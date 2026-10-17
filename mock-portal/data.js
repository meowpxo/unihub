/**
 * data.js — templates + per-student seed data for the mock portal.
 *
 * All of this is INVENTED for development/testing. Nothing comes from the real
 * UniKL portal and no real student is represented.
 *
 * The mock now supports many students (see store.js). Each student who registers
 * gets their OWN independent copy of the template data below, via seedData().
 */

// Demo student profile (seeded on first run — login 12345678 / demo123).
const STUDENT = {
  id: 1001,
  student_id: '12345678',
  fullname: 'Test Student',
  email: 'test.student@s.unikl.edu.my',
  programme: 'BSc (Hons) IT - Software Engineering',
  semester: 'Semester 5, 2025/2026',
};

// Courses used to build the Moodle-shaped assignments response.
const COURSES = [
  { id: 301, fullname: 'Database Systems',           shortname: 'IDB30303', credit_hours: 3 },
  { id: 302, fullname: 'Software Project Management', shortname: 'ISB38104', credit_hours: 4 },
  { id: 303, fullname: 'Internet Programming',        shortname: 'IPB49804', credit_hours: 4 },
  { id: 304, fullname: 'Software Testing & QA',       shortname: 'ISB37804', credit_hours: 4 },
  { id: 305, fullname: 'Information Systems',         shortname: 'IDB30102', credit_hours: 2 },
];

// ── Assignments (real Moodle mod_assign_get_assignments shape) ─────────────────
// duedate is a UNIX timestamp in SECONDS, exactly like real Moodle.
function unix(dateStr) {
  return Math.floor(new Date(dateStr + 'T23:59:00Z').getTime() / 1000);
}

const ASSIGNMENTS_BY_COURSE = {
  301: [
    { id: 101, name: 'Lab Report 3 - Query Optimization',           duedate: unix('2026-05-19'), intro: 'Submit the lab report for the Query Optimization practical. Include execution plans and performance comparisons.' },
    { id: 104, name: 'Quiz 3 - Database Normalization',             duedate: unix('2026-05-19'), intro: 'Online quiz covering 1NF, 2NF, 3NF and BCNF normalization. 20 questions, 30 minutes.' },
    { id: 109, name: 'Discussion Forum - SQL Injection & Security', duedate: unix('2026-05-17'), intro: 'Participate in the forum discussing SQL injection attacks and prevention techniques. Min 2 posts.' },
  ],
  302: [
    { id: 102, name: 'Project Milestone 2 - SRS Document',          duedate: unix('2026-05-22'), intro: 'Submit the Software Requirements Specification document following IEEE 830 standard.' },
    { id: 107, name: 'Final Project Report & Presentation',         duedate: unix('2026-06-10'), intro: 'Submit the final project report and prepare slides for the Week 14 group presentation.' },
  ],
  303: [
    { id: 103, name: 'Assignment 2 - Dynamic Web Application',      duedate: unix('2026-05-28'), intro: 'Build a dynamic web application using PHP and MySQL with registration, login and CRUD.' },
    { id: 110, name: 'Chapter 8 Reading - REST API Design',         duedate: unix('2026-05-18'), intro: 'Read Chapter 8 on HTTP protocols and RESTful API design, then complete the reflection quiz.' },
  ],
  304: [
    { id: 105, name: 'Individual Assignment - Test Plan Document',  duedate: unix('2026-06-01'), intro: 'Prepare a complete test plan using the IEEE 829 standard template.' },
    { id: 108, name: 'Lab Test 2 - Unit & Integration Testing',    duedate: unix('2026-05-29'), intro: 'Lab test covering JUnit, test case design and integration testing strategies.' },
  ],
  305: [
    { id: 106, name: 'Assignment 1 - System Analysis Report',       duedate: unix('2026-05-22'), intro: 'Analyse an existing information system and propose improvements. Min 15 pages.' },
  ],
};

function moodleAssignments() {
  return {
    courses: COURSES.map((c) => ({
      id: c.id,
      fullname: c.fullname,
      shortname: c.shortname,
      assignments: (ASSIGNMENTS_BY_COURSE[c.id] || []).map((a) => ({
        id: a.id, name: a.name, duedate: a.duedate, intro: a.intro,
      })),
    })),
  };
}

