const router = require('express').Router();
const c = require('../controllers/busController');

// Fixed paths must be declared before "/:busId"
router.get('/available', c.available);
router.get('/route/:value', c.byRoute);
router.get('/departure/:value', c.byDeparture);
router.get('/destination/:value', c.byDestination);
router.get('/date/:date', c.byDate);

router.post('/', c.create);
router.get('/', c.getAll);
router.get('/:busId', c.getById);
router.get('/:busId/seats', c.seats);
router.put('/:busId', c.updateDetails);
router.put('/:busId/schedule', c.updateSchedule);
router.delete('/:busId', c.remove);

module.exports = router;
