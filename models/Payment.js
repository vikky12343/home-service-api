const mongoose = require('mongoose');
const { PAYMENT_STATUS } = require('../config/constants');

const paymentSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  paymentMethod: {
    type: String,
    enum: ['razorpay', 'wallet', 'cod'],
    default: 'razorpay',
  },
  status: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
  },
  razorpayOrderId: {
    type: String,
    default: null,
  },
  razorpayPaymentId: {
    type: String,
    default: null,
  },
  razorpaySignature: {
    type: String,
    default: null,
  },
  transactionId: {
    type: String,
    default: null,
  },
  failureReason: {
    type: String,
    default: null,
  },
  refundAmount: {
    type: Number,
    default: 0,
    min: 0,
  },
  refundDate: {
    type: Date,
    default: null,
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: null,
  },
  webhookProcessed: {
    type: Boolean,
    default: false,
  },
  idempotencyKey: {
    type: String,
    sparse: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for queries and uniqueness
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1, status: 1 });
paymentSchema.index({ razorpayPaymentId: 1 }, { unique: true, sparse: true });
paymentSchema.index({ status: 1 });
paymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', paymentSchema);
