const pdfParse = require('pdf-parse');
const fs       = require('fs');

// ─── Pass 1: Calendar Events ─────────────────────────────────────────────────

const TYPE_KEYWORDS = [
  { type: 'exam',         words: ['exam', 'examination', 'final', 'midterm', 'mid-term', 'test', 'quiz'] },
  { type: 'holiday',      words: ['holiday', 'public holiday', 'raya', 'chinese new year', 'deepavali', 'christmas', 'new year', 'thaipusam', 'wesak', 'labour day', 'merdeka', 'agong', 'national day'] },
  { type: 'break',        words: ['break', 'semester break', 'mid-sem break', 'study week', 'revision week', 'reading week'] },
  { type: 'registration', words: ['registration', 'enrolment', 'enrollment', 'add/drop', 'course add', 'late registration'] },
  { type: 'deadline',     words: ['deadline', 'submission', 'due date', 'last day', 'dateline'] },
  { type: 'orientation',  words: ['orientation', 'convocation', 'convo', 'graduation'] },
  { type: 'semester',     words: ['semester', 'trimester', 'academic calendar', 'week 1', 'week 14', 'teaching week', 'first day', 'last day of class'] },
];

function classifyType(text) {
  const lower = text.toLowerCase();
  for (const { type, words } of TYPE_KEYWORDS) {
    if (words.some(w => lower.includes(w))) return type;
  }
  return 'other';
}

function parseDate(raw) {
  const d = new Date(raw);
  return isNaN(d) ? null : d.toISOString().split('T')[0];
}

function expandYear(yy) {
  const n = parseInt(yy);
  return n <= 50 ? `20${String(n).padStart(2,'0')}` : `19${String(n).padStart(2,'0')}`;
}

function extractDate(line) {
  const patterns = [
    // 4-digit year formats
    { re: /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i,
      build: m => `${m[1]} ${m[2]} ${m[3]}` },
    { re: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})/i,
      build: m => `${m[1]} ${m[2]} ${m[3]}` },
    { re: /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{4})/i,
      build: m => `${m[1]} ${m[2]} ${m[3]}` },
    { re: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2}),?\s+(\d{4})/i,
      build: m => `${m[1]} ${m[2]} ${m[3]}` },
    { re: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
      build: m => `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` },
    { re: /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/,
      build: m => `${m[1]}-${String(m[2]).padStart(2,'0')}-${String(m[3]).padStart(2,'0')}` },
    // 2-digit year formats  e.g. "11-May-26", "May 11, 26"
    { re: /(\d{1,2})[\-](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\-](\d{2})\b/i,
      build: m => `${m[1]} ${m[2]} ${expandYear(m[3])}` },
    { re: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\-](\d{1,2})[\-](\d{2})\b/i,
      build: m => `${m[1]} ${m[2]} ${expandYear(m[3])}` },
    { re: /(\d{1,2})[\/](\d{1,2})[\/](\d{2})\b/,
      build: m => `${expandYear(m[3])}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}` },
  ];
  for (const { re, build } of patterns) {
    const m = line.match(re);
    if (m) return parseDate(build(m)) || build(m);
  }
  return null;
}

function cleanTitle(line) {
  return line.replace(/^\s*\d+[\.\)]\s*/, '').replace(/\s{2,}/g, ' ').trim().slice(0, 200);
}

function extractCalendarEvents(lines) {
  const events = [];
  const seenEv = new Set();
  for (const line of lines) {
    const date = extractDate(line);
    if (!date) continue;
    const type  = classifyType(line);
    const title = cleanTitle(line);
    const key   = `${title.slice(0, 60)}_${date}`;
    if (seenEv.has(key)) continue;
    seenEv.add(key);
    events.push({ title, date, type, description: null, raw_text: line });
  }
  events.sort((a, b) => (!a.date ? 1 : !b.date ? -1 : a.date.localeCompare(b.date)));
  return events;
}

// ─── Pass 2: Grid Timetable — coordinate-based ────────────────────────────────
// Handles visual grid tables (like UniKL PJR039) where day labels are row headers
// and time slots are column headers. Uses x,y positions to assign text to cells.

