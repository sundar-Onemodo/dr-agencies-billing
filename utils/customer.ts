export interface CustomerInfo {
  name: string;
  address: string;
  gstin: string;
  state: string;
}

/**
 * Parses a serialized customer info string.
 * Format: "Name||Address||GSTIN||State"
 * Fallback for old records: simple string becomes the name, others empty.
 */
export const parseCustomerInfo = (customerNameStr: string | null | undefined): CustomerInfo => {
  if (!customerNameStr) {
    return { name: '', address: '', gstin: '', state: 'Tamil Nadu' };
  }
  if (customerNameStr.includes('||')) {
    const parts = customerNameStr.split('||');
    return {
      name: parts[0] || '',
      address: parts[1] || '',
      gstin: parts[2] || '',
      state: parts[3] || 'Tamil Nadu',
    };
  }
  return {
    name: customerNameStr,
    address: '',
    gstin: '',
    state: 'Tamil Nadu',
  };
};

/**
 * Serializes customer info object to a string for saving in database.
 */
export const serializeCustomerInfo = (info: CustomerInfo): string => {
  const name = (info.name || '').trim();
  const address = (info.address || '').trim();
  const gstin = (info.gstin || '').trim().toUpperCase();
  const state = (info.state || 'Tamil Nadu').trim();
  return `${name}||${address}||${gstin}||${state}`;
};
