const crypto = require('crypto');
const mongoose = require('mongoose');
const Razorpay = require('razorpay');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const WebhookLog = require('../models/WebhookLog');
const Notification = require('../models/Notification');
const { sendResponse, sendError } = require('../utils/response');
const { PAYMENT_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @desc Create Razorpay order
// @route POST /api/payments/create-order
// @access Private
exports.createOrder = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bookingId, amount, idempotencyKey } = req.body;
    const userId = req.user.id;

    // Validate idempotency key
    if (idempotencyKey) {
      const existingPayment = await Payment.findOne({
        idempotencyKey,
        userId
      }).session(session);

      if (existingPayment) {
        await session.abortTransaction();
        return sendResponse(res, 200, true, 'Order already created', {
          razorpayOrderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount
        });
      }
    }

    // Verify booking
    const booking = await Booking.findOne({
      _id: bookingId,
      userId
    }).session(session);

    if (!booking) {
      await session.abortTransaction();
      return sendError(res, 404, 'Booking not found');
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: amount * 100, // amount in paise
      currency: 'INR',
      receipt: `booking_${bookingId}_${Date.now()}`,
      payment_capture: 1,
      notes: {
        bookingId: bookingId.toString(),
        userId: userId.toString()
      }
    });

    // Create payment record
    const payment = await Payment.create([{
      bookingId,
      userId,
      amount,
      razorpayOrderId: razorpayOrder.id,
      status: PAYMENT_STATUS.PENDING,
      idempotencyKey: idempotencyKey || null,
      webhookProcessed: false
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 201, true, 'Order created successfully', {
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Create order error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Verify payment with signature verification (CRITICAL for security)
// @route POST /api/payments/verify
// @access Private
exports.verifyPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user.id;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      await session.abortTransaction();
      return sendError(res, 400, 'Missing payment details');
    }

    // CRITICAL: Verify Razorpay signature to prevent payment fraud
    const signatureData = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(signatureData)
      .digest('hex');

    if (razorpaySignature !== expectedSignature) {
      await session.abortTransaction();
      console.error('Invalid Razorpay signature detected', {
        received: razorpaySignature,
        expected: expectedSignature
      });
      return sendError(res, 400, 'Payment verification failed - Invalid signature');
    }

    // Check for duplicate payment (idempotency)
    const existingPayment = await Payment.findOne({
      razorpayPaymentId,
      userId,
      status: PAYMENT_STATUS.SUCCESS
    }).session(session);

    if (existingPayment) {
      await session.abortTransaction();
      return sendError(res, 400, 'Payment already processed');
    }

    // Find payment record
    const payment = await Payment.findOne({
      razorpayOrderId,
      userId
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return sendError(res, 404, 'Payment order not found');
    }

    // Fetch payment details from Razorpay for additional verification
    const razorpayPayment = await razorpay.payments.fetch(razorpayPaymentId);

    if (!razorpayPayment || razorpayPayment.status !== 'captured') {
      await session.abortTransaction();
      return sendError(res, 400, 'Payment not captured by Razorpay');
    }

    // Verify amount matches (prevent price manipulation)
    if (razorpayPayment.amount !== payment.amount * 100) {
      await session.abortTransaction();
      console.error('Payment amount mismatch detected', {
        razorpay: razorpayPayment.amount,
        stored: payment.amount * 100
      });
      return sendError(res, 400, 'Payment amount mismatch');
    }

    // Update payment
    payment.status = PAYMENT_STATUS.SUCCESS;
    payment.razorpayPaymentId = razorpayPaymentId;
    payment.razorpaySignature = razorpaySignature;
    payment.webhookProcessed = true;
    await payment.save({ session });

    // Update booking payment status
    const booking = await Booking.findByIdAndUpdate(
      payment.bookingId,
      {
        paymentStatus: PAYMENT_STATUS.SUCCESS,
        status: 'confirmed'
      },
      { new: true, session }
    );

    if (!booking) {
      await session.abortTransaction();
      return sendError(res, 404, 'Booking not found');
    }

    // Create notification
    const notification = await Notification.create([{
      userId,
      title: 'Payment Successful',
      message: `Payment of ₹${payment.amount} received for booking`,
      type: NOTIFICATION_TYPES.PAYMENT_SUCCESS,
      relatedId: booking._id
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Payment verified successfully', {
      payment: {
        id: payment._id,
        status: payment.status,
        amount: payment.amount
      },
      booking: {
        id: booking._id,
        status: booking.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Verify payment error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Refund payment
// @route POST /api/payments/:id/refund
// @access Private
exports.refundPayment = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id: paymentId } = req.params;
    const { amount, reason } = req.body;
    const userId = req.user.id;

    // Find payment
    const payment = await Payment.findOne({
      _id: paymentId,
      userId
    }).session(session);

    if (!payment) {
      await session.abortTransaction();
      return sendError(res, 404, 'Payment not found');
    }

    if (payment.status !== PAYMENT_STATUS.SUCCESS) {
      await session.abortTransaction();
      return sendError(res, 400, 'Can only refund completed payments');
    }

    if (!payment.razorpayPaymentId) {
      await session.abortTransaction();
      return sendError(res, 400, 'No Razorpay payment ID found');
    }

    // Create refund with Razorpay
    const refundAmount = (amount || payment.amount) * 100;
    const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: refundAmount,
      notes: {
        reason: reason || 'Booking cancelled',
        paymentId: paymentId.toString()
      }
    });

    if (!razorpayRefund || !razorpayRefund.id) {
      await session.abortTransaction();
      return sendError(res, 400, 'Refund failed');
    }

    // Update payment
    payment.status = PAYMENT_STATUS.REFUNDED;
    payment.refundStatus = 'processed';
    payment.refundAmount = amount || payment.amount;
    payment.refundDate = new Date();
    payment.razorpayRefundId = razorpayRefund.id;
    await payment.save({ session });

    // Update booking
    const booking = await Booking.findByIdAndUpdate(
      payment.bookingId,
      {
        status: 'cancelled',
        refundStatus: 'processed',
        refundAmount: amount || payment.amount,
        refundDate: new Date()
      },
      { new: true, session }
    );

    // Create notification
    await Notification.create([{
      userId,
      title: 'Refund Processed',
      message: `Refund of ₹${amount || payment.amount} has been initiated`,
      type: 'refund_processed',
      relatedId: booking._id
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Refund processed successfully', {
      refund: {
        id: razorpayRefund.id,
        amount: razorpayRefund.amount / 100,
        status: razorpayRefund.status
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Refund payment error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Get payment history
// @route GET /api/payments/history
// @access Private
exports.getPaymentHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const userId = req.user.id;

    const skip = (page - 1) * limit;
    const query = { userId };
    if (status) query.status = status;

    const payments = await Payment.find(query)
      .populate('bookingId')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Payment.countDocuments(query);

    return sendResponse(res, 200, true, 'Payment history retrieved', {
      payments,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get payment by ID
// @route GET /api/payments/:id
// @access Private
exports.getPaymentById = async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      userId: req.user.id,
    }).populate('bookingId');

    if (!payment) {
      return sendError(res, 404, 'Payment not found');
    }

    return sendResponse(res, 200, true, 'Payment retrieved', payment);
  } catch (error) {
    next(error);
  }
};

// @desc Handle Razorpay webhook (CRITICAL - Verify signature)
// @route POST /api/webhooks/razorpay
// @access Public
exports.handleWebhook = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { event, payload } = req.body;
    const webhookSignature = req.headers['x-razorpay-signature'];

    if (!event || !payload || !webhookSignature) {
      await session.abortTransaction();
      return sendError(res, 400, 'Missing webhook data');
    }

    // CRITICAL: Verify webhook signature to prevent unauthorized updates
    const signatureData = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(signatureData)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      await session.abortTransaction();
      console.error('Invalid webhook signature detected');
      return sendError(res, 400, 'Invalid webhook signature');
    }

    // Check for duplicate webhook (idempotency)
    const eventId = payload?.payload?.payment?.entity?.id || `${event}_${Date.now()}`;
    const existingLog = await WebhookLog.findOne({
      razorpayEventId: eventId
    }).session(session);

    if (existingLog) {
      await session.commitTransaction();
      return sendResponse(res, 200, true, 'Webhook already processed');
    }

    // Log webhook for idempotency
    await WebhookLog.create([{
      razorpayEventId: eventId,
      eventType: event,
      payload: req.body,
      processedAt: new Date()
    }], { session });

    // Process different webhook events
    switch (event) {
      case 'payment.captured':
        await handlePaymentCaptured(payload, session);
        break;
      case 'payment.failed':
        await handlePaymentFailed(payload, session);
        break;
      case 'refund.created':
        await handleRefundCreated(payload, session);
        break;
      case 'refund.failed':
        await handleRefundFailed(payload, session);
        break;
    }

    await session.commitTransaction();
    return sendResponse(res, 200, true, 'Webhook processed successfully');
  } catch (error) {
    await session.abortTransaction();
    console.error('Webhook processing error:', error);
    next(error);
  } finally {
    session.endSession();
  }
};

// Helper: Handle payment.captured event
async function handlePaymentCaptured(payload, session) {
  try {
    const paymentData = payload.payload?.payment?.entity;
    if (!paymentData) return;

    const payment = await Payment.findOneAndUpdate(
      { razorpayPaymentId: paymentData.id },
      {
        status: PAYMENT_STATUS.SUCCESS,
        webhookProcessed: true
      },
      { session, new: true }
    );

    if (payment) {
      await Booking.findByIdAndUpdate(
        payment.bookingId,
        { paymentStatus: PAYMENT_STATUS.SUCCESS, status: 'confirmed' },
        { session }
      );
    }
  } catch (error) {
    console.error('Error handling payment.captured:', error);
  }
}

// Helper: Handle payment.failed event
async function handlePaymentFailed(payload, session) {
  try {
    const paymentData = payload.payload?.payment?.entity;
    if (!paymentData) return;

    const payment = await Payment.findOneAndUpdate(
      { razorpayPaymentId: paymentData.id },
      { status: PAYMENT_STATUS.FAILED, webhookProcessed: true },
      { session }
    );

    if (payment) {
      await Booking.findByIdAndUpdate(
        payment.bookingId,
        { paymentStatus: PAYMENT_STATUS.FAILED },
        { session }
      );
    }
  } catch (error) {
    console.error('Error handling payment.failed:', error);
  }
}

// Helper: Handle refund.created event
async function handleRefundCreated(payload, session) {
  try {
    const refundData = payload.payload?.refund?.entity;
    if (!refundData) return;

    await Payment.findOneAndUpdate(
      { razorpayPaymentId: refundData.payment_id },
      {
        status: PAYMENT_STATUS.REFUNDED,
        refundStatus: 'processed',
        refundDate: new Date()
      },
      { session }
    );
  } catch (error) {
    console.error('Error handling refund.created:', error);
  }
}

// Helper: Handle refund.failed event
async function handleRefundFailed(payload, session) {
  try {
    const refundData = payload.payload?.refund?.entity;
    if (!refundData) return;

    await Payment.findOneAndUpdate(
      { razorpayPaymentId: refundData.payment_id },
      { refundStatus: 'failed' },
      { session }
    );
  } catch (error) {
    console.error('Error handling refund.failed:', error);
  }
}
