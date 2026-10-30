/**
 * lecturers.js — lecturer accounts + course materials store for the mock portal.
 *
 * Lecturers sign in on /lecturer.html and post course materials for the courses
 * they teach: Course Learning Plans (CLP), slide notes, tutorial/lab sheets,
 * other documents, and links (e.g. WhatsApp group, lecture recordings). Each item
 * sits in a section — "General" or "Week 1"…"Week 14" — like a VLE course page.
 *
 * Item details are saved to course-materials.json and uploaded files to
 * uploads/learning-plans/, so they survive server restarts.
 *
 * Accounts and data are INVENTED for development/testing — no real staff are
 * represented. Demo login: staff ID L1001 / lecturer123.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const MATERIALS_FILE = path.join(__dirname, 'course-materials.json');
const LEGACY_FILE    = path.join(__dirname, 'learning-plans.json');   // older CLP-only store
const UPLOAD_DIR     = path.join(__dirname, 'uploads', 'learning-plans');

const KINDS = {
  clp:      'Course Learning Plan',
  slides:   'Slide Notes',
  tutorial: 'Tutorial / Lab Sheet',
  other:    'Document',
  link:     'Link',
};

const WEEKS = 14;
const SECTIONS = ['general', ...Array.from({ length: WEEKS }, (_, i) => `week-${i + 1}`)];
const sectionRank = (s) => (s === 'general' ? 0 : Number(String(s).replace('week-', '')) || 99);

// Demo lecturer accounts. Course codes match the CATALOG in data.js.
const ACCOUNTS = [
  { staff_id: 'L1001', name: 'Dr. Aminah', email: 'aminah@lecturer.mock', password: 'lecturer123',
    courses: ['IPB49906', 'IDB30303', 'IDB30102'] },
  { staff_id: 'L1002', name: 'Mr. Faisal', email: 'faisal@lecturer.mock', password: 'lecturer123',
    courses: ['IPB49804', 'ISB46103'] },
  { staff_id: 'L1003', name: 'Dr. Lim',    email: 'lim@lecturer.mock',    password: 'lecturer123',
    courses: ['ISB38104', 'ISB37804', 'ISB35303'] },
];

// Passwords are hashed in memory at startup so they're never compared in plain text.
function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `${salt}:${crypto.scryptSync(String(pw), salt, 64).toString('hex')}`;
}
function verifyPw(pw, stored) {
  try {
    const [salt, h] = String(stored).split(':');
    const hh = crypto.scryptSync(String(pw), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hh, 'hex'));
  } catch { return false; }
}

const lecturers = ACCOUNTS.map(({ password, ...rest }) => ({ ...rest, passwordHash: hashPw(password) }));

function byLogin(u) {
  const key = String(u || '').trim().toLowerCase();
  return lecturers.find(l => l.staff_id.toLowerCase() === key || l.email.toLowerCase() === key) || null;
}

function authenticate(username, password) {
  const l = byLogin(username);
  return l && verifyPw(password, l.passwordHash) ? l : null;
}

function publicLecturer(l) {
  return { staff_id: l.staff_id, name: l.name, email: l.email, courses: l.courses };
}

// ── Materials store ───────────────────────────────────────────────────────────
let db = { nextId: 1, materials: [] };

function load() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  try {
    db = JSON.parse(fs.readFileSync(MATERIALS_FILE, 'utf8'));
    if (!db || !Array.isArray(db.materials)) throw new Error('bad file');
  } catch {
    db = { nextId: 1, materials: [] };
    // Carry over plans uploaded before materials existed: each becomes a CLP in "General".
    try {
      const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
      for (const p of legacy.plans || []) {
        db.materials.push({
          id: db.nextId++, course_code: p.course_code, course_name: p.course_name,
          section: 'general', kind: 'clp', title: p.title, notes: p.notes || '',
          lecturer_id: p.lecturer_id, lecturer_name: p.lecturer_name,
          original_name: p.original_name, stored_name: p.stored_name, size_bytes: p.size_bytes,
          url: null, uploaded_at: p.uploaded_at,
        });
      }
      if (db.materials.length) save();
    } catch { /* no legacy file */ }
  }
}

function save() {
  try { fs.writeFileSync(MATERIALS_FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.warn('[lecturers] could not save course-materials.json:', e.message); }
}

function addMaterial({ lecturer, course_code, course_name, section, kind, title, notes, file, url }) {
  const m = {
    id: db.nextId++,
    course_code,
    course_name,
    section,
    kind,
    title,
    notes: notes || '',
    lecturer_id: lecturer.staff_id,
    lecturer_name: lecturer.name,
    original_name: file ? file.originalname : null,
    stored_name:   file ? file.filename : null,
    size_bytes:    file ? file.size : null,
    url: url || null,
    uploaded_at: new Date().toISOString(),
  };
  db.materials.push(m);
  save();
  return m;
}

// Course page order: General first, then Week 1…14; oldest first within a section.
const byCourseOrder = (a, b) =>
  a.course_code.localeCompare(b.course_code) ||
  sectionRank(a.section) - sectionRank(b.section) ||
  a.uploaded_at.localeCompare(b.uploaded_at);

function materialsByLecturer(staffId) {
  return db.materials.filter(m => m.lecturer_id === staffId).sort(byCourseOrder);
}

function materialsForCourse(code) {
  return db.materials.filter(m => m.course_code === code).sort(byCourseOrder);
}

function materialById(id) {
  return db.materials.find(m => m.id === Number(id)) || null;
}

function renameMaterial(id, title) {
  const m = materialById(id);
  if (!m) return null;
  m.title = title;
  save();
  return m;
}

function deleteMaterial(id) {
  const m = materialById(id);
  if (!m) return false;
  db.materials = db.materials.filter(x => x.id !== m.id);
  save();
  if (m.stored_name) { try { fs.unlinkSync(filePath(m)); } catch { /* already gone */ } }
  return true;
}

function filePath(m) {
  return path.join(UPLOAD_DIR, m.stored_name);
}

load();

module.exports = {
  UPLOAD_DIR, KINDS, SECTIONS, authenticate, publicLecturer,
  addMaterial, materialsByLecturer, materialsForCourse, materialById, renameMaterial, deleteMaterial, filePath,
};
