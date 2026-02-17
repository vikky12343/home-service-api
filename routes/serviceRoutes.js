const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authMiddleware = require('../middleware/authMiddleware');
const { authorizeAdmin } = require('../middleware/authorization');

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
