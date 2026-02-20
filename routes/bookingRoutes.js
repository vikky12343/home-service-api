const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeAdmin, authorizeWorker } = require('../middleware/authorization');
const { validateBooking } = require('../middleware/validators');

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Service booking management
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     tags: [Bookings]
 *     summary: Create a new booking
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service, scheduledDate, address]
 *             properties:
 *               service:
 *                 type: string
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *               address:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *   get:
 *     tags: [Bookings]
 *     summary: Get user bookings
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of bookings retrieved
 */

/**
 * @swagger
 * /api/v1/bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get booking details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking details retrieved
 *       404:
 *         description: Booking not found
 */

/**
 * @swagger
 * /api/v1/bookings/{id}/cancel:
 *   put:
 *     tags: [Bookings]
 *     summary: Cancel a booking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */

/**
 * @swagger
 * /api/v1/bookings/{id}/reschedule:
 *   put:
 *     tags: [Bookings]
 *     summary: Reschedule a booking
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scheduledDate]
 *             properties:
 *               scheduledDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Booking rescheduled successfully
 */

/**
 * @swagger
 * /api/v1/bookings/{id}/status:
 *   put:
 *     tags: [Bookings]
 *     summary: Update booking status (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, completed, cancelled]
 *     responses:
 *       200:
 *         description: Booking status updated
 */

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
