const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Cart = require('../models/Cart');
const Service = require('../models/Service');
const Address = require('../models/Address');
const Notification = require('../models/Notification');
const { sendResponse, sendPaginatedResponse, sendError } = require('../utils/response');
const { BOOKING_STATUS, PAYMENT_STATUS, NOTIFICATION_TYPES } = require('../config/constants');

// @desc Create booking with transaction support and idempotency
// @route POST /api/bookings
// @access Private
exports.createBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { serviceId, addressId, date, time, notes, idempotencyKey } = req.body;
    const userId = req.user.id;

    // Check idempotency (prevent duplicate bookings)
    if (idempotencyKey) {
      const existingBooking = await Booking.findOne({
        idempotencyKey,
        userId,
        isDeleted: false
      }).session(session);

      if (existingBooking) {
        await session.abortTransaction();
        return sendResponse(res, 200, true, 'Booking already exists', existingBooking);
      }
    }

    // Validate service
    const service = await Service.findById(serviceId).session(session);
    if (!service) {
      await session.abortTransaction();
      return sendError(res, 404, 'Service not found');
    }

    // Validate address
    const address = await Address.findOne({
      _id: addressId,
      userId,
      isDeleted: false,
    }).session(session);

    if (!address) {
      await session.abortTransaction();
      return sendError(res, 404, 'Address not found');
    }

    // Check for slot availability (prevent overbooking with unique partial index)
    const existingSlot = await Booking.findOne({
      serviceId,
      date: new Date(date),
      time,
      status: { $nin: ['cancelled'] },
      isDeleted: false
    }).session(session);

    if (existingSlot) {
      await session.abortTransaction();
      return sendError(res, 409, 'This time slot is no longer available');
    }

    // Calculate final price
    const discountAmount = (service.price * service.discount) / 100;
    const finalPrice = service.price - discountAmount;

    // Create booking with idempotency key
    const booking = await Booking.create([{
      userId,
      serviceId,
      addressId,
      date: new Date(date),
      time,
      totalAmount: finalPrice,
      notes,
      idempotencyKey: idempotencyKey || null,
      status: BOOKING_STATUS.PENDING,
      paymentStatus: PAYMENT_STATUS.PENDING
    }], { session });

    // Populate references
    await booking[0].populate(['serviceId', 'addressId']);

    // Clear cart
    await Cart.findOneAndDelete({ userId }, { session });

    // Create notification
    await Notification.create([{
      userId,
      title: 'Booking Created',
      message: `Your booking for ${service.name} is created. Awaiting payment.`,
      type: NOTIFICATION_TYPES.BOOKING_CONFIRMED,
      relatedId: booking[0]._id,
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 201, true, 'Booking created successfully', booking[0]);
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Get all bookings
// @route GET /api/bookings
// @access Private
exports.getBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { userId: req.user.id, isDeleted: false };

    if (status) {
      filter.status = status;
    }

    const skip = (page - 1) * limit;
    const bookings = await Booking.find(filter)
      .populate(['serviceId', 'addressId', 'workerId'])
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Booking.countDocuments(filter);

    return sendPaginatedResponse(res, 200, 'Bookings retrieved', bookings, {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get booking by ID
// @route GET /api/bookings/:id
// @access Private
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    }).populate(['serviceId', 'addressId', 'workerId']);

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    return sendResponse(res, 200, true, 'Booking retrieved', booking);
  } catch (error) {
    next(error);
  }
};

