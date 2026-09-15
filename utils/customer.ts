export interface CustomerInfo {
  name: string;
  address: string;
  phone?: string;
  gstin: string;
  state: string;
}

/**
 * Parses a serialized customer info string.
 * Format: "Name||Address||GSTIN||State||Phone" or "Name||Address||GSTIN||State"
 * Fallback for old records: simple string becomes the name, others empty.
 */
export const parseCustomerInfo = (customerNameStr: string | null | undefined): CustomerInfo => {
  if (!customerNameStr) {
    return { name: '', address: '', phone: '', gstin: '', state: 'Tamil Nadu' };
  }
  if (customerNameStr.includes('||')) {
    const parts = customerNameStr.split('||');
    const name = parts[0] || '';
    let address = parts[1] || '';
    const gstin = parts[2] || '';
    const state = parts[3] || 'Tamil Nadu';
    let phone = parts[4] || '';

    // If phone was not in 5th part, check if 10-digit phone exists in address string
    if (!phone && address) {
      const phoneMatch = address.match(/\b\d{10}\b/);
      if (phoneMatch) {
        phone = phoneMatch[0];
      }
    }

    return {
      name,
      address,
      phone,
      gstin,
      state,
    };
  }
  return {
    name: customerNameStr,
    address: '',
    phone: '',
    gstin: '',
    state: 'Tamil Nadu',
  };
};

/**
 * Serializes customer info object to a string for saving in database.
 * Format: "Name||Address||GSTIN||State||Phone"
 */
export const serializeCustomerInfo = (info: CustomerInfo): string => {
  const name = (info.name || '').trim();
  const address = (info.address || '').trim();
  const phone = (info.phone || '').trim();
  const gstin = (info.gstin || '').trim().toUpperCase();
  const state = (info.state || 'Tamil Nadu').trim();
  return `${name}||${address}||${gstin}||${state}||${phone}`;
};
