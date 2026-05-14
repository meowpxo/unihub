# UniHub – FYP Project

**UniHub: A Unified Academic Data Integrator for Automated Schedule & Task Management**

> FYP1 · UITM · March 2026  
> Syed Muhammad Zulkifli Syed Alfian (52213224368)  
> Nursyafiqa Tasya Mona Mohidi (52213124274)  
> Supervisor: Azrai bin Abdul Aziz

---

## Project Structure

```
unihub-project/
├── unihub-rn/          ← React Native (Expo) mobile app
│   ├── app/
│   │   ├── _layout.js       ← Root layout with auth guard
│   │   ├── login.js         ← Module 1: Login screen  ← NEW
│   │   ├── register.js      ← Module 1: Register screen  ← NEW
│   │   ├── pdf-upload.js    ← Module 3: PDF upload UI  ← NEW
│   │   ├── index.js         ← Dashboard (Home tab)
│   │   ├── schedule.js      ← Schedule tab
│   │   ├── tasks.js         ← Tasks tab
│   │   ├── gpa.js           ← GPA tab
│   │   └── profile.js       ← Profile tab
│   └── constants/
│       ├── Colors.js
│       └── Config.js        ← API base URL  ← NEW
│
├── backend/             ← Node.js / Express API
│   ├── src/
│   │   ├── server.js        ← Entry point
│   │   ├── config/
│   │   │   ├── db.js        ← MySQL connection pool
│   │   │   └── setupDb.js   ← One-time DB setup script
│   │   ├── middleware/
│   │   │   ├── auth.js      ← JWT verification
│   │   │   └── upload.js    ← Multer config
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── pdf.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── pdfController.js
│   │   └── utils/
│   │       └── pdfParser.js ← Core PDF extraction logic
│   ├── database/
│   │   └── schema.sql       ← Full MySQL schema
│   ├── uploads/pdfs/        ← Uploaded PDFs stored here
│   ├── package.json
│   └── .env.example
└── README.md
```

---

## Quick Start

### 1. Database Setup (XAMPP / MySQL)

1. Start Apache & MySQL in XAMPP
2. Copy `.env.example` → `.env` inside `backend/`
3. Fill in your MySQL credentials (default: root, no password)
4. Run the setup script:

```bash
cd backend
npm install
npm run db:setup
```

This creates the `unihub_db` database and all tables automatically.

### 2. Start the Backend

```bash
cd backend
cp .env.example .env     # fill in your values
npm run dev              # starts on http://localhost:3000
```

Verify: `GET http://localhost:3000/health` → `{ "status": "ok" }`

### 3. Start the Mobile App

```bash
cd unihub-rn
npm install
npx expo start
```

> **On a physical device**: Update `constants/Config.js` — replace `localhost` with your computer's local IP address (e.g. `192.168.1.100`).

---

## API Reference

### Auth Endpoints

| Method | URL | Auth | Description |
|--------|-----|------|-------------|
| POST | `/api/auth/register` | ✗ | Create account |
| POST | `/api/auth/login` | ✗ | Login → returns JWT |
| GET  | `/api/auth/me` | ✓ | Get current user |
| POST | `/api/auth/logout` | ✗ | Logout (client drops token) |

**Register body:**
```json
{
  "name": "Syed Muhammad Zulkifli",
  "student_id": "52213224368",
  "email": "zulkifli@student.uitm.edu.my",
  "password": "securepass"
}
```

**Login body:**
```json
{ "email": "zulkifli@student.uitm.edu.my", "password": "securepass" }
```

**Login response:**
```json
{
  "success": true,
  "token": "<JWT>",
  "user": { "id": 1, "name": "Syed Muhammad Zulkifli", "email": "...", "student_id": "..." }
}
```

---

### PDF Parsing Endpoints (Module 3)

All require `Authorization: Bearer <token>`.

| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/pdf/parse` | Upload + parse PDF (multipart `pdf` field) |
| GET  | `/api/pdf/history` | User's past uploads |
| GET  | `/api/pdf/:uploadId/events` | Events from a specific upload |
| PATCH | `/api/pdf/events/:eventId/save` | Mark event as saved to schedule |
| DELETE | `/api/pdf/:uploadId` | Delete upload and its events |

**Parse response:**
```json
{
  "success": true,
  "message": "Parsed successfully. 12 events found.",
  "upload": { "id": 1, "originalName": "uitm-calendar.pdf", "pageCount": 4 },
  "events": [
    {
      "title": "Final Examination Week - Semester 1 2026",
      "date": "2026-06-10",
      "type": "exam",
      "raw_text": "10 June 2026 – Final Examination Week begins"
    }
  ]
}
```

**Event types:** `exam` | `holiday` | `break` | `registration` | `deadline` | `orientation` | `semester` | `other`

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Student accounts |
| `refresh_tokens` | JWT token management |
| `pdf_uploads` | Upload history + parse status |
| `schedule_events` | Extracted events from PDFs |
| `tasks` | Manual task management |

---

## PDF Parser – How It Works

`backend/src/utils/pdfParser.js` implements Module 3:

1. **Extract text** – uses `pdf-parse` to pull all text from the uploaded PDF
2. **Line scanning** – each line is checked for 6 date format patterns (DD Month YYYY, MM/DD/YYYY, ISO 8601, etc.)
3. **Event classification** – keyword matching assigns a type (exam, holiday, deadline, etc.)
4. **Deduplication** – prevents duplicate events from multi-column PDF layouts
5. **Chronological sort** – events returned in date order

Works with UITM academic calendars, exam timetables, and semester schedules.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile Frontend | React Native (Expo Router) |
| Backend | Node.js + Express.js |
| Database | MySQL (via XAMPP) |
| Authentication | JWT (jsonwebtoken + bcryptjs) |
| PDF Parsing | pdf-parse |
| File Upload | Multer |
| Security | Helmet, CORS, express-rate-limit |
