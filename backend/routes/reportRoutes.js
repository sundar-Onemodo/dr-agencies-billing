const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/auth');

router.get('/summary', authenticateToken, reportController.getSummary);

module.exports = router;
