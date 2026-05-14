const router    = require('express').Router();
const schedCtrl = require('../controllers/scheduleController');
const authMw    = require('../middleware/auth');

router.use(authMw);

router.get('/dashboard',          schedCtrl.getDashboard);
router.get('/timetable',          schedCtrl.getTimetable);
router.post('/timetable',         schedCtrl.addTimetableSlot);
router.post('/timetable/bulk',    schedCtrl.bulkAddTimetableSlots);
router.delete('/timetable/:id',   schedCtrl.deleteTimetableSlot);
router.get('/events',          schedCtrl.getSavedEvents);
router.get('/clash',           schedCtrl.getClash);

module.exports = router;
