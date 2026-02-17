const mongoose = require('mongoose');
const { BOOKING_STATUS, PAYMENT_STATUS } = require('../config/constants');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  serviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: true,
  },
  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(BOOKING_STATUS),
    default: BOOKING_STATUS.PENDING,
  },
  paymentStatus: {
    type: String,
    enum: Object.values(PAYMENT_STATUS),
    default: PAYMENT_STATUS.PENDING,
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  cancellationReason: {
    type: String,
    default: null,
  },
  cancellationDate: {
    type: Date,
    default: null,
  },
  rescheduleHistory: [
    {
      previousDate: Date,
      previousTime: String,
      newDate: Date,
      newTime: String,
      reason: String,
      rescheduleDate: Date,
    },
  ],
  notes: {
    type: String,
    default: '',
  },
  idempotencyKey: {
    type: String,
    sparse: true,
    unique: true,
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
  workerCancelledAt: {
    type: Date,
    default: null,
  },
  workerCancellationReason: {
    type: String,
    default: null,
  },
  isDeleted: {
    type: Boolean,
    default: false,
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

// Composite indexes for queries
bookingSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, isDeleted: 1, status: 1 });
bookingSchema.index({ workerId: 1, status: 1 });
bookingSchema.index({ serviceId: 1, date: 1, time: 1, isDeleted: 1 }, {
  unique: true,
  sparse: true,
  partialFilterExpression: {
    status: { $in: ['pending', 'assigned', 'accepted', 'in_progress'] }
  }
});
bookingSchema.index({ idempotencyKey: 1, userId: 1 }, { sparse: true });
bookingSchema.index({ status: 1, date: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
