/**
 * portalClient.js
 *
 * Talks to the student learning portal on the app's behalf. In development this
 * is the mock portal (mock-portal/, http://localhost:4000). In production you'd
 * point PORTAL_URL at the real portal and adapt these calls to its real API.
 *
 * Flow: the student links their portal account once (connect -> login), we keep
 * the returned session token, and sync uses it to pull timetable/grades/tasks.
 */

const PORTAL_URL =
  process.env.PORTAL_URL || process.env.MOODLE_URL || 'http://localhost:4000';

// Log in to the portal with the student's portal credentials.
// Returns { token, student }.
async function portalLogin(username, password) {
  const res = await fetch(`${PORTAL_URL}/api/portal/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    const err = new Error(data.message || 'Portal login failed');
    err.status = res.status;
    throw err;
  }
  return data; // { success, token, student }
}

// GET a portal endpoint with the student's stored session token.
async function portalGet(path, token) {
  const res = await fetch(`${PORTAL_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    const err = new Error('Portal session expired');
    err.code = 'PORTAL_AUTH';
    throw err;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success) {
    throw new Error(data.message || `Portal request failed: ${path}`);
  }
  return data;
}

module.exports = {
  PORTAL_URL,
  portalLogin,
  getProfile:     (t) => portalGet('/api/portal/profile', t),
  getTimetable:   (t) => portalGet('/api/portal/timetable', t),
  getGrades:      (t) => portalGet('/api/portal/grades', t),
  getAssignments: (t) => portalGet('/api/portal/assignments', t),
};
