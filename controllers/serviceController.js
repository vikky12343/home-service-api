const Service = require('../models/Service');
const { sendResponse, sendPaginatedResponse, sendError } = require('../utils/response');

// @desc Get all services with pagination and filters
// @route GET /api/services
// @access Public
exports.getServices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, minPrice, maxPrice, search } = req.query;

    const filter = { isActive: true };

    if (category) {
      filter.category = category;
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if (search) {
      filter.$text = { $search: search };
    }

    const skip = (page - 1) * limit;
    const services = await Service.find(filter)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    const total = await Service.countDocuments(filter);

    return sendPaginatedResponse(res, 200, 'Services retrieved', services, {
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

// @desc Get service by ID
// @route GET /api/services/:id
// @access Public
exports.getServiceById = async (req, res, next) => {
  try {
    const service = await Service.findById(req.params.id);

    if (!service) {
      return sendError(res, 404, 'Service not found');
    }

    return sendResponse(res, 200, true, 'Service retrieved', service);
  } catch (error) {
    next(error);
  }
};

// @desc Search services
// @route GET /api/services/search
// @access Public
exports.searchServices = async (req, res, next) => {
  try {
    const { keyword, category } = req.query;

    const filter = { isActive: true };

    if (keyword) {
      filter.$text = { $search: keyword };
    }

    if (category) {
      filter.category = category;
    }

    const services = await Service.find(filter).limit(20);

    return sendResponse(res, 200, true, 'Services found', services);
  } catch (error) {
    next(error);
  }
};

// @desc Get categories
// @route GET /api/services/categories
// @access Public
exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Service.distinct('category', { isActive: true });

    return sendResponse(res, 200, true, 'Categories retrieved', categories);
  } catch (error) {
    next(error);
  }
};

// @desc Create service (Admin only)
// @route POST /api/services
// @access Private/Admin
exports.createService = async (req, res, next) => {
  try {
    const { name, description, price, duration, category, image, discount } = req.body;

    const service = new Service({
      name,
      description,
      price,
      originalPrice: price,
      duration,
      category,
      image,
      discount: discount || 0,
    });

    await service.save();

    return sendResponse(res, 201, true, 'Service created successfully', service);
  } catch (error) {
    next(error);
  }
};

// @desc Update service (Admin only)
// @route PUT /api/services/:id
// @access Private/Admin
exports.updateService = async (req, res, next) => {
  try {
    const { name, description, price, duration, category, image, discount, isActive } = req.body;

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        price,
        duration,
        category,
        image,
        discount,
        isActive,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!service) {
      return sendError(res, 404, 'Service not found');
    }

    return sendResponse(res, 200, true, 'Service updated successfully', service);
  } catch (error) {
    next(error);
  }
};

// @desc Delete service (Admin only)
// @route DELETE /api/services/:id
// @access Private/Admin
exports.deleteService = async (req, res, next) => {
  try {
    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!service) {
      return sendError(res, 404, 'Service not found');
    }

    return sendResponse(res, 200, true, 'Service deleted successfully');
  } catch (error) {
    next(error);
  }
};
