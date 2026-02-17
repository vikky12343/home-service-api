const Notification = require('../models/Notification');
const { sendResponse, sendPaginatedResponse, sendError } = require('../utils/response');

// @desc Get notifications
// @route GET /api/notifications
// @access Private
exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isRead } = req.query;

    const filter = { userId: req.user.id };

    if (isRead !== undefined) {
      filter.isRead = isRead === 'true';
    }

    const skip = (page - 1) * limit;

    const notifications = await Notification.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Notification.countDocuments(filter);

    return sendPaginatedResponse(res, 200, 'Notifications retrieved', notifications, {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get unread notifications count
// @route GET /api/notifications/unread/count
// @access Private
exports.getUnreadCount = async (req, res, next) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      isRead: false,
    });

    return sendResponse(res, 200, true, 'Unread count retrieved', { unreadCount: count });
  } catch (error) {
    next(error);
  }
};

// @desc Mark notification as read
// @route PUT /api/notifications/:id/read
// @access Private
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { isRead: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 404, 'Notification not found');
    }

    return sendResponse(res, 200, true, 'Notification marked as read', notification);
  } catch (error) {
    next(error);
  }
};

// @desc Mark all notifications as read
// @route PUT /api/notifications/mark-all-read
// @access Private
exports.markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, isRead: false },
      { isRead: true, readAt: new Date() }
    );

    return sendResponse(res, 200, true, 'All notifications marked as read');
  } catch (error) {
    next(error);
  }
};

// @desc Delete notification
// @route DELETE /api/notifications/:id
// @access Private
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!notification) {
      return sendError(res, 404, 'Notification not found');
    }

    return sendResponse(res, 200, true, 'Notification deleted');
  } catch (error) {
    next(error);
  }
};
