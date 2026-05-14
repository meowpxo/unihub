const db = require('../config/db');

// ── GET /api/schedule/timetable?day=1 ─────────────────────────────────────────
// day: 0=Sun, 1=Mon … 6=Sat  (optional – omit to get all)
async function getTimetable(req, res) {
  try {
    const day = parseInt(req.query.day);
    let query  = 'SELECT * FROM timetable_slots WHERE user_id = ?';
    const params = [req.user.id];

    if (!isNaN(day) && day >= 0 && day <= 6) {
      query += ' AND day_of_week = ?';
      params.push(day);
    }
    query += ' ORDER BY start_time ASC';

    const [slots] = await db.query(query, params);
    return res.json({ success: true, slots });
  } catch (err) {
    console.error('getTimetable error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /api/schedule/timetable ──────────────────────────────────────────────
async function addTimetableSlot(req, res) {
  try {
    const {
      course_name, course_code, day_of_week,
      start_time, end_time, venue, lecturer, slot_type, color_index,
    } = req.body;

    if (!course_name || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        message: 'course_name, day_of_week, start_time and end_time are required',
      });
    }

    const [result] = await db.query(
      `INSERT INTO timetable_slots
         (user_id, course_name, course_code, day_of_week, start_time, end_time,
          venue, lecturer, slot_type, color_index)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, course_name, course_code || null, day_of_week,
        start_time, end_time, venue || null, lecturer || null,
        slot_type || 'lecture', color_index ?? 0,
      ]
    );

    return res.status(201).json({ success: true, id: result.insertId, message: 'Slot added' });
  } catch (err) {
    console.error('addTimetableSlot error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── DELETE /api/schedule/timetable/:id ────────────────────────────────────────
async function deleteTimetableSlot(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM timetable_slots WHERE id=? AND user_id=?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    return res.json({ success: true, message: 'Slot deleted' });
  } catch (err) {
    console.error('deleteTimetableSlot error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── GET /api/schedule/events ──────────────────────────────────────────────────
// All schedule_events that have been saved to schedule (from PDF parsing)
async function getSavedEvents(req, res) {
  try {
    const [events] = await db.query(
      `SELECT id, title, event_date, event_type, description
       FROM schedule_events
       WHERE user_id = ? AND saved_to_schedule = 1
       ORDER BY event_date ASC`,
      [req.user.id]
    );
    return res.json({ success: true, events });
  } catch (err) {
    console.error('getSavedEvents error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── GET /api/schedule/clash ───────────────────────────────────────────────────
// Module 8: Smart Conflict Detection
// Finds dates (within next 30 days) that have 2+ tasks/events
async function getClash(req, res) {
  try {
    const [tasks] = await db.query(
      `SELECT id, title, due_date AS date, 'task' AS source,
              priority, course, task_type
       FROM tasks
       WHERE user_id = ? AND is_done = 0
         AND due_date >= CURDATE()
         AND due_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
      [req.user.id]
    );

    const [events] = await db.query(
      `SELECT id, title, event_date AS date, 'event' AS source, event_type
       FROM schedule_events
       WHERE user_id = ?
         AND event_date >= CURDATE()
         AND event_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`,
      [req.user.id]
    );

    const byDate = {};
    for (const item of [...tasks, ...events]) {
      if (!item.date) continue;
      const key = item.date instanceof Date
        ? item.date.toISOString().split('T')[0]
        : String(item.date).split('T')[0];
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(item);
    }

    const PRIORITY_RANK = { Low: 1, Med: 2, High: 3 };

    const clashes = Object.entries(byDate)
      .filter(([, items]) => items.length >= 2)
      .map(([date, items]) => {
        // Pick the lowest-priority task to suggest completing early
        const taskItems = items.filter(i => i.source === 'task');
        let suggestion = null;
        if (taskItems.length >= 1) {
          const pick = [...taskItems].sort(
            (a, b) => (PRIORITY_RANK[a.priority] || 2) - (PRIORITY_RANK[b.priority] || 2)
          )[0];
          const target = new Date(date);
          target.setDate(target.getDate() - 2);
          suggestion = {
            task_id:     pick.id,
            title:       pick.title,
            course:      pick.course || pick.course_code || null,
            target_date: target.toISOString().split('T')[0],
          };
        }
        return { date, count: items.length, items, suggestion };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return res.json({ success: true, clashes });
  } catch (err) {
    console.error('getClash error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── GET /api/schedule/dashboard ───────────────────────────────────────────────
// Aggregated stats for the dashboard screen
async function getDashboard(req, res) {
  try {
    const [[{ upcoming_count }]] = await db.query(
      `SELECT COUNT(*) AS upcoming_count FROM tasks
       WHERE user_id = ? AND is_done = 0 AND due_date >= CURDATE()`,
      [req.user.id]
    );

    const [[{ done_count }]] = await db.query(
      `SELECT COUNT(*) AS done_count FROM tasks WHERE user_id = ? AND is_done = 1`,
      [req.user.id]
    );

    const [upcoming] = await db.query(
      `SELECT id, title, course, course_code, task_type, priority, source,
              due_date, DATEDIFF(due_date, CURDATE()) AS days_left
       FROM tasks
       WHERE user_id = ? AND is_done = 0 AND due_date >= CURDATE()
       ORDER BY due_date ASC LIMIT 5`,
      [req.user.id]
    );

    // Tasks grouped by day-of-week for the next 7 days (workload chart)
    const [workload] = await db.query(
      `SELECT DATE_FORMAT(due_date, '%a') AS label,
              DAYOFWEEK(due_date) AS dow,
              COUNT(*) AS tasks
       FROM tasks
       WHERE user_id = ? AND is_done = 0
         AND due_date >= CURDATE()
         AND due_date < DATE_ADD(CURDATE(), INTERVAL 7 DAY)
       GROUP BY DATE(due_date)
       ORDER BY due_date ASC`,
      [req.user.id]
    );

    return res.json({
      success: true,
      stats: {
        upcomingDeadlines: upcoming_count,
        completedTasks:    done_count,
      },
      upcoming,
      workload,
    });
  } catch (err) {
    console.error('getDashboard error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// ── POST /api/schedule/timetable/bulk ────────────────────────────────────────
// Save an array of timetable slots extracted from a PDF
async function bulkAddTimetableSlots(req, res) {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots) || slots.length === 0) {
      return res.status(400).json({ success: false, message: 'slots array is required' });
    }

    const rows = slots.map((s, idx) => [
      req.user.id,
      s.course_name  || 'Unknown Course',
      s.course_code  || null,
      s.day_of_week,
      s.start_time,
      s.end_time,
      s.venue        || null,
      s.lecturer     || null,
      s.slot_type    || 'lecture',
      idx % 6,          // cycle color_index
    ]);

    await db.query(
      `INSERT INTO timetable_slots
         (user_id, course_name, course_code, day_of_week, start_time, end_time,
          venue, lecturer, slot_type, color_index)
       VALUES ?`,
      [rows]
    );

    return res.status(201).json({ success: true, message: `${rows.length} slots saved to timetable` });
  } catch (err) {
    console.error('bulkAddTimetableSlots error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  getTimetable, addTimetableSlot, deleteTimetableSlot,
  getSavedEvents, getClash, getDashboard, bulkAddTimetableSlots,
};
