const router  = require('express').Router();
const aiCtrl  = require('../controllers/aiController');
const authMw  = require('../middleware/auth');

router.use(authMw);

router.post('/study-plan', aiCtrl.studyPlan);

module.exports = router;
