import { Bill, CompanySettings } from '@/context/BillingContext';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { parseCustomerInfo } from './customer';

/**
 * Parses the product name to separate the main name and HSN code if present.
 */
const parseItemNameAndHsn = (name: string) => {
  const hsnMatch = name.match(/(?:HSN\/SAC\s*:\s*|HSN\s*:\s*)(\d+)/i);
  const gstMatch = name.match(/(?:GST\s*:\s*)(\d+)%/i);
  let hsn = '';
  let gstRate = 18;
  let cleanName = name;

  if (hsnMatch) {
    hsn = hsnMatch[1] || hsnMatch[0];
    cleanName = cleanName.replace(hsnMatch[0], '');
  }
  if (gstMatch) {
    gstRate = parseInt(gstMatch[1], 10);
    cleanName = cleanName.replace(gstMatch[0], '');
  }

  cleanName = cleanName
    .replace(/\(\s*\)/g, '')
    .replace(/,\s*,/g, ',')
    .trim();

  return { name: cleanName, hsn, gstRate };
};

/**
 * Gets the initials of a company name for the logo.
 */
const getCompanyInitials = (name: string): string => {
  if (!name) return 'DR';
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();
};

/**
 * Converts a number into Indian currency words.
 */
const numberToWords = (num: number): string => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    if (n === 0) return '';
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  const convert = (n: number): string => {
    if (n === 0) return 'Zero';
    let str = '';

    // Crore
    const crore = Math.floor(n / 10000000);
    n %= 10000000;
    if (crore > 0) {
      str += convertLessThanOneThousand(crore) + ' Crore ';
    }

    // Lakh
    const lakh = Math.floor(n / 100000);
    n %= 100000;
    if (lakh > 0) {
      str += convertLessThanOneThousand(lakh) + ' Lakh ';
    }

    // Thousand
    const thousand = Math.floor(n / 1000);
    n %= 1000;
    if (thousand > 0) {
      str += convertLessThanOneThousand(thousand) + ' Thousand ';
    }

    if (n > 0) {
      str += convertLessThanOneThousand(n) + ' ';
    }

    return str.trim();
  };

  const integerPart = Math.floor(num);
  const words = convert(integerPart);
  return words ? words + ' Rupees only' : '';
};

/**
 * Generates the HTML content for an A4 Tax Invoice
 */