// Flat assignment list (friendly shape used by the UI + app sync).
function buildAssignmentsFlat() {
  const { courses } = moodleAssignments();
  const flat = [];
  for (const c of courses) {
    for (const a of c.assignments) {
      flat.push({
        id: a.id,
        title: a.name,
        course: c.fullname,
        course_code: c.shortname,
        due_date: new Date(a.duedate * 1000).toISOString().split('T')[0],
        description: a.intro,
      });
    }
  }
  flat.sort((x, y) => x.due_date.localeCompare(y.due_date));
  return flat;
}

// ── Timetable template (shaped to timetable_slots) ────────────────────────────
const TEMPLATE_TIMETABLE = [
  { course_name: 'Database Systems',           course_code: 'IDB30303', day_of_week: 1, start_time: '08:00:00', end_time: '10:00:00', venue: 'Lab B-07',  lecturer: 'Dr. Aminah', slot_type: 'lecture' },
  { course_name: 'Internet Programming',        course_code: 'IPB49804', day_of_week: 1, start_time: '14:00:00', end_time: '16:00:00', venue: 'Lab C-02',  lecturer: 'Mr. Faisal', slot_type: 'lab' },
  { course_name: 'Software Project Management', course_code: 'ISB38104', day_of_week: 2, start_time: '10:00:00', end_time: '12:00:00', venue: 'Room A-11', lecturer: 'Dr. Lim',    slot_type: 'lecture' },
  { course_name: 'Software Testing & QA',       course_code: 'ISB37804', day_of_week: 3, start_time: '09:00:00', end_time: '11:00:00', venue: 'Room A-09', lecturer: 'Ms. Priya',  slot_type: 'lecture' },
  { course_name: 'Software Testing & QA',       course_code: 'ISB37804', day_of_week: 3, start_time: '11:00:00', end_time: '13:00:00', venue: 'Lab C-04',  lecturer: 'Ms. Priya',  slot_type: 'lab' },
  { course_name: 'Information Systems',         course_code: 'IDB30102', day_of_week: 4, start_time: '14:00:00', end_time: '16:00:00', venue: 'Room A-11', lecturer: 'Dr. Aminah', slot_type: 'lecture' },
  { course_name: 'Internet Programming',        course_code: 'IPB49804', day_of_week: 5, start_time: '10:00:00', end_time: '12:00:00', venue: 'Room B-03', lecturer: 'Mr. Faisal', slot_type: 'tutorial' },
];

// ── Grades template (shaped to gpa_courses + gpa_assessments) ─────────────────
const TEMPLATE_GRADES = [
  { course_code: 'IDB30303', course_name: 'Database Systems', credit_hours: 3, assessments: [
      { name: 'Quizzes', weight: 10, score: 8, max_score: 10 }, { name: 'Lab Reports', weight: 20, score: 17, max_score: 20 },
      { name: 'Assignment', weight: 20, score: 16, max_score: 20 }, { name: 'Final Exam', weight: 50, score: 40, max_score: 50 } ] },
  { course_code: 'ISB38104', course_name: 'Software Project Management', credit_hours: 4, assessments: [
      { name: 'Milestone 1', weight: 15, score: 13, max_score: 15 }, { name: 'Milestone 2', weight: 15, score: 12, max_score: 15 },
      { name: 'Final Report', weight: 30, score: 25, max_score: 30 }, { name: 'Final Exam', weight: 40, score: 31, max_score: 40 } ] },
  { course_code: 'IPB49804', course_name: 'Internet Programming', credit_hours: 4, assessments: [
      { name: 'Assignment 1', weight: 20, score: 18, max_score: 20 }, { name: 'Assignment 2', weight: 25, score: 21, max_score: 25 },
      { name: 'Final Exam', weight: 55, score: 44, max_score: 55 } ] },
  { course_code: 'ISB37804', course_name: 'Software Testing & QA', credit_hours: 4, assessments: [
      { name: 'Lab Test 1', weight: 15, score: 12, max_score: 15 }, { name: 'Lab Test 2', weight: 15, score: 11, max_score: 15 },
      { name: 'Test Plan', weight: 20, score: 17, max_score: 20 }, { name: 'Final Exam', weight: 50, score: 38, max_score: 50 } ] },
  { course_code: 'IDB30102', course_name: 'Information Systems', credit_hours: 2, assessments: [
      { name: 'Assignment', weight: 40, score: 34, max_score: 40 }, { name: 'Final Exam', weight: 60, score: 48, max_score: 60 } ] },
];

