/**
 * Stock Logging Helper
 * Resiliently handles inserting stock logs into `product_stock_logs`.
 * Supports both:
 * 1. Modern schema: { user_id, product_id, type: 'IN'|'OUT', quantity: number, reference_id: string }
 * 2. Legacy schema: { user_id, product_id, change_type: string, qty_changed: number, previous_qty: number, new_qty: number, notes: string }
 */

async function recordStockLogs(supabase, logs) {
  if (!logs) return;
  const logArray = Array.isArray(logs) ? logs : [logs];
  if (logArray.length === 0) return;

  // 1. Try inserting with modern schema
  const modernLogs = logArray.map(item => ({
    user_id: item.user_id,
    product_id: parseInt(item.product_id, 10),
    type: item.type || (item.quantity >= 0 ? 'IN' : 'OUT'),
    quantity: Math.abs(parseFloat(item.quantity || 0)),
    reference_id: item.reference_id || 'STOCK_UPDATE'
  }));

  try {
    const { error } = await supabase.from('product_stock_logs').insert(modernLogs);
    if (!error) return;

    // If modern schema columns (type / quantity / reference_id) are missing, fall back to legacy schema
    const isColumnError = error.message && (
      error.message.includes('type') ||
      error.message.includes('quantity') ||
      error.message.includes('column') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    );

    if (isColumnError) {
      const legacyLogs = logArray.map(item => {
        const qty = Math.abs(parseFloat(item.quantity || 0));
        const isOut = item.type === 'OUT';
        return {
          user_id: item.user_id,
          product_id: parseInt(item.product_id, 10),
          change_type: item.reference_id || (isOut ? 'BILL_SALE' : 'RESTOCK'),
          qty_changed: isOut ? -qty : qty,
          previous_qty: 0,
          new_qty: isOut ? -qty : qty,
          notes: item.reference_id || ''
        };
      });

      const { error: legacyErr } = await supabase.from('product_stock_logs').insert(legacyLogs);
      if (legacyErr) {
        console.error('Error inserting legacy stock logs:', legacyErr.message);
      }
    } else {
      console.error('Error inserting stock logs:', error.message);
    }
  } catch (err) {
    console.error('Exception writing stock logs:', err.message || err);
  }
}

module.exports = {
  recordStockLogs
};
