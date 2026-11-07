/**
 * mailer.js — sends portal password reset codes through Gmail.
 *
 * Reuses MAIL_USER and MAIL_PASS from backend/.env (a Gmail address and App
 * Password), so the email account is set up in one place. When they're empty the
 * code is printed in the portal terminal instead, so reset can still be tested —
 * this is a development mock, and most of its accounts use made-up addresses.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');

function mailSettings() {
  try {
    const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', 'backend', '.env')));
    return { user: env.MAIL_USER, pass: env.MAIL_PASS };
  } catch {
    return {};
  }
}

async function sendResetCode(to, name, code) {
  const { user, pass } = mailSettings();
  if (!user || !pass) {
    console.log(`[mock-portal] Email not set up — reset code for ${to}: ${code}`);
    return;
  }
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: String(pass).replace(/\s+/g, '') },   // App Passwords are shown with spaces
  });
  await transport.sendMail({
    from: `"UniKL VLE (Mock)" <${user}>`,
    to,
    subject: `${code} is your portal password reset code`,
    text:
      `Hi ${(name || '').split(' ')[0] || 'there'},\n\n` +
      `Your student portal password reset code is: ${code}\n\n` +
      `It expires in 10 minutes. If you didn't ask for this, you can ignore this email.\n`,
  });
}

module.exports = { sendResetCode };
