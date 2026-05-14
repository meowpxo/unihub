const db = require('../config/db');

// Malaysian grading scale (common public university scale)
function gradeFromPct(pct) {
  if (pct >= 80) return { grade: 'A',  gp: 4.00 };
  if (pct >= 75) return { grade: 'A-', gp: 3.67 };
  if (pct >= 70) return { grade: 'B+', gp: 3.33 };
  if (pct >= 65) return { grade: 'B',  gp: 3.00 };
  if (pct >= 60) return { grade: 'B-', gp: 2.67 };
  if (pct >= 55) return { grade: 'C+', gp: 2.33 };
  if (pct >= 50) return { grade: 'C',  gp: 2.00 };
  if (pct >= 45) return { grade: 'D',  gp: 1.00 };
  return { grade: 'F', gp: 0.00 };
}

// GET /api/gpa/summary
async function getSummary(req, res) {
  try {
    const [courses] = await db.query(
      'SELECT * FROM gpa_courses WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    let totalGP = 0;
    let totalCH = 0;
    const courseDetails = [];

    for (const c of courses) {
      const [assessments] = await db.query(
        'SELECT * FROM gpa_assessments WHERE gpa_course_id = ? ORDER BY created_at ASC',
        [c.id]
      );

      let weightedScore = 0;
      let totalWeight   = 0;

      for (const a of assessments) {
        if (a.score !== null) {
          const pct = (parseFloat(a.score) / parseFloat(a.max_score)) * 100;
          weightedScore += pct * parseFloat(a.weight);
          totalWeight   += parseFloat(a.weight);
        }
      }

      let totalPct  = null;
      let gradeInfo = null;

      if (totalWeight > 0) {
        totalPct  = weightedScore / totalWeight;
        gradeInfo = gradeFromPct(totalPct);
        totalGP  += gradeInfo.gp * c.credit_hours;
        totalCH  += c.credit_hours;
      }

      courseDetails.push({
        ...c,
        assessments,
        totalPct:   totalPct !== null ? Math.round(totalPct * 10) / 10 : null,
        grade:      gradeInfo?.grade      ?? null,
        gradePoint: gradeInfo?.gp         ?? null,
      });
    }

    const cgpa = totalCH > 0 ? Math.round((totalGP / totalCH) * 100) / 100 : null;

    return res.json({
      success: true,
      cgpa,
      totalCreditHours: totalCH,
      courses: courseDetails,
    });
  } catch (err) {
    console.error('getSummary error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/gpa/courses
async function addCourse(req, res) {
  try {
    const { course_code, course_name, credit_hours, semester } = req.body;
    if (!course_name) {
      return res.status(400).json({ success: false, message: 'Course name is required' });
    }
    const [result] = await db.query(
      `INSERT INTO gpa_courses (user_id, course_code, course_name, credit_hours, semester)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, course_code || null, course_name, credit_hours || 3, semester || null]
    );
    return res.status(201).json({ success: true, id: result.insertId, message: 'Course added' });
  } catch (err) {
    console.error('addCourse error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// PUT /api/gpa/courses/:id
async function updateCourse(req, res) {
  try {
    const { id } = req.params;
    const { course_code, course_name, credit_hours, semester } = req.body;
    const [result] = await db.query(
      `UPDATE gpa_courses SET course_code=?, course_name=?, credit_hours=?, semester=?
       WHERE id=? AND user_id=?`,
      [course_code || null, course_name, credit_hours || 3, semester || null, id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    return res.json({ success: true, message: 'Course updated' });
  } catch (err) {
    console.error('updateCourse error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// DELETE /api/gpa/courses/:id
async function deleteCourse(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM gpa_courses WHERE id=? AND user_id=?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }
    return res.json({ success: true, message: 'Course deleted' });
  } catch (err) {
    console.error('deleteCourse error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/gpa/courses/:courseId/assessments
async function addAssessment(req, res) {
  try {
    const { courseId } = req.params;
    const { name, weight, score, max_score } = req.body;

    if (!name || weight === undefined) {
      return res.status(400).json({ success: false, message: 'Name and weight are required' });
    }

    const [courses] = await db.query(
      'SELECT id FROM gpa_courses WHERE id=? AND user_id=?',
      [courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    const [result] = await db.query(
      `INSERT INTO gpa_assessments (gpa_course_id, user_id, name, weight, score, max_score)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [courseId, req.user.id, name, weight, score ?? null, max_score ?? 100]
    );
    return res.status(201).json({ success: true, id: result.insertId, message: 'Assessment added' });
  } catch (err) {
    console.error('addAssessment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// PUT /api/gpa/assessments/:id
async function updateAssessment(req, res) {
  try {
    const { id } = req.params;
    const { name, weight, score, max_score } = req.body;
    const [result] = await db.query(
      `UPDATE gpa_assessments SET name=?, weight=?, score=?, max_score=?
       WHERE id=? AND user_id=?`,
      [name, weight, score ?? null, max_score ?? 100, id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    return res.json({ success: true, message: 'Assessment updated' });
  } catch (err) {
    console.error('updateAssessment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

// DELETE /api/gpa/assessments/:id
async function deleteAssessment(req, res) {
  try {
    const { id } = req.params;
    const [result] = await db.query(
      'DELETE FROM gpa_assessments WHERE id=? AND user_id=?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }
    return res.json({ success: true, message: 'Assessment deleted' });
  } catch (err) {
    console.error('deleteAssessment error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  getSummary, addCourse, updateCourse, deleteCourse,
  addAssessment, updateAssessment, deleteAssessment,
};
