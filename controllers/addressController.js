const Address = require('../models/Address');
const { sendResponse, sendPaginatedResponse, sendError } = require('../utils/response');

// @desc Create address
// @route POST /api/addresses
// @access Private
exports.createAddress = async (req, res, next) => {
  try {
    const { fullName, phone, houseNo, area, city, state, pincode, landmark, latitude, longitude, isDefault } = req.body;

    // If setting as default, remove default from other addresses
    if (isDefault) {
      await Address.updateMany({ userId: req.user.id }, { isDefault: false });
    }

    const address = new Address({
      userId: req.user.id,
      fullName,
      phone,
      houseNo,
      area,
      city,
      state,
      pincode,
      landmark,
      latitude,
      longitude,
      isDefault: isDefault || false,
    });

    await address.save();

    return sendResponse(res, 201, true, 'Address created successfully', address);
  } catch (error) {
    next(error);
  }
};

// @desc Get all addresses
// @route GET /api/addresses
// @access Private
exports.getAddresses = async (req, res, next) => {
  try {
    const addresses = await Address.find({
      userId: req.user.id,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return sendResponse(res, 200, true, 'Addresses retrieved', addresses);
  } catch (error) {
    next(error);
  }
};

// @desc Get single address
// @route GET /api/addresses/:id
// @access Private
exports.getAddressById = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!address) {
      return sendError(res, 404, 'Address not found');
    }

    return sendResponse(res, 200, true, 'Address retrieved', address);
  } catch (error) {
    next(error);
  }
};

// @desc Update address
// @route PUT /api/addresses/:id
// @access Private
exports.updateAddress = async (req, res, next) => {
  try {
    const { fullName, phone, houseNo, area, city, state, pincode, landmark, latitude, longitude, isDefault } = req.body;

    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!address) {
      return sendError(res, 404, 'Address not found');
    }

    // If setting as default, remove default from other addresses
    if (isDefault) {
      await Address.updateMany(
        { userId: req.user.id, _id: { $ne: req.params.id } },
        { isDefault: false }
      );
    }

    const updatedAddress = await Address.findByIdAndUpdate(
      req.params.id,
      {
        fullName: fullName || address.fullName,
        phone: phone || address.phone,
        houseNo: houseNo || address.houseNo,
        area: area || address.area,
        city: city || address.city,
        state: state || address.state,
        pincode: pincode || address.pincode,
        landmark: landmark || address.landmark,
        latitude: latitude !== undefined ? latitude : address.latitude,
        longitude: longitude !== undefined ? longitude : address.longitude,
        isDefault: isDefault !== undefined ? isDefault : address.isDefault,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return sendResponse(res, 200, true, 'Address updated successfully', updatedAddress);
  } catch (error) {
    next(error);
  }
};

// @desc Delete address (soft delete)
// @route DELETE /api/addresses/:id
// @access Private
exports.deleteAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!address) {
      return sendError(res, 404, 'Address not found');
    }

    // Soft delete
    address.isDeleted = true;
    await address.save();

    return sendResponse(res, 200, true, 'Address deleted successfully');
  } catch (error) {
    next(error);
  }
};

// @desc Set default address
// @route PUT /api/addresses/:id/set-default
// @access Private
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const address = await Address.findOne({
      _id: req.params.id,
      userId: req.user.id,
      isDeleted: false,
    });

    if (!address) {
      return sendError(res, 404, 'Address not found');
    }

    // Remove default from other addresses
    await Address.updateMany(
      { userId: req.user.id, _id: { $ne: req.params.id } },
      { isDefault: false }
    );

    // Set this as default
    address.isDefault = true;
    await address.save();

    return sendResponse(res, 200, true, 'Default address set successfully', address);
  } catch (error) {
    next(error);
  }
};
