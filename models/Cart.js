const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  items: [
    {
      serviceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Service',
        required: true,
      },
      quantity: {
        type: Number,
        default: 1,
        min: 1,
      },
      selectedDate: {
        type: Date,
        required: true,
      },
      selectedTime: {
        type: String,
        required: true,
      },
      priceSnapshot: {
        price: Number,
        discount: Number,
        finalPrice: Number,
      },
      addedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  totalPrice: {
    type: Number,
    default: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Index for queries
cartSchema.index({ userId: 1 });

module.exports = mongoose.model('Cart', cartSchema);
