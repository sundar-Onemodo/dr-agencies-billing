const supabase = require('../config/supabase');

/**
 * Get reports summary for a date range
 * GET /reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
exports.getSummary = async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Parameters "from" and "to" (YYYY-MM-DD) are required.' });
  }

  // Basic date format validation YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(from) || !dateRegex.test(to)) {
    return res.status(400).json({ error: 'Dates must be in YYYY-MM-DD format.' });
  }

  try {
    // Set start of from-day and end of to-day in ISO format
    const fromDate = new Date(`${from}T00:00:00.000Z`).toISOString();
    const toDate = new Date(`${to}T23:59:59.999Z`).toISOString();

    const { data: bills, error } = await supabase
      .from('bills')
      .select('total, cgst, sgst')
      .eq('user_id', req.user.id)
      .gte('created_at', fromDate)
      .lte('created_at', toDate);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    let totalRevenue = 0;
    let cgstCollected = 0;
    let sgstCollected = 0;
    const totalInvoices = bills ? bills.length : 0;

    if (bills) {
      bills.forEach(bill => {
        totalRevenue += parseFloat(bill.total || 0);
        cgstCollected += parseFloat(bill.cgst || 0);
        sgstCollected += parseFloat(bill.sgst || 0);
      });
    }

    const gstCollected = cgstCollected + sgstCollected;

    return res.status(200).json({
      success: true,
      summary: {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        gstCollected: parseFloat(gstCollected.toFixed(2)),
        cgstCollected: parseFloat(cgstCollected.toFixed(2)),
        sgstCollected: parseFloat(sgstCollected.toFixed(2)),
        totalInvoices
      }
    });
  } catch (err) {
    console.error('Get Summary Report Error:', err.message || err);
    return res.status(500).json({ error: 'Server error generating reports summary.' });
  }
};