// ── Course overview cards template ────────────────────────────────────────────
const TEMPLATE_COURSE_CARDS = [
  { code: 'IPB49906', name: 'Final Year Project 2',                 lecturer: 'Dr. Aminah', category: 'DEGREE', activities_total: 40, activities_done: 12, color: 0 },
  { code: 'IDB30303', name: 'Database Systems',                     lecturer: 'Dr. Aminah', category: 'DEGREE', activities_total: 32, activities_done: 20, color: 1 },
  { code: 'ISB38104', name: 'Software Project Management',          lecturer: 'Dr. Lim',    category: 'DEGREE', activities_total: 28, activities_done: 15, color: 2 },
  { code: 'IPB49804', name: 'Internet Programming',                 lecturer: 'Mr. Faisal', category: 'DEGREE', activities_total: 36, activities_done: 24, color: 3 },
  { code: 'ISB37804', name: 'Software Testing & Quality Assurance', lecturer: 'Ms. Priya',  category: 'DEGREE', activities_total: 30, activities_done: 9,  color: 4 },
  { code: 'IDB30102', name: 'Information Systems',                  lecturer: 'Dr. Aminah', category: 'DEGREE', activities_total: 22, activities_done: 18, color: 5 },
];

// Fresh, independent copy of the template data for one student.
function seedData() {
  return JSON.parse(JSON.stringify({
    timetable:   TEMPLATE_TIMETABLE.map((s, i) => ({ ...s, color_index: i % 6 })),
    grades:      TEMPLATE_GRADES,
    courseCards: TEMPLATE_COURSE_CARDS,
    assignments: buildAssignmentsFlat(),
  }));
}

// ══════════════════════════════════════════════════════════════════════════════
// Random per-student data generator
// New students get a DISTINCT set of courses, grades, activities and timetable
// (not the demo's fixed data), drawn from the catalog/pools below.
// ══════════════════════════════════════════════════════════════════════════════

const CATALOG = [
  { code: 'IDB30303', name: 'Database Systems',                     ch: 3 },
  { code: 'ISB38104', name: 'Software Project Management',          ch: 4 },
  { code: 'IPB49804', name: 'Internet Programming',                 ch: 4 },
  { code: 'ISB37804', name: 'Software Testing & Quality Assurance', ch: 4 },
  { code: 'IDB30102', name: 'Information Systems',                  ch: 2 },
  { code: 'IPB49906', name: 'Final Year Project 2',                ch: 6 },
  { code: 'ISB46103', name: 'Web Application Framework',            ch: 3 },
  { code: 'ISB37904', name: 'Software Quality & Config Management', ch: 3 },
  { code: 'IDB20203', name: 'Data Structures & Algorithms',         ch: 4 },
  { code: 'INB30103', name: 'Computer Networks',                    ch: 3 },
  { code: 'ISB35303', name: 'Mobile Application Development',       ch: 4 },
  { code: 'IDB40503', name: 'Artificial Intelligence',             ch: 3 },
  { code: 'ISB33103', name: 'Operating Systems',                   ch: 3 },
  { code: 'IMB50104', name: 'Cloud Computing',                     ch: 3 },
];

const LECTURERS = ['Dr. Aminah', 'Dr. Lim', 'Mr. Faisal', 'Ms. Priya', 'Dr. Rajesh',
  'Mdm. Sofea', 'Mr. Hafiz', 'Dr. Chen', 'Ms. Farah', 'Mr. Tan'];
const VENUES = ['Lab B-07', 'Lab C-02', 'Room A-11', 'Room A-09', 'Lab C-04',
  'Room B-03', 'Lab D-01', 'Room C-12', 'Lab A-05', 'Room D-08'];
const PROGRAMMES = [
  'BSc (Hons) IT - Software Engineering',
  'BSc (Hons) Information Technology',
  'BSc (Hons) Computer Science',
  'BSc (Hons) Data Engineering',
  'Bachelor of Software Engineering (Hons)',
];
const SCHEMES = [
  [{ name: 'Quizzes', weight: 10 }, { name: 'Assignment', weight: 20 }, { name: 'Lab Work', weight: 20 }, { name: 'Final Exam', weight: 50 }],
  [{ name: 'Midterm', weight: 30 }, { name: 'Project', weight: 30 }, { name: 'Final Exam', weight: 40 }],
  [{ name: 'Assignment 1', weight: 20 }, { name: 'Assignment 2', weight: 25 }, { name: 'Final Exam', weight: 55 }],
  [{ name: 'Milestone 1', weight: 15 }, { name: 'Milestone 2', weight: 15 }, { name: 'Report', weight: 30 }, { name: 'Presentation', weight: 40 }],
];
const ASG_KINDS = [
  (n) => `Assignment ${n}`, () => 'Online Quiz', (n) => `Lab Report ${n}`,
  () => 'Project Milestone', () => 'Case Study', (n) => `Tutorial ${n} Submission`,
];
const START_BLOCKS = ['08:00:00', '09:00:00', '10:00:00', '11:00:00', '13:00:00', '14:00:00', '16:00:00'];

