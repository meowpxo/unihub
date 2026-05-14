const router     = require('express').Router();
const tasksCtrl  = require('../controllers/tasksController');
const authMw     = require('../middleware/auth');

router.use(authMw);

router.get('/',          tasksCtrl.getTasks);
router.post('/',         tasksCtrl.createTask);
router.patch('/:id/toggle', tasksCtrl.toggleTask);
router.put('/:id',       tasksCtrl.updateTask);
router.delete('/:id',    tasksCtrl.deleteTask);

module.exports = router;
