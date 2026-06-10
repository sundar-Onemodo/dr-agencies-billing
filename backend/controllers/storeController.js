const supabase = require('../config/supabase');

/**
 * Get store profile for the authenticated user
 * GET /store/me
 */
exports.getStoreProfile = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle(); // Returns null instead of error if row not found

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      store: data ? {
        id: data.id,
        name: data.name,
        address: data.address,
        gstin: data.gstin,
        phone: data.phone,
        email: data.email,
        bankName: data.bank_name,
        accountName: data.account_name,
        accountNo: data.account_no,
        ifsc: data.ifsc,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      } : null
    });
  } catch (err) {
    console.error('Get Store Error:', err.message || err);
    return res.status(500).json({ error: 'Server error retrieving store profile.' });
  }
};

/**
 * Create or update store profile for the authenticated user
 * POST /store/save
 */
exports.saveStoreProfile = async (req, res) => {
  const {
    name,
    address,
    gstin,
    phone,
    email,
    bankName,
    accountName,
    accountNo,
    ifsc
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Store name is required.' });
  }

  try {
    const upsertData = {
      user_id: req.user.id,
      name,
      address,
      gstin,
      phone,
      email,
      bank_name: bankName,
      account_name: accountName,
      account_no: accountNo,
      ifsc,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('stores')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      message: 'Store profile saved successfully.',
      store: {
        id: data.id,
        name: data.name,
        address: data.address,
        gstin: data.gstin,
        phone: data.phone,
        email: data.email,
        bankName: data.bank_name,
        accountName: data.account_name,
        accountNo: data.account_no,
        ifsc: data.ifsc,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }
    });
  } catch (err) {
    console.error('Save Store Error:', err.message || err);
    return res.status(500).json({ error: 'Server error saving store profile.' });
  }
};
