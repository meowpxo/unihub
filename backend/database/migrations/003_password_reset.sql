-- ============================================================
-- Migration 003 — Forgot password (email reset codes)
-- Run once against unihub_db:  mysql -u root -p unihub_db < 003_password_reset.sql
-- (Also included in schema.sql, so `npm run db:setup` creates it too.)
-- ============================================================

USE unihub_db;

-- One active reset code per user. The 6-digit code is stored as a bcrypt hash,
-- expires after 10 minutes, and is locked after too many wrong attempts.
CREATE TABLE IF NOT EXISTS password_resets (
  user_id     INT          PRIMARY KEY,
  code_hash   VARCHAR(255) NOT NULL,
  expires_at  DATETIME     NOT NULL,
  attempts    INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
