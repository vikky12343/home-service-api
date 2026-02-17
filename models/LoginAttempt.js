const mongoose = require('mongoose');

const loginAttemptSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  attempts: {
    type: Number,
    default: 1,
  },
  lastAttemptAt: {
    type: Date,
    default: Date.now,
  },
  lockedUntil: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600, // Auto-cleanup after 1 hour
  },
});

module.exports = mongoose.model('LoginAttempt', loginAttemptSchema);
