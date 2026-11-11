const router = require('express').Router();
const c = require('../controllers/bookingController');

router.get('/passenger/:name', c.byPassenger);
router.get('/phone/:phone', c.byPhone);
router.get('/email/:email', c.byEmail);
router.get('/bus/:busId', c.byBus);
router.get('/date/:date', c.byDate);

router.post('/', c.create);
router.get('/', c.getAll);
router.get('/:bookingId', c.getById);
router.put('/:bookingId', c.update);
router.delete('/:bookingId', c.cancel);

module.exports = router;
