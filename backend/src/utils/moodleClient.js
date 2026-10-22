/**
 * moodleClient.js
 *
 * Fetches assignments from Moodle Web Services.
 * When MOODLE_URL + MOODLE_TOKEN are set in .env, calls the real API.
 * Otherwise returns no assignments (there is no built-in demo data).
 *
 * Real API endpoint (when available):
 *   GET {MOODLE_URL}/webservice/rest/server.php
 *     ?wstoken={MOODLE_TOKEN}
 *     &wsfunction=mod_assign_get_assignments
 *     &moodlewsrestformat=json
 */

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
  console.log('[moodle] MOODLE_URL/MOODLE_TOKEN not set or unreachable; no assignments fetched');
  return [];
}

function isUsingDummy() {
  return !process.env.MOODLE_URL || !process.env.MOODLE_TOKEN;
}

module.exports = { getAssignments, isUsingDummy };