const rnd       = (n) => Math.floor(Math.random() * n);
const pick      = (a) => a[rnd(a.length)];
const randRange = (lo, hi) => lo + rnd(hi - lo + 1);
const shuffle   = (a) => { const r = [...a]; for (let i = r.length - 1; i > 0; i--) { const j = rnd(i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; };
const plus2     = (t) => { const h = parseInt(t.slice(0, 2), 10) + 2; return `${String(h).padStart(2, '0')}:${t.slice(3)}`; };
const dueInDays = (d) => { const dt = new Date(); dt.setDate(dt.getDate() + d); return dt.toISOString().split('T')[0]; };

function randomProgramme() { return pick(PROGRAMMES); }

function generateStudentData() {
  const chosen = shuffle(CATALOG).slice(0, randRange(4, 6));
  const used = new Set();            // taken (day-start) slots to avoid clashes
  const timetable = [], grades = [], courseCards = [], assignments = [];
  let asgId = 101;

  chosen.forEach((c, idx) => {
    const lecturer = pick(LECTURERS);

    // Course card (activities + progress)
    const total = randRange(20, 45);
    const done  = randRange(0, total);
    courseCards.push({
      code: c.code, name: c.name, lecturer, category: 'DEGREE',
      activities_total: total, activities_done: done, color: idx % 6,
    });

    // Grades (random scores on a random scheme)
    const scheme = pick(SCHEMES);
    const assessments = scheme.map((a) => {
      const max = a.weight;
      const score = Math.min(max, Math.round(max * (0.5 + Math.random() * 0.45)));
      return { name: a.name, weight: a.weight, score, max_score: max };
    });
    grades.push({ course_code: c.code, course_name: c.name, credit_hours: c.ch, assessments });

    // Timetable: 1–2 non-clashing slots
    const slots = randRange(1, 2);
    for (let i = 0; i < slots; i++) {
      let day, start, key, tries = 0;
      do { day = randRange(1, 5); start = pick(START_BLOCKS); key = `${day}-${start}`; tries++; }
      while (used.has(key) && tries < 15);
      if (used.has(key)) continue;
      used.add(key);
      timetable.push({
        course_name: c.name, course_code: c.code, day_of_week: day,
        start_time: start, end_time: plus2(start),
        venue: pick(VENUES), lecturer,
        slot_type: i === 0 ? 'lecture' : pick(['lab', 'tutorial']),
        color_index: idx % 6,
      });
    }

    // Assignments: 1–3 with upcoming due dates
    const an = randRange(1, 3);
    for (let i = 0; i < an; i++) {
      assignments.push({
        id: asgId++,
        title: `${pick(ASG_KINDS)(i + 1)} - ${c.name}`,
        course: c.name, course_code: c.code,
        due_date: dueInDays(randRange(3, 45)),
        description: 'Complete and submit this activity via the portal before the due date.',
      });
    }
  });

  timetable.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
  assignments.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return { timetable, grades, courseCards, assignments };
}

// Course overview + summary stat numbers, computed from a student's cards.
function courseOverview(cards) {
  const courses = (cards || []).map((c) => ({
    ...c,
    progress: Math.round((c.activities_done / c.activities_total) * 100),
  }));
  const summary = {
    courses_enrolled: courses.length,
    courses_completed: courses.filter((c) => c.progress >= 100).length,
    activities_completed: courses.reduce((s, c) => s + c.activities_done, 0),
    activities_due: courses.reduce((s, c) => s + (c.activities_total - c.activities_done), 0),
  };
  return { courses, summary };
}

module.exports = {
  STUDENT, COURSES, moodleAssignments, seedData, courseOverview,
  generateStudentData, randomProgramme,
};
