const express = require('express');
const { handleWebhook } = require('../controllers/paymentController');

const router = express.Router();

// Webhook endpoint - PUBLIC (no auth required)
// CRITICAL: Razorpay signature is verified in controller
router.post('/razorpay', handleWebhook);

module.exports = router;
