const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticateToken = require('../middleware/auth');

router.post('/add', authenticateToken, productController.addProduct);
router.get('/list', authenticateToken, productController.listProducts);
router.put('/:id', authenticateToken, productController.updateProduct);
router.delete('/:id', authenticateToken, productController.deleteProduct);
router.get('/stock-ledger', authenticateToken, productController.getStockLedger);

module.exports = router;
