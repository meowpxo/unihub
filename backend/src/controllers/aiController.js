/**
 * aiController.js — AI features, provider-switchable.
 *
 * Smart Study Planner: reads the student's upcoming tasks + weekly timetable
 * and asks an LLM to produce a day-by-day study plan that fits around classes
 * and front-loads urgent / high-priority work.
 *
 * Provider is chosen by AI_PROVIDER (default: gemini if a Gemini key is set,
 * else anthropic):
 *   - gemini    : free tier. Needs GEMINI_API_KEY (aistudio.google.com).
 *                 Model via GEMINI_MODEL (default gemini-2.0-flash).
 *   - anthropic : Claude. Needs ANTHROPIC_API_KEY. Model via AI_MODEL.
 */

const db = require('../config/db');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const AI_PROVIDER = process.env.AI_PROVIDER ||
  (process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic');

function aiConfigured() {
  return AI_PROVIDER === 'gemini'
    ? !!process.env.GEMINI_API_KEY
    : !!process.env.ANTHROPIC_API_KEY;
}

function missingKeyMessage() {
  return AI_PROVIDER === 'gemini'
    ? 'AI is not configured. Add GEMINI_API_KEY to the backend .env (free key at aistudio.google.com).'
    : 'AI is not configured. Add ANTHROPIC_API_KEY to the backend .env.';
}

// ── Gemini (free) via REST ──────────────────────────────────────────────────
async function callGemini(system, user, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `Gemini error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
  if (!text) {
    const reason = cand?.finishReason || data?.promptFeedback?.blockReason;
    throw new Error('Gemini returned no text' + (reason ? ` (${reason})` : ''));
  }
  return text;
}

// ── Anthropic (Claude) via SDK ──────────────────────────────────────────────
let _anthropic = null;
async function callAnthropic(system, user, maxTokens) {
  if (!_anthropic) {
    const Anthropic = require('@anthropic-ai/sdk');
    _anthropic = new Anthropic();
  }
  const resp = await _anthropic.messages.create({
    model: process.env.AI_MODEL || 'claude-opus-5-5',
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const tb = resp.content.find((b) => b.type === 'text');
  if (!tb) throw new Error('Model returned no text');
  return tb.text;
}

function callLLM(system, user, maxTokens) {
  return AI_PROVIDER === 'gemini'
    ? callGemini(system, user, maxTokens)
    : callAnthropic(system, user, maxTokens);
}

// Pull the first JSON object out of the model's text (tolerates fences/prose).
function parsePlanJson(text) {
  let t = String(text || '').trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON found in model response');
  return JSON.parse(t.slice(start, end + 1));
}

// ── POST /api/ai/study-plan ─────────────────────────────────────────────────
async function studyPlan(req, res) {
  try {
    if (!aiConfigured()) {
      return res.status(503).json({ success: false, message: missingKeyMessage() });
    }

    // Upcoming, unfinished tasks (next ~6 weeks).
    const [tasks] = await db.query(
      `SELECT title, course, course_code, task_type, priority, due_date,
              DATEDIFF(due_date, CURDATE()) AS days_left
       FROM tasks
       WHERE user_id = ? AND is_done = 0 AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 42 DAY)
       ORDER BY due_date ASC
       LIMIT 40`,
      [req.user.id]
    );

    if (tasks.length === 0) {
      return res.json({
        success: true,
        empty: true,
        message: 'No upcoming tasks to plan. Sync your portal or add tasks first.',
      });
    }

    // Weekly timetable (so the plan avoids class times).
    const [slots] = await db.query(
      `SELECT course_name, course_code, day_of_week, start_time, end_time, slot_type
       FROM timetable_slots WHERE user_id = ?
       ORDER BY day_of_week, start_time`,
      [req.user.id]
    );

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const classLines = slots.length
      ? slots.map((s) =>
          `- ${DAY_NAMES[s.day_of_week]} ${String(s.start_time).slice(0, 5)}–${String(s.end_time).slice(0, 5)}: ${s.course_name} (${s.course_code || ''}) [${s.slot_type}]`
        ).join('\n')
      : '(no fixed classes recorded)';

    const taskLines = tasks.map((t) =>
      `- "${t.title}" | course: ${t.course || t.course_code || 'General'} | type: ${t.task_type} | priority: ${t.priority} | due: ${String(t.due_date).split('T')[0]} (${t.days_left} days away)`
    ).join('\n');

    const system =
      'You are a study-planning assistant for a university student. You create realistic, ' +
      'encouraging weekly study plans. You schedule study sessions ONLY in free time (never ' +
      'during the student\'s classes or past midnight), front-load urgent and high-priority ' +
      'work, break big tasks into focused sessions across multiple days, and keep sessions to ' +
      '1–2 hours with short breaks. Respond with ONLY a valid JSON object, no prose, no markdown.';

    const user =
      `Today is ${DAY_NAMES[today.getDay()]}, ${todayStr}.\n\n` +
      `The student's weekly class timetable:\n${classLines}\n\n` +
      `Upcoming assignments and tasks:\n${taskLines}\n\n` +
      `Create a study plan for the next 7 days (starting today). Return JSON in EXACTLY this shape:\n` +
      `{\n` +
      `  "summary": "2-3 sentence overview of the week's focus",\n` +
      `  "days": [\n` +
      `    { "date": "YYYY-MM-DD", "day": "Mon",\n` +
      `      "sessions": [\n` +
      `        { "start": "HH:MM", "end": "HH:MM", "title": "short action",\n` +
      `          "course": "course code or name", "why": "one short reason (deadline/priority)" }\n` +
      `      ] }\n` +
      `  ],\n` +
      `  "tips": ["2-4 short, specific study tips for this workload"]\n` +
      `}\n` +
      `Include all 7 days (use an empty sessions array for rest days). Keep text concise.`;

    let text;
    try {
      text = await callLLM(system, user, 8000);
    } catch (e) {
      console.error(`${AI_PROVIDER} call error:`, e.message);
      const msg = e?.status === 401 || e?.status === 403
        ? 'AI authentication failed. Check your API key.'
        : e?.status === 429
          ? 'AI rate limit reached. Please wait a moment and try again.'
          : 'Could not generate a study plan right now.';
      return res.status(502).json({ success: false, message: msg });
    }

    let plan;
    try {
      plan = parsePlanJson(text);
    } catch (e) {
      console.error('plan parse error:', e.message, '\nraw:', String(text).slice(0, 500));
      return res.status(502).json({ success: false, message: 'Could not read the generated plan. Please try again.' });
    }

    return res.json({ success: true, plan, provider: AI_PROVIDER, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('studyPlan error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { studyPlan };
