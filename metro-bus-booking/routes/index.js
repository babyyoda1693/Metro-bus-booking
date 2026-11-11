const router = require('express').Router();

// To add a feature: create model + controller + route file, then register it here.
router.use('/buses', require('./buses'));
router.use('/bookings', require('./bookings'));
router.use('/passengers', require('./passengers'));

module.exports = router;
