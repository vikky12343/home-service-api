const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const mongoose = require('mongoose');
const User = require('../models/User');
const OTP = require('../models/OTP');
const RefreshToken = require('../models/RefreshToken');
const TokenBlacklist = require('../models/TokenBlacklist');
const LoginAttempt = require('../models/LoginAttempt');
const { sendResponse, sendError } = require('../utils/response');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, decodeToken } = require('../utils/tokenUtils');
const { generateOTP, generateOTPExpiry } = require('../utils/otpUtils');
const { ROLES } = require('../config/constants');

// @desc Signup a new user with secure token management
// @route POST /api/auth/signup
// @access Public
exports.signup = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (existingUser) {
      return sendError(res, 409, 'User with this email or phone already exists');
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role: role || ROLES.CUSTOMER,
    });

    await user.save();

    // Generate tokens with token family for rotation
    const tokenFamily = uuidv4();
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token in separate collection (prevents unbounded array growth)
    await RefreshToken.create({
      userId: user._id,
      token: refreshToken,
      tokenFamily,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    });

    return sendResponse(res, 201, true, 'User registered successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc Login user with brute force protection
// @route POST /api/auth/login
// @access Public
exports.login = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, password } = req.body;

    // Check for brute force attempts
    const loginAttempt = await LoginAttempt.findOne({ email }).session(session);
    
    if (loginAttempt && loginAttempt.lockedUntil && loginAttempt.lockedUntil > new Date()) {
      await session.abortTransaction();
      const minutesRemaining = Math.ceil((loginAttempt.lockedUntil - Date.now()) / 60000);
      return sendError(res, 429, `Account locked. Try again in ${minutesRemaining} minutes`);
    }

    // Find user
    const user = await User.findOne({ email }).session(session);

    if (!user) {
      // Record failed attempt (don't reveal user doesn't exist)
      await LoginAttempt.findOneAndUpdate(
        { email },
        {
          email,
          $inc: { attempts: 1 },
          lastAttemptAt: new Date(),
          ...(loginAttempt && loginAttempt.attempts >= 4 && {
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
          })
        },
        { upsert: true, session }
      );
      await session.commitTransaction();
      return sendError(res, 401, 'Invalid email or password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Record failed attempt
      await LoginAttempt.findOneAndUpdate(
        { email },
        {
          email,
          $inc: { attempts: 1 },
          lastAttemptAt: new Date(),
          ...(loginAttempt && loginAttempt.attempts >= 4 && {
            lockedUntil: new Date(Date.now() + 30 * 60 * 1000)
          })
        },
        { upsert: true, session }
      );
      await session.commitTransaction();
      return sendError(res, 401, 'Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      await session.abortTransaction();
      return sendError(res, 403, 'Account is inactive');
    }

    // Clear login attempts on success
    await LoginAttempt.deleteOne({ email }, { session });

    // Generate tokens
    const tokenFamily = uuidv4();
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token in separate collection with token rotation support
    await RefreshToken.create([{
      userId: user._id,
      token: refreshToken,
      tokenFamily,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    }], { session });

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save({ session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Login successful', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Login user
// @route POST /api/auth/login
// @access Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });

    if (!user) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 401, 'Invalid email or password');
    }

    // Check if account is active
    if (!user.isActive) {
      return sendError(res, 403, 'Account is inactive');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token and update lastLogin
    user.refreshTokens.push({ token: refreshToken });
    user.lastLogin = new Date();
    await user.save();

    return sendResponse(res, 200, true, 'Login successful', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc Refresh access token with token rotation
// @route POST /api/auth/refresh-access-token
// @access Public
exports.refreshAccessToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 400, 'Refresh token is required');
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    if (decoded.expired) {
      // Token family has expired - potential token theft detected
      // Revoke entire family to prevent further damage
      await RefreshToken.updateMany(
        { tokenFamily: decoded.tokenFamily },
        { revokedAt: new Date() }
      );
      return sendError(res, 401, 'Refresh token expired. Please login again');
    }

    if (decoded.error) {
      return sendError(res, 401, 'Invalid refresh token');
    }

    // Find stored refresh token
    const storedToken = await RefreshToken.findOne({
      token: refreshToken,
      revokedAt: null
    });

    if (!storedToken) {
      return sendError(res, 401, 'Refresh token revoked or invalid');
    }

    const user = await User.findById(decoded.userId);
    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Token rotation: revoke old token, create new one in same family
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Revoke old token
      storedToken.revokedAt = new Date();
      await storedToken.save({ session });

      // Create new refresh token in same family
      const newRefreshToken = generateRefreshToken(user._id);
      await RefreshToken.create([{
        userId: user._id,
        token: newRefreshToken,
        tokenFamily: storedToken.tokenFamily, // Same family
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      }], { session });

      await session.commitTransaction();

      const accessToken = generateAccessToken(user._id, user.role);

      return sendResponse(res, 200, true, 'Token refreshed', {
        accessToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    next(error);
  }
};

// @desc Logout user - blacklist tokens
// @route POST /api/auth/logout
// @access Private
exports.logout = async (req, res, next) => {
  try {
    const userId = req.userId;
    const token = req.token;

    if (!token) {
      return sendError(res, 400, 'No token provided');
    }

    // Decode token to get expiration
    const decoded = decodeToken(token);
    if (!decoded) {
      return sendError(res, 400, 'Invalid token');
    }

    // Add token to blacklist
    await TokenBlacklist.create({
      userId,
      token,
      expiresAt: new Date(decoded.exp * 1000),
      blacklistedAt: new Date()
    });

    // Optionally revoke all refresh tokens
    const revokeAll = req.body.revokeAll || false;
    if (revokeAll) {
      await RefreshToken.updateMany(
        { userId },
        { revokedAt: new Date() }
      );
    }

    return sendResponse(res, 200, true, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
};

// @desc Refresh token (old endpoint - use refreshAccessToken instead)
// @route POST /api/auth/refresh-token
// @access Public
exports.refreshToken = async (req, res, next) => {
  try {
    // Get refresh token from body or headers
    let { refreshToken } = req.body;
    
    // If not in body, try Authorization header
    if (!refreshToken && req.headers.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        refreshToken = parts[1];
      }
    }

    if (!refreshToken) {
      return sendError(res, 400, 'Refresh token is required in body or Authorization header');
    }

    const decoded = verifyRefreshToken(refreshToken);

    if (!decoded) {
      return sendError(res, 401, 'Invalid or expired refresh token');
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(user._id, user.role);

    return sendResponse(res, 200, true, 'Token refreshed', { accessToken: newAccessToken });
  } catch (error) {
    next(error);
  }
};

// @desc Forgot password - Send OTP (prevents email enumeration)
// @route POST /api/auth/forgot-password
// @access Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always return same message (prevents email enumeration attack)
    if (!user) {
      return sendResponse(res, 200, true, 'If account exists, OTP will be sent to email', { email });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpiry = generateOTPExpiry(10); // 10 minutes

    // Save OTP
    await OTP.findOneAndUpdate(
      { email },
      { email, otp, expiresAt: otpExpiry, isUsed: false },
      { upsert: true, new: true }
    );

    // TODO: Send OTP via email
    // await sendEmail(email, 'Password Reset OTP', `Your OTP is ${otp}`);

    return sendResponse(res, 200, true, 'If account exists, OTP will be sent to email', { email });
  } catch (error) {
    next(error);
  }
};

// @desc Verify OTP
// @route POST /api/auth/verify-otp
// @access Public
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const otpRecord = await OTP.findOne({ email, isUsed: false });

    if (!otpRecord) {
      return sendError(res, 400, 'Invalid or expired OTP');
    }

    if (otpRecord.otp !== otp) {
      return sendError(res, 400, 'Incorrect OTP');
    }

    if (new Date() > otpRecord.expiresAt) {
      return sendError(res, 400, 'OTP has expired');
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    return sendResponse(res, 200, true, 'OTP verified successfully', { email });
  } catch (error) {
    next(error);
  }
};

// @desc Reset password - revoke all tokens
// @route POST /api/auth/reset-password
// @access Public
exports.resetPassword = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { email, password } = req.body;

    // Verify OTP was used
    const otpRecord = await OTP.findOne({ email, isUsed: true }).session(session);

    if (!otpRecord) {
      await session.abortTransaction();
      return sendError(res, 400, 'Please verify OTP first');
    }

    const user = await User.findOne({ email }).session(session);

    if (!user) {
      await session.abortTransaction();
      return sendError(res, 404, 'User not found');
    }

    // Hash new password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update password and revoke all refresh tokens
    user.password = hashedPassword;
    await user.save({ session });

    // Revoke all refresh tokens (user must login everywhere)
    await RefreshToken.updateMany(
      { userId: user._id },
      { revokedAt: new Date() },
      { session }
    );

    // Invalidate all access tokens
    await TokenBlacklist.deleteMany({ userId: user._id }, { session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Password reset successfully. Please login again.');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};

// @desc Get user profile
// @route GET /api/auth/profile
// @access Private
exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('-password -refreshTokens');

    if (!user) {
      return sendError(res, 404, 'User not found');
    }

    return sendResponse(res, 200, true, 'Profile retrieved', user);
  } catch (error) {
    next(error);
  }
};

// @desc Update profile
// @route PUT /api/auth/profile
// @access Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, profileImage } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, profileImage, updatedAt: new Date() },
      { new: true }
    ).select('-password -refreshTokens');

    return sendResponse(res, 200, true, 'Profile updated successfully', user);
  } catch (error) {
    next(error);
  }
};

// @desc Delete account with transaction support
// @route DELETE /api/auth/account
// @access Private
exports.deleteAccount = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { password } = req.body;

    const user = await User.findById(req.user.id).session(session);

    if (!user) {
      await session.abortTransaction();
      return sendError(res, 404, 'User not found');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      await session.abortTransaction();
      return sendError(res, 401, 'Invalid password');
    }

    // Soft delete with anonymization
    user.isDeleted = true;
    user.deletedAt = new Date();
    user.isActive = false;
    user.email = `deleted_${user._id}@deleted.local`; // Anonymize email
    user.phone = null;
    user.profileImage = null;
    await user.save({ session });

    // Revoke all refresh tokens
    await RefreshToken.deleteMany({ userId: user._id }, { session });

    // Blacklist all access tokens (revoke current session)
    await TokenBlacklist.create([{
      userId: user._id,
      token: req.token,
      expiresAt: new Date(),
      blacklistedAt: new Date()
    }], { session });

    await session.commitTransaction();

    return sendResponse(res, 200, true, 'Account deleted successfully');
  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
};
