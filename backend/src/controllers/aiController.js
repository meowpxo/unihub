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
// Free-tier models are sometimes overloaded (503) or retired (404). When that
// happens we move on to the next model instead of failing the student's request.
// Override the backups with GEMINI_FALLBACK_MODELS (comma-separated).
const RETRYABLE = new Set([404, 500, 502, 503, 504]);

function geminiModels() {
  const primary = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const backups = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-3.5-flash,gemini-flash-latest,gemini-3.5-flash-lite')
    .split(',').map((m) => m.trim()).filter(Boolean);
  return [...new Set([primary, ...backups])];
}

async function callGemini(system, user, maxTokens) {
  let lastErr;
  for (const model of geminiModels()) {
    try {
      return await callGeminiModel(model, system, user, maxTokens);
    } catch (e) {
      lastErr = e;
      if (!RETRYABLE.has(e.status)) throw e;   // bad key, quota, blocked prompt: another model won't help
      console.warn(`gemini ${model} unavailable (${e.status}: ${e.message}) — trying next model`);
    }
  }
  throw lastErr;
}

async function callGeminiModel(model, system, user, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
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

// ══════════════════════════════════════════════════════════════════════════════
// Exam Prep — predict upcoming quizzes/tests/final exam from the course CLP and
// generate the possible question format, aligned with the Course Learning Outcomes.
// ══════════════════════════════════════════════════════════════════════════════

const portal = require('../utils/portalClient');
const { clpToText } = require('../utils/clpReader');

const TIME_ZONE = process.env.GOOGLE_CALENDAR_TZ || 'Asia/Kuala_Lumpur';
const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(new Date()); // YYYY-MM-DD

// One prediction per student + course + CLP version + day, so reopening the
// screen doesn't spend another AI call. "Regenerate" bypasses it.
const examPrepCache = new Map();

async function portalTokenFor(userId) {
  const [[row]] = await db.query('SELECT portal_token FROM portal_links WHERE user_id = ?', [userId]);
  return row?.portal_token || null;
}

function portalError(res, e, fallback) {
  if (e.code === 'PORTAL_AUTH') {
    return res.status(401).json({ success: false, needsConnect: true,
      message: 'Your portal session expired — reconnect your Student Portal and try again.' });
  }
  console.error(fallback, e.message);
  return res.status(502).json({ success: false, message: e.message || 'Could not reach the student portal.' });
}

const latestClp = (materials) =>
  (materials || []).filter((m) => m.kind === 'clp' && m.stored_name)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0] || null;

