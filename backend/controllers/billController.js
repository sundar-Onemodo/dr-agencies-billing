const supabase = require('../config/supabase');

/**
 * Create a new bill (invoice) and its associated items
 * POST /bills/create
 */
exports.createBill = async (req, res) => {
  const {
    customerName,
    customer_name,
    invoiceNumber,
    invoice_number,
    items,
    subtotal,
    cgst,
    sgst,
    total
  } = req.body;

  // Normalize parameters to support both camelCase and snake_case
  const finalCustomerName = customerName || customer_name;
  const finalInvoiceNumber = invoiceNumber || invoice_number || `INV-${Date.now()}`;

  if (!finalCustomerName || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Customer name and a non-empty items array are required.' });
  }

  if (subtotal === undefined || total === undefined) {
    return res.status(400).json({ error: 'Subtotal and total are required.' });
  }

  try {
    // 1. Fetch current product stock from DB for all items
    const productIds = items
      .map(item => item.productId || item.product_id)
      .filter(id => id && id !== 'null' && id !== '');
    
    let dbProducts = [];
    if (productIds.length > 0) {
      const { data, error: fetchError } = await supabase
        .from('products')
        .select('id, name, stock_qty')
        .in('id', productIds)
        .eq('user_id', req.user.id);
      
      if (fetchError) {
        return res.status(400).json({ error: `Failed to fetch stock levels: ${fetchError.message}` });
      }
      dbProducts = data || [];
    }

    // 2. Validate stock before bill creation
    for (const item of items) {
      const rawProductId = item.productId || item.product_id;
      if (rawProductId && rawProductId !== 'null' && rawProductId !== '') {
        const dbProd = dbProducts.find(p => String(p.id) === String(rawProductId));
        if (!dbProd) {
          return res.status(404).json({ error: `Product "${item.name}" not found in inventory.` });
        }
        const quantity = parseFloat(item.qty || item.quantity || 1);
        const stockQty = parseFloat(dbProd.stock_qty || 0);
        if (quantity > stockQty) {
          return res.status(400).json({
            error: `Insufficient stock for product: ${item.name}. Available: ${stockQty}, Requested: ${quantity}`
          });
        }
      }
    }

    // 3. Insert the main bill
    const billData = {
      user_id: req.user.id,
      invoice_number: finalInvoiceNumber,
      customer_name: finalCustomerName,
      subtotal: parseFloat(subtotal),
      cgst: parseFloat(cgst || 0),
      sgst: parseFloat(sgst || 0),
      total: parseFloat(total)
    };

    const { data: bill, error: billError } = await supabase
      .from('bills')
      .insert(billData)
      .select()
      .single();

    if (billError) {
      return res.status(400).json({ error: billError.message });
    }

    // 4. Format and insert the bill items
    const billItemsData = items.map(item => {
      const quantity = parseFloat(item.qty || item.quantity || 1);
      const price = parseFloat(item.price || 0);
      const amount = parseFloat(item.amount || (quantity * price));
      
      const rawProductId = item.productId || item.product_id;
      const parsedProductId = (rawProductId && rawProductId !== 'null' && rawProductId !== '') 
        ? parseInt(rawProductId, 10) 
        : null;

      return {
        bill_id: bill.id,
        product_id: parsedProductId,
        name: item.name || 'Unknown Product',
        quantity,
        price,
        amount
      };
    });

    const { data: insertedItems, error: itemsError } = await supabase
      .from('bill_items')
      .insert(billItemsData)
      .select();

    if (itemsError) {
      // Rollback: Delete the inserted bill if item insertion fails
      await supabase.from('bills').delete().eq('id', bill.id);
      return res.status(400).json({ error: `Failed to save invoice items: ${itemsError.message}` });
    }

    // 5. Update product stock atomically and track success for rollback
    const updatedProducts = [];
    let decrementFailed = false;
    let failedItemName = '';
    let failedItemAvailableStock = 0;
    let failedItemRequestedQty = 0;

    for (const item of items) {
      const rawProductId = item.productId || item.product_id;
      if (rawProductId && rawProductId !== 'null' && rawProductId !== '') {
        const quantity = parseFloat(item.qty || item.quantity || 1);
        
        // Call RPC to decrement stock atomically
        const { data: success, error: rpcError } = await supabase.rpc('decrement_product_stock', {
          p_id: parseInt(rawProductId, 10),
          p_qty: quantity,
          p_user_id: req.user.id
        });

        if (rpcError || !success) {
          decrementFailed = true;
          failedItemName = item.name;
          failedItemRequestedQty = quantity;
          
          // Fetch current stock to report in error message
          const { data: updatedProd } = await supabase
            .from('products')
            .select('stock_qty')
            .eq('id', rawProductId)
            .single();
            
          failedItemAvailableStock = updatedProd ? parseFloat(updatedProd.stock_qty || 0) : 0;
          break;
        }

        updatedProducts.push({
          id: rawProductId,
          qty: quantity
        });
      }
    }

    if (decrementFailed) {
      console.log(`Stock decrement failed for "${failedItemName}". Rolling back transaction...`);
      
      // Rollback stock updates
      for (const revert of updatedProducts) {
        await supabase.rpc('decrement_product_stock', {
          p_id: parseInt(revert.id, 10),
          p_qty: -revert.qty, // Negative quantity reverts/adds stock back
          p_user_id: req.user.id
        });
      }

      // Rollback bill (cascades to bill_items due to ON DELETE CASCADE)
      await supabase.from('bills').delete().eq('id', bill.id);

      return res.status(400).json({
        error: `Insufficient stock for product: ${failedItemName}. Available: ${failedItemAvailableStock}, Requested: ${failedItemRequestedQty}`
      });
    }

    // 6. Return the fully saved invoice with nested items
    return res.status(201).json({
      success: true,
      message: 'Invoice created successfully.',
      bill: {
        id: String(bill.id),
        invoiceNumber: bill.invoice_number,
        customerName: bill.customer_name,
        date: bill.created_at,
        subtotal: parseFloat(bill.subtotal),
        cgst: parseFloat(bill.cgst),
        sgst: parseFloat(bill.sgst),
        total: parseFloat(bill.total),
        gstEnabled: (parseFloat(bill.cgst) > 0 || parseFloat(bill.sgst) > 0),
        items: insertedItems.map(item => ({
          id: String(item.id),
          productId: item.product_id ? String(item.product_id) : null,
          name: item.name,
          qty: parseFloat(item.quantity),
          price: parseFloat(item.price),
          amount: parseFloat(item.amount)
        }))
      }
    });
  } catch (err) {
    console.error('Create Bill Error:', err.message || err);
    return res.status(500).json({ error: 'Server error creating bill.' });
  }
};

