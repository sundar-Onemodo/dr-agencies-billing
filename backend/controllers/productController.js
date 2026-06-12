const supabase = require('../config/supabase');

/**
 * Add a new product
 * POST /products/add
 */
exports.addProduct = async (req, res) => {
  const { name, price, gstRate, stockQty } = req.body;

  if (!name || price === undefined || gstRate === undefined || stockQty === undefined) {
    return res.status(400).json({ error: 'Product name, price, gstRate, and stockQty are required.' });
  }

  const parsedStock = parseFloat(stockQty);
  if (isNaN(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
  }

  try {
    const productData = {
      user_id: req.user.id,
      name,
      price: parseFloat(price),
      gst_rate: parseFloat(gstRate),
      stock_qty: parsedStock
    };

    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Product added successfully.',
      product: {
        id: String(data.id),
        name: data.name,
        price: parseFloat(data.price),
        gstRate: parseFloat(data.gst_rate),
        stockQty: parseFloat(data.stock_qty || 0),
        createdAt: data.created_at
      }
    });
  } catch (err) {
    console.error('Add Product Error:', err.message || err);
    return res.status(500).json({ error: 'Server error adding product.' });
  }
};

/**
 * List all products for the authenticated user
 * GET /products/list
 */
exports.listProducts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const formattedProducts = data.map(product => ({
      id: String(product.id),
      name: product.name,
      price: parseFloat(product.price),
      gstRate: parseFloat(product.gst_rate),
      stockQty: parseFloat(product.stock_qty || 0),
      createdAt: product.created_at
    }));

    return res.status(200).json({
      success: true,
      products: formattedProducts
    });
  } catch (err) {
    console.error('List Products Error:', err.message || err);
    return res.status(500).json({ error: 'Server error listing products.' });
  }
};

/**
 * Delete a product by ID
 * DELETE /products/:id
 */
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Ensure product belongs to the user
      .select();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data || data.length === 0) {
      return res.status(404).json({ error: 'Product not found or unauthorized to delete.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Product deleted successfully.',
      deletedProduct: {
        id: String(data[0].id),
        name: data[0].name
      }
    });
  } catch (err) {
    console.error('Delete Product Error:', err.message || err);
    return res.status(500).json({ error: 'Server error deleting product.' });
  }
};

/**
 * Update an existing product
 * PUT /products/:id
 */
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const { name, price, gstRate, stockQty } = req.body;

  if (!name || price === undefined || gstRate === undefined || stockQty === undefined) {
    return res.status(400).json({ error: 'Product name, price, gstRate, and stockQty are required.' });
  }

  const parsedStock = parseFloat(stockQty);
  if (isNaN(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: 'Stock quantity cannot be negative.' });
  }

  try {
    const { data, error } = await supabase
      .from('products')
      .update({
        name,
        price: parseFloat(price),
        gst_rate: parseFloat(gstRate),
        stock_qty: parsedStock
      })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      product: {
        id: String(data.id),
        name: data.name,
        price: parseFloat(data.price),
        gstRate: parseFloat(data.gst_rate),
        stockQty: parseFloat(data.stock_qty || 0),
        createdAt: data.created_at
      }
    });
  } catch (err) {
    console.error('Update Product Error:', err.message || err);
    return res.status(500).json({ error: 'Server error updating product.' });
  }
};
