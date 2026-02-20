const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/authorization');

/**
 * @swagger
 * tags:
 *   name: Services
 *   description: Service management endpoints
 */

/**
 * @swagger
 * /api/v1/services:
 *   get:
 *     tags: [Services]
 *     summary: Get all services
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of services retrieved successfully
 *   post:
 *     tags: [Services]
 *     summary: Create service (Admin only)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, description, category, basePrice]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               basePrice:
 *                 type: number
 *               image:
 *                 type: string
 *     responses:
 *       201:
 *         description: Service created successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/services/categories:
 *   get:
 *     tags: [Services]
 *     summary: Get all service categories
 *     responses:
 *       200:
 *         description: List of categories retrieved
 */

/**
 * @swagger
 * /api/v1/services/search:
 *   get:
 *     tags: [Services]
 *     summary: Search services
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Search results
 */

/**
 * @swagger
 * /api/v1/services/{id}:
 *   get:
 *     tags: [Services]
 *     summary: Get service by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Service details retrieved
 *       404:
 *         description: Service not found
 *   put:
 *     tags: [Services]
 *     summary: Update service (Admin only)
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               basePrice:
 *                 type: number
 *     responses:
 *       200:
 *         description: Service updated successfully
 *   delete:
 *     tags: [Services]
 *     summary: Delete service (Admin only)
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
 *         description: Service deleted successfully
 */

// Public routes
router.get('/', serviceController.getServices);
router.get('/categories', serviceController.getCategories);
router.get('/search', serviceController.searchServices);
router.get('/:id', serviceController.getServiceById);

// Admin routes
router.post('/', authMiddleware, authorizeAdmin, serviceController.createService);
router.put('/:id', authMiddleware, authorizeAdmin, serviceController.updateService);
router.delete('/:id', authMiddleware, authorizeAdmin, serviceController.deleteService);

module.exports = router;
