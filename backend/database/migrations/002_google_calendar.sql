-- ============================================================
-- Migration 002 — Google Calendar sync
-- Run once against unihub_db:  mysql -u root -p unihub_db < 002_google_calendar.sql
-- (Also included in schema.sql, so `npm run db:setup` creates it too.)
-- ============================================================

USE unihub_db;

-- Each user's link to their Google account. refresh_token is AES-GCM encrypted
-- by the backend (see src/utils/googleCalendar.js), never stored in plain text.
CREATE TABLE IF NOT EXISTS google_links (
  user_id         INT          PRIMARY KEY,
  google_email    VARCHAR(255) DEFAULT NULL,
  refresh_token   TEXT         NOT NULL,
  calendar_id     VARCHAR(255) DEFAULT NULL,      -- the "UniHub" calendar in their account
  connected_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  last_synced_at  TIMESTAMP    NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
