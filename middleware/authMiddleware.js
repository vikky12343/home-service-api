const { verifyAccessToken } = require('../utils/tokenUtils');
const { sendError } = require('../utils/response');
const TokenBlacklist = require('../models/TokenBlacklist');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'No token provided');
    }

    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return sendError(res, 401, 'Invalid or expired token');
    }

    // Check if token is blacklisted (user logged out)
    const isBlacklisted = await TokenBlacklist.findOne({ token });
    if (isBlacklisted) {
      return sendError(res, 401, 'Token has been revoked. Please login again');
    }

    req.user = decoded;
    req.userId = decoded.userId || decoded.id; // Support both field names
    req.token = token; // Store token for logout endpoint
    next();
  } catch (error) {
    return sendError(res, 401, 'Authentication failed');
  }
};

module.exports = protect;
