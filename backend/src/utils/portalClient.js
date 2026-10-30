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

// fetch() that turns a network failure (portal down / wrong URL) into a clear message.
async function portalFetch(path, options) {
  try {
    return await fetch(`${PORTAL_URL}${path}`, options);
  } catch (e) {
    console.error(`[portal] cannot reach ${PORTAL_URL}:`, e.cause?.code || e.message);
    throw new Error('Cannot reach the student portal right now. Please try again later.');
  }
}

// Log in to the portal with the student's portal credentials.
// Returns { token, student }.
async function portalLogin(username, password) {
  const res = await portalFetch('/api/portal/login', {
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
  const res = await portalFetch(path, {
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

// Download a course material file (e.g. the CLP) with the student's session token.
// Returns { buffer, contentType }.
async function downloadMaterial(token, id) {
  const res = await portalFetch(`/api/portal/materials/${encodeURIComponent(id)}/file`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    const err = new Error('Portal session expired');
    err.code = 'PORTAL_AUTH';
    throw err;
  }
  if (!res.ok) throw new Error('Could not download the file from the portal');
  return {
    buffer: Buffer.from(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') || '',
  };
}

module.exports = {
  PORTAL_URL,
  portalLogin,
  getProfile:     (t) => portalGet('/api/portal/profile', t),
  getTimetable:   (t) => portalGet('/api/portal/timetable', t),
  getGrades:      (t) => portalGet('/api/portal/grades', t),
  getAssignments: (t) => portalGet('/api/portal/assignments', t),
  getCourses:     (t) => portalGet('/api/portal/courses', t),
  getCourseMaterials: (t, code) => portalGet(`/api/portal/courses/${encodeURIComponent(code)}/materials`, t),
  downloadMaterial,
};
