const path      = require('path');
const fs        = require('fs');
const db        = require('../config/db');
const { parsePDF } = require('../utils/pdfParser');
const { UPLOAD_DIR } = require('../middleware/upload');

// ── POST /api/pdf/parse ────────────────────────────────────────────
async function uploadAndParse(req, res) {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No PDF file uploaded' });
  }

  const { originalname, filename, size } = req.file;
  let uploadId = null;

  try {
    // 1. Record the upload in the DB (status = processing)
    const [insertResult] = await db.query(
      `INSERT INTO pdf_uploads (user_id, original_name, stored_name, file_size, status)
       VALUES (?, ?, ?, ?, 'processing')`,
      [req.user.id, originalname, filename, size]
    );
    uploadId = insertResult.insertId;

    // 2. Run the parser
    const filePath = path.join(UPLOAD_DIR, filename);
    const parseResult = await parsePDF(filePath);
    console.log(`[PDF] pages=${parseResult.pageCount} events=${parseResult.events.length} timetableSlots=${parseResult.timetableSlots.length}`);
    if (parseResult.rawTextSample) console.log('[PDF] raw text sample:\n', parseResult.rawTextSample);

    // 3. Save all extracted events to the DB
    if (parseResult.events.length > 0) {
      const rows = parseResult.events.map(ev => [
        req.user.id,
        uploadId,
        ev.title,
        ev.date || null,
        ev.type,
        ev.description || null,
        ev.raw_text || null,
      ]);

      await db.query(
        `INSERT INTO schedule_events
           (user_id, pdf_upload_id, title, event_date, event_type, description, raw_text)
         VALUES ?`,
        [rows]
      );
    }

    // 4. Mark upload as completed
    await db.query(
      `UPDATE pdf_uploads SET status = 'completed', processed_at = NOW() WHERE id = ?`,
      [uploadId]
    );

    return res.json({
      success: true,
      message: `Parsed successfully. ${parseResult.events.length} events and ${parseResult.timetableSlots.length} timetable slots found.`,
      upload: {
        id:           uploadId,
        originalName: originalname,
        pageCount:    parseResult.pageCount,
      },
      events:         parseResult.events,
      timetableSlots: parseResult.timetableSlots,
    });

  } catch (err) {
    console.error('PDF parse error:', err);

    // Mark as failed
    if (uploadId) {
      await db.query(
        `UPDATE pdf_uploads SET status = 'failed', error_message = ? WHERE id = ?`,
        [err.message, uploadId]
      ).catch(() => {});
    }

    return res.status(500).json({ success: false, message: 'Failed to parse PDF', error: err.message });
  }
}

// ── GET /api/pdf/history ───────────────────────────────────────────
async function getHistory(req, res) {
  try {
    const [uploads] = await db.query(
      `SELECT id, original_name, file_size, status, uploaded_at, processed_at
       FROM pdf_uploads
       WHERE user_id = ?
       ORDER BY uploaded_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    return res.json({ success: true, uploads });
  } catch (err) {
    console.error('getHistory error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── GET /api/pdf/:uploadId/events ──────────────────────────────────
async function getEventsByUpload(req, res) {
  try {
    const { uploadId } = req.params;
    const [events] = await db.query(
      `SELECT id, title, event_date, event_type, description, saved_to_schedule
       FROM schedule_events
       WHERE user_id = ? AND pdf_upload_id = ?
       ORDER BY event_date ASC`,
      [req.user.id, uploadId]
    );
    return res.json({ success: true, events });
  } catch (err) {
    console.error('getEventsByUpload error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── PATCH /api/pdf/events/:eventId/save ────────────────────────────
// Marks an extracted event as "saved to schedule"
async function saveEvent(req, res) {
  try {
    const { eventId } = req.params;
    const [result] = await db.query(
      `UPDATE schedule_events SET saved_to_schedule = 1
       WHERE id = ? AND user_id = ?`,
      [eventId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    return res.json({ success: true, message: 'Event saved to schedule' });
  } catch (err) {
    console.error('saveEvent error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── DELETE /api/pdf/:uploadId ──────────────────────────────────────
async function deleteUpload(req, res) {
  try {
    const { uploadId } = req.params;
    const [rows] = await db.query(
      'SELECT stored_name FROM pdf_uploads WHERE id = ? AND user_id = ?',
      [uploadId, req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Upload not found' });
    }

    // Delete physical file
    const filePath = path.join(UPLOAD_DIR, rows[0].stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    // Cascade delete in DB (events deleted via FK ON DELETE CASCADE)
    await db.query('DELETE FROM pdf_uploads WHERE id = ?', [uploadId]);

    return res.json({ success: true, message: 'Upload and events deleted' });
  } catch (err) {
    console.error('deleteUpload error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── PATCH /api/pdf/:uploadId/save-all ─────────────────────────────────────────
// Marks every extracted event in an upload as saved to schedule
async function saveAllEvents(req, res) {
  try {
    const { uploadId } = req.params;
    const [uploads] = await db.query(
      'SELECT id FROM pdf_uploads WHERE id=? AND user_id=?',
      [uploadId, req.user.id]
    );
    if (uploads.length === 0) {
      return res.status(404).json({ success: false, message: 'Upload not found' });
    }
    const [result] = await db.query(
      `UPDATE schedule_events SET saved_to_schedule = 1
       WHERE pdf_upload_id = ? AND user_id = ?`,
      [uploadId, req.user.id]
    );
    return res.json({
      success: true,
      message: `${result.affectedRows} event(s) saved to schedule`,
    });
  } catch (err) {
    console.error('saveAllEvents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { uploadAndParse, getHistory, getEventsByUpload, saveEvent, saveAllEvents, deleteUpload };
