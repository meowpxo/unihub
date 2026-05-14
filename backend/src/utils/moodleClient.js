/**
 * moodleClient.js
 *
 * Fetches assignments from Moodle Web Services.
 * When MOODLE_URL + MOODLE_TOKEN are set in .env, calls the real API.
 * Otherwise returns DUMMY_ASSIGNMENTS so the feature works without API access.
 *
 * Real API endpoint (when available):
 *   GET {MOODLE_URL}/webservice/rest/server.php
 *     ?wstoken={MOODLE_TOKEN}
 *     &wsfunction=mod_assign_get_assignments
 *     &moodlewsrestformat=json
 */

// ── Dummy assignments (based on UniKL BSc IT Software Engineering Sem 5) ──────

const DUMMY_ASSIGNMENTS = [
  {
    moodle_id:   'moodle_101',
    title:       'Lab Report 3 – Query Optimization',
    course:      'Database Systems',
    course_code: 'IDB30303',
    due_date:    '2026-05-19',
    description: 'Submit the lab report for the Query Optimization practical. Include execution plans and performance comparisons.',
    task_type:   'lab',
    priority:    'High',
  },
  {
    moodle_id:   'moodle_102',
    title:       'Project Milestone 2 – SRS Document',
    course:      'Software Project Management',
    course_code: 'ISB38104',
    due_date:    '2026-05-22',
    description: 'Submit the Software Requirements Specification document for your group project following IEEE 830 standard.',
    task_type:   'assignment',
    priority:    'High',
  },
  {
    moodle_id:   'moodle_103',
    title:       'Assignment 2 – Dynamic Web Application',
    course:      'Internet Programming',
    course_code: 'IPB49804',
    due_date:    '2026-05-28',
    description: 'Build a dynamic web application using PHP and MySQL with user registration, login, and CRUD functionality.',
    task_type:   'assignment',
    priority:    'Med',
  },
  {
    moodle_id:   'moodle_104',
    title:       'Quiz 3 – Database Normalization',
    course:      'Database Systems',
    course_code: 'IDB30303',
    due_date:    '2026-05-19',
    description: 'Online quiz covering 1NF, 2NF, 3NF and BCNF normalization. 20 questions, 30 minutes.',
    task_type:   'quiz',
    priority:    'Med',
  },
  {
    moodle_id:   'moodle_105',
    title:       'Individual Assignment – Test Plan Document',
    course:      'Software Testing & QA',
    course_code: 'ISB37804',
    due_date:    '2026-06-01',
    description: 'Prepare a complete test plan for the given software system using the IEEE 829 standard template.',
    task_type:   'assignment',
    priority:    'Med',
  },
  {
    moodle_id:   'moodle_106',
    title:       'Assignment 1 – System Analysis Report',
    course:      'Information Systems',
    course_code: 'IDB30102',
    due_date:    '2026-05-22',
    description: 'Analyse an existing information system and propose improvements for business processes. Min 15 pages.',
    task_type:   'assignment',
    priority:    'Med',
  },
  {
    moodle_id:   'moodle_107',
    title:       'Final Project Report & Presentation',
    course:      'Software Project Management',
    course_code: 'ISB38104',
    due_date:    '2026-06-10',
    description: 'Submit the final project report and prepare slides for the Week 14 group presentation.',
    task_type:   'assignment',
    priority:    'High',
  },
  {
    moodle_id:   'moodle_108',
    title:       'Lab Test 2 – Unit & Integration Testing',
    course:      'Software Testing & QA',
    course_code: 'ISB37804',
    due_date:    '2026-05-29',
    description: 'Lab test covering JUnit framework, test case design, and integration testing strategies.',
    task_type:   'lab',
    priority:    'High',
  },
  {
    moodle_id:   'moodle_109',
    title:       'Discussion Forum – SQL Injection & Security',
    course:      'Database Systems',
    course_code: 'IDB30303',
    due_date:    '2026-05-17',
    description: 'Participate in the Moodle forum discussing SQL injection attacks and prevention techniques. Min 2 posts.',
    task_type:   'other',
    priority:    'Low',
  },
  {
    moodle_id:   'moodle_110',
    title:       'Chapter 8 Reading – REST API Design',
    course:      'Internet Programming',
    course_code: 'IPB49804',
    due_date:    '2026-05-18',
    description: 'Read Chapter 8 on HTTP protocols and RESTful API design, then complete the reflection quiz on Moodle.',
    task_type:   'study',
    priority:    'Low',
  },
];

// ── Real Moodle API call ───────────────────────────────────────────────────────

async function fetchFromRealMoodle() {
  const MOODLE_URL   = process.env.MOODLE_URL;
  const MOODLE_TOKEN = process.env.MOODLE_TOKEN;
  if (!MOODLE_URL || !MOODLE_TOKEN) return null;

  try {
    const url =
      `${MOODLE_URL}/webservice/rest/server.php` +
      `?wstoken=${MOODLE_TOKEN}` +
      `&wsfunction=mod_assign_get_assignments` +
      `&moodlewsrestformat=json`;

    const res  = await fetch(url);
    const json = await res.json();

    if (json.exception) {
      console.warn('[moodle] API error:', json.message);
      return null;
    }

    // Flatten courses → assignments
    const assignments = [];
    for (const course of (json.courses || [])) {
      for (const assign of (course.assignments || [])) {
        assignments.push({
          moodle_id:   `moodle_${assign.id}`,
          title:       assign.name,
          course:      course.fullname,
          course_code: course.shortname || null,
          due_date:    assign.duedate
            ? new Date(assign.duedate * 1000).toISOString().split('T')[0]
            : null,
          description: assign.intro || null,
          task_type:   'assignment',
          priority:    'Med',
        });
      }
    }
    return assignments;
  } catch (err) {
    console.warn('[moodle] fetch error:', err.message);
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getAssignments() {
  const real = await fetchFromRealMoodle();
  if (real) {
    console.log(`[moodle] fetched ${real.length} assignments from real API`);
    return real;
  }
  console.log(`[moodle] using ${DUMMY_ASSIGNMENTS.length} dummy assignments`);
  return DUMMY_ASSIGNMENTS;
}

function isUsingDummy() {
  return !process.env.MOODLE_URL || !process.env.MOODLE_TOKEN;
}

module.exports = { getAssignments, isUsingDummy };
