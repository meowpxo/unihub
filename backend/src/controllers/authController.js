const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const mailer = require('../utils/mailer');
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

// ─── PUT /api/auth/profile ────────────────────────────────────────
async function updateProfile(req, res) {
  try {
    const name  = (req.body.name  || '').trim();
    const email = (req.body.email || '').toLowerCase().trim();

    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    }

    // Email must stay unique across accounts
    const [taken] = await db.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [email, req.user.id]
    );
    if (taken.length > 0) {
      return res.status(409).json({ success: false, message: 'That email is already used by another account' });
    }

    await db.query('UPDATE users SET name = ?, email = ? WHERE id = ?', [name, email, req.user.id]);

    const [rows] = await db.query(
      'SELECT id, name, student_id, email FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = rows[0];

    // The JWT carries name/email, so issue a fresh one
    return res.json({
      success: true,
      message: 'Profile updated',
      token: signAccessToken(user),
      user,
    });
  } catch (err) {
    console.error('updateProfile error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── PUT /api/auth/password ───────────────────────────────────────
async function changePassword(req, res) {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'Current and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const [rows] = await db.query('SELECT password FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const valid = await bcrypt.compare(current_password, rows[0].password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    if (await bcrypt.compare(new_password, rows[0].password)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current one' });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    console.error('changePassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── POST /api/auth/forgot-password ───────────────────────────────
// Always answers the same way, so the endpoint can't be used to find out
// which emails have accounts.
const RESET_CODE_MINUTES = 10;
const RESET_MAX_ATTEMPTS = 5;

async function forgotPassword(req, res) {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    if (!mailer.isConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'Password reset email is not set up on the server. Add MAIL_USER and MAIL_PASS to backend/.env.',
      });
    }

    const [rows] = await db.query('SELECT id, name, email FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      const user = rows[0];
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const codeHash = await bcrypt.hash(code, 10);

      // One active code per user — asking again replaces the old code
      await db.query(
        `INSERT INTO password_resets (user_id, code_hash, expires_at, attempts)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 0)
         ON DUPLICATE KEY UPDATE
           code_hash = VALUES(code_hash), expires_at = VALUES(expires_at),
           attempts = 0, created_at = NOW()`,
        [user.id, codeHash, RESET_CODE_MINUTES]
      );

      try {
        await mailer.sendResetCode(user.email, user.name, code);
      } catch (mailErr) {
        console.error('reset email error:', mailErr.message);
        return res.status(502).json({ success: false, message: 'Could not send the reset email. Please try again later.' });
      }
    }

    return res.json({
      success: true,
      message: 'If that email is registered, a 6-digit code has been sent to it.',
    });
  } catch (err) {
    console.error('forgotPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── POST /api/auth/reset-password ────────────────────────────────
async function resetPassword(req, res) {
  try {
    const email = (req.body.email || '').toLowerCase().trim();
    const code  = String(req.body.code || '').trim();
    const { new_password } = req.body;

    if (!email || !code || !new_password) {
      return res.status(400).json({ success: false, message: 'Email, code and new password are required' });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const invalid = () => res.status(400).json({ success: false, message: 'Invalid or expired code. Request a new one.' });

    const [rows] = await db.query(
      `SELECT u.id, r.code_hash, r.attempts, r.expires_at > NOW() AS still_valid
       FROM users u JOIN password_resets r ON r.user_id = u.id
       WHERE u.email = ?`,
      [email]
    );
    if (rows.length === 0) return invalid();

    const reset = rows[0];
    if (!reset.still_valid || reset.attempts >= RESET_MAX_ATTEMPTS) {
      await db.query('DELETE FROM password_resets WHERE user_id = ?', [reset.id]);
      return invalid();
    }

    const valid = await bcrypt.compare(code, reset.code_hash);
    if (!valid) {
      await db.query('UPDATE password_resets SET attempts = attempts + 1 WHERE user_id = ?', [reset.id]);
      const left = RESET_MAX_ATTEMPTS - reset.attempts - 1;
      return res.status(400).json({
        success: false,
        message: left > 0
          ? `Incorrect code. ${left} attempt${left === 1 ? '' : 's'} left.`
          : 'Too many incorrect attempts. Request a new code.',
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 12);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, reset.id]);
    await db.query('DELETE FROM password_resets WHERE user_id = ?', [reset.id]);

    return res.json({ success: true, message: 'Password reset. You can now sign in with your new password.' });
  } catch (err) {
    console.error('resetPassword error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ─── POST /api/auth/logout ────────────────────────────────────────
function logout(_req, res) {
  // With JWT there's no server-side session to invalidate.
  // Client simply discards the token.
  return res.json({ success: true, message: 'Logged out successfully' });
}

module.exports = {
  register, login, me, updateProfile, changePassword,
  forgotPassword, resetPassword, logout,
};
