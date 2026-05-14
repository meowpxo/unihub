const db = require('../config/db');

// GET /api/tasks
async function getTasks(req, res) {
  try {
    const { type, done } = req.query;
    let query  = 'SELECT * FROM tasks WHERE user_id = ?';
    const params = [req.user.id];

    if (type && type !== 'All') {
      query += ' AND task_type = ?';
      params.push(type.toLowerCase());
    }
    if (done !== undefined) {
      query += ' AND is_done = ?';
      params.push(done === '1' ? 1 : 0);
    }
    query += ' ORDER BY due_date ASC, created_at DESC';

    const [tasks] = await db.query(query, params);
    return res.json({ success: true, tasks });
  } catch (err) {
    console.error('getTasks error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/tasks
async function createTask(req, res) {
  try {
    const { title, course, course_code, task_type, priority, due_date, notes } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'Title is required' });

    const [result] = await db.query(
      `INSERT INTO tasks (user_id, title, course, course_code, task_type, priority, due_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, course || null, course_code || null,
       task_type || 'other', priority || 'Med', due_date || null, notes || null]
    );
    return res.status(201).json({ success: true, id: result.insertId, message: 'Task created' });
  } catch (err) {
    console.error('createTask error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// PATCH /api/tasks/:id/toggle
async function toggleTask(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      `UPDATE tasks SET is_done = NOT is_done WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task toggled' });
  } catch (err) {
    console.error('toggleTask error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// PUT /api/tasks/:id
async function updateTask(req, res) {
  try {
    const { id } = req.params;
    const { title, course, course_code, task_type, priority, due_date, notes } = req.body;
    const [result] = await db.query(
      `UPDATE tasks SET title=?, course=?, course_code=?, task_type=?, priority=?, due_date=?, notes=?
       WHERE id=? AND user_id=?`,
      [title, course || null, course_code || null, task_type || 'other',
       priority || 'Med', due_date || null, notes || null, id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task updated' });
  } catch (err) {
    console.error('updateTask error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// DELETE /api/tasks/:id
async function deleteTask(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM tasks WHERE id=? AND user_id=?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Task not found' });
    return res.json({ success: true, message: 'Task deleted' });
  } catch (err) {
    console.error('deleteTask error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = { getTasks, createTask, toggleTask, updateTask, deleteTask };
