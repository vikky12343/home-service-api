const express = require('express');
const router = express.Router();
const addressController = require('../controllers/addressController');
const authMiddleware = require('../middleware/authMiddleware');
const { validateAddress } = require('../middleware/validators');

// All routes require authentication
router.use(authMiddleware);

router.post('/', validateAddress, addressController.createAddress);
router.get('/', addressController.getAddresses);
router.get('/:id', addressController.getAddressById);
router.put('/:id', validateAddress, addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);
router.put('/:id/set-default', addressController.setDefaultAddress);

module.exports = router;
