const router     = require('express').Router();
const authCtrl   = require('../controllers/authController');
const authMw     = require('../middleware/auth');

// Public
router.post('/register', authCtrl.register);
router.post('/login',    authCtrl.login);
router.post('/logout',   authCtrl.logout);

// Protected
router.get('/me', authMw, authCtrl.me);

module.exports = router;
