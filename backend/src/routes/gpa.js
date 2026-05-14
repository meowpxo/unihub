const router  = require('express').Router();
const gpaCtrl = require('../controllers/gpaController');
const authMw  = require('../middleware/auth');

router.use(authMw);

router.get('/summary',                          gpaCtrl.getSummary);
router.post('/courses',                         gpaCtrl.addCourse);
router.put('/courses/:id',                      gpaCtrl.updateCourse);
router.delete('/courses/:id',                   gpaCtrl.deleteCourse);
router.post('/courses/:courseId/assessments',   gpaCtrl.addAssessment);
router.put('/assessments/:id',                  gpaCtrl.updateAssessment);
router.delete('/assessments/:id',               gpaCtrl.deleteAssessment);

module.exports = router;
