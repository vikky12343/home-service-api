const { sendError } = require('../utils/response');
const { ROLES } = require('../config/constants');

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Unauthorized');
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 403, 'Forbidden - insufficient permissions');
    }

    next();
  };
};

const authorizeCustomer = (req, res, next) => {
  if (req.user.role !== ROLES.CUSTOMER) {
    return sendError(res, 403, 'Only customers can access this resource');
  }
  next();
};

const authorizeWorker = (req, res, next) => {
  if (req.user.role !== ROLES.WORKER) {
    return sendError(res, 403, 'Only workers can access this resource');
  }
  next();
};

const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== ROLES.ADMIN) {
    return sendError(res, 403, 'Only admins can access this resource');
  }
  next();
};

module.exports = {
  authorize,
  authorizeCustomer,
  authorizeWorker,
  authorizeAdmin,
};
