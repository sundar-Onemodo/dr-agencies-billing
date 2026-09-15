const supabase = require('../config/supabase');

/**
 * Get all customers for the logged-in user with dynamic balance metrics
 * GET /customers
 */
exports.getCustomers = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(`
        *,
        bills (
          total
        )
      `)
      .eq('user_id', req.user.id)
      .order('name', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const formattedCustomers = (data || []).map(customer => {
      const totalBilled = (customer.bills || []).reduce((sum, bill) => sum + parseFloat(bill.total || 0), 0);
      const totalReceived = parseFloat(customer.total_received || 0);
      const pendingAmount = Math.max(0, totalBilled - totalReceived);

      return {
        id: String(customer.id),
        name: customer.name,
        phone: customer.phone || '',
        address: customer.address || '',
        gstin: customer.gstin || '',
        state: customer.state || 'Tamil Nadu',
        totalBilled: parseFloat(totalBilled.toFixed(2)),
        totalReceived: parseFloat(totalReceived.toFixed(2)),
        pendingAmount: parseFloat(pendingAmount.toFixed(2)),
        createdAt: customer.created_at
      };
    });

    return res.status(200).json({
      success: true,
      customers: formattedCustomers
    });
  } catch (err) {
    console.error('Get Customers Error:', err.message || err);
    return res.status(500).json({ error: 'Server error retrieving customers.' });
  }
};

/**
 * Update customer details or record a payment
 * PUT /customers/:id
 */
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const { name, phone, address, gstin, state, total_received, amountReceived } = req.body;

  try {
    // Check customer ownership
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or unauthorized.' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (phone !== undefined) updates.phone = phone.trim();
    if (address !== undefined) updates.address = address.trim();
    if (gstin !== undefined) updates.gstin = gstin.trim().toUpperCase();
    if (state !== undefined) updates.state = state.trim();

    if (total_received !== undefined) {
      updates.total_received = parseFloat(total_received);
    } else if (amountReceived !== undefined) {
      updates.total_received = parseFloat(customer.total_received || 0) + parseFloat(amountReceived);
    }

    // Check for duplicate name or phone with other customers (excluding self)
    if (updates.name || updates.phone) {
      const { data: existingCustomers } = await supabase
        .from('customers')
        .select('id, name, phone')
        .eq('user_id', req.user.id)
        .neq('id', id);

      if (updates.name) {
        const dupName = (existingCustomers || []).find(
          c => c.name && c.name.trim().toLowerCase() === updates.name.toLowerCase()
        );
        if (dupName) {
          return res.status(400).json({ error: `Another customer named "${updates.name}" already exists.` });
        }
      }

      if (updates.phone) {
        const dupPhone = (existingCustomers || []).find(
          c => c.phone && c.phone.trim() === updates.phone
        );
        if (dupPhone) {
          return res.status(400).json({ error: `Contact number "${updates.phone}" is already registered to "${dupPhone.name}".` });
        }
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({
      success: true,
      customer: {
        id: String(updatedCustomer.id),
        name: updatedCustomer.name,
        phone: updatedCustomer.phone || '',
        address: updatedCustomer.address || '',
        gstin: updatedCustomer.gstin || '',
        state: updatedCustomer.state || 'Tamil Nadu',
        totalReceived: parseFloat(updatedCustomer.total_received || 0)
      }
    });
  } catch (err) {
    console.error('Update Customer Error:', err.message || err);
    return res.status(500).json({ error: 'Server error updating customer.' });
  }
};

/**
 * Create a new customer manually
 * POST /customers
 */
exports.createCustomer = async (req, res) => {
  const { name, phone, address, gstin, state, total_received } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  const trimmedName = name.trim();
  const trimmedPhone = phone ? phone.trim() : '';

  try {
    // Check if customer with same name already exists (case-insensitive) or same phone
    const { data: existingCustomers, error: queryError } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('user_id', req.user.id);

    if (queryError) {
      console.warn('Error querying existing customers:', queryError);
    }

    const duplicate = (existingCustomers || []).find(c => {
      const sameName = c.name && c.name.trim().toLowerCase() === trimmedName.toLowerCase();
      const samePhone = trimmedPhone && c.phone && c.phone.trim() === trimmedPhone;
      return sameName || samePhone;
    });

    if (duplicate) {
      if (duplicate.name && duplicate.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
        return res.status(400).json({ error: `A customer named "${trimmedName}" already exists in your directory.` });
      }
      return res.status(400).json({ error: `A customer with contact number "${trimmedPhone}" already exists (${duplicate.name}).` });
    }

    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        user_id: req.user.id,
        name: trimmedName,
        phone: trimmedPhone,
        address: address ? address.trim() : '',
        gstin: gstin ? gstin.trim().toUpperCase() : '',
        state: state ? state.trim() : 'Tamil Nadu',
        total_received: parseFloat(total_received || 0)
      })
      .select()
      .single();

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    return res.status(201).json({
      success: true,
      customer: {
        id: String(newCustomer.id),
        name: newCustomer.name,
        phone: newCustomer.phone || '',
        address: newCustomer.address || '',
        gstin: newCustomer.gstin || '',
        state: newCustomer.state || 'Tamil Nadu',
        totalBilled: 0,
        totalReceived: parseFloat(newCustomer.total_received || 0),
        pendingAmount: 0,
        createdAt: newCustomer.created_at
      }
    });
  } catch (err) {
    console.error('Create Customer Error:', err.message || err);
    return res.status(500).json({ error: 'Server error creating customer.' });
  }
};

