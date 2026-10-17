/**
 * store.js — persistent multi-student store for the mock portal.
 *
 * Students register their own portal accounts; they are saved to students.json
 * next to this file so they survive server restarts. Each student has their own
 * independent copy of the seed data (timetable, grades, assignments, courses).
 *
 * Passwords are salted + hashed with scrypt (not plaintext). This is still a
 * development mock, not production-grade auth.
 */

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { STUDENT, seedData, generateStudentData, randomProgramme } = require('./data');

const FILE = path.join(__dirname, 'students.json');

let db = { nextId: 1002, students: {} };

function save() {
  try { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }
  catch (e) { console.warn('[store] could not save students.json:', e.message); }
}

function hashPw(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const h = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `${salt}:${h}`;
}
function verifyPw(pw, stored) {
  try {
    const [salt, h] = String(stored).split(':');
    const hh = crypto.scryptSync(String(pw), salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(hh, 'hex'));
  } catch { return false; }
}

function seedDemo() {
  db.students[STUDENT.student_id] = {
    id: STUDENT.id,
    student_id: STUDENT.student_id,
    email: STUDENT.email,
    fullname: STUDENT.fullname,
    programme: STUDENT.programme,
    semester: STUDENT.semester,
    passwordHash: hashPw('demo123'),
    data: seedData(),
  };
}

function load() {
  try {
    db = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (!db || !db.students) throw new Error('bad file');
  } catch {
    db = { nextId: 1002, students: {} };
    seedDemo();
    save();
  }
}

// Find a student by their student_id OR email (case-insensitive).
function byUsername(u) {
  const key = String(u || '').trim().toLowerCase();
  return Object.values(db.students).find(
    (s) => s.student_id.toLowerCase() === key || s.email.toLowerCase() === key
  ) || null;
}

function authenticate(username, password) {
  const s = byUsername(username);
  if (!s) return null;
  return verifyPw(password, s.passwordHash) ? s : null;
}

function create({ fullname, student_id, email, password, programme }) {
  const sid = String(student_id || '').trim();
  const mail = String(email || '').trim();
  if (byUsername(sid) || byUsername(mail)) {
    const e = new Error('An account with this Student ID or email already exists');
    e.code = 'DUP';
    throw e;
  }
  const rec = {
    id: db.nextId++,
    student_id: sid,
    email: mail,
    fullname: String(fullname || '').trim(),
    programme: programme || randomProgramme(),
    semester: STUDENT.semester,
    passwordHash: hashPw(password),
    // Each registered student gets their OWN randomly generated courses,
    // grades, activities and timetable — distinct from the demo account.
    data: generateStudentData(),
  };
  db.students[sid] = rec;
  save();
  return rec;
}

// Public-safe profile (no password hash, no bulk data).
function publicProfile(s) {
  return {
    id: s.id,
    student_id: s.student_id,
    email: s.email,
    fullname: s.fullname,
    programme: s.programme,
    semester: s.semester,
  };
}

function count() { return Object.keys(db.students).length; }

load();

module.exports = { authenticate, create, byUsername, publicProfile, count };
