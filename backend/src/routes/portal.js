const router      = require('express').Router();
const portalCtrl  = require('../controllers/portalController');
const authMw      = require('../middleware/auth');

// All portal-link actions are for the logged-in app user.
router.use(authMw);

router.get('/status',      portalCtrl.status);
router.post('/connect',    portalCtrl.connect);
router.post('/disconnect', portalCtrl.disconnect);
router.post('/sync',       portalCtrl.sync);

module.exports = router;