/**
 * Record a payment transaction log for a customer
 * POST /customers/:id/payments
 */
exports.recordPayment = async (req, res) => {
  const { id } = req.params;
  const { amount, paymentMode, paymentDate } = req.body;

  if (amount === undefined || parseFloat(amount) <= 0) {
    return res.status(400).json({ error: 'Valid payment amount is required.' });
  }

  const finalAmount = parseFloat(amount);
  const finalMode = paymentMode || 'Cash';
  const finalDate = paymentDate ? new Date(paymentDate).toISOString() : new Date().toISOString();

  try {
    // 1. Check customer existence
    const { data: customer, error: fetchError } = await supabase
      .from('customers')
      .select('id, total_received')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (fetchError) {
      return res.status(400).json({ error: fetchError.message });
    }

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found or unauthorized.' });
    }

    // 2. Insert payment log
    const { data: paymentLog, error: logError } = await supabase
      .from('customer_payments')
      .insert({
        user_id: req.user.id,
        customer_id: id,
        amount: finalAmount,
        payment_mode: finalMode,
        payment_date: finalDate
      })
      .select()
      .single();

    if (logError) {
      return res.status(400).json({ error: logError.message });
    }

    // 3. Update customer total_received
    const newTotalReceived = parseFloat(customer.total_received || 0) + finalAmount;
    await supabase
      .from('customers')
      .update({ total_received: newTotalReceived, updated_at: new Date().toISOString() })
      .eq('id', id);

    return res.status(201).json({
      success: true,
      message: 'Payment recorded successfully.',
      payment: {
        id: String(paymentLog.id),
        customerId: String(paymentLog.customer_id),
        amount: parseFloat(paymentLog.amount),
        paymentMode: paymentLog.payment_mode,
        paymentDate: paymentLog.payment_date,
        createdAt: paymentLog.created_at
      },
      totalReceived: newTotalReceived
    });
  } catch (err) {
    console.error('Record Payment Error:', err.message || err);
    return res.status(500).json({ error: 'Server error recording payment.' });
  }
};

/**
 * Retrieve payment history and all purchase bills for a specific customer
 * GET /customers/:id/payments
 */
exports.getCustomerPayments = async (req, res) => {
  const { id } = req.params;

  try {
    // 0. Get customer details
    const { data: customer } = await supabase
      .from('customers')
      .select('id, name')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    // 1. Fetch all customer payment records
    const { data: payments, error: paymentsError } = await supabase
      .from('customer_payments')
      .select('*')
      .eq('customer_id', id)
      .eq('user_id', req.user.id);

    if (paymentsError) {
      return res.status(400).json({ error: paymentsError.message });
    }

    // 2. Fetch all bills associated with this customer
    let query = supabase
      .from('bills')
      .select(`
        *,
        bill_items (*)
      `)
      .eq('user_id', req.user.id);

    if (customer && customer.name) {
      query = query.or(`customer_id.eq.${id},customer_name.ilike.%${customer.name}%`);
    } else {
      query = query.eq('customer_id', id);
    }

    const { data: bills, error: billsError } = await query;

    if (billsError) {
      return res.status(400).json({ error: billsError.message });
    }

    // 3. Transform and combine them into a unified ledger
    const ledger = [];
    const seenBillIds = new Set();

    // Add bills as debit entries
    (bills || []).forEach(bill => {
      if (seenBillIds.has(String(bill.id))) return;
      seenBillIds.add(String(bill.id));

      const itemsSummary = (bill.bill_items || [])
        .map(i => `${i.name} (${i.quantity} kg)`)
        .join(', ');

      ledger.push({
        id: `bill-${bill.id}`,
        customerId: String(bill.customer_id || id),
        billId: String(bill.id),
        amount: parseFloat(bill.total),
        paymentMode: 'Billed',
        paymentDate: bill.created_at,
        createdAt: bill.created_at,
        type: 'bill',
        invoiceNumber: bill.invoice_number,
        paymentStatus: bill.payment_status || 'Pending',
        itemsCount: (bill.bill_items || []).length,
        itemsSummary: itemsSummary
      });
    });

    // Add payments as credit entries
    (payments || []).forEach(log => {
      ledger.push({
        id: `payment-${log.id}`,
        customerId: String(log.customer_id),
        billId: log.bill_id ? String(log.bill_id) : null,
        amount: parseFloat(log.amount),
        paymentMode: log.payment_mode,
        paymentDate: log.payment_date,
        createdAt: log.created_at,
        type: 'payment'
      });
    });

    // Sort combined entries by date descending (newest first)
    ledger.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

    return res.status(200).json({
      success: true,
      payments: ledger
    });
  } catch (err) {
    console.error('Get Payments Error:', err.message || err);
    return res.status(500).json({ error: 'Server error retrieving payments.' });
  }
};