const TIME_12H_RE  = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
const CC_RE        = /^[A-Z]{2,4}\d{4,5}[A-Z]?\d*$/;
const SLOT_TYPE_RE = /^\((lect(?:ure)?|lab|tut(?:orial)?|fyp|pract(?:ical)?)\)$/i;
const DAY_NUM      = { MON:1, TUE:2, WED:3, THU:4, FRI:5, SAT:6, SUN:0 };

function to24h(str) {
  const m = str.match(TIME_12H_RE);
  if (!m) return null;
  let h = parseInt(m[1]);
  if (m[3].toUpperCase() === 'PM' && h !== 12) h += 12;
  if (m[3].toUpperCase() === 'AM' && h === 12) h  =  0;
  return `${String(h).padStart(2,'0')}:${m[2]}`;
}

function addOneHour(t) {
  const [h, m] = t.split(':').map(Number);
  return `${String(h+1).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// Merge items whose text ends with '-' and the next item (same column, just below) looks like a suffix
function mergeHyphenSplits(items) {
  const sorted = [...items].sort((a, b) => b.y - a.y); // top→bottom (desc y)
  const out = [];
  let i = 0;
  while (i < sorted.length) {
    const cur = sorted[i];
    if (cur.text.endsWith('-') && i + 1 < sorted.length) {
      const nxt = sorted[i + 1];
      if (Math.abs(nxt.x - cur.x) < 25 && (cur.y - nxt.y) < 18) {
        out.push({ ...cur, text: cur.text + nxt.text });
        i += 2;
        continue;
      }
    }
    out.push(cur);
    i++;
  }
  return out;
}

function extractGridTimetable(allPageItems) {
  const slots = [];
  const seen  = new Set();

  for (const rawItems of allPageItems) {
    if (!rawItems || rawItems.length < 10) continue;

    // ── locate time-header row ───────────────────────────────────────────────
    const timeHeaders = rawItems
      .filter(it => TIME_12H_RE.test(it.text))
      .sort((a, b) => a.x - b.x);
    if (timeHeaders.length < 3) continue;

    // ── build column x-bands using midpoints between adjacent headers ────────
    const cols = timeHeaders
      .map((th, i) => ({
        time: to24h(th.text),
        xMin: i === 0
          ? th.x - 50
          : Math.round((timeHeaders[i-1].x + th.x) / 2),
        xMax: i < timeHeaders.length - 1
          ? Math.round((th.x + timeHeaders[i+1].x) / 2)
          : th.x + 90,
      }))
      .filter(c => c.time);

    // ── find day-label items (different y from time-header row) ──────────────
    const headerY  = timeHeaders[0].y;
    const dayItems = rawItems
      .filter(it => DAY_NUM[it.text.toUpperCase()] !== undefined && Math.abs(it.y - headerY) > 5)
      .sort((a, b) => b.y - a.y);  // highest y first = top of page first
    if (dayItems.length === 0) continue;

    // ── compute row y-bands: midpoint between consecutive day labels ─────────
    const rowBands = dayItems.map((dayItem, di) => {
      const yTop = di === 0
        ? dayItem.y + 60
        : Math.round((dayItems[di-1].y + dayItem.y) / 2);
      const yBot = di < dayItems.length - 1
        ? Math.round((dayItem.y + dayItems[di+1].y) / 2)
        : dayItem.y - 80;
      return { dayItem, dow: DAY_NUM[dayItem.text.toUpperCase()], yMin: yBot, yMax: yTop };
    });

    // ── process each day row ─────────────────────────────────────────────────
    for (const { dayItem, dow, yMin, yMax } of rowBands) {
      const rowItems = mergeHyphenSplits(
        rawItems.filter(it => it.y >= yMin && it.y <= yMax && it.x > dayItem.x + 5)
      );
      if (rowItems.length === 0) continue;

      let curCode = null, curStart = null, curCellItems = [];

      const commit = (endColIdx) => {
        if (!curCode || !curStart) return;

        const endTime = endColIdx < cols.length
          ? cols[endColIdx].time
          : addOneHour(cols[endColIdx - 1].time);

        // slot type
        const typeItem = curCellItems.find(it => SLOT_TYPE_RE.test(it.text));
        let slot_type = 'lecture';
        if (typeItem) {
          const t = typeItem.text.toLowerCase();
          if      (t.includes('lab') || t.includes('pract')) slot_type = 'lab';
          else if (t.includes('tut'))                         slot_type = 'tutorial';
          else if (t.includes('fyp'))                         slot_type = 'fyp';
        }

        // venue: items with dash or "online", not a course code / slot type / pure name
        const venueItems = curCellItems.filter(it =>
          !CC_RE.test(it.text) && !SLOT_TYPE_RE.test(it.text) &&
          (it.text.includes('-') || /online/i.test(it.text)) &&
          it.text.length < 40
        );
        const venue = venueItems.length > 0
          ? venueItems.map(v => v.text).join(' ').trim()
          : null;

        // lecturer: all-caps alphabetic text (names), sorted top→bottom, joined
        const nameItems = curCellItems
          .filter(it =>
            /^[A-Z][A-Z ]{2,}$/.test(it.text) &&
            !CC_RE.test(it.text) &&
            !DAY_NUM[it.text] &&
            !['LECT','LAB','TUT','LECTURE','TUTORIAL'].includes(it.text)
          )
          .sort((a, b) => b.y - a.y);  // top first
        const lecturer = nameItems.length > 0
          ? [...new Set(nameItems.map(n => n.text))].join(' ').trim()
          : null;

        const key = `${dow}_${curStart}`;
        if (!seen.has(key)) {
          seen.add(key);
          slots.push({
            day_of_week: dow,
            start_time:  curStart,
            end_time:    endTime,
            course_name: curCode,
            course_code: curCode,
            venue,
            lecturer,
            slot_type,
          });
        }

        curCode = null; curStart = null; curCellItems = [];
      };

      for (let ci = 0; ci < cols.length; ci++) {
        const col  = cols[ci];
        const cell = rowItems.filter(it => it.x >= col.xMin && it.x < col.xMax);
        const code = cell.find(it => CC_RE.test(it.text));

        if (code) {
          if (curCode && curCode !== code.text) commit(ci);
          if (!curStart) curStart = col.time;
          curCode = code.text;
          // deduplicate: skip items already in curCellItems at same y
          for (const it of cell) {
            if (!curCellItems.some(e => e.text === it.text && Math.abs(e.y - it.y) < 4)) {
              curCellItems.push(it);
            }
          }
        } else if (curCode) {
          commit(ci);
        }
      }
      commit(cols.length);
    }
  }

  return slots.sort((a, b) =>
    a.day_of_week !== b.day_of_week
      ? a.day_of_week - b.day_of_week
      : a.start_time.localeCompare(b.start_time)
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

async function parsePDF(filePath) {
  const buffer       = fs.readFileSync(filePath);
  const allPageItems = [];
  let   rawText      = '';

  const options = {
    pagerender(pageData) {
      return pageData.getTextContent().then(content => {
        const items = [];
        let pageText = '';
        for (const item of content.items) {
          const t = (item.str || '').trim();
          if (t) {
            items.push({
              text: t,
              x: Math.round(item.transform[4]),
              y: Math.round(item.transform[5]),
            });
          }
          pageText += item.str + ' ';
        }
        allPageItems.push(items);
        rawText += pageText + '\n';
        return pageText;
      });
    },
  };

  const parsed = await pdfParse(buffer, options);
  const text   = rawText || parsed.text;
  const lines  = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 3);

  const events         = extractCalendarEvents(lines);
  const timetableSlots = extractGridTimetable(allPageItems);

  console.log(`[pdfParser] pages:${parsed.numpages} events:${events.length} slots:${timetableSlots.length}`);
  if (timetableSlots.length > 0) {
    console.log('[pdfParser] slots:', JSON.stringify(timetableSlots, null, 2));
  } else {
    console.log('[pdfParser] no slots found. text sample:', text.slice(0, 600));
  }

  return {
    pageCount:      parsed.numpages,
    rawTextSize:    text.length,
    rawTextSample:  text.slice(0, 1500),
    events,
    timetableSlots,
  };
}

module.exports = { parsePDF };
