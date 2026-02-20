const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  validateSignup,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} = require('../middleware/validators');
const { authLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, confirmPassword, phone, role]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Full name (e.g., "John Doe")
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 description: Min 6 chars, 1 uppercase, 1 number
 *               confirmPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Must match password
 *               phone:
 *                 type: string
 *                 description: 10 digit phone number
 *               role:
 *                 type: string
 *                 enum: [customer, provider]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: User already exists
 *       429:
 *         description: Too many requests
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 */

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Request password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: OTP sent to email
 *       404:
 *         description: User not found
 */

/**
 * @swagger
 * /api/v1/auth/verify-otp:
 *   post:
 *     tags: [Authentication]
 *     summary: Verify OTP for password reset
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 */

/**
 * @swagger
 * /api/v1/auth/reset-password:
 *   post:
 *     tags: [Authentication]
 *     summary: Reset password with new password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword, confirmPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *               confirmPassword:
 *                 type: string
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Password validation failed
 */

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags: [Authentication]
 *     summary: Refresh authentication token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: New token generated
 *       401:
 *         description: Invalid refresh token
 */

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Authentication]
 *     summary: Logout user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *       401:
 *         description: Unauthorized
 *   put:
 *     tags: [Authentication]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               profileImage:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/auth/account:
 *   delete:
 *     tags: [Authentication]
 *     summary: Delete user account
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *       401:
 *         description: Unauthorized
 */

// Public routes
router.post('/signup', authLimiter, validateSignup, authController.signup);
router.post('/login', authLimiter, validateLogin, authController.login);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/verify-otp', authController.verifyOTP);
router.post('/reset-password', validateResetPassword, authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// Private routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.delete('/account', authMiddleware, authController.deleteAccount);

module.exports = router;
