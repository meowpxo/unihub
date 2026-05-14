const db = require('../config/db');
const { getAssignments, isUsingDummy } = require('../utils/moodleClient');

// ── POST /api/moodle/sync ─────────────────────────────────────────────────────
// Fetch assignments (Moodle or dummy) and upsert into the tasks table.
// Existing Moodle tasks are updated if the lecturer changes the due date or title.
async function syncMoodle(req, res) {
  try {
    const assignments = await getAssignments();
    let newCount = 0, updatedCount = 0;

    for (const a of assignments) {
      const [existing] = await db.query(
        'SELECT id FROM tasks WHERE user_id = ? AND moodle_id = ?',
        [req.user.id, a.moodle_id]
      );

      if (existing.length === 0) {
        await db.query(
          `INSERT INTO tasks
             (user_id, title, course, course_code, task_type, priority,
              due_date, notes, source, moodle_id, moodle_synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'moodle', ?, NOW())`,
          [req.user.id, a.title, a.course, a.course_code,
           a.task_type, a.priority, a.due_date, a.description, a.moodle_id]
        );
        newCount++;
      } else {
        // Sync lecturer updates (title, due date, description)
        await db.query(
          `UPDATE tasks
           SET title=?, course=?, course_code=?, due_date=?, notes=?, moodle_synced_at=NOW()
           WHERE user_id=? AND moodle_id=?`,
          [a.title, a.course, a.course_code, a.due_date, a.description,
           req.user.id, a.moodle_id]
        );
        updatedCount++;
      }
    }

    return res.json({
      success:    true,
      message:    `Sync complete: ${newCount} new, ${updatedCount} updated`,
      new:        newCount,
      updated:    updatedCount,
      total:      assignments.length,
      isDummy:    isUsingDummy(),
    });
  } catch (err) {
    console.error('syncMoodle error:', err);
    return res.status(500).json({ success: false, message: 'Sync failed' });
  }
}

// ── GET /api/moodle/status ────────────────────────────────────────────────────
async function getMoodleStatus(req, res) {
  try {
    const [[{ count, last_sync }]] = await db.query(
      `SELECT COUNT(*) AS count, MAX(moodle_synced_at) AS last_sync
       FROM tasks WHERE user_id = ? AND source = 'moodle'`,
      [req.user.id]
    );
    return res.json({
      success:   true,
      count:     count || 0,
      last_sync: last_sync || null,
      isDummy:   isUsingDummy(),
    });
  } catch (err) {
    console.error('getMoodleStatus error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { syncMoodle, getMoodleStatus };
