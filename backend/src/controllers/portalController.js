/**
 * portalController.js
 *
 * Links a UniHub user to their student portal account and syncs portal data
 * (timetable, grades, assignments) into the app's own tables.
 *
 * Endpoints (all require app auth — see routes/portal.js):
 *   GET    /api/portal-link/status      – is this user linked to the portal?
 *   POST   /api/portal-link/connect     – { username, password } link the account
 *   POST   /api/portal-link/disconnect  – remove the link
 *   POST   /api/portal-link/sync        – pull portal data into the app
 *
 * Requires the portal_links table and the `source` columns added by
 * backend/database/migrations/001_portal_link.sql.
 */

const db     = require('../config/db');
const portal = require('../utils/portalClient');

// ── GET /status ───────────────────────────────────────────────────────────────
async function status(req, res) {
  try {
    const [[row]] = await db.query(
      'SELECT portal_username, connected_at FROM portal_links WHERE user_id = ?',
      [req.user.id]
    );
    return res.json({
      success: true,
      connected: !!row,
      portal_username: row?.portal_username || null,
      connected_at:    row?.connected_at || null,
      portal_url:      portal.PORTAL_URL,
    });
  } catch (err) {
    console.error('portal status error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /connect ─────────────────────────────────────────────────────────────
async function connect(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Portal ID and password are required' });
    }

    let login;
    try {
      login = await portal.portalLogin(username, password);
    } catch (e) {
      return res.status(401).json({ success: false, message: e.message || 'Invalid portal credentials' });
    }

    await db.query(
      `INSERT INTO portal_links (user_id, portal_username, portal_token, connected_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         portal_username = VALUES(portal_username),
         portal_token    = VALUES(portal_token),
         connected_at    = NOW()`,
      [req.user.id, login.student.student_id, login.token]
    );

    return res.json({
      success: true,
      message: 'Student portal connected',
      portal_student: login.student,
    });
  } catch (err) {
    console.error('portal connect error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /disconnect ──────────────────────────────────────────────────────────
async function disconnect(req, res) {
  try {
    await db.query('DELETE FROM portal_links WHERE user_id = ?', [req.user.id]);
    return res.json({ success: true, message: 'Student portal disconnected' });
  } catch (err) {
    console.error('portal disconnect error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

async function getStoredToken(userId) {
  const [[row]] = await db.query(
    'SELECT portal_token FROM portal_links WHERE user_id = ?',
    [userId]
  );
  return row?.portal_token || null;
}

// ── POST /sync ────────────────────────────────────────────────────────────────
// Pulls timetable, grades and assignments from the portal and upserts them into
// the app's tables, replacing any previously portal-sourced rows.
async function sync(req, res) {
  const userId = req.user.id;
  try {
    const token = await getStoredToken(userId);
    if (!token) {
      return res.status(400).json({ success: false, message: 'Portal not connected', needsConnect: true });
    }

    let timetable, grades, assignments;
    try {
      [timetable, grades, assignments] = await Promise.all([
        portal.getTimetable(token),
        portal.getGrades(token),
        portal.getAssignments(token),
      ]);
    } catch (e) {
      if (e.code === 'PORTAL_AUTH') {
        // Stored token no longer valid — force a reconnect.
        await db.query('DELETE FROM portal_links WHERE user_id = ?', [userId]);
        return res.status(401).json({
          success: false, needsConnect: true,
          message: 'Portal session expired — please reconnect your portal account',
        });
      }
      throw e;
    }

    const result = { timetable: 0, grades: 0, assignments: 0 };

    // ── Timetable → timetable_slots ──
    // The portal timetable replaces the whole timetable (earlier portal syncs and
    // PDF uploads alike), matching PDF upload, so only the latest import shows.
    // Skipped if the portal returned no classes, so a glitch can't wipe it.
    const portalSlots = timetable.slots || [];
    if (portalSlots.length) {
      await db.query('DELETE FROM timetable_slots WHERE user_id = ?', [userId]);
    }
    const slotRows = portalSlots.map((s, i) => [
      userId, s.course_name, s.course_code || null, s.day_of_week,
      s.start_time, s.end_time, s.venue || null, s.lecturer || null,
      s.slot_type || 'lecture', s.color_index ?? (i % 6), 'portal',
    ]);
    if (slotRows.length) {
      await db.query(
        `INSERT INTO timetable_slots
           (user_id, course_name, course_code, day_of_week, start_time, end_time,
            venue, lecturer, slot_type, color_index, source)
         VALUES ?`,
        [slotRows]
      );
      result.timetable = slotRows.length;
    }

    // ── Grades → gpa_courses + gpa_assessments (replace portal-sourced) ──
    await db.query('DELETE FROM gpa_courses WHERE user_id = ? AND source = ?', [userId, 'portal']);
    for (const c of (grades.courses || [])) {
      const [r] = await db.query(
        `INSERT INTO gpa_courses (user_id, course_code, course_name, credit_hours, semester, source)
         VALUES (?, ?, ?, ?, ?, 'portal')`,
        [userId, c.course_code || null, c.course_name, c.credit_hours || 3, c.semester || null]
      );
      const courseId = r.insertId;
      const aRows = (c.assessments || []).map((a) => [
        courseId, userId, a.name, a.weight, a.score ?? null, a.max_score ?? 100,
      ]);
      if (aRows.length) {
        await db.query(
          `INSERT INTO gpa_assessments (gpa_course_id, user_id, name, weight, score, max_score)
           VALUES ?`,
          [aRows]
        );
      }
      result.grades++;
    }

    // ── Assignments → tasks (upsert by moodle_id, like Moodle sync) ──
    // The portal is the source of truth for synced tasks: drop any synced task
    // (including old demo Moodle ones) that isn't in this sync. Manual tasks stay.
    const portalTasks = assignments.assignments || [];
    const keepIds = portalTasks.map(a => `portal_${a.id}`);
    await db.query(
      `DELETE FROM tasks WHERE user_id = ? AND source = 'moodle'
         AND moodle_id NOT IN (?)`,
      [userId, keepIds.length ? keepIds : ['']]
    );

    for (const a of portalTasks) {
      const moodleId = `portal_${a.id}`;
      const [existing] = await db.query(
        'SELECT id FROM tasks WHERE user_id = ? AND moodle_id = ?',
        [userId, moodleId]
      );
      if (existing.length === 0) {
        await db.query(
          `INSERT INTO tasks
             (user_id, title, course, course_code, task_type, priority,
              due_date, notes, source, moodle_id, moodle_synced_at)
           VALUES (?, ?, ?, ?, 'assignment', 'Med', ?, ?, 'moodle', ?, NOW())`,
          [userId, a.title, a.course, a.course_code, a.due_date, a.description || null, moodleId]
        );
      } else {
        await db.query(
          `UPDATE tasks
             SET title=?, course=?, course_code=?, due_date=?, notes=?, moodle_synced_at=NOW()
           WHERE user_id=? AND moodle_id=?`,
          [a.title, a.course, a.course_code, a.due_date, a.description || null, userId, moodleId]
        );
      }
      result.assignments++;
    }

    return res.json({
      success: true,
      message: `Synced ${result.timetable} classes, ${result.grades} courses, ${result.assignments} assignments`,
      synced: result,
    });
  } catch (err) {
    console.error('portal sync error:', err);
    return res.status(500).json({ success: false, message: 'Sync failed' });
  }
}

module.exports = { status, connect, disconnect, sync };
