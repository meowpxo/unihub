# UniHub Mock Portal

A **local, fake** stand-in for the UniKL / Moodle learning portal, for developing
and testing UniHub's sync feature without live portal access.

> ⚠️ This is a development tool. The data is invented and no part of it comes
> from the real UniKL portal. Do not present it as the real portal and do not
> use it to collect anyone's real credentials.

## Why it exists

`backend/src/utils/moodleClient.js` can call a real Moodle Web Services REST API
when `MOODLE_URL` + `MOODLE_TOKEN` are set, and otherwise falls back to hard-coded
dummy assignments. This mock implements that same REST protocol, so you can point
the backend at it and exercise the **real** network path end-to-end — while still
using fake data.

## Run

```bash
cd mock-portal
npm install
npm start
```

Server starts on `http://localhost:4000` (override with `MOCK_PORT`).

## Point the backend at it

In `backend/.env`:

```
MOODLE_URL=http://localhost:4000
MOODLE_TOKEN=dev-token
```

Restart the backend, then trigger **Sync Moodle** in the app. The backend will
fetch assignments from the mock instead of using its built-in dummy list, and
`isDummy` in the sync response will be `false`.

## The portal website + login

Open **http://localhost:4000** in a browser. You get a VLE-style landing page
with a **student login**. Sign in with the demo account, then browse the
Dashboard, Timetable, Grades and Assignments.

**Demo account:** student ID `12345678` · password `demo123`
(defined in `data.js` → `ACCOUNTS`; add more there.)

Login issues an in-memory session token (cleared when the server restarts). The
UI stores it in `localStorage` and sends it as `Authorization: Bearer <token>`.
This is **mock auth for development/demo only** — not real security, and not a
clone of any real institution's sign-in.

## Endpoints

| Endpoint | Shape | Maps to |
|---|---|---|
| `POST /api/portal/login` | `{username, password}` → `{token, student}` | fake accounts |
| `GET /api/portal/me` | current session's student | — |
| `POST /api/portal/logout` | ends the session | — |
| `GET/POST /webservice/rest/server.php?wsfunction=mod_assign_get_assignments` | Real Moodle | `tasks` table (used today) |
| `GET /api/portal/timetable` | UniHub-friendly | `timetable_slots` |
| `GET /api/portal/grades` | UniHub-friendly | `gpa_courses` + `gpa_assessments` |
| `GET /api/portal/profile` | UniHub-friendly | the fake student |
| `GET /health` | `{ ok: true }` | — |

The timetable and grades endpoints are **not** standard Moodle. The real portal
doesn't expose these cleanly, so they're shaped to match UniHub's own DB tables.
Wiring them into the app means adding new sync controllers (like `moodleController`)
that fetch from `MOODLE_URL` and upsert into `timetable_slots` / `gpa_courses`.

## Editing the data

All fake data lives in `data.js` — change courses, assignments, timetable slots,
and grades there. Assignment `duedate` values are UNIX timestamps in seconds,
exactly like real Moodle.

## Optional: require a token

Set `MOCK_TOKEN=some-value` when starting the server to make it reject requests
whose `wstoken` doesn't match. By default any token is accepted.
