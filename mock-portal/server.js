/**
 * server.js — UniKL VLE mock learning portal (development only).
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
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { STUDENT, CATALOG, courseOverview, moodleAssignments } = require('./data');
const store = require('./store');
const lecturers = require('./lecturers');

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
        sitename: 'UniKL VLE Mock Portal',
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

// ══════════════════════════════════════════════════════════════════════════════
// Lecturer area — course materials: CLP, slide notes, sheets, links (UI: /lecturer.html)
// ══════════════════════════════════════════════════════════════════════════════

const LECTURER_SESSIONS = new Map(); // token -> lecturer record (dev only; cleared on restart)

function sessionLecturer(req) {
  const token = bearer(req);
  return token ? LECTURER_SESSIONS.get(token) || null : null;
}

const courseName = (code) => (CATALOG.find(c => c.code === code) || {}).name || code;

// For testing, any lecturer can post to every course in the catalog. The courses
// they actually teach come first and are flagged, so the page still reads naturally.
function lecturerCourses(lecturer) {
  const own = lecturer.courses.map(code => ({ code, name: courseName(code), teaches: true }));
  const rest = CATALOG.filter(c => !lecturer.courses.includes(c.code))
    .map(c => ({ code: c.code, name: c.name, teaches: false }));
  return [...own, ...rest];
}
const canPostTo = (lecturer, code) => lecturerCourses(lecturer).some(c => c.code === code);

// Allowed uploads: PDF, PowerPoint, Word and Excel, max 25 MB. Saved under
// uploads/learning-plans/ with a random name that keeps the real extension.
const FILE_TYPES = {
  '.pdf':  'application/pdf',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.ppt':  'application/vnd.ms-powerpoint',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc':  'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
  '.xls':  'application/vnd.ms-excel',
  '.csv':  'text/csv',
};
const ALLOWED_LABEL = 'PDF, PowerPoint, Word or Excel';
const fileExt = (name) => (String(name).toLowerCase().match(/\.(pdf|pptx|ppt|docx|doc|xlsx|xlsm|xls|csv)$/) || [])[0] || null;

const materialUpload = multer({
  storage: multer.diskStorage({
    destination: lecturers.UPLOAD_DIR,
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${fileExt(file.originalname)}`),
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = !!fileExt(file.originalname);
    cb(ok ? null : Object.assign(new Error(`Only ${ALLOWED_LABEL} files are allowed`), { code: 'BAD_TYPE' }), ok);
  },
}).single('file');

// PDFs open in the browser; other files download with their original name.
function sendMaterialFile(res, m) {
  const ext = fileExt(m.stored_name) || '.pdf';
  const disposition = ext === '.pdf' ? 'inline' : 'attachment';
  res.type(FILE_TYPES[ext]).sendFile(lecturers.filePath(m), {
    headers: { 'Content-Disposition': `${disposition}; filename*=UTF-8''${encodeURIComponent(m.original_name)}` },
  });
}

// POST /api/lecturer/login  { username, password }  (staff ID or email)
app.post('/api/lecturer/login', (req, res) => {
  const { username, password } = req.body || {};
  const lecturer = lecturers.authenticate(username, password);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Invalid staff ID or password' });
  const token = 'lect-' + crypto.randomBytes(16).toString('hex');
  LECTURER_SESSIONS.set(token, lecturer);
  console.log(`[mock-portal] lecturer login OK: ${lecturer.staff_id}`);
  res.json({ success: true, token, lecturer: lecturers.publicLecturer(lecturer) });
});

app.get('/api/lecturer/me', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({
    success: true,
    lecturer: lecturers.publicLecturer(lecturer),
    courses: lecturerCourses(lecturer),
    kinds: lecturers.KINDS,
    sections: lecturers.SECTIONS,
  });
});

app.post('/api/lecturer/logout', (req, res) => {
  const token = bearer(req);
  if (token) LECTURER_SESSIONS.delete(token);
  res.json({ success: true });
});

// The signed-in lecturer's materials, across all their courses.
app.get('/api/lecturer/materials', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });
  res.json({ success: true, materials: lecturers.materialsByLecturer(lecturer.staff_id) });
});

// POST /api/lecturer/materials  multipart:
//   course_code, section, kind, title, notes?  +  file (any kind except link)  or  url (kind=link)
app.post('/api/lecturer/materials', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });

  materialUpload(req, res, (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 25 MB)' : err.message;
      return res.status(400).json({ success: false, message });
    }
    const discard = () => { if (req.file) try { fs.unlinkSync(req.file.path); } catch {} };
    const fail = (code, message) => { discard(); return res.status(code).json({ success: false, message }); };

    const { course_code, section, kind, title, notes, url } = req.body || {};
    if (!lecturers.KINDS[kind]) return fail(400, 'Choose what type of material this is');
    if (!lecturers.SECTIONS.includes(section)) return fail(400, 'Choose a section (General or a week)');
    if (!String(title || '').trim()) return fail(400, 'A title is required');
    if (!canPostTo(lecturer, course_code)) return fail(400, 'Choose a course from the list');

    let link = null;
    if (kind === 'link') {
      link = String(url || '').trim();
      if (!/^https?:\/\/\S+$/i.test(link)) return fail(400, 'Enter a full link starting with http:// or https://');
      discard();   // links don't carry a file
    } else if (!req.file) {
      return fail(400, `Choose a ${ALLOWED_LABEL} file to upload`);
    }

    const m = lecturers.addMaterial({
      lecturer, course_code, course_name: courseName(course_code),
      section, kind, title: String(title).trim().slice(0, 150),
      notes: String(notes || '').trim().slice(0, 500),
      file: kind === 'link' ? null : req.file, url: link,
    });
    console.log(`[mock-portal] material posted: ${m.course_code} ${m.section} ${m.kind} by ${lecturer.staff_id}`);
    res.status(201).json({ success: true, material: m });
  });
});

// View/download a material's file (lecturer: own materials only).
app.get('/api/lecturer/materials/:id/file', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });
  const m = lecturers.materialById(req.params.id);
  if (!m || m.lecturer_id !== lecturer.staff_id || !m.stored_name) return res.status(404).json({ success: false, message: 'File not found' });
  sendMaterialFile(res, m);
});

// PATCH /api/lecturer/materials/:id  { title }  — rename (lecturer: own materials only)
app.patch('/api/lecturer/materials/:id', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });
  const m = lecturers.materialById(req.params.id);
  if (!m || m.lecturer_id !== lecturer.staff_id) return res.status(404).json({ success: false, message: 'Material not found' });
  const title = String((req.body || {}).title || '').trim().slice(0, 150);
  if (!title) return res.status(400).json({ success: false, message: 'A title is required' });
  res.json({ success: true, material: lecturers.renameMaterial(m.id, title) });
});

app.delete('/api/lecturer/materials/:id', (req, res) => {
  const lecturer = sessionLecturer(req);
  if (!lecturer) return res.status(401).json({ success: false, message: 'Not logged in' });
  const m = lecturers.materialById(req.params.id);
  if (!m || m.lecturer_id !== lecturer.staff_id) return res.status(404).json({ success: false, message: 'Material not found' });
  lecturers.deleteMaterial(m.id);
  res.json({ success: true });
});

// ── Student side: course content for the courses the student is enrolled in ───
const enrolledCodes = (student) => (student.data.courseCards || []).map(c => c.code);

app.get('/api/portal/courses/:code/materials', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  if (!enrolledCodes(student).includes(req.params.code)) {
    return res.status(404).json({ success: false, message: 'You are not enrolled in this course' });
  }
  res.json({ success: true, materials: lecturers.materialsForCourse(req.params.code) });
});

app.get('/api/portal/materials/:id/file', (req, res) => {
  const student = sessionStudent(req);
  if (!student) return res.status(401).json({ success: false, message: 'Not logged in' });
  const m = lecturers.materialById(req.params.id);
  if (!m || !m.stored_name || !enrolledCodes(student).includes(m.course_code)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }
  sendMaterialFile(res, m);
});

// ── Health + index ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ ok: true, service: 'unikl-vle-mock-portal' }));

app.get('/info', (_req, res) => {
  res.type('text/plain').send(
    [
      'UniKL VLE Mock Portal (development only — not the real UniKL portal)',
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
  console.log(`\n  UniKL VLE MOCK portal running at http://localhost:${PORT}`);
  console.log(`  (development fake — not the real UniKL portal)\n`);
  if (REQUIRED_TOKEN) console.log(`  Token required: ${REQUIRED_TOKEN}\n`);
});
