-- ============================================================
-- UniHub Database Schema
-- Module 1: User Authentication
-- Module 3: PDF Schedule Extraction
-- ============================================================

CREATE DATABASE IF NOT EXISTS unihub_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE unihub_db;

-- ─────────────────────────────────────────
-- USERS (Module 1 – Authentication)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120)        NOT NULL,
  student_id   VARCHAR(30)         NOT NULL UNIQUE,
  email        VARCHAR(120)        NOT NULL UNIQUE,
  password     VARCHAR(255)        NOT NULL,   -- bcrypt hash
  avatar_url   VARCHAR(255)        DEFAULT NULL,
  created_at   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────
-- REFRESH TOKENS (for secure JWT rotation)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT                 NOT NULL,
  token        VARCHAR(512)        NOT NULL,
  expires_at   DATETIME            NOT NULL,
  created_at   TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- PDF UPLOADS (Module 3 – PDF Parsing)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pdf_uploads (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  user_id         INT                 NOT NULL,
  original_name   VARCHAR(255)        NOT NULL,
  stored_name     VARCHAR(255)        NOT NULL,
  file_size       INT                 NOT NULL,   -- bytes
  status          ENUM('pending','processing','completed','failed')
                                      DEFAULT 'pending',
  error_message   TEXT                DEFAULT NULL,
  uploaded_at     TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
  processed_at    TIMESTAMP           NULL DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- EXTRACTED EVENTS (from PDF parsing)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_events (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  user_id       INT                 NOT NULL,
  pdf_upload_id INT                 NOT NULL,
  title         VARCHAR(300)        NOT NULL,
  event_date    DATE                DEFAULT NULL,
  event_type    ENUM(
    'exam', 'holiday', 'break', 'registration',
    'deadline', 'orientation', 'semester', 'other'
  )                                 DEFAULT 'other',
  description   TEXT                DEFAULT NULL,
  raw_text      TEXT                DEFAULT NULL,   -- original extracted line
  saved_to_schedule TINYINT(1)      DEFAULT 0,
  created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (pdf_upload_id) REFERENCES pdf_uploads(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- TASKS (Module 5 – Task Management)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  user_id           INT                 NOT NULL,
  title             VARCHAR(255)        NOT NULL,
  course            VARCHAR(60)         DEFAULT NULL,
  course_code       VARCHAR(20)         DEFAULT NULL,
  task_type         ENUM('assignment','lab','study','fyp','personal','quiz','other')
                                        DEFAULT 'other',
  priority          ENUM('High','Med','Low')
                                        DEFAULT 'Med',
  due_date          DATE                DEFAULT NULL,
  is_done           TINYINT(1)          DEFAULT 0,
  notes             TEXT                DEFAULT NULL,
  source            ENUM('manual','moodle') DEFAULT 'manual',
  moodle_id         VARCHAR(100)        DEFAULT NULL,
  moodle_synced_at  TIMESTAMP           NULL DEFAULT NULL,
  created_at        TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- Indexes for common query patterns
-- ─────────────────────────────────────────
CREATE INDEX idx_schedule_events_user ON schedule_events (user_id, event_date);
CREATE INDEX idx_tasks_user_due       ON tasks (user_id, due_date);
CREATE INDEX idx_pdf_uploads_user     ON pdf_uploads (user_id, uploaded_at DESC);

-- ─────────────────────────────────────────
-- TIMETABLE SLOTS (Module 2 – Schedule)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timetable_slots (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  course_name  VARCHAR(120) NOT NULL,
  course_code  VARCHAR(20)  DEFAULT NULL,
  day_of_week  TINYINT      NOT NULL,       -- 0=Sun, 1=Mon … 6=Sat
  start_time   TIME         NOT NULL,
  end_time     TIME         NOT NULL,
  venue        VARCHAR(100) DEFAULT NULL,
  lecturer     VARCHAR(100) DEFAULT NULL,
  slot_type    ENUM('lecture','lab','tutorial','fyp','break','other') DEFAULT 'lecture',
  color_index  TINYINT      DEFAULT 0,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- GPA COURSES (Module 6 – GPA Tracking)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gpa_courses (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  user_id      INT          NOT NULL,
  course_code  VARCHAR(20)  NOT NULL,
  course_name  VARCHAR(120) NOT NULL,
  credit_hours INT          DEFAULT 3,
  semester     VARCHAR(30)  DEFAULT NULL,
  created_at   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────
-- GPA ASSESSMENTS (marks per component)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gpa_assessments (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  gpa_course_id  INT          NOT NULL,
  user_id        INT          NOT NULL,
  name           VARCHAR(100) NOT NULL,
  weight         DECIMAL(5,2) NOT NULL,     -- percentage weight e.g. 30.00
  score          DECIMAL(5,2) DEFAULT NULL, -- marks obtained
  max_score      DECIMAL(5,2) DEFAULT 100.00,
  created_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (gpa_course_id) REFERENCES gpa_courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)       REFERENCES users(id)        ON DELETE CASCADE
);

CREATE INDEX idx_timetable_user_day ON timetable_slots (user_id, day_of_week);
CREATE INDEX idx_gpa_courses_user   ON gpa_courses (user_id);
CREATE INDEX idx_gpa_assess_course  ON gpa_assessments (gpa_course_id);
