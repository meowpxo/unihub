/**
 * clpReader.js — turns a Course Learning Plan file into plain text for the AI.
 *
 * Supports Excel (.xlsx / .xlsm — the usual CLP template, with "Section A -
 * Course Details" and "Section B - Learning Schedule" sheets) and PDF.
 * Each spreadsheet row becomes one line of "cell | cell | cell", which keeps the
 * week / dates / topics / CLO / assessment columns together for the model.
 */

const ExcelJS  = require('exceljs');
const pdfParse = require('pdf-parse');

const MAX_CHARS = 30000;   // plenty for a CLP; keeps the prompt a sensible size

// Helper sheets in the template that carry no course content.
const SKIP_SHEETS = /^(data|index|lists?|dropdowns?)$/i;

function cellText(cell) {
  let v;
  try { v = cell.text; } catch { v = cell.value; }
  if (v && typeof v === 'object') {
    if (Array.isArray(v.richText)) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v) v = v.result;             // formula → its computed value
    else if ('text' in v) v = v.text;                 // hyperlink
    else if (v instanceof Date) v = v.toISOString().slice(0, 10);
    else v = '';
  }
  if (v === '[object Object]') v = '';
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

async function excelToText(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const parts = [];
  for (const ws of wb.worksheets) {
    if (SKIP_SHEETS.test(ws.name.trim())) continue;
    const lines = [];
    ws.eachRow((row) => {
      const cells = [];
      const seen = new Set();                         // merged cells repeat their text
      row.eachCell((c) => {
        const t = cellText(c);
        if (t && !seen.has(t)) { seen.add(t); cells.push(t); }
      });
      if (cells.length) lines.push(cells.join(' | '));
    });
    if (lines.length) parts.push(`### Sheet: ${ws.name}\n${lines.join('\n')}`);
  }
  return parts.join('\n\n');
}

async function pdfToText(buffer) {
  const data = await pdfParse(buffer);
  return data.text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

// Returns the CLP as text, or throws an error with code 'UNSUPPORTED'.
async function clpToText(buffer, filename) {
  const name = String(filename || '').toLowerCase();
  let text;
  if (/\.(xlsx|xlsm)$/.test(name)) text = await excelToText(buffer);
  else if (/\.pdf$/.test(name)) text = await pdfToText(buffer);
  else {
    const e = new Error('This CLP file type can\'t be read yet. Ask for the CLP as an Excel (.xlsx/.xlsm) or PDF file.');
    e.code = 'UNSUPPORTED';
    throw e;
  }
  if (!text || text.length < 50) {
    const e = new Error('The CLP file looks empty or unreadable.');
    e.code = 'UNSUPPORTED';
    throw e;
  }
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\n…(truncated)' : text;
}

module.exports = { clpToText };