// @desc Cancel booking with transaction support and refund processing
// @route PUT /api/bookings/:id/cancel
// @access Private
exports.cancelBooking = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { cancellationReason } = req.body;
    const userId = req.user.id;
    const bookingId = req.params.id;

    const booking = await Booking.findOne({
      _id: bookingId,
      userId,
      isDeleted: false,
    }).session(session);

    if (!booking) {
      await session.abortTransaction();
      return sendError(res, 404, 'Booking not found');
    }

    // Check if booking can be cancelled
    const bookingDate = new Date(booking.date);
    const cancellationDeadline = new Date(bookingDate.getTime() - 2 * 60 * 60 * 1000); // 2 hours before
    
    if (new Date() > cancellationDeadline) {
      await session.abortTransaction();
      return sendError(res, 400, 'Cannot cancel booking within 2 hours of service time');
    }

    // Calculate refund amount (100% for > 2 hours cancellation)
    const refundAmount = booking.totalAmount;

    // Update booking status
    booking.status = BOOKING_STATUS.CANCELLED;
    booking.cancellationReason = cancellationReason || 'Cancelled by customer';
    booking.cancellationDate = new Date();
    booking.refundStatus = 'pending';
    booking.refundAmount = refundAmount;
    await booking.save({ session });

    // Find associated payment and process refund
    const Payment = require('../models/Payment');
    const payment = await Payment.findOne({
      bookingId,
      status: PAYMENT_STATUS.SUCCESS
    }).session(session);

    if (payment) {
      // Trigger refund via Razorpay
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });

      try {
        const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
          amount: refundAmount * 100,
          notes: {
            reason: cancellationReason || 'Booking cancelled by customer',
            bookingId: bookingId.toString()
          }
        });

        // Update payment refund status
        payment.status = PAYMENT_STATUS.REFUNDED;
        payment.refundStatus = 'processed';
        payment.refundAmount = refundAmount;
        payment.refundDate = new Date();
        payment.razorpayRefundId = razorpayRefund.id;
        await payment.save({ session });

        booking.refundStatus = 'processed';
      } catch (refundError) {
        console.error('Refund processing error:', refundError);
        // Refund failed but update status to allow retry
        payment.refundStatus = 'failed';
        await payment.save({ session });
        booking.refundStatus = 'failed';
      }
    }

    // Create notification
    await Notification.create([{
      userId,
      title: 'Booking Cancelled',
      message: `Your booking has been cancelled. Refund of ₹${refundAmount} will be processed.`,
      type: NOTIFICATION_TYPES.CANCELLATION,
      relatedId: booking._id,
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Booking cancelled successfully', {
      booking,
      refundAmount,
      refundStatus: booking.refundStatus
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Reschedule booking
// @route PUT /api/bookings/:id/reschedule
// @access Private
exports.rescheduleBooking = async (req, res, next) => {
  try {
    const { newDate, newTime, reason } = req.body;

    const booking = await Booking.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    // Check if booking can be rescheduled
    if (![BOOKING_STATUS.PENDING, BOOKING_STATUS.ASSIGNED].includes(booking.status)) {
      return sendError(res, 400, 'Cannot reschedule this booking');
    }

    // Add to reschedule history
    booking.rescheduleHistory.push({
      previousDate: booking.date,
      previousTime: booking.time,
      newDate: new Date(newDate),
      newTime,
      reason,
      rescheduleDate: new Date(),
    });

    booking.date = new Date(newDate);
    booking.time = newTime;

    await booking.save();

    // Create notification
    const notification = new Notification({
      userId: req.user.id,
      title: 'Booking Rescheduled',
      message: 'Your booking has been rescheduled',
      type: NOTIFICATION_TYPES.RESCHEDULED,
      relatedId: booking._id,
    });

    await notification.save();

    return sendResponse(res, 200, true, 'Booking rescheduled successfully', booking);
  } catch (error) {
    next(error);
  }
};

// @desc Update booking status (Admin/Worker only)
// @route PUT /api/bookings/:id/status
// @access Private
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!Object.values(BOOKING_STATUS).includes(status)) {
      return sendError(res, 400, 'Invalid status');
    }

    const booking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, updatedAt: new Date() },
      { new: true }
    ).populate(['serviceId', 'addressId', 'workerId']);

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    return sendResponse(res, 200, true, 'Booking status updated', booking);
  } catch (error) {
    next(error);
  }
};
