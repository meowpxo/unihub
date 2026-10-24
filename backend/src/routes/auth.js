const router     = require('express').Router();
const authCtrl   = require('../controllers/authController');
const authMw     = require('../middleware/auth');

// Public
router.post('/register', authCtrl.register);
router.post('/login',    authCtrl.login);
router.post('/logout',   authCtrl.logout);
router.post('/forgot-password', authCtrl.forgotPassword);
router.post('/reset-password',  authCtrl.resetPassword);

// Protected
router.get('/me',       authMw, authCtrl.me);
router.put('/profile',  authMw, authCtrl.updateProfile);
router.put('/password', authMw, authCtrl.changePassword);

module.exports = router;
