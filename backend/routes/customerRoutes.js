const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');
const authenticateToken = require('../middleware/auth');

router.get('/', authenticateToken, customerController.getCustomers);
router.post('/', authenticateToken, customerController.createCustomer);
router.put('/:id', authenticateToken, customerController.updateCustomer);
router.get('/:id/payments', authenticateToken, customerController.getCustomerPayments);
router.post('/:id/payments', authenticateToken, customerController.recordPayment);

module.exports = router;
