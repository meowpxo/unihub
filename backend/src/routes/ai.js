const router  = require('express').Router();
const aiCtrl  = require('../controllers/aiController');
const authMw  = require('../middleware/auth');

router.use(authMw);

router.post('/study-plan', aiCtrl.studyPlan);
router.get('/exam-prep/courses', aiCtrl.examPrepCourses);
router.post('/exam-prep', aiCtrl.examPrep);

module.exports = router;
