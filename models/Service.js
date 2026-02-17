const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  originalPrice: {
    type: Number,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  duration: {
    type: Number,
    required: true,
    default: 60, // in minutes
  },
  category: {
    type: String,
    required: true,
    enum: ['cleaning', 'plumbing', 'electrical', 'carpentry', 'painting', 'appliance_repair', 'other'],
  },
  image: {
    type: String,
    default: 'default_service.png',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  ratingAverage: {
    type: Number,
    default: 0,
    min: 0,
    max: 5,
  },
  totalReviews: {
    type: Number,
    default: 0,
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

// Index for queries
serviceSchema.index({ category: 1 });
serviceSchema.index({ isActive: 1 });
serviceSchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Service', serviceSchema);
