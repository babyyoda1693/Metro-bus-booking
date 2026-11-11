const router = require('express').Router();
const c = require('../controllers/passengerController');

router.get('/', c.getAll);
router.get('/phone/:phone', c.byPhone);

module.exports = router;