export const generateA4Html = (bill: Bill, companySettings: CompanySettings): string => {
  const customer = parseCustomerInfo(bill.customerName);
  const initials = getCompanyInitials(companySettings.name || 'KM');

  const extractPhone = (addressStr: string) => {
    const phoneMatch = addressStr.match(/\b\d{10}\b/);
    return phoneMatch ? phoneMatch[0] : '';
  };
  const phone = extractPhone(customer.address) || '9385707011';
  const cleanAddress = (customer.address || '').replace(/\b\d{10}\b/, '').replace(/Contact\s*No\.?\s*:\s*/i, '').trim();

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/) ? new Date(dateStr) : null;
      if (d) {
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  const formattedDate = formatDate(bill.date);

  // Calculate dynamic GST rates if subtotal is available
  const subtotal = bill.subtotal || 0;

  // Format currency in Indian standard (INR)
  const formatCurrencyVal = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Generate table rows for items
  let totalGst = 0;
  const groupedGst: Record<number, number> = {};
  const itemsHtml = bill.items.map((item, index) => {
    const { name, hsn, gstRate } = parseItemNameAndHsn(item.name);

    // Calculate dynamic per-item GST and total amount
    const itemSubtotal = item.amount || (item.qty * item.price);
    const itemGstVal = bill.gstEnabled ? (itemSubtotal * (gstRate / 100)) : 0;
    totalGst += itemGstVal;

    if (itemGstVal > 0) {
      groupedGst[gstRate] = (groupedGst[gstRate] || 0) + itemGstVal;
    }

    const cgstDisplay = bill.gstEnabled
      ? `₹${(itemGstVal / 2).toFixed(2)}<br/><span style="font-size: 8px; color: #555;">${gstRate / 2}%</span>`
      : '₹0.00 (0%)';
    const sgstDisplay = bill.gstEnabled
      ? `₹${(itemGstVal / 2).toFixed(2)}<br/><span style="font-size: 8px; color: #555;">${gstRate / 2}%</span>`
      : '₹0.00 (0%)';

    return `
      <tr class="item-row">
        <td style="text-align: center;">${index + 1}</td>
        <td>
          <div class="item-name">${name}</div>
        </td>
        <td style="text-align: center;">${hsn || '21039040'}</td>
        <td style="text-align: center;">${item.qty} kg</td>
        <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
        <td style="text-align: right;">${cgstDisplay}</td>
        <td style="text-align: right;">${sgstDisplay}</td>
        <td style="text-align: right;">₹${itemSubtotal.toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  // Total quantity
  const totalQty = bill.items.reduce((sum, item) => sum + item.qty, 0);

  // Dynamic spacer row height
  const numItems = bill.items.length;
  const spacerHeight = Math.max(50, 300 - (numItems * 35));

  const amountInWords = numberToWords(bill.total);

  // Split total GST into CGST and SGST rows
  const gstRowsHtml = bill.gstEnabled ? Object.entries(groupedGst).map(([rateStr, amt]) => {
    const rate = parseFloat(rateStr);
    const splitRate = rate / 2;
    const splitAmt = amt / 2;
    return `
      <div class="amounts-row">
        <span>CGST (${splitRate}%):</span>
        <span style="font-weight: bold;">${formatCurrencyVal(splitAmt)}</span>
      </div>
      <div class="amounts-row">
        <span>SGST (${splitRate}%):</span>
        <span style="font-weight: bold;">${formatCurrencyVal(splitAmt)}</span>
      </div>
    `;
  }).join('') : '';

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Tax Invoice</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&display=swap');
        
        body {
          font-family: 'Outfit', sans-serif;
          margin: 0;
          padding: 20px 30px;
          color: #000000;
          background-color: #ffffff;
          box-sizing: border-box;
        }

        .invoice-box {
          width: 100%;
          max-width: 800px;
          margin: auto;
          border: 1px solid #000000;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 55px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.05);
          text-transform: uppercase;
          letter-spacing: 5px;
          pointer-events: none;
          z-index: 0;
          white-space: nowrap;
        }

        .invoice-title {
          text-align: center;
          font-size: 13px;
          font-weight: bold;
          padding: 5px 0;
          margin: 0;
          text-transform: uppercase;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          border-top: 1px solid #000000;
          border-bottom: 1px solid #000000;
        }

        .header-table td {
          padding: 8px;
          vertical-align: top;
        }

        .company-details-col {
          width: 55%;
          border-right: 1px solid #000000;
        }

        .logo-container {
          display: flex;
          align-items: center;
        }

        .logo-box {
          margin-right: 10px;
        }

        .company-info {
          flex: 1;
        }

        .company-name {
          font-size: 15px;
          font-weight: 900;
          text-transform: uppercase;
          margin: 0 0 2px 0;
        }

        .company-subtext {
          font-size: 10px;
          line-height: 1.3;
          margin: 2px 0;
        }

        .meta-details-col {
          width: 45%;
          padding: 0 !important;
        }

        .meta-sub-table {
          width: 100%;
          border-collapse: collapse;
          height: 100%;
        }

        .meta-sub-table td {
          padding: 6px 8px;
          font-size: 10px;
          vertical-align: top;
        }

        .meta-sub-table tr.row-border {
          border-bottom: 1px solid #000000;
        }

        .meta-sub-table td.col-border {
          border-right: 1px solid #000000;
        }

        .bill-to-section {
          padding: 8px;
          font-size: 11px;
          border-bottom: 1px solid #000000;
          line-height: 1.4;
        }

        .bill-to-title {
          font-weight: bold;
          color: #555555;
          margin-bottom: 2px;
        }

        .bill-to-name {
          font-weight: 900;
          font-size: 12px;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .items-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .items-table th {
          border-right: 1px solid #000000;
          border-bottom: 1px solid #000000;
          font-size: 11px;
          font-weight: bold;
          padding: 5px;
          text-align: center;
          background-color: #fcfcfc;
        }

        .items-table th:last-child {
          border-right: none;
        }

        .items-table td {
          border-right: 1px solid #000000;
          padding: 6px 5px;
          font-size: 10px;
          vertical-align: middle;
        }

        .items-table td:last-child {
          border-right: none;
        }

        .items-table tr.item-row {
          border-bottom: 1px solid #000000;
        }

        .items-table tr.spacer-row {
          height: ${spacerHeight}px;
        }

        .items-table tr.spacer-row td {
          border-bottom: 1px solid #000000;
        }

        .items-table tr.total-row {
          font-weight: bold;
          border-bottom: 1px solid #000000;
        }

        .items-table tr.total-row td {
          padding: 6px 5px;
          font-size: 11px;
        }

        .totals-section-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 1px solid #000000;
        }

        .totals-section-table td {
          padding: 0;
          vertical-align: top;
        }

        .words-box {
          width: 60%;
          border-right: 1px solid #000000;
          padding: 8px;
          font-size: 10px;
        }

        .words-title {
          color: #555555;
          margin-bottom: 4px;
        }

        .words-text {
          font-weight: bold;
          font-size: 11px;
        }

        .amounts-box {
          width: 40%;
          padding: 6px 8px !important;
        }

        .amounts-row {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          margin-bottom: 3px;
        }

        .amounts-row.bold-row {
          font-weight: bold;
          font-size: 11px;
          margin-top: 4px;
          border-top: 1px dashed #000000;
          padding-top: 4px;
        }

        .footer-section-table {
          width: 100%;
          border-collapse: collapse;
        }

        .footer-section-table td {
          padding: 8px;
          vertical-align: top;
          font-size: 10px;
        }

        .bank-details-box {
          width: 40%;
          border-right: 1px solid #000000;
          line-height: 1.4;
        }

        .bank-title {
          font-weight: bold;
          color: #555555;
          margin-bottom: 4px;
          text-transform: uppercase;
        }

        .terms-box {
          width: 30%;
          border-right: 1px solid #000000;
          line-height: 1.4;
        }

        .terms-title {
          font-weight: bold;
          color: #555555;
          margin-bottom: 4px;
        }

        .signatory-box {
          width: 30%;
          text-align: center;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 90px;
        }

        .signatory-company {
          font-weight: bold;
          font-size: 10px;
        }

        .signatory-title {
          font-weight: bold;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <h2 class="invoice-title">Tax Invoice</h2>

      <div class="invoice-box">
        <div class="watermark">${companySettings.name || 'D R AGENCIES'}</div>
        <table class="header-table">
          <tr>
            <td class="company-details-col">
              <div class="logo-container">
                <div class="logo-box">
                  <svg width="45" height="45" viewBox="0 0 100 100" style="display: inline-block;">
                    <circle cx="50" cy="50" r="45" fill="#fcfcfc" stroke="#dddddd" stroke-width="1.5"/>
                    <circle cx="50" cy="50" r="41" fill="none" stroke="#007aff" stroke-width="2"/>
                    <path d="M 25 65 L 45 45 L 60 52 L 75 32" fill="none" stroke="#ff8a00" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M 67 32 L 75 32 L 75 40" fill="none" stroke="#ff8a00" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M 25 72 L 40 55 L 55 60 L 75 40" fill="none" stroke="#007aff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                    <text x="50" y="85" font-family="'Outfit', sans-serif" font-size="9" font-weight="900" fill="#007aff" text-anchor="middle">${initials}</text>
                  </svg>
                </div>
                <div class="company-info">
                  <h1 class="company-name">${companySettings.name}</h1>
                  <div class="company-subtext">${companySettings.address}</div>
                  <div class="company-subtext">Email: ${companySettings.email || 'dragencies6250@gmail.com'}</div>
                  <div class="company-subtext" style="font-weight: bold;">GSTIN: ${companySettings.gstin}</div>
                  <div class="company-subtext">Phone No: ${companySettings.phone}</div>
                </div>
              </div>
            </td>
            <td class="meta-details-col">
              <table class="meta-sub-table">
                <tr class="row-border">
                  <td class="col-border" style="width: 50%;">
                    <div style="color: #555555; font-weight: bold;">Invoice No.</div>
                    <div style="font-weight: 900; font-size: 11px; margin-top: 3px;">${bill.invoiceNumber || bill.id}</div>
                  </td>
                  <td style="width: 50%;">
                    <div style="color: #555555; font-weight: bold;">Date</div>
                    <div style="font-weight: 900; font-size: 11px; margin-top: 3px;">${formattedDate}</div>
                  </td>
                </tr>
                <tr>
                  <td colspan="2">
                    <div style="color: #555555; font-weight: bold;">Place of supply</div>
                    <div style="font-weight: 900; font-size: 11px; margin-top: 3px;">33-Tamil Nadu</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <div class="bill-to-section">
          <div class="bill-to-title">Bill To</div>
          <div class="bill-to-name">${customer.name}</div>
          <div>${cleanAddress || 'PALAGANATHAM'}</div>
          <div>Contact No.: ${phone}</div>
          <div>GSTIN : ${customer.gstin || '33KSBPS0649G1ZL'}</div>
          <div>State: ${customer.state || '33-Tamil Nadu'}</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th style="width: 30%; text-align: left;">Item name</th>
              <th style="width: 10%;">HSN/ SAC</th>
              <th style="width: 10%;">Quantity (kg)</th>
              <th style="width: 11%; text-align: right;">Price</th>
              <th style="width: 11%; text-align: right;">CGST</th>
              <th style="width: 11%; text-align: right;">SGST</th>
              <th style="width: 12%; text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr class="spacer-row">
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
            <tr class="total-row">
              <td colspan="2" style="text-align: left;">Total</td>
              <td></td>
              <td style="text-align: center;">${totalQty} kg</td>
              <td></td>
              <td style="text-align: right;">₹${(totalGst / 2).toFixed(2)}</td>
              <td style="text-align: right;">₹${(totalGst / 2).toFixed(2)}</td>
              <td style="text-align: right;">${formatCurrencyVal(subtotal)}</td>
            </tr>
          </tbody>
        </table>

        <table class="totals-section-table">
          <tr>
            <td class="words-box">
              <div class="words-title">Invoice Amount in Words</div>
              <div class="words-text">${amountInWords}</div>
            </td>
            <td class="amounts-box">
              <div class="amounts-row">
                <span>Sub Total:</span>
                <span style="font-weight: bold;">${formatCurrencyVal(subtotal)}</span>
              </div>
              ${gstRowsHtml}
              <div class="amounts-row bold-row">
                <span>Total:</span>
                <span>${formatCurrencyVal(bill.total)}</span>
              </div>
            </td>
          </tr>
        </table>

        <table class="footer-section-table">
          <tr>
            <td class="bank-details-box">
              <div class="bank-title">Bank Details</div>
              <div>Name : <strong>${companySettings.bankName || 'CANARA BANK, GOMATHIPURAM,MADURAI'}</strong></div>
              <div>Account No : <strong>${companySettings.accountNo || '120000798208'}</strong></div>
              <div>IFSC code : <strong>${companySettings.ifsc || 'CNRBL0003420'}</strong></div>
              <div>Account holder's name : <strong>${companySettings.accountName || companySettings.name || 'KRISHNA MARKETING AGENCY'}</strong></div>
            </td>
            <td class="terms-box">
              <div class="terms-title">Terms and conditions</div>
              <div style="font-size: 9px; color: #444444;">Thanks for doing business with us!</div>
            </td>
            <td style="width: 30%; padding: 4px;">
              <div class="signatory-box">
                <div class="signatory-company">For : ${companySettings.name || 'KRISHNA MARKETING AGENCY'}</div>
                <div class="signatory-title">Authorized Signatory</div>
              </div>
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `;
};

/**
 * Generates and prints an A4 Invoice using expo-print
 */
export const printA4Invoice = async (bill: Bill, companySettings: CompanySettings) => {
  const htmlContent = generateA4Html(bill, companySettings);
  try {
    await Print.printAsync({
      html: htmlContent,
    });
  } catch (error) {
    console.error('Error printing A4 invoice:', error);
    throw error;
  }
};

/**
 * Generates and downloads/saves A4 Invoice as a PDF file
 */
export const downloadA4InvoicePdf = async (bill: Bill, companySettings: CompanySettings) => {
  const htmlContent = generateA4Html(bill, companySettings);
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    const pdfName = `${bill.invoiceNumber || bill.id}.pdf`;
    const destinationUri = `${FileSystem.cacheDirectory}${pdfName}`;

    // Copy file to cache directory with custom file name
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destinationUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download Invoice ${pdfName}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Error', 'Sharing/Saving is not available on this device');
    }
  } catch (error) {
    console.error('Error generating and sharing A4 PDF:', error);
    Alert.alert('PDF Error', 'Failed to generate invoice PDF.');
    throw error;
  }
};
