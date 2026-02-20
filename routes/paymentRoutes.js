const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing and history
 */

/**
 * @swagger
 * /api/v1/payments/create-order:
 *   post:
 *     tags: [Payments]
 *     summary: Create payment order
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, bookingId]
 *             properties:
 *               amount:
 *                 type: number
 *               bookingId:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Order created successfully
 */

/**
 * @swagger
 * /api/v1/payments/verify:
 *   post:
 *     tags: [Payments]
 *     summary: Verify payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderId, paymentId, signature]
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentId:
 *                 type: string
 *               signature:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payment verified successfully
 */

/**
 * @swagger
 * /api/v1/payments/history:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment history
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Payment history retrieved
 */

/**
 * @swagger
 * /api/v1/payments/{id}:
 *   get:
 *     tags: [Payments]
 *     summary: Get payment details
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
 *         description: Payment details retrieved
 */

/**
 * @swagger
 * /api/v1/payments/{id}/refund:
 *   post:
 *     tags: [Payments]
 *     summary: Refund payment
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
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Refund processed successfully
 */

// All routes require authentication
router.use(authMiddleware);

// Payment endpoints
router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/:id/refund', paymentController.refundPayment);
router.get('/history', paymentController.getPaymentHistory);
router.get('/:id', paymentController.getPaymentById);

module.exports = router;
