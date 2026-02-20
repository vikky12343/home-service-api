const express = require('express');
const router = express.Router();
const ratingController = require('../controllers/ratingController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * @swagger
 * tags:
 *   name: Ratings
 *   description: Service and user ratings and reviews
 */

/**
 * @swagger
 * /api/v1/ratings:
 *   post:
 *     tags: [Ratings]
 *     summary: Create a rating/review
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [service, rating, review]
 *             properties:
 *               service:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *               booking:
 *                 type: string
 *     responses:
 *       201:
 *         description: Rating created successfully
 */

/**
 * @swagger
 * /api/v1/ratings/service/{serviceId}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get ratings for a service
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Service ratings retrieved
 */

/**
 * @swagger
 * /api/v1/ratings/user/{userId}:
 *   get:
 *     tags: [Ratings]
 *     summary: Get ratings by a user
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User ratings retrieved
 */

/**
 * @swagger
 * /api/v1/ratings/{id}:
 *   put:
 *     tags: [Ratings]
 *     summary: Update a rating
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
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               review:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating updated successfully
 */

router.post('/', authMiddleware, ratingController.createRating);
router.get('/service/:serviceId', ratingController.getServiceRatings);
router.get('/user/:userId', ratingController.getUserRatings);
router.put('/:id', authMiddleware, ratingController.updateRating);

module.exports = router;
