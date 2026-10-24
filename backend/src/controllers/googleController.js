/**
 * googleController.js
 *
 * Links a UniHub user to their Google account and pushes their timetable,
 * open tasks and saved academic dates into a "UniHub" calendar there.
 *
 * Endpoints (see routes/google.js):
 *   GET  /api/google/status      – is this user connected?            (app auth)
 *   POST /api/google/auth-url    – { returnUrl } → Google consent URL  (app auth)
 *   GET  /api/google/callback    – Google redirects here after consent (public)
 *   POST /api/google/sync        – push UniHub data to Google Calendar (app auth)
 *   POST /api/google/disconnect  – revoke access and remove the link   (app auth)
 *
 * Sync is one-way (UniHub → Google). Each UniHub row maps to a fixed Google
 * event ID (uhslot12, uhtask34, uhevt56), so re-syncing updates events in place
 * and removes ones whose task was finished or deleted.
 *
 * Requires the google_links table from backend/database/migrations/002_google_calendar.sql.
 */

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const google = require('../utils/googleCalendar');

const SEMESTER_WEEKS = 14;   // how many weeks each weekly class repeats for
const RETURN_URL_RE  = /^(exps?|unihub):\/\//;

const notConfigured = (res) => res.status(503).json({
  success: false,
  message: 'Google Calendar is not set up on the server. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI to backend/.env.',
});

