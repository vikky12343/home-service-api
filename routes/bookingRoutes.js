const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeAdmin, authorizeWorker } = require('../middleware/authorization');
const { validateBooking } = require('../middleware/validators');

// All routes require authentication
router.use(authMiddleware);

// Customer routes
router.post('/', validateBooking, bookingController.createBooking);
router.get('/', bookingController.getBookings);
router.get('/:id', bookingController.getBookingById);
router.put('/:id/cancel', bookingController.cancelBooking);
router.put('/:id/reschedule', bookingController.rescheduleBooking);

// Admin/Worker routes
router.put('/:id/status', authorizeAdmin, bookingController.updateBookingStatus);

module.exports = router;
