const { sendError } = require('../utils/response');
const { isValidEmail, isValidPhone, isValidPassword, isValidPincode } = require('../utils/validators');

const validateSignup = (req, res, next) => {
  const { name, email, phone, password, confirmPassword } = req.body;

  if (!name || !email || !phone || !password || !confirmPassword) {
    return sendError(res, 400, 'All fields are required');
  }

  if (name.trim().length < 2) {
    return sendError(res, 400, 'Name must be at least 2 characters');
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, 'Invalid email format');
  }

  if (!isValidPhone(phone)) {
    return sendError(res, 400, 'Invalid phone number (must be 10 digits)');
  }

  if (!isValidPassword(password)) {
    return sendError(res, 400, 'Password must be at least 6 characters with 1 uppercase and 1 number');
  }

  if (password !== confirmPassword) {
    return sendError(res, 400, 'Passwords do not match');
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 400, 'Email and password are required');
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, 'Invalid email format');
  }

  next();
};

const validateForgotPassword = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return sendError(res, 400, 'Email is required');
  }

  if (!isValidEmail(email)) {
    return sendError(res, 400, 'Invalid email format');
  }

  next();
};

const validateResetPassword = (req, res, next) => {
  const { password, confirmPassword } = req.body;

  if (!password || !confirmPassword) {
    return sendError(res, 400, 'Password and confirmation are required');
  }

  if (!isValidPassword(password)) {
    return sendError(res, 400, 'Password must be at least 6 characters with 1 uppercase and 1 number');
  }

  if (password !== confirmPassword) {
    return sendError(res, 400, 'Passwords do not match');
  }

  next();
};

const validateAddress = (req, res, next) => {
  const { fullName, phone, houseNo, area, city, state, pincode } = req.body;

  if (!fullName || !phone || !houseNo || !area || !city || !state || !pincode) {
    return sendError(res, 400, 'All address fields are required');
  }

  if (!isValidPhone(phone)) {
    return sendError(res, 400, 'Invalid phone number');
  }

  if (!isValidPincode(pincode)) {
    return sendError(res, 400, 'Invalid pincode (must be 6 digits)');
  }

  next();
};

const validateBooking = (req, res, next) => {
  const { serviceId, addressId, date, time } = req.body;

  if (!serviceId || !addressId || !date || !time) {
    return sendError(res, 400, 'Service ID, address, date, and time are required');
  }

  const bookingDate = new Date(date);
  if (bookingDate < new Date()) {
    return sendError(res, 400, 'Booking date must be in the future');
  }

  next();
};

module.exports = {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateAddress,
  validateBooking,
};
