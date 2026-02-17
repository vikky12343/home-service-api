const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/', authMiddleware, ratingController.createRating);
router.get('/service/:serviceId', ratingController.getServiceRatings);
router.get('/user/:userId', ratingController.getUserRatings);
router.put('/:id', authMiddleware, ratingController.updateRating);

module.exports = router;
