export interface CustomerInfo {
  name: string;
  address: string;
  phone?: string;
  gstin: string;
  state: string;
}

/**
 * Formats a phone number into Indian standard display: "+91 98765-43210".
 * If input is empty or invalid, returns fallback (default: "-").
 */
export const formatPhoneNumber = (phone: string | null | undefined, fallback: string = '-'): string => {
  if (!phone) return fallback;
  const trimmed = phone.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed === 'undefined' || trimmed === 'null') {
    return fallback;
  }

  // Extract digits only
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 5) return fallback;

  // 12 digits starting with 91 (e.g. 919876543210 or +919876543210)
  if (digits.length === 12 && digits.startsWith('91')) {
    const tenDigits = digits.slice(2);
    return `+91 ${tenDigits.slice(0, 5)}-${tenDigits.slice(5)}`;
  }

  // 10 digits (e.g. 9876543210)
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  // More than 10 digits (e.g. international format or with leading country code)
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)}-${last10.slice(5)}`;
  }

  return trimmed;
};

/**
 * Parses a serialized customer info string.
 * Format: "Name||Address||GSTIN||State||Phone" or "Name||Address||GSTIN||State"
 * Fallback for old records: simple string becomes the name, others empty.
 */
export const parseCustomerInfo = (customerNameStr: string | null | undefined): CustomerInfo => {
  if (!customerNameStr) {
    return { name: '', address: '', phone: '', gstin: '', state: '' };
  }
  if (customerNameStr.includes('||')) {
    const parts = customerNameStr.split('||');
    const name = parts[0] || '';
    let address = parts[1] || '';
    const gstin = parts[2] || '';
    const state = parts[3] || '';
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
    state: '',
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
  const state = (info.state || '').trim();
  return `${name}||${address}||${gstin}||${state}||${phone}`;
};