// ── GET /api/ai/exam-prep/courses ───────────────────────────────────────────
// The student's portal courses, and whether each has a CLP to predict from.
async function examPrepCourses(req, res) {
  try {
    const token = await portalTokenFor(req.user.id);
    if (!token) {
      return res.json({ success: true, connected: false, courses: [],
        message: 'Connect your Student Portal first (Profile → Student Portal) so UniHub can read your course CLPs.' });
    }
    let courses;
    try {
      const data = await portal.getCourses(token);
      courses = await Promise.all((data.courses || []).map(async (c) => {
        const mats = await portal.getCourseMaterials(token, c.code).then((d) => d.materials).catch(() => []);
        const clp = latestClp(mats);
        return { code: c.code, name: c.name, lecturer: c.lecturer, has_clp: !!clp, clp_title: clp?.title || null };
      }));
    } catch (e) {
      return portalError(res, e, 'exam-prep courses error:');
    }
    courses.sort((a, b) => Number(b.has_clp) - Number(a.has_clp) || a.code.localeCompare(b.code));
    return res.json({ success: true, connected: true, courses });
  } catch (err) {
    console.error('examPrepCourses error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /api/ai/exam-prep  { course_code, refresh? } ───────────────────────
async function examPrep(req, res) {
  try {
    const code = String(req.body?.course_code || '').trim();
    if (!code) return res.status(400).json({ success: false, message: 'Choose a course' });
    if (!aiConfigured()) return res.status(503).json({ success: false, message: missingKeyMessage() });

    const token = await portalTokenFor(req.user.id);
    if (!token) {
      return res.status(400).json({ success: false, needsConnect: true,
        message: 'Connect your Student Portal first (Profile → Student Portal).' });
    }

    // 1. Find and read the course's CLP from the portal.
    let clp, clpText;
    try {
      const { materials } = await portal.getCourseMaterials(token, code);
      clp = latestClp(materials);
      if (!clp) {
        return res.json({ success: true, noClp: true,
          message: 'Your lecturer hasn\'t uploaded a Course Learning Plan for this course yet.' });
      }
      const today = todayLocal();
      const key = `${req.user.id}|${code}|${clp.id}|${clp.uploaded_at}|${today}`;
      if (!req.body?.refresh && examPrepCache.has(key)) {
        return res.json({ success: true, cached: true, ...examPrepCache.get(key) });
      }
      const file = await portal.downloadMaterial(token, clp.id);
      clpText = await clpToText(file.buffer, clp.original_name);
    } catch (e) {
      if (e.code === 'UNSUPPORTED') return res.status(422).json({ success: false, message: e.message });
      return portalError(res, e, 'exam-prep CLP error:');
    }

    // 2. Ask the AI to read the schedule and predict the coming assessments.
    const today = todayLocal();
    const system =
      'You are an academic assessment advisor helping a university student prepare for exams. ' +
      'You read Course Learning Plans (CLP) precisely and never invent assessments, topics or CLOs ' +
      'that are not supported by the CLP. Predicted questions must only test topics that appear in ' +
      'the CLP, and every question must map to a real CLO from the CLP. ' +
      'Respond with ONLY a valid JSON object, no prose, no markdown.';

    const user =
      `Today is ${today} (time zone ${TIME_ZONE}).\n\n` +
      `Course Learning Plan for ${code} (extracted from "${clp.original_name}"):\n` +
      `"""\n${clpText}\n"""\n\n` +
      'Tasks:\n' +
      '1. From the learning schedule and its dates, work out the current teaching week and which weeks are ' +
      'already finished (a week is finished when its end date is before today). Use the year/semester in the CLP to ' +
      'interpret dates. Skip break weeks.\n' +
      '2. List the finished weeks with their topics and CLOs.\n' +
      '3. Find every UPCOMING written assessment in the schedule or assessment table: quizzes, tests, mid-term, ' +
      'lab test, final test / final exam. Ignore assessments already in the past. For each, give its week and date ' +
      'range from the CLP, weightage from the assessment table, which weeks/topics it most likely covers (topics ' +
      'taught before it), and the CLOs it assesses (from the CLO-assessment mapping).\n' +
      '4. For each upcoming assessment, predict the POSSIBLE QUESTION FORMAT as sections (e.g. MCQ, short answer, ' +
      'structured, code-writing/analysis, case study), with an estimated number of questions and marks, the Bloom\'s ' +
      'taxonomy level and the CLO each section targets. Base the style on the assessment method and the CLO wording ' +
      '(e.g. "build/write" → practical or code-writing; "analyse, formulate and solve" → problem-solving/case study).\n' +
      '5. Give 4-6 realistic practice questions per assessment, written about the FINISHED topics first (mark any ' +
      'that use not-yet-taught topics as such), each tagged with its CLO, Bloom level, topic and suggested marks.\n' +
      '6. If the course has no upcoming written assessment (e.g. project-based), return an empty "upcoming" list and ' +
      'explain in "notes" how the course is assessed.\n\n' +
      'Return JSON in EXACTLY this shape:\n' +
      '{\n' +
      '  "course": { "code": "...", "name": "..." },\n' +
      '  "current_week": { "number": 3, "label": "Week 3", "dates": "26 Oct - 1 Nov", "status": "short phrase" },\n' +
      '  "clos": [ { "id": "CLO1", "description": "...", "assessed_by": "e.g. Test, Final Test" } ],\n' +
      '  "completed": [ { "week": "Week 1", "topics": ["..."], "clos": ["CLO1"] } ],\n' +
      '  "upcoming": [ {\n' +
      '      "name": "Test 1", "type": "quiz|test|midterm|lab_test|final|other",\n' +
      '      "week": "Week 5", "dates": "9 - 15 Nov", "days_away": 10, "weightage": "20%",\n' +
      '      "covers": ["topic", "..."], "clos": ["CLO1", "CLO3"],\n' +
      '      "confidence": "high|medium|low", "why": "one sentence on how this was predicted",\n' +
      '      "format": [ { "section": "Section A", "question_type": "MCQ", "questions": 10, "marks": 20,\n' +
      '                   "bloom": "Remember/Understand", "clo": "CLO1", "description": "what this section tests" } ],\n' +
      '      "practice_questions": [ { "question": "...", "type": "MCQ|Short answer|Structured|Code|Case study",\n' +
      '                   "clo": "CLO1", "bloom": "Apply", "topic": "...", "marks": 5, "taught": true } ],\n' +
      '      "prep_tips": ["..."]\n' +
      '  } ],\n' +
      '  "notes": "1-2 sentences of caveats, e.g. that this is a prediction from the CLP, not the real paper"\n' +
      '}\n' +
      'Order "upcoming" by date. Keep text concise.';

    let text;
    try {
      text = await callLLM(system, user, 12000);
    } catch (e) {
      console.error(`${AI_PROVIDER} exam-prep error:`, e.message);
      const msg = e?.status === 401 || e?.status === 403
        ? 'AI authentication failed. Check your API key.'
        : e?.status === 429
          ? 'AI rate limit reached. Please wait a moment and try again.'
          : 'Could not generate predictions right now. Please try again.';
      return res.status(502).json({ success: false, message: msg });
    }

    let prediction;
    try {
      prediction = parsePlanJson(text);
    } catch (e) {
      console.error('exam-prep parse error:', e.message, '\nraw:', String(text).slice(0, 500));
      return res.status(502).json({ success: false, message: 'Could not read the AI\'s prediction. Please try again.' });
    }

    const result = {
      prediction,
      clp: { title: clp.title, file: clp.original_name, uploaded_at: clp.uploaded_at, lecturer: clp.lecturer_name },
      provider: AI_PROVIDER,
      generated_at: new Date().toISOString(),
    };
    examPrepCache.set(`${req.user.id}|${code}|${clp.id}|${clp.uploaded_at}|${today}`, result);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('examPrep error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { studyPlan, examPrepCourses, examPrep };
