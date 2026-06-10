const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authenticateToken = require('../middleware/auth');

router.post('/add', authenticateToken, productController.addProduct);
router.get('/list', authenticateToken, productController.listProducts);
router.delete('/:id', authenticateToken, productController.deleteProduct);

module.exports = router;
