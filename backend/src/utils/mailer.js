/**
 * mailer.js — sends UniHub emails through Gmail (free) using Nodemailer.
 *
 * Env:
 *   MAIL_USER  – the Gmail address that sends the emails
 *   MAIL_PASS  – a Gmail App Password (Google Account → Security → App passwords),
 *                NOT the normal Gmail password
 */

const nodemailer = require('nodemailer');

let _transport = null;

function isConfigured() {
  return !!(process.env.MAIL_USER && process.env.MAIL_PASS);
}

function transport() {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: String(process.env.MAIL_PASS).replace(/\s+/g, ''),   // App Passwords are shown with spaces
      },
    });
  }
  return _transport;
}

async function sendResetCode(to, name, code) {
  const firstName = (name || '').split(' ')[0] || 'there';
  await transport().sendMail({
    from: `"UniHub" <${process.env.MAIL_USER}>`,
    to,
    subject: `${code} is your UniHub password reset code`,
    text:
      `Hi ${firstName},\n\n` +
      `Your UniHub password reset code is: ${code}\n\n` +
      `It expires in 10 minutes. If you didn't ask to reset your password, you can ignore this email.\n\n` +
      `— UniHub`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:460px;margin:auto;padding:24px;color:#0f172a">
        <h2 style="color:#0b2545;margin:0 0 12px">Reset your UniHub password</h2>
        <p>Hi ${firstName},</p>
        <p>Use this code in the UniHub app to set a new password:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#1f4fd1;margin:20px 0">${code}</p>
        <p style="color:#5a6478">The code expires in <b>10 minutes</b>. If you didn't ask to reset your password, you can ignore this email.</p>
        <p style="color:#5a6478;margin-top:24px">— UniHub</p>
      </div>`,
  });
}

module.exports = { isConfigured, sendResetCode };
