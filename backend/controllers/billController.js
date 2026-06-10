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
    // 1. Insert the main bill
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

    // 2. Format and insert the bill items
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

    // 3. Return the fully saved invoice with nested items
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
