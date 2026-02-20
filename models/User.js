const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },

  role: {
    type: String,
    enum: Object.values(ROLES),
    default: ROLES.CUSTOMER,
  },
  profileImage: {
    type: String,
    default: 'default_profile.png',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
  refreshTokens: [
    {
      token: String,
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ], // DEPRECATED: Use RefreshToken collection instead
  lastLogin: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
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
userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
