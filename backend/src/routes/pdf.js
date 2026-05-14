const router    = require('express').Router();
const pdfCtrl   = require('../controllers/pdfController');
const authMw    = require('../middleware/auth');
const { upload } = require('../middleware/upload');

// All PDF routes require authentication
router.use(authMw);

// POST  /api/pdf/parse          – upload + parse
router.post('/parse', upload.single('pdf'), pdfCtrl.uploadAndParse);

// GET   /api/pdf/history        – user's upload history
router.get('/history', pdfCtrl.getHistory);

// GET   /api/pdf/:uploadId/events  – events for one upload
router.get('/:uploadId/events', pdfCtrl.getEventsByUpload);

// PATCH /api/pdf/events/:eventId/save  – save event to schedule
router.patch('/events/:eventId/save', pdfCtrl.saveEvent);

// PATCH  /api/pdf/:uploadId/save-all  – mark all events as saved to schedule
router.patch('/:uploadId/save-all', pdfCtrl.saveAllEvents);

// DELETE /api/pdf/:uploadId     – delete upload + events
router.delete('/:uploadId', pdfCtrl.deleteUpload);

module.exports = router;
