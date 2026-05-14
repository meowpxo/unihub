const router     = require('express').Router();
const moodleCtrl = require('../controllers/moodleController');
const authMw     = require('../middleware/auth');

router.use(authMw);

router.get('/status', moodleCtrl.getMoodleStatus);
router.post('/sync',  moodleCtrl.syncMoodle);

module.exports = router;
