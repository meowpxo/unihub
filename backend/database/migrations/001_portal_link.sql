-- ============================================================
-- Migration 001 — Student Portal linking
-- Run once against unihub_db:  mysql -u root -p unihub_db < 001_portal_link.sql
-- (Re-running the ALTER lines will error if the column already exists; that's safe to ignore.)
-- ============================================================

USE unihub_db;

-- Stores each user's link to their student portal account + session token.
CREATE TABLE IF NOT EXISTS portal_links (
  user_id         INT          PRIMARY KEY,
  portal_username VARCHAR(50)  NOT NULL,          -- portal student ID
  portal_token    VARCHAR(255) NOT NULL,          -- session token from the portal
  connected_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Mark rows that came from the portal so a re-sync can cleanly replace them,
-- without touching the student's manually-added slots/courses.
ALTER TABLE timetable_slots
  ADD COLUMN source ENUM('manual','portal') DEFAULT 'manual';

ALTER TABLE gpa_courses
  ADD COLUMN source ENUM('manual','portal') DEFAULT 'manual';
