require('dotenv').config();

const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

// Route modules
const authRoutes     = require('./routes/auth');
const pdfRoutes      = require('./routes/pdf');
const gpaRoutes      = require('./routes/gpa');
const scheduleRoutes = require('./routes/schedule');
const tasksRoutes    = require('./routes/tasks');
const moodleRoutes   = require('./routes/moodle');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: '*',   // Restrict in production to your app's domain / IP
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rate limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Stricter limit on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many login attempts, please wait.' },
});

// ── Body parsers ──────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Health check ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth',     authLimiter, authRoutes);
app.use('/api/pdf',      pdfRoutes);
app.use('/api/gpa',      gpaRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/tasks',    tasksRoutes);
app.use('/api/moodle',   moodleRoutes);

// ── 404 handler ───────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 10}MB.`,
    });
  }
  if (err.message === 'Only PDF files are allowed') {
    return res.status(415).json({ success: false, message: err.message });
  }

  res.status(500).json({ success: false, message: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`🚀 UniHub API running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});

process.on('SIGTERM', () => server.close());
process.on('SIGINT',  () => server.close());

module.exports = app;
