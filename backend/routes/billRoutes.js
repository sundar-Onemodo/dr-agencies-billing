const express = require('express');
const router = express.Router();
const billController = require('../controllers/billController');
const authenticateToken = require('../middleware/auth');

router.post('/create', authenticateToken, billController.createBill);
router.get('/recent', authenticateToken, billController.getRecentBills);
router.get('/:id', authenticateToken, billController.getBillById);
router.delete('/:id', authenticateToken, billController.deleteBill);

module.exports = router;
