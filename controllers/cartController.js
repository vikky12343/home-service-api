const Cart = require('../models/Cart');
const Service = require('../models/Service');
const { sendResponse, sendError } = require('../utils/response');

// @desc Add to cart
// @route POST /api/cart
// @access Private
exports.addToCart = async (req, res, next) => {
  try {
    const { serviceId, quantity = 1, selectedDate, selectedTime } = req.body;

    // Get service
    const service = await Service.findById(serviceId);
    if (!service) {
      return sendError(res, 404, 'Service not found');
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      cart = new Cart({
        userId: req.user.id,
        items: [],
      });
    }

    // Check if service already in cart
    const existingItem = cart.items.find((item) => item.serviceId.toString() === serviceId);

    if (existingItem) {
      return sendError(res, 400, 'Service already in cart');
    }

    // Calculate final price
    const discountAmount = (service.price * service.discount) / 100;
    const finalPrice = service.price - discountAmount;

    // Add item to cart
    cart.items.push({
      serviceId,
      quantity,
      selectedDate,
      selectedTime,
      priceSnapshot: {
        price: service.price,
        discount: service.discount,
        finalPrice,
      },
    });

    // Update total price
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.priceSnapshot.finalPrice * item.quantity, 0);
    cart.updatedAt = new Date();

    await cart.save();
    await cart.populate('items.serviceId');

    return sendResponse(res, 201, true, 'Item added to cart', cart);
  } catch (error) {
    next(error);
  }
};

// @desc Get cart
// @route GET /api/cart
// @access Private
exports.getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id }).populate('items.serviceId');

    if (!cart) {
      return sendResponse(res, 200, true, 'Cart is empty', {
        items: [],
        totalPrice: 0,
      });
    }

    return sendResponse(res, 200, true, 'Cart retrieved', cart);
  } catch (error) {
    next(error);
  }
};

// @desc Update cart item
// @route PUT /api/cart/:itemId
// @access Private
exports.updateCartItem = async (req, res, next) => {
  try {
    const { quantity, selectedDate, selectedTime } = req.body;

    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return sendError(res, 404, 'Cart not found');
    }

    const item = cart.items.id(req.params.itemId);

    if (!item) {
      return sendError(res, 404, 'Item not found in cart');
    }

    if (quantity) item.quantity = quantity;
    if (selectedDate) item.selectedDate = selectedDate;
    if (selectedTime) item.selectedTime = selectedTime;

    // Recalculate total
    cart.totalPrice = cart.items.reduce((sum, cartItem) => sum + cartItem.priceSnapshot.finalPrice * cartItem.quantity, 0);
    cart.updatedAt = new Date();

    await cart.save();
    await cart.populate('items.serviceId');

    return sendResponse(res, 200, true, 'Cart item updated', cart);
  } catch (error) {
    next(error);
  }
};

// @desc Remove item from cart
// @route DELETE /api/cart/:itemId
// @access Private
exports.removeFromCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });

    if (!cart) {
      return sendError(res, 404, 'Cart not found');
    }

    cart.items.id(req.params.itemId).deleteOne();

    // Recalculate total
    cart.totalPrice = cart.items.reduce((sum, item) => sum + item.priceSnapshot.finalPrice * item.quantity, 0);
    cart.updatedAt = new Date();

    await cart.save();
    await cart.populate('items.serviceId');

    return sendResponse(res, 200, true, 'Item removed from cart', cart);
  } catch (error) {
    next(error);
  }
};

// @desc Clear cart
// @route DELETE /api/cart
// @access Private
exports.clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndDelete({ userId: req.user.id });

    return sendResponse(res, 200, true, 'Cart cleared');
  } catch (error) {
    next(error);
  }
};
