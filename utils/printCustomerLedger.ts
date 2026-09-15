import { CompanySettings } from '@/context/BillingContext';
import { Customer, CustomerPayment } from '@/store/slices/customerSlice';
import * as FileSystem from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

/**
 * Gets company initials for the logo.
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
 * Format currency to INR (₹)
 */
const formatCurrencyVal = (val: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(val || 0);
};

/**
 * Format date string to DD-MM-YYYY
 */
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
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

/**
 * Generates high quality A4 HTML layout for Customer Ledger Statement
 */
export const generateCustomerLedgerHtml = (
  customer: Customer,
  transactions: CustomerPayment[],
  companySettings: CompanySettings
): string => {
  const initials = getCompanyInitials(companySettings.name);
  const todayStr = formatDate(new Date().toISOString());

  // Sort transactions chronologically (oldest first) to compute accurate running balance
  const sortedTx = [...transactions].sort((a, b) => {
    return new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime();
  });

  let runningBalance = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  const rowsHtml = sortedTx.map((tx, index) => {
    const isBill = tx.type === 'bill';
    const amount = tx.amount || 0;

    let debit = 0;
    let credit = 0;

    if (isBill) {
      debit = amount;
      totalDebit += debit;
      runningBalance += debit;
    } else {
      credit = amount;
      totalCredit += credit;
      runningBalance -= credit;
    }

    const typeLabel = isBill ? 'Tax Invoice' : `Payment (${tx.paymentMode || 'Cash'})`;
    const refNo = isBill ? (tx.invoiceNumber || tx.billId || 'INV') : `REC-${tx.id.replace('payment-', '').slice(-6).toUpperCase()}`;
    const badgeColor = isBill ? '#007aff' : '#34C759';

    return `
      <tr class="tx-row">
        <td style="text-align: center;">${index + 1}</td>
        <td style="text-align: center;">${formatDate(tx.paymentDate)}</td>
        <td>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; color: #ffffff; background-color: ${badgeColor};">
            ${typeLabel}
          </span>
        </td>
        <td style="font-weight: 600; font-size: 9.5px;">${refNo}</td>
        <td style="text-align: right; color: ${debit > 0 ? '#111111' : '#888888'};">
          ${debit > 0 ? `₹${debit.toFixed(2)}` : '-'}
        </td>
        <td style="text-align: right; color: ${credit > 0 ? '#2e7d32' : '#888888'}; font-weight: ${credit > 0 ? '600' : 'normal'};">
          ${credit > 0 ? `₹${credit.toFixed(2)}` : '-'}
        </td>
        <td style="text-align: right; font-weight: bold; color: ${runningBalance > 0 ? '#c62828' : '#2e7d32'};">
          ₹${Math.max(0, runningBalance).toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  const finalPending = Math.max(0, customer.pendingAmount);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Customer Statement - ${customer.name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;900&display=swap');
        
        * {
          box-sizing: border-box;
        }

        body {
          font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          margin: 0;
          padding: 20px 25px;
          color: #111111;
          background-color: #ffffff;
          font-size: 9.5px;
        }

        .statement-title-bar {
          text-align: center;
          margin-bottom: 8px;
        }

        .statement-title {
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #191820;
          margin: 0;
        }

        .statement-subtitle {
          font-size: 8.5px;
          color: #666666;
          margin-top: 2px;
          letter-spacing: 0.5px;
        }

        .statement-box {
          border: 1.5px solid #000000;
          width: 100%;
          position: relative;
        }

        .watermark {
          position: absolute;
          top: 40%;
          left: 10%;
          right: 10%;
          text-align: center;
          font-size: 55px;
          font-weight: 900;
          color: rgba(0, 0, 0, 0.03);
          transform: rotate(-25deg);
          letter-spacing: 6px;
          text-transform: uppercase;
          pointer-events: none;
          z-index: 0;
        }

        .header-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 1px solid #000000;
        }

        .company-col {
          width: 55%;
          padding: 10px;
          border-right: 1px solid #000000;
          vertical-align: top;
        }

        .meta-col {
          width: 45%;
          padding: 10px;
          vertical-align: top;
          background-color: #fafafa;
        }

        .logo-row {
          display: flex;
          flex-direction: row;
          align-items: center;
        }

        .logo-circle {
          width: 42px;
          height: 42px;
          border-radius: 21px;
          border: 1.5px solid #D4AF37;
          background-color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 900;
          color: #D4AF37;
          margin-right: 10px;
          flex-shrink: 0;
          text-align: center;
          line-height: 38px;
        }

        .company-name {
          font-size: 13px;
          font-weight: 900;
          color: #000000;
          text-transform: uppercase;
          margin: 0 0 2px 0;
        }

        .company-text {
          font-size: 8.5px;
          color: #333333;
          line-height: 1.3;
        }

        .meta-item {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          font-size: 9px;
        }

        .meta-label {
          color: #555555;
          font-weight: 600;
        }

        .meta-val {
          font-weight: 800;
          color: #000000;
        }

        /* Customer Profile & Financial Summary Grid */
        .info-grid {
          display: flex;
          flex-direction: row;
          border-bottom: 1px solid #000000;
        }

        .customer-info-box {
          width: 55%;
          padding: 10px;
          border-right: 1px solid #000000;
        }

        .summary-info-box {
          width: 45%;
          padding: 10px;
          background-color: #fcfcfc;
        }

        .section-label {
          font-size: 8px;
          font-weight: 800;
          color: #777777;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }

        .customer-title {
          font-size: 12px;
          font-weight: 900;
          color: #000000;
          text-transform: uppercase;
          margin-bottom: 3px;
        }

        .customer-detail {
          font-size: 8.5px;
          color: #333333;
          line-height: 1.35;
        }

        .summary-card-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 9px;
        }

        .summary-card-row.bold-total {
          border-top: 1px dashed #cccccc;
          padding-top: 4px;
          margin-top: 4px;
        }

        /* Transaction Table */
        .tx-table {
          width: 100%;
          border-collapse: collapse;
        }

        .tx-table th {
          background-color: #f2f2f2;
          border-bottom: 1px solid #000000;
          border-right: 1px solid #e0e0e0;
          padding: 6px 5px;
          font-size: 8.5px;
          font-weight: 800;
          color: #000000;
          text-transform: uppercase;
        }

        .tx-table th:last-child {
          border-right: none;
        }

        .tx-table td {
          border-bottom: 1px solid #eeeeee;
          border-right: 1px solid #f0f0f0;
          padding: 5px;
          font-size: 9px;
        }

        .tx-table td:last-child {
          border-right: none;
        }

        .tx-table tr:nth-child(even) td {
          background-color: #fafafa;
        }

        .tx-total-row td {
          background-color: #f7f7f7 !important;
          font-weight: 800;
          border-top: 1.5px solid #000000;
          border-bottom: 1px solid #000000;
          padding: 6px 5px;
        }

        /* Footer Section */
        .footer-table {
          width: 100%;
          border-collapse: collapse;
        }

        .bank-box {
          width: 60%;
          padding: 8px 10px;
          border-right: 1px solid #000000;
          vertical-align: top;
          font-size: 8px;
          line-height: 1.35;
        }

        .signatory-box {
          width: 40%;
          padding: 8px 10px;
          text-align: center;
          vertical-align: top;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          height: 70px;
        }

        .empty-history {
          padding: 20px;
          text-align: center;
          color: #888888;
          font-style: italic;
        }
      </style>
    </head>
    <body>
      <div class="statement-title-bar">
        <h1 class="statement-title">Customer Account Statement</h1>
        <div class="statement-subtitle">Statement & Detailed Purchase Ledger History</div>
      </div>

      <div class="statement-box">
        <div class="watermark">${companySettings.name || 'DR AGENCIES'}</div>

        <!-- Header -->
        <table class="header-table">
          <tr>
            <td class="company-col">
              <div class="logo-row">
                <div class="logo-circle">${initials}</div>
                <div>
                  <h2 class="company-name">${companySettings.name}</h2>
                  <div class="company-text">${companySettings.address}</div>
                  <div class="company-text"><strong>GSTIN:</strong> ${companySettings.gstin}</div>
                  <div class="company-text"><strong>Phone:</strong> ${companySettings.phone}</div>
                </div>
              </div>
            </td>
            <td class="meta-col">
              <div class="meta-item">
                <span class="meta-label">Statement Date:</span>
                <span class="meta-val">${todayStr}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Customer ID:</span>
                <span class="meta-val">CUST-${customer.id}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Total Transactions:</span>
                <span class="meta-val">${transactions.length} Records</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Account Status:</span>
                <span class="meta-val" style="color: ${finalPending > 0 ? '#c62828' : '#2e7d32'};">
                  ${finalPending > 0 ? 'PAYMENT PENDING' : 'ACCOUNT CLEARED'}
                </span>
              </div>
            </td>
          </tr>
        </table>

        <!-- Info Grid -->
        <div class="info-grid">
          <div class="customer-info-box">
            <div class="section-label">Billed To / Customer Information</div>
            <div class="customer-title">${customer.name}</div>
            <div class="customer-detail"><strong>Address:</strong> ${customer.address || 'Palaganatham, Madurai'}</div>
            <div class="customer-detail"><strong>Contact No:</strong> ${customer.phone || 'N/A'}</div>
            <div class="customer-detail"><strong>GSTIN:</strong> ${customer.gstin || 'Unregistered'}</div>
            <div class="customer-detail"><strong>State:</strong> ${customer.state || 'Tamil Nadu (33)'}</div>
          </div>
          <div class="summary-info-box">
            <div class="section-label">Account Financial Summary</div>
            <div class="summary-card-row">
              <span style="color: #555555;">Total Invoiced (Billed):</span>
              <span style="font-weight: 700;">${formatCurrencyVal(totalDebit || customer.totalBilled)}</span>
            </div>
            <div class="summary-card-row">
              <span style="color: #555555;">Total Payments Received:</span>
              <span style="font-weight: 700; color: #2e7d32;">${formatCurrencyVal(totalCredit || customer.totalReceived)}</span>
            </div>
            <div class="summary-card-row bold-total">
              <span style="font-weight: 800; color: #111111;">Current Balance Due:</span>
              <span style="font-weight: 900; font-size: 11px; color: ${finalPending > 0 ? '#c62828' : '#2e7d32'};">
                ${formatCurrencyVal(finalPending)}
              </span>
            </div>
          </div>
        </div>

        <!-- Transactions Table -->
        <table class="tx-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">#</th>
              <th style="width: 14%; text-align: center;">Date</th>
              <th style="width: 18%; text-align: left;">Type</th>
              <th style="width: 18%; text-align: left;">Ref / Invoice No</th>
              <th style="width: 15%; text-align: right;">Debit (Billed)</th>
              <th style="width: 15%; text-align: right;">Credit (Paid)</th>
              <th style="width: 15%; text-align: right;">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml.length > 0 ? rowsHtml : `
              <tr>
                <td colspan="7" class="empty-history">No purchase or payment history recorded for this customer yet.</td>
              </tr>
            `}
            <tr class="tx-total-row">
              <td colspan="4" style="text-align: right; text-transform: uppercase;">Closing Ledger Totals:</td>
              <td style="text-align: right;">₹${totalDebit.toFixed(2)}</td>
              <td style="text-align: right; color: #2e7d32;">₹${totalCredit.toFixed(2)}</td>
              <td style="text-align: right; color: ${finalPending > 0 ? '#c62828' : '#2e7d32'};">
                ₹${finalPending.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Footer -->
        <table class="footer-table">
          <tr>
            <td class="bank-box">
              <div style="font-weight: 800; color: #555555; text-transform: uppercase; margin-bottom: 2px;">Bank Payment Details</div>
              <div>Bank Name: <strong>${companySettings.bankName || 'CANARA BANK, GOMATHIPURAM, MADURAI'}</strong></div>
              <div>Account No: <strong>${companySettings.accountNo || '120000798208'}</strong></div>
              <div>IFSC Code: <strong>${companySettings.ifsc || 'CNRBL0003420'}</strong></div>
              <div>A/C Holder: <strong>${companySettings.accountName || companySettings.name}</strong></div>
            </td>
            <td class="signatory-box">
              <div style="font-weight: 800; font-size: 8.5px;">For ${companySettings.name}</div>
              <div style="font-weight: 700; font-size: 8px; border-top: 1px solid #333333; padding-top: 2px; margin-top: 30px;">
                Authorized Signatory
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
 * Print Customer Ledger Statement directly
 */
export const printCustomerLedger = async (
  customer: Customer,
  transactions: CustomerPayment[],
  companySettings: CompanySettings
) => {
  const htmlContent = generateCustomerLedgerHtml(customer, transactions, companySettings);
  try {
    await Print.printAsync({ html: htmlContent });
  } catch (error) {
    console.error('Error printing customer ledger:', error);
    throw error;
  }
};

/**
 * Generates and downloads/saves Customer Ledger Statement as PDF file
 */
export const downloadCustomerLedgerPdf = async (
  customer: Customer,
  transactions: CustomerPayment[],
  companySettings: CompanySettings
) => {
  const htmlContent = generateCustomerLedgerHtml(customer, transactions, companySettings);
  try {
    const { uri } = await Print.printToFileAsync({ html: htmlContent });
    const cleanCustomerName = customer.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const pdfName = `Ledger_Statement_${cleanCustomerName}.pdf`;
    const destinationUri = `${FileSystem.cacheDirectory}${pdfName}`;

    // Copy file to cache directory with custom file name
    await FileSystem.copyAsync({
      from: uri,
      to: destinationUri,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(destinationUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Download Statement - ${customer.name}`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      throw new Error('Sharing/Saving is not available on this device');
    }
  } catch (error) {
    console.error('Error downloading customer ledger PDF:', error);
    throw error;
  }
};
