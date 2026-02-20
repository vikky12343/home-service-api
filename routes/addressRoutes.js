const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateAddress } = require('../middleware/validators');

/**
 * @swagger
 * tags:
 *   name: Addresses
 *   description: User address management
 */

/**
 * @swagger
 * /api/v1/addresses:
 *   post:
 *     tags: [Addresses]
 *     summary: Create a new address
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [street, city, state, zipCode, country]
 *             properties:
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *               country:
 *                 type: string
 *               label:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Address created successfully
 *   get:
 *     tags: [Addresses]
 *     summary: Get all user addresses
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Addresses retrieved successfully
 */

/**
 * @swagger
 * /api/v1/addresses/{id}:
 *   get:
 *     tags: [Addresses]
 *     summary: Get address by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Address retrieved
 *   put:
 *     tags: [Addresses]
 *     summary: Update address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               street:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zipCode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Address updated successfully
 *   delete:
 *     tags: [Addresses]
 *     summary: Delete address
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Address deleted successfully
 */

/**
 * @swagger
 * /api/v1/addresses/{id}/set-default:
 *   put:
 *     tags: [Addresses]
 *     summary: Set address as default
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Default address set successfully
 */

// All routes require authentication
router.use(authMiddleware);

router.post('/', validateAddress, addressController.createAddress);
router.get('/', addressController.getAddresses);
router.get('/:id', addressController.getAddressById);
router.put('/:id', validateAddress, addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.put('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;