/**
 * Get the latest 10 invoices
 * GET /bills/recent
 */
exports.getRecentBills = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        bill_items (
          *
        )
      `)
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const formattedBills = data.map(bill => ({
      id: String(bill.id),
      invoiceNumber: bill.invoice_number,
      customerName: bill.customer_name,
      date: bill.created_at,
      subtotal: parseFloat(bill.subtotal),
      cgst: parseFloat(bill.cgst),
      sgst: parseFloat(bill.sgst),
      total: parseFloat(bill.total),
      gstEnabled: (parseFloat(bill.cgst) > 0 || parseFloat(bill.sgst) > 0),
      items: (bill.bill_items || []).map(item => ({
        id: String(item.id),
        productId: item.product_id ? String(item.product_id) : null,
        name: item.name,
        qty: parseFloat(item.quantity),
        price: parseFloat(item.price),
        amount: parseFloat(item.amount)
      }))
    }));

    return res.status(200).json({
      success: true,
      bills: formattedBills
    });
  } catch (err) {
    console.error('Get Recent Bills Error:', err.message || err);
    return res.status(500).json({ error: 'Server error retrieving recent bills.' });
  }
};

/**
 * Get details of a single bill including all its items
 * GET /bills/:id
 */
exports.getBillById = async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from('bills')
      .select(`
        *,
        bill_items (
          *
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (!data) {
      return res.status(404).json({ error: 'Invoice not found.' });
    }

    const formattedBill = {
      id: String(data.id),
      invoiceNumber: data.invoice_number,
      customerName: data.customer_name,
      date: data.created_at,
      subtotal: parseFloat(data.subtotal),
      cgst: parseFloat(data.cgst),
      sgst: parseFloat(data.sgst),
      total: parseFloat(data.total),
      gstEnabled: (parseFloat(data.cgst) > 0 || parseFloat(data.sgst) > 0),
      items: (data.bill_items || []).map(item => ({
        id: String(item.id),
        productId: item.product_id ? String(item.product_id) : null,
        name: item.name,
        qty: parseFloat(item.quantity),
        price: parseFloat(item.price),
        amount: parseFloat(item.amount)
      }))
    };

    return res.status(200).json({
      success: true,
      bill: formattedBill
    });
  } catch (err) {
    console.error('Get Bill Detail Error:', err.message || err);
    return res.status(500).json({ error: 'Server error retrieving invoice details.' });
  }
};

/**
 * Delete a bill (invoice) by ID and restore product stock levels
 * DELETE /bills/:id
 */
exports.deleteBill = async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch the bill and its items to restore stock
    const { data: bill, error: fetchError } = await supabase
      .from('bills')
      .select(`
        *,
        bill_items (
          *
        )
      `)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    if (!bill) {
      return res.status(404).json({ error: 'Invoice not found or unauthorized.' });
    }

    // 2. Restore stock for each item that has a product_id
    const items = bill.bill_items || [];
    for (const item of items) {
      if (item.product_id) {
        // Increment stock by passing negative quantity to decrement function
        await supabase.rpc('decrement_product_stock', {
          p_id: parseInt(item.product_id, 10),
          p_qty: -parseFloat(item.quantity),
          p_user_id: req.user.id
        });
      }
    }

    // 3. Delete the bill from database (ON DELETE CASCADE deletes bill_items)
    const { error: deleteError } = await supabase
      .from('bills')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id);

    if (deleteError) {
      return res.status(400).json({ error: deleteError.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully and stock restored.'
    });
  } catch (err) {
    console.error('Delete Bill Error:', err.message || err);
    return res.status(500).json({ error: 'Server error deleting invoice.' });
  }
};
