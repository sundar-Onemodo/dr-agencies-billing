const express = require('express');
const router = express.Router();
const storeController = require('../controllers/storeController');
const authenticateToken = require('../middleware/auth');

router.get('/me', authenticateToken, storeController.getStoreProfile);
router.post('/save', authenticateToken, storeController.saveStoreProfile);

module.exports = router;
