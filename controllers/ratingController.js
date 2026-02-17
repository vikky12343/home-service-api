const Rating = require('../models/Rating');
const Booking = require('../models/Booking');
const Service = require('../models/Service');
const { sendResponse, sendError } = require('../utils/response');

// @desc Create rating
// @route POST /api/ratings
// @access Private
exports.createRating = async (req, res, next) => {
  try {
    const { serviceId, bookingId, rating, review } = req.body;

    // Check if booking exists and is completed
    const booking = await Booking.findOne({
      _id: bookingId,
      userId: req.user.id,
    });

    if (!booking) {
      return sendError(res, 404, 'Booking not found');
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return sendError(res, 400, 'Can only rate completed bookings');
    }

    // Check if already rated
    const existingRating = await Rating.findOne({ bookingId });

    if (existingRating) {
      return sendError(res, 400, 'You have already rated this booking');
    }

    // Create rating
    const newRating = new Rating({
      userId: req.user.id,
      serviceId,
      bookingId,
      workerId: booking.workerId,
      rating,
      review,
    });

    await newRating.save();

    // Update service average rating
    const allRatings = await Rating.find({ serviceId });
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    await Service.findByIdAndUpdate(serviceId, {
      ratingAverage: avgRating,
      totalReviews: allRatings.length,
    });

    return sendResponse(res, 201, true, 'Rating created successfully', newRating);
  } catch (error) {
    next(error);
  }
};

// @desc Get ratings for service
// @route GET /api/ratings/service/:serviceId
// @access Public
exports.getServiceRatings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const skip = (page - 1) * limit;

    const ratings = await Rating.find({ serviceId: req.params.serviceId })
      .populate('userId', 'name profileImage')
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Rating.countDocuments({ serviceId: req.params.serviceId });

    return sendResponse(res, 200, true, 'Ratings retrieved', {
      ratings,
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

// @desc Get user ratings
// @route GET /api/ratings/user/:userId
// @access Public
exports.getUserRatings = async (req, res, next) => {
  try {
    const ratings = await Rating.find({ userId: req.params.userId })
      .populate(['serviceId', 'bookingId'])
      .sort({ createdAt: -1 });

    return sendResponse(res, 200, true, 'Ratings retrieved', ratings);
  } catch (error) {
    next(error);
  }
};

// @desc Update rating
// @route PUT /api/ratings/:id
// @access Private
exports.updateRating = async (req, res, next) => {
  try {
    const { rating, review } = req.body;

    const ratingDoc = await Rating.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!ratingDoc) {
      return sendError(res, 404, 'Rating not found');
    }

    ratingDoc.rating = rating || ratingDoc.rating;
    ratingDoc.review = review || ratingDoc.review;

    await ratingDoc.save();

    // Update service average rating
    const allRatings = await Rating.find({ serviceId: ratingDoc.serviceId });
    const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;

    await Service.findByIdAndUpdate(ratingDoc.serviceId, {
      ratingAverage: avgRating,
    });

    return sendResponse(res, 200, true, 'Rating updated successfully', ratingDoc);
  } catch (error) {
    next(error);
  }
};
