const router     = require('express').Router();
const googleCtrl = require('../controllers/googleController');
const authMw     = require('../middleware/auth');

// Google redirects the browser here — it carries a signed `state`, not an app token.
router.get('/callback', googleCtrl.callback);

router.use(authMw);

router.get('/status',      googleCtrl.status);
router.post('/auth-url',   googleCtrl.authUrl);
router.post('/sync',       googleCtrl.sync);
router.post('/disconnect', googleCtrl.disconnect);

module.exports = router;
