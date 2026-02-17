// Booking status constants
const BOOKING_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  ACCEPTED: 'accepted',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
  NO_SHOW: 'no_show',
};

// Payment status constants
const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

// User roles
const ROLES = {
  CUSTOMER: 'customer',
  WORKER: 'worker',
  ADMIN: 'admin',
};

// Notification types
const NOTIFICATION_TYPES = {
  BOOKING_CONFIRMED: 'booking_confirmed',
  WORKER_ASSIGNED: 'worker_assigned',
  SERVICE_STARTED: 'service_started',
  SERVICE_COMPLETED: 'service_completed',
  PAYMENT_SUCCESS: 'payment_success',
  CANCELLATION: 'cancellation',
  RESCHEDULED: 'rescheduled',
};

module.exports = {
  BOOKING_STATUS,
  PAYMENT_STATUS,
  ROLES,
  NOTIFICATION_TYPES,
};
