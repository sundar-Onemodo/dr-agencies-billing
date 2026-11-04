/**
 * Stock Logging Helper
 * Resiliently handles inserting stock logs into `product_stock_logs`.
 * Supports both:
 * 1. Combined schema: fills both modern and legacy columns to satisfy any NOT NULL constraints.
 * 2. Modern schema fallback: { user_id, product_id, type: 'IN'|'OUT', quantity: number, reference_id: string }
 * 3. Legacy schema fallback: { user_id, product_id, change_type: string, qty_changed: number, previous_qty: number, new_qty: number, notes: string }
 */

async function recordStockLogs(supabase, logs) {
  if (!logs) return;
  const logArray = Array.isArray(logs) ? logs : [logs];
  if (logArray.length === 0) return;

  // 1. Prepare combined records with all fields populated
  const combinedLogs = logArray.map(item => {
    const qty = Math.abs(parseFloat(item.quantity || 0));
    const isOut = item.type === 'OUT' || (parseFloat(item.quantity || 0) < 0 && item.type !== 'IN');
    const type = isOut ? 'OUT' : 'IN';
    const ref = String(item.reference_id || 'STOCK_UPDATE');
    const parsedPid = parseInt(item.product_id, 10);
    const productId = isNaN(parsedPid) ? item.product_id : parsedPid;

    return {
      user_id: item.user_id,
      product_id: productId,
      type: type,
      quantity: qty,
      reference_id: ref,
      change_type: ref,
      qty_changed: isOut ? -qty : qty,
      previous_qty: 0,
      new_qty: isOut ? -qty : qty,
      notes: ref
    };
  });

  try {
    // Attempt 1: Combined insertion
    const { error } = await supabase.from('product_stock_logs').insert(combinedLogs);
    if (!error) return;

    console.warn('Combined stock log insert failed, trying schema-specific fallback:', error.message);

    // Attempt 2: Modern schema only
    const modernLogs = logArray.map(item => {
      const qty = Math.abs(parseFloat(item.quantity || 0));
      const isOut = item.type === 'OUT' || (parseFloat(item.quantity || 0) < 0 && item.type !== 'IN');
      const parsedPid = parseInt(item.product_id, 10);
      return {
        user_id: item.user_id,
        product_id: isNaN(parsedPid) ? item.product_id : parsedPid,
        type: isOut ? 'OUT' : 'IN',
        quantity: qty,
        reference_id: String(item.reference_id || 'STOCK_UPDATE')
      };
    });

    const { error: modernErr } = await supabase.from('product_stock_logs').insert(modernLogs);
    if (!modernErr) return;

    // Attempt 3: Legacy schema only
    const legacyLogs = logArray.map(item => {
      const qty = Math.abs(parseFloat(item.quantity || 0));
      const isOut = item.type === 'OUT' || (parseFloat(item.quantity || 0) < 0 && item.type !== 'IN');
      const ref = String(item.reference_id || (isOut ? 'BILL_SALE' : 'RESTOCK'));
      const parsedPid = parseInt(item.product_id, 10);
      return {
        user_id: item.user_id,
        product_id: isNaN(parsedPid) ? item.product_id : parsedPid,
        change_type: ref,
        qty_changed: isOut ? -qty : qty,
        previous_qty: 0,
        new_qty: isOut ? -qty : qty,
        notes: ref
      };
    });

    const { error: legacyErr } = await supabase.from('product_stock_logs').insert(legacyLogs);
    if (legacyErr) {
      console.error('All stock log insertion attempts failed. Modern error:', modernErr.message, 'Legacy error:', legacyErr.message);
    }
  } catch (err) {
    console.error('Exception writing stock logs:', err.message || err);
  }
}

module.exports = {
  recordStockLogs
};
