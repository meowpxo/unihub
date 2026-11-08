/**
 * publicPages.js — the public home page and privacy policy.
 *
 * Google requires both links before an OAuth app can leave Testing mode
 * (Google Auth Platform → Branding). Keep the policy in step with what
 * routes/google.js and utils/googleCalendar.js actually do.
 */

const router = require('express').Router();

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;background:#f3f5f9;color:#0f172a;font:16px/1.65 "Segoe UI",system-ui,Arial,sans-serif}
  main{max-width:720px;margin:0 auto;padding:40px 22px 60px}
  h1{color:#0b2545;font-size:30px;line-height:1.2;margin:0 0 6px}
  h2{color:#0b2545;font-size:19px;margin:30px 0 6px}
  p,li{color:#334155}
  a{color:#1f4fd1}
  .sub{color:#5a6478;margin:0 0 24px}
</style></head><body><main>${body}</main></body></html>`;
}

router.get('/', (_req, res) => {
  res.type('html').send(page('UniHub', `
    <h1>UniHub</h1>
    <p class="sub">A unified academic data integrator for automated schedule and task management.</p>
    <p>UniHub is a mobile app built as a Final Year Project by students at Universiti Kuala Lumpur.
       It is a student project, not an official university service. It brings a student's timetable,
       assignments, grades and academic dates into one place.</p>
    <h2>Google Calendar</h2>
    <p>Students can choose to connect a Google account so that UniHub adds their classes, task deadlines
       and saved academic dates to a separate calendar named "UniHub" in that account.</p>
    <p><a href="/privacy">Privacy policy</a></p>`));
});

router.get('/privacy', (_req, res) => {
  res.type('html').send(page('UniHub Privacy Policy', `
    <h1>Privacy Policy</h1>
    <p class="sub">UniHub Final Year Project · Last updated 8 November 2026</p>
    <p>This policy explains what UniHub does with your information, including data from your Google account
       if you choose to connect it. UniHub is a student project at Universiti Kuala Lumpur and is used for
       development and testing.</p>

    <h2>Information UniHub stores</h2>
    <ul>
      <li>Your account details: name, student ID, email address and a hashed password.</li>
      <li>Your academic data: timetable, tasks, grades and academic dates that you enter or sync.</li>
    </ul>

    <h2>Google account data</h2>
    <p>Connecting Google Calendar is optional. If you connect, UniHub receives:</p>
    <ul>
      <li>Your Google email address, to show which account is connected.</li>
      <li>Permission to manage only calendars that UniHub itself creates.</li>
    </ul>
    <p>UniHub creates one calendar named "UniHub" and adds your classes, task deadlines and saved academic
       dates to it. It cannot see or change your other calendars or their events.</p>
    <p>The token that lets UniHub update this calendar is stored encrypted on the UniHub server.</p>

    <h2>How Google data is used and shared</h2>
    <p>Google data is used only to keep your UniHub calendar up to date. UniHub does not sell it, does not
       use it for advertising, and does not send it to AI services. UniHub's use of information received from
       Google APIs adheres to the
       <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
       including the Limited Use requirements.</p>

    <h2>AI features</h2>
    <p>If you use the Smart Study Planner or Exam Prep, your tasks, timetable and course learning plan are sent
       to an AI provider to generate the result. Google Calendar data is not included.</p>

    <h2>Removing your data</h2>
    <p>Choose <b>Disconnect Google Calendar</b> in the app at any time. UniHub then deletes the "UniHub" calendar
       from your Google account, revokes its access and removes the stored token. You can also remove access from
       your <a href="https://myaccount.google.com/permissions">Google Account permissions</a>.</p>

    <h2>Contact</h2>
    <p>For questions about this policy, contact the UniHub project team.</p>

    <p><a href="/">Back to UniHub</a></p>`));
});

module.exports = router;
