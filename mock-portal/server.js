/**
 * server.js — UniHub mock learning portal (development only).
 *
 * This is a LOCAL FAKE of the UniKL/Moodle portal. It returns invented student
 * data so you can build and test UniHub's sync feature without live portal
 * access. It is not affiliated with UniKL and must never be presented as the
 * real portal or used to collect anyone's real credentials.
 *
 * It speaks the real Moodle Web Services REST protocol for assignments, so the
 * existing backend (backend/src/utils/moodleClient.js) talks to it unchanged —
 * just point MOODLE_URL at this server.
 *
 * Run:   npm install && npm start   (from the mock-portal/ folder)
 * Then:  set MOODLE_URL=http://localhost:4000 and MOODLE_TOKEN=dev-token
 *        in backend/.env, restart the backend, and hit "Sync Moodle" in the app.
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { STUDENT, courseOverview, moodleAssignments } = require('./data');
const store = require('./store');

// In-memory session tokens issued at login (dev only; cleared on restart).
// Accounts themselves are persisted by store.js — only live sessions are here.
const SESSIONS = new Map(); // token -> student_id

const app = express();
const PORT = process.env.MOCK_PORT || 4000;

// Any token is accepted (dev only). Set MOCK_TOKEN to require a specific one.
const REQUIRED_TOKEN = process.env.MOCK_TOKEN || null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the styled portal UI from public/ (index.html at "/").
app.use(express.static(path.join(__dirname, 'public')));

// Simple request log so you can see your app hitting the mock.
app.use((req, _res, next) => {
  const fn = req.query.wsfunction ? ` wsfunction=${req.query.wsfunction}` : '';
  console.log(`[mock-portal] ${req.method} ${req.path}${fn}`);
  next();
});

function tokenOk(req) {
  if (!REQUIRED_TOKEN) return true;
  const token = req.query.wstoken || req.body.wstoken || req.get('Authorization');
  return token === REQUIRED_TOKEN || token === `Bearer ${REQUIRED_TOKEN}`;
}

// Extract a bearer token from the Authorization header.
function bearer(req) {
  const h = req.get('Authorization') || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// Resolve the logged-in student RECORD for a request, or null if not authed.
// Sessions store the student_id, so we always read the latest stored data.
function sessionStudent(req) {
  const token = bearer(req);
  if (!token) return null;
  const sid = SESSIONS.get(token);
  return sid ? store.byUsername(sid) : null;
}

function newSession(student) {
  const token = 'sess-' + crypto.randomBytes(16).toString('hex');
  SESSIONS.set(token, student.student_id);
  return token;
}

// Moodle returns errors as a 200 with an "exception" field — mirror that.
function moodleError(res, message) {
  return res.json({
    exception: 'webservice_access_exception',
    errorcode: 'accessexception',
    message,
  });
}

// ── Real Moodle Web Services REST endpoint ────────────────────────────────────
// GET/POST /webservice/rest/server.php?wstoken=..&wsfunction=..&moodlewsrestformat=json
app.all('/webservice/rest/server.php', (req, res) => {
  const wsfunction = req.query.wsfunction || req.body.wsfunction;

  if (!tokenOk(req)) return moodleError(res, 'Invalid token - token not found');

  switch (wsfunction) {
    case 'mod_assign_get_assignments':
      // Exact shape backend/src/utils/moodleClient.js expects to flatten.
      return res.json(moodleAssignments());

    case 'core_webservice_get_site_info':
      return res.json({
        sitename: 'UniHub Mock Portal',
        username: STUDENT.student_id,
        fullname: STUDENT.fullname,
        userid: STUDENT.id,
      });

    default:
      return moodleError(res, `Unknown or unsupported wsfunction: ${wsfunction}`);
  }
});

// ── Convenience REST endpoints (friendlier shapes for the app's other modules) ─
// These are NOT standard Moodle; they match UniHub's own DB tables so you can
// wire schedule/GPA sync the same way Moodle sync works for tasks.

// ── Student registration ──────────────────────────────────────────────────────
// POST /api/portal/register  { fullname, student_id, email, password, programme? }
app.post('/api/portal/register', (req, res) => {
  const { fullname, student_id, email, password, programme } = req.body || {};
  if (!fullname || !student_id || !email || !password) {
    return res.status(400).json({ success: false, message: 'Full name, Student ID, email and password are required' });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }
  if (!/^\S+@\S+\.\S+$/.test(String(email))) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
  }
  let student;
  try {
    student = store.create({ fullname, student_id, email, password, programme });
  } catch (e) {
    if (e.code === 'DUP') return res.status(409).json({ success: false, message: e.message });
    console.error('register error:', e);
    return res.status(500).json({ success: false, message: 'Could not create account' });
  }
  const token = newSession(student);
  console.log(`[mock-portal] registered: ${student.student_id} (${store.count()} accounts)`);
  return res.status(201).json({ success: true, token, student: store.publicProfile(student) });
});

// ── Student login (persisted accounts from store.js) ──────────────────────────
// POST /api/portal/login  { username, password } -> { success, token, student }
app.post('/api/portal/login', (req, res) => {
  const { username, password } = req.body || {};
  const student = store.authenticate(username, password);
  if (!student) {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
  const token = newSession(student);
  console.log(`[mock-portal] login OK: ${student.student_id}`);
  return res.json({ success: true, token, student: store.publicProfile(student) });
});

// Who is this session? (used by the UI to restore state on refresh)
app.get('/api/portal/me', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({ success: true, student: store.publicProfile(student) });
});

app.post('/api/portal/logout', (req, res) => {
  const token = bearer(req);
  if (token) SESSIONS.delete(token);
  res.json({ success: true });
});

app.get('/api/portal/profile', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({ success: true, student: store.publicProfile(student) });
});

// Course overview + summary stats → feeds the dashboard cards and stat tiles.
app.get('/api/portal/courses', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({ success: true, ...courseOverview(student.data.courseCards) });
});

// Timetable → maps to timetable_slots
app.get('/api/portal/timetable', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({
    success: true,
    semester: student.semester,
    slots: student.data.timetable,
  });
});

// Assignments → flattened list for the portal UI (frontend convenience).
app.get('/api/portal/assignments', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  const assignments = [...student.data.assignments].sort((x, y) => x.due_date.localeCompare(y.due_date));
  res.json({ success: true, assignments });
});

// Grades → maps to gpa_courses + gpa_assessments, with a computed percentage.
app.get('/api/portal/grades', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });

  const courses = student.data.grades.map((c) => {
    const totalPct = c.assessments.reduce(
      (sum, a) => sum + (a.score / a.max_score) * a.weight,
      0
    );
    return {
      course_code: c.course_code,
      course_name: c.course_name,
      credit_hours: c.credit_hours,
      semester: student.semester,
      assessments: c.assessments,
      total_percentage: Math.round(totalPct * 100) / 100,
    };
  });

  res.json({ success: true, courses });
});

// ── Health + index ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, service: 'unihub-mock-portal' }));

app.get('/info', (_req, res) => {
  res.type('text/plain').send(
    [
      'UniHub Mock Portal (development only — not the real UniKL portal)',
      '',
      'Moodle REST:',
      `  /webservice/rest/server.php?wstoken=dev-token&wsfunction=mod_assign_get_assignments&moodlewsrestformat=json`,
      '',
      'Convenience REST:',
      '  GET /api/portal/profile',
      '  GET /api/portal/timetable',
      '  GET /api/portal/grades',
      '  GET /health',
    ].join('\n')
  );
});

app.listen(PORT, () => {
  console.log(`\n  UniHub MOCK portal running at http://localhost:${PORT}`);
  console.log(`  (development fake — not the real UniKL portal)\n`);
  if (REQUIRED_TOKEN) console.log(`  Token required: ${REQUIRED_TOKEN}\n`);
});