// ── GET /status ───────────────────────────────────────────────────────────────
async function status(req, res) {
  try {
    const [[row]] = await db.query(
      'SELECT google_email, connected_at, last_synced_at FROM google_links WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({
      success: true,
      configured:     google.isConfigured(),
      connected:      !!row,
      google_email:   row?.google_email || null,
      connected_at:   row?.connected_at || null,
      last_synced_at: row?.last_synced_at || null,
    });
  } catch (err) {
    console.error('google status error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /auth-url ────────────────────────────────────────────────────────────
// The app opens this URL in the browser. `state` carries who is connecting and
// where to send them back, signed so the public callback can trust it.
async function authUrl(req, res) {
  if (!google.isConfigured()) return notConfigured(res);
  const { returnUrl } = req.body || {};
  if (returnUrl && !RETURN_URL_RE.test(returnUrl)) {
    return res.status(400).json({ success: false, message: 'Invalid returnUrl' });
  }
  const state = jwt.sign(
    { uid: req.user.id, purpose: 'google-oauth', returnUrl: returnUrl || null },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
  return res.json({ success: true, url: google.buildAuthUrl(state) });
}

// ── GET /callback ─────────────────────────────────────────────────────────────
async function callback(req, res) {
  let state;
  try {
    state = jwt.verify(String(req.query.state || ''), process.env.JWT_SECRET);
    if (state.purpose !== 'google-oauth') throw new Error('wrong purpose');
  } catch {
    return sendPage(res, 400, 'Link expired', 'Please go back to UniHub and tap Connect again.', null);
  }

  if (req.query.error) {
    const msg = req.query.error === 'access_denied'
      ? 'You cancelled the Google sign-in. Nothing was connected.'
      : `Google returned an error: ${req.query.error}`;
    return sendPage(res, 400, 'Not connected', msg, state.returnUrl, 'cancelled');
  }

  try {
    const tokens = await google.exchangeCode(String(req.query.code || ''));
    if (!tokens.refresh_token) throw new Error('Google did not return a refresh token');
    if (!tokens.calendarGranted) {
      await google.revoke(tokens.refresh_token);
      return sendPage(res, 400, 'Calendar permission needed',
        'UniHub needs permission to manage its own calendar. Go back to UniHub, tap Connect again, and tick the calendar box on the Google permission screen.',
        state.returnUrl, 'cancelled');
    }

    // calendar_id is assigned before google_email, so it still compares the old
    // email: keep the calendar for the same account, reset it for a different one.
    await db.query(
      `INSERT INTO google_links (user_id, google_email, refresh_token, connected_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         calendar_id   = IF(google_email <=> VALUES(google_email), calendar_id, NULL),
         google_email  = VALUES(google_email),
         refresh_token = VALUES(refresh_token),
         connected_at  = NOW()`,
      [state.uid, tokens.email, google.encrypt(tokens.refresh_token)]
    );

    // The app runs the first sync when the student returns to it (it sees last_synced_at is empty).
    return sendPage(res, 200, 'Google Calendar connected',
      `Signed in as ${tokens.email || 'your Google account'}. Go back to UniHub to add your classes and deadlines to the "UniHub" calendar.`,
      state.returnUrl, 'connected');
  } catch (err) {
    console.error('google callback error:', err);
    return sendPage(res, 500, 'Could not connect', 'Something went wrong talking to Google. Please try again.', state.returnUrl, 'error');
  }
}

// ── POST /sync ────────────────────────────────────────────────────────────────
async function sync(req, res) {
  if (!google.isConfigured()) return notConfigured(res);
  try {
    const result = await syncUser(req.user.id);
    return res.json({
      success: true,
      message: `Synced ${result.classes} classes, ${result.tasks} tasks and ${result.events} academic dates to Google Calendar`,
      synced: result,
    });
  } catch (err) {
    if (err.code === 'NOT_CONNECTED') {
      return res.status(400).json({ success: false, needsConnect: true, message: 'Google Calendar not connected' });
    }
    if (err.code === 'GOOGLE_AUTH') {
      await db.query('DELETE FROM google_links WHERE user_id = ?', [req.user.id]);
      return res.status(401).json({
        success: false, needsConnect: true,
        message: 'Google access was removed or expired — please reconnect Google Calendar',
      });
    }
    if (err.code === 'GOOGLE_SCOPE') {
      await db.query('DELETE FROM google_links WHERE user_id = ?', [req.user.id]);
      return res.status(403).json({
        success: false, needsConnect: true,
        message: 'Calendar permission was not granted. Tap Connect again and tick the calendar box on the Google permission screen.',
      });
    }
    console.error('google sync error:', err);
    return res.status(500).json({ success: false, message: 'Google Calendar sync failed' });
  }
}

// ── POST /disconnect ──────────────────────────────────────────────────────────
// Deletes the "UniHub" calendar from the student's Google account, then revokes access.
// The student's own calendars are never touched (the scope only covers calendars UniHub created).
async function disconnect(req, res) {
  try {
    const [[row]] = await db.query('SELECT refresh_token, calendar_id FROM google_links WHERE user_id = ?', [req.user.id]);
    let calendarRemoved = false;
    if (row) {
      const refreshToken = google.decrypt(row.refresh_token);
      if (row.calendar_id) {
        try {
          const token = await google.getAccessToken(refreshToken);
          await google.deleteCalendar(token, row.calendar_id);
          calendarRemoved = true;
        } catch (e) {
          // Already deleted by the student, or access already gone — nothing left to clean up here
          if (e.status === 404 || e.status === 410) calendarRemoved = true;
          else console.warn('google disconnect: could not delete UniHub calendar:', e.message);
        }
      }
      try { await google.revoke(refreshToken); } catch {}
      await db.query('DELETE FROM google_links WHERE user_id = ?', [req.user.id]);
    }
    return res.json({
      success: true,
      calendarRemoved,
      message: calendarRemoved || !row?.calendar_id
        ? 'Google Calendar disconnected and the UniHub calendar was removed'
        : 'Google Calendar disconnected, but the UniHub calendar could not be removed — you can delete it in Google Calendar',
    });
  } catch (err) {
    console.error('google disconnect error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── Sync engine ───────────────────────────────────────────────────────────────
async function syncUser(userId) {
  const [[link]] = await db.query('SELECT * FROM google_links WHERE user_id = ?', [userId]);
  if (!link) throw Object.assign(new Error('Not connected'), { code: 'NOT_CONNECTED' });

  const token = await google.getAccessToken(google.decrypt(link.refresh_token));

  let calendarId = link.calendar_id;
  let existing   = [];
  if (calendarId) {
    try {
      existing = await google.listEvents(token, calendarId);
    } catch (e) {
      if (e.status !== 404) throw e;
      calendarId = null;   // student deleted the UniHub calendar — make a new one
    }
  }
  if (!calendarId) {
    calendarId = await google.createCalendar(token);
    await db.query('UPDATE google_links SET calendar_id = ? WHERE user_id = ?', [calendarId, userId]);
  }

  const { desired, counts } = await buildEvents(userId);
  const existingById = new Map(existing.map(e => [e.id, e]));

  for (const [id, ev] of desired) {
    const current = existingById.get(id);
    if (!current) {
      try {
        await google.insertEvent(token, calendarId, { id, ...ev });
      } catch (e) {
        if (e.status !== 409) throw e;   // ID already taken (e.g. a concurrent sync) — update instead
        await google.updateEvent(token, calendarId, id, ev);
      }
    } else if (current.status === 'cancelled' || current.extendedProperties?.private?.uhHash !== ev.extendedProperties.private.uhHash) {
      await google.updateEvent(token, calendarId, id, ev);
    }
  }

  for (const e of existing) {
    if (e.status !== 'cancelled' && !desired.has(e.id)) {
      try { await google.deleteEvent(token, calendarId, e.id); }
      catch (err) { if (err.status !== 404 && err.status !== 410) throw err; }
    }
  }

  await db.query('UPDATE google_links SET last_synced_at = NOW() WHERE user_id = ?', [userId]);
  return counts;
}

async function buildEvents(userId) {
  const tz = google.TIME_ZONE;
  const desired = new Map();
  const add = (id, ev) => {
    const uhHash = crypto.createHash('sha1').update(JSON.stringify(ev)).digest('hex');
    desired.set(id, { ...ev, extendedProperties: { private: { uhHash } } });
  };

  // Weekly classes → recurring events, starting the week the slot was added.
  const [slots] = await db.query(
    `SELECT id, course_name, course_code, day_of_week, start_time, end_time, venue, lecturer, slot_type,
            DATE_FORMAT(created_at, '%Y-%m-%d') AS added_on
     FROM timetable_slots WHERE user_id = ?`,
    [userId]
  );
  for (const s of slots) {
    const date = weekdayInWeekOf(s.added_on, s.day_of_week);
    add(`uhslot${s.id}`, {
      summary:     s.course_code ? `${s.course_code} · ${s.course_name}` : s.course_name,
      location:    s.venue || undefined,
      description: lines([s.slot_type && `Type: ${s.slot_type}`, s.lecturer && `Lecturer: ${s.lecturer}`, 'From UniHub timetable']),
      start:       { dateTime: `${date}T${s.start_time}`, timeZone: tz },
      end:         { dateTime: `${date}T${s.end_time}`,   timeZone: tz },
      recurrence:  [`RRULE:FREQ=WEEKLY;COUNT=${SEMESTER_WEEKS}`],
      colorId:     '9',
    });
  }

  // Open tasks with a due date → all-day events. Finished tasks drop off the calendar.
  const [tasks] = await db.query(
    `SELECT id, title, course, course_code, task_type, priority, notes,
            DATE_FORMAT(due_date, '%Y-%m-%d') AS due
     FROM tasks WHERE user_id = ? AND is_done = 0 AND due_date IS NOT NULL`,
    [userId]
  );
  const PRIORITY_COLOR = { High: '11', Med: '5', Low: '10' };
  for (const t of tasks) {
    add(`uhtask${t.id}`, {
      summary:     `📌 ${t.title}${t.course_code ? ` (${t.course_code})` : ''}`,
      description: lines([t.course && `Course: ${t.course}`, `Priority: ${t.priority}`, t.task_type && `Type: ${t.task_type}`, t.notes, 'From UniHub tasks']),
      start:       { date: t.due },
      end:         { date: addDays(t.due, 1) },
      colorId:     PRIORITY_COLOR[t.priority] || '5',
    });
  }

  // Academic-calendar dates the student saved from a PDF → all-day events.
  const [events] = await db.query(
    `SELECT id, title, event_type, description, DATE_FORMAT(event_date, '%Y-%m-%d') AS day
     FROM schedule_events WHERE user_id = ? AND saved_to_schedule = 1 AND event_date IS NOT NULL`,
    [userId]
  );
  for (const e of events) {
    add(`uhevt${e.id}`, {
      summary:     `🎓 ${e.title}`,
      description: lines([e.event_type && `Type: ${e.event_type}`, e.description, 'From UniHub academic calendar']),
      start:       { date: e.day },
      end:         { date: addDays(e.day, 1) },
      colorId:     e.event_type === 'exam' ? '11' : '7',
    });
  }

  return { desired, counts: { classes: slots.length, tasks: tasks.length, events: events.length } };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const lines = (parts) => parts.filter(Boolean).join('\n');

function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Date of `dayOfWeek` (0=Sun … 6=Sat) in the Monday-to-Sunday week containing `ymd`.
function weekdayInWeekOf(ymd, dayOfWeek) {
  const d = new Date(`${ymd}T00:00:00Z`);
  const mondayBased = (n) => (n + 6) % 7;
  return addDays(ymd, mondayBased(dayOfWeek) - mondayBased(d.getUTCDay()));
}

const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Small page shown in the phone's browser after Google sign-in, with a way back to the app.
function sendPage(res, code, title, message, returnUrl, result) {
  const back = returnUrl ? `${returnUrl}${returnUrl.includes('?') ? '&' : '?'}google=${result}` : null;
  res.status(code).type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${back ? `<meta http-equiv="refresh" content="1;url=${esc(back)}">` : ''}
<title>UniHub · ${esc(title)}</title></head>
<body style="margin:0;background:#0d0f14;color:#e8eaf0;font-family:system-ui,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:360px;padding:28px;text-align:center">
<h1 style="font-size:20px;margin:0 0 10px">${esc(title)}</h1>
<p style="color:#8a90a2;line-height:1.5;margin:0 0 24px">${esc(message)}</p>
${back ? `<a href="${esc(back)}" style="display:inline-block;background:#4f8ef7;color:#fff;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:12px">Return to UniHub</a>`
       : '<p style="color:#8a90a2">You can close this page and go back to UniHub.</p>'}
</div></body></html>`);
}

module.exports = { status, authUrl, callback, sync, disconnect, syncUser };
