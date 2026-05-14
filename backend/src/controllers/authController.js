const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
require('dotenv').config();

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// ─── POST /api/auth/register ──────────────────────────────────────
async function register(req, res) {
  try {
    const { name, student_id, email, password } = req.body;

    // Basic validation
    if (!name || !student_id || !email || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    // Check duplicate email or student_id
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ? OR student_id = ?',
      [email.toLowerCase().trim(), student_id.trim()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email or Student ID already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const [result] = await db.query(
      'INSERT INTO users (name, student_id, email, password) VALUES (?, ?, ?, ?)',
      [name.trim(), student_id.trim(), email.toLowerCase().trim(), hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: 'Account created successfully',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── POST /api/auth/login ─────────────────────────────────────────
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await db.query(
      'SELECT id, name, student_id, email, password FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const token = signAccessToken(user);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:         user.id,
        name:       user.name,
        student_id: user.student_id,
        email:      user.email,
      },
    });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── GET /api/auth/me ─────────────────────────────────────────────
async function me(req, res) {
  try {
    const [rows] = await db.query(
      'SELECT id, name, student_id, email, avatar_url, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error('me error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────
function logout(_req, res) {
  // With JWT there's no server-side session to invalidate.
  // Client simply discards the token.
  return res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = { register, login, me, logout };
