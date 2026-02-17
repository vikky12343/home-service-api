const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  razorpayEventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 604800, // Auto-cleanup after 7 days
  },
});

module.exports = mongoose.model('WebhookLog', webhookLogSchema);
