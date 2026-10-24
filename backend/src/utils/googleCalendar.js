/**
 * googleCalendar.js
 *
 * Thin wrapper over Google OAuth 2.0 and the Google Calendar REST API (no SDK —
 * plain fetch). UniHub writes into its own secondary calendar ("UniHub") in the
 * student's Google account, so it never touches their personal events.
 *
 * Env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  – OAuth "Web application" client
 *   GOOGLE_REDIRECT_URI                     – public HTTPS URL of /api/google/callback
 *   GOOGLE_CALENDAR_TZ                      – optional, default Asia/Kuala_Lumpur
 */

const crypto = require('crypto');

const AUTH_URL     = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL    = 'https://oauth2.googleapis.com/token';
const REVOKE_URL   = 'https://oauth2.googleapis.com/revoke';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const API          = 'https://www.googleapis.com/calendar/v3';

// calendar.app.created = only calendars this app creates (not the user's others).
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
const SCOPES = [
  'openid',
  'email',
  CALENDAR_SCOPE,
];

const TIME_ZONE = process.env.GOOGLE_CALENDAR_TZ || 'Asia/Kuala_Lumpur';

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

class GoogleError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code   = code;   // 'GOOGLE_AUTH' when the stored grant is no longer valid
  }
}

// ── Refresh-token encryption (AES-256-GCM, key derived from env) ──────────────
function key() {
  const secret = process.env.GOOGLE_TOKEN_KEY || process.env.JWT_SECRET;
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function encrypt(plain) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const data   = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function decrypt(stored) {
  const [iv, tag, data] = stored.split('.').map(s => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// ── OAuth ─────────────────────────────────────────────────────────────────────
function buildAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:     process.env.GOOGLE_CLIENT_ID,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope:         SCOPES.join(' '),
    access_type:   'offline',   // we need a refresh token to sync later
    prompt:        'consent',   // force Google to return a refresh token every time
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

async function postForm(url, body) {
  const res  = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const auth = data.error === 'invalid_grant';
    throw new GoogleError(data.error_description || data.error || 'Google token request failed',
      res.status, auth ? 'GOOGLE_AUTH' : undefined);
  }
  return data;
}

// code → { access_token, refresh_token, email }
async function exchangeCode(code) {
  const tokens = await postForm(TOKEN_URL, {
    code,
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri:  process.env.GOOGLE_REDIRECT_URI,
    grant_type:    'authorization_code',
  });
  const res  = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
  const info = await res.json().catch(() => ({}));
  return {
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token,
    email:         info.email || null,
    // Google lets the student untick individual permissions on the consent screen.
    calendarGranted: String(tokens.scope || '').split(' ').includes(CALENDAR_SCOPE),
  };
}

async function getAccessToken(refreshToken) {
  const data = await postForm(TOKEN_URL, {
    refresh_token: refreshToken,
    client_id:     process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type:    'refresh_token',
  });
  return data.access_token;
}

async function revoke(refreshToken) {
  try { await postForm(REVOKE_URL, { token: refreshToken }); } catch { /* already revoked */ }
}

// ── Calendar API ──────────────────────────────────────────────────────────────
async function api(accessToken, method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const scopeMissing = res.status === 403 && /insufficient.*scope/i.test(data.error?.message || '');
    throw new GoogleError(data.error?.message || `Google Calendar error ${res.status}`,
      res.status, res.status === 401 ? 'GOOGLE_AUTH' : scopeMissing ? 'GOOGLE_SCOPE' : undefined);
  }
  return data;
}

async function createCalendar(accessToken) {
  const cal = await api(accessToken, 'POST', '/calendars', {
    summary:     'UniHub',
    description: 'Classes, deadlines and academic dates synced from UniHub.',
    timeZone:    TIME_ZONE,
  });
  return cal.id;
}

// Removes the whole UniHub calendar (and every event in it) from the student's account.
async function deleteCalendar(accessToken, calendarId) {
  await api(accessToken, 'DELETE', `/calendars/${encodeURIComponent(calendarId)}`);
}

// Every event in the calendar (including cancelled ones, whose IDs stay reserved).
async function listEvents(accessToken, calendarId) {
  const out = [];
  let pageToken;
  do {
    const q = new URLSearchParams({ showDeleted: 'true', maxResults: '2500' });
    if (pageToken) q.set('pageToken', pageToken);
    const page = await api(accessToken, 'GET', `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    out.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}

const eventPath = (calendarId, id) =>
  `/calendars/${encodeURIComponent(calendarId)}/events${id ? `/${encodeURIComponent(id)}` : ''}`;

const insertEvent = (t, cal, ev)     => api(t, 'POST',   eventPath(cal), ev);
const updateEvent = (t, cal, id, ev) => api(t, 'PUT',    eventPath(cal, id), { ...ev, status: 'confirmed' });
const deleteEvent = (t, cal, id)     => api(t, 'DELETE', eventPath(cal, id));

module.exports = {
  TIME_ZONE, GoogleError, isConfigured,
  encrypt, decrypt,
  buildAuthUrl, exchangeCode, getAccessToken, revoke,
  createCalendar, deleteCalendar, listEvents, insertEvent, updateEvent, deleteEvent,
};
