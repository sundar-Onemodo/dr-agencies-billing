import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling, Bill } from '@/context/BillingContext';
import { GoldButton } from '@/components/ui/GoldButton';
import { BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';

export default function BillPreviewScreen() {
  const router = useRouter();
  const { billId, billData, isDraft } = useLocalSearchParams<{
    billId?: string;
    billData?: string;
    isDraft?: string;
  }>();
  
  const { bills, companySettings, printerSettings } = useBilling();
  const [bill, setBill] = useState<Bill | null>(null);

  useEffect(() => {
    if (billId) {
      // Find saved bill
      const found = bills.find((b) => b.id === billId);
      if (found) {
        setBill(found);
      }
    } else if (billData) {
      // Load draft bill data
      try {
        const parsed = JSON.parse(billData) as Bill;
        setBill(parsed);
      } catch (e) {
        Alert.alert('Error', 'Failed to load preview data');
      }
    }
  }, [billId, billData, bills]);

  if (!bill) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={50} color="#FF4B4B" />
        <Text style={styles.errorText}>No preview data found</Text>
        <GoldButton title="Go Back" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  // Helper to parse date string (ISO or DD-MM-YYYY)
  const parseDateString = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    if (dateStr.includes('T') || dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
      return new Date(dateStr);
    }
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // 0-indexed
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  };

  // Helper to format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    const d = parseDateString(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  // Simulating sharing PDF/Text of the invoice
  const handleShareInvoice = async () => {
    try {
      const itemsList = bill.items
        .map((item) => `${item.name} (${item.qty} x ₹${item.price}) = ₹${item.amount}`)
        .join('\n');

      const message = `
=================================
       D R AGENCIES INVOICE      
=================================
Invoice No: ${bill.invoiceNumber || bill.id}
Date: ${formatDateForDisplay(bill.date)}
Customer: ${bill.customerName}
---------------------------------
Items:
${itemsList}
---------------------------------
Subtotal: ₹${bill.subtotal}
GST Tax: ₹${bill.cgst + bill.sgst}
Grand Total: ₹${bill.total}
=================================
Thank you for doing business!
      `;

      await Share.share({
        message,
        title: `Invoice ${bill.invoiceNumber || bill.id}`,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not share invoice');
    }
  };

  // Printing to Bluetooth ESC/POS or falling back to simulation
  const handlePrintInvoice = async () => {
    const printerName = printerSettings.connectedPrinter;
    const printerAddress = printerSettings.connectedPrinterAddress;
    
    if (!printerName) {
      Alert.alert(
        'Setup Printer',
        'No hardware printer connected. Would you like to set one up in Settings?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Settings', onPress: () => router.push('/(tabs)/settings') },
        ]
      );
      return;
    }

    // Checking if running in native app with real bluetooth connection
    if (!BluetoothEscposPrinter || !printerAddress || printerAddress.startsWith('pr-')) {
      // Fallback/Simulation mode
      Alert.alert(
        'Print Success (Simulated)',
        `Sending invoice data to connected printer "${printerName}" (${printerSettings.paperSize} width)...`,
        [{ text: 'Dismiss' }]
      );
      return;
    }

    try {
      // 1. Initialize printer
      await BluetoothEscposPrinter.printerInit();
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      
      const is58 = printerSettings.paperSize === '58mm';
      const colWidths = is58 ? [16, 6, 10] : [24, 8, 16]; // Columns layout for 32 vs 48 chars width
      
      // 2. Print Header
      await BluetoothEscposPrinter.setBlob(1); // Set Bold
      await BluetoothEscposPrinter.printText(`${companySettings.name}\n`, {
        encoding: 'GBK',
        codepage: 0,
        widthtimes: 1,
        heigthtimes: 1,
        fonttype: 1
      });
      await BluetoothEscposPrinter.setBlob(0); // Set Normal
      
      await BluetoothEscposPrinter.printText(`${companySettings.address}\n`, {});
      await BluetoothEscposPrinter.printText(`Phone: ${companySettings.phone}\n`, {});
      await BluetoothEscposPrinter.printText(`GSTIN: ${companySettings.gstin}\n`, {});
      
      const divider = is58 ? '-'.repeat(32) + '\n' : '-'.repeat(48) + '\n';
      await BluetoothEscposPrinter.printText(divider, {});
      
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printText("TAX INVOICE\n", {});
      await BluetoothEscposPrinter.setBlob(0);
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 3. Print Meta Info
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText(`Invoice No: ${bill.invoiceNumber || bill.id}\n`, {});
      await BluetoothEscposPrinter.printText(`Date: ${formatDateForDisplay(bill.date)}\n`, {});
      await BluetoothEscposPrinter.printText(`Billed To: ${bill.customerName}\n`, {});
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 4. Print Table Headers
      await BluetoothEscposPrinter.printColumn(
        colWidths,
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.CENTER, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Item / Qty', 'Price', 'Amount'],
        {}
      );
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 5. Print Items
      for (const item of bill.items) {
        await BluetoothEscposPrinter.setBlob(1);
        await BluetoothEscposPrinter.printText(`${item.name}\n`, {});
        await BluetoothEscposPrinter.setBlob(0);
        await BluetoothEscposPrinter.printColumn(
          colWidths,
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.CENTER, BluetoothEscposPrinter.ALIGN.RIGHT],
          [`Qty: ${item.qty}`, item.price.toFixed(2), item.amount.toFixed(2)],
          {}
        );
      }
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 6. Print Calculations
      await BluetoothEscposPrinter.printColumn(
        is58 ? [16, 16] : [24, 24],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Subtotal:', bill.subtotal.toFixed(2)],
        {}
      );
      
      if (bill.gstEnabled) {
        await BluetoothEscposPrinter.printColumn(
          is58 ? [16, 16] : [24, 24],
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
          ['CGST (9.0%):', bill.cgst.toFixed(2)],
          {}
        );
        await BluetoothEscposPrinter.printColumn(
          is58 ? [16, 16] : [24, 24],
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
          ['SGST (9.0%):', bill.sgst.toFixed(2)],
          {}
        );
      }
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printColumn(
        is58 ? [16, 16] : [24, 24],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['GRAND TOTAL:', formatCurrency(bill.total)],
        {}
      );
      await BluetoothEscposPrinter.setBlob(0);
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 7. Print Bank details
      await BluetoothEscposPrinter.printText("BANK PAYMENT DETAILS\n", {});
      await BluetoothEscposPrinter.printText(`Bank: ${companySettings.bankName}\n`, {});
      await BluetoothEscposPrinter.printText(`Name: ${companySettings.accountName}\n`, {});
      await BluetoothEscposPrinter.printText(`A/C: ${companySettings.accountNo}\n`, {});
      await BluetoothEscposPrinter.printText(`IFSC: ${companySettings.ifsc}\n`, {});
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // 8. Signatures & Footer
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.RIGHT);
      await BluetoothEscposPrinter.printText(`For ${companySettings.name}\n\n\n`, {});
      await BluetoothEscposPrinter.printText("Authorized Signatory\n", {});
      
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText("* Thanks for doing business! *\n", {});
      await BluetoothEscposPrinter.printText("Goods once sold will not be returned.\n\n\n\n", {});
      
    } catch (error) {
      console.warn('Real printer error:', error);
      Alert.alert('Printing Error', 'Could not print to the device. Please verify your Bluetooth connection and try again.');
    }
  };

  // Helper to dynamically adjust preview container sizing
  const getPaperWidthStyle = () => {
    switch (printerSettings.paperSize) {
      case '58mm':
        return {
          maxWidth: 290,
          padding: 12,
        };
      case '80mm':
        return {
          maxWidth: 380,
          padding: 18,
        };
      case 'A4':
      default:
        return {
          width: '100%',
          padding: 24,
        };
    }
  };

  const renderDivider = () => {
    const chars = printerSettings.paperSize === '58mm' ? 32 : (printerSettings.paperSize === '80mm' ? 48 : 64);
    return <Text style={styles.dashedDivider}>{'-'.repeat(chars)}</Text>;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.navBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <Text style={styles.navbarTitle}>
          {isDraft === 'true' ? 'Draft Receipt' : 'Invoice Details'}
        </Text>
        <TouchableOpacity style={styles.navShareBtn} onPress={handleShareInvoice}>
          <Ionicons name="share-social-outline" size={22} color="#D4AF37" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Receipt Container simulating white paper */}
        <View style={[styles.receiptPaper, getPaperWidthStyle()]}>
          
          {/* Header */}
          <Text style={styles.receiptHeaderName}>{companySettings.name}</Text>
          <Text style={styles.receiptHeaderDetail}>{companySettings.address}</Text>
          <Text style={styles.receiptHeaderDetail}>Phone: {companySettings.phone}</Text>
          <Text style={styles.receiptHeaderDetail}>GSTIN: {companySettings.gstin}</Text>
          
          {renderDivider()}
          <Text style={styles.receiptDocTitle}>TAX INVOICE</Text>
          {renderDivider()}

          {/* Invoice Meta */}
          <View style={styles.metaRow}>
            <Text style={styles.receiptMetaText}>Invoice No: {bill.invoiceNumber || bill.id}</Text>
            <Text style={styles.receiptMetaText}>Date: {formatDateForDisplay(bill.date)}</Text>
          </View>
          <Text style={styles.receiptMetaText}>Billed To: {bill.customerName}</Text>
          
          {renderDivider()}

          {/* Items Table */}
          <View style={styles.tableRowHeader}>
            <Text style={[styles.receiptText, styles.itemColHeader]}>Item / Qty</Text>
            <Text style={[styles.receiptText, styles.priceColHeader]}>Price</Text>
            <Text style={[styles.receiptText, styles.amountColHeader]}>Amount</Text>
          </View>
          {renderDivider()}

          {bill.items.map((item, index) => (
            <View key={item.id || index} style={styles.receiptItemRow}>
              <View style={styles.itemCol}>
                <Text style={styles.receiptTextBold}>{item.name}</Text>
                <Text style={styles.receiptSubtext}>Qty: {item.qty}</Text>
              </View>
              <Text style={[styles.receiptText, styles.priceCol]}>
                {item.price.toFixed(2)}
              </Text>
              <Text style={[styles.receiptText, styles.amountCol]}>
                {item.amount.toFixed(2)}
              </Text>
            </View>
          ))}

          {renderDivider()}

          {/* Calculation Area */}
          <View style={styles.receiptCalcRow}>
            <Text style={styles.receiptText}>Subtotal:</Text>
            <Text style={styles.receiptText}>{bill.subtotal.toFixed(2)}</Text>
          </View>

          {bill.gstEnabled && (
            <>
              <View style={styles.receiptCalcRow}>
                <Text style={styles.receiptText}>CGST (9.0%):</Text>
                <Text style={styles.receiptText}>{bill.cgst.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptCalcRow}>
                <Text style={styles.receiptText}>SGST (9.0%):</Text>
                <Text style={styles.receiptText}>{bill.sgst.toFixed(2)}</Text>
              </View>
            </>
          )}

          {renderDivider()}
          <View style={styles.receiptCalcRow}>
            <Text style={styles.receiptTextBoldBig}>GRAND TOTAL:</Text>
            <Text style={styles.receiptTextBoldBig}>{formatCurrency(bill.total)}</Text>
          </View>
          {renderDivider()}

          {/* Bank Details */}
          <Text style={styles.receiptSectionTitle}>BANK PAYMENT DETAILS</Text>
          <Text style={styles.receiptBankDetail}>Bank Name: {companySettings.bankName}</Text>
          <Text style={styles.receiptBankDetail}>Account Name: {companySettings.accountName}</Text>
          <Text style={styles.receiptBankDetail}>A/C Number: {companySettings.accountNo}</Text>
          <Text style={styles.receiptBankDetail}>IFSC Code: {companySettings.ifsc}</Text>

          {renderDivider()}

          {/* Signatory Area */}
          <View style={styles.signatureContainer}>
            <Text style={styles.signatureTitle}>For {companySettings.name}</Text>
            <View style={styles.signatureSpacer} />
            <Text style={styles.signatureLine}>----------------------------</Text>
            <Text style={styles.signatureSubtitle}>Authorized Signatory</Text>
          </View>

          <Text style={[styles.receiptFooterNote, { marginTop: 24 }]}>
            * Thanks for doing business with us! *
          </Text>
          <Text style={styles.receiptFooterNote}>
            Goods once sold will not be returned.
          </Text>
        </View>

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          <GoldButton
            title="Bluetooth Print (Thermal)"
            iconName="print-outline"
            onPress={handlePrintInvoice}
            style={styles.primaryBtn}
          />
          <GoldButton
            title="Share Digitally (Text/WhatsApp)"
            variant="outlined"
            onPress={handleShareInvoice}
            style={styles.secondaryBtn}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
  },
  navbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  navBackBtn: {
    padding: 8,
  },
  navbarTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  navShareBtn: {
    padding: 8,
  },
  scrollContent: {
    padding: 16,
    alignItems: 'center',
    paddingBottom: 40,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#191820',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginVertical: 16,
  },
  receiptPaper: {
    backgroundColor: '#FFFFFF',
    width: '100%',
    borderRadius: 8,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  receiptHeaderName: {
    color: '#000000',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
  },
  receiptHeaderDetail: {
    color: '#333333',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginVertical: 1,
  },
  dashedDivider: {
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginVertical: 6,
    letterSpacing: -1,
  },
  receiptDocTitle: {
    color: '#000000',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '800',
    textAlign: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  receiptMetaText: {
    color: '#000000',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tableRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptText: {
    color: '#000000',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  receiptTextBold: {
    color: '#000000',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '700',
  },
  receiptTextBoldBig: {
    color: '#000000',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '900',
  },
  receiptSubtext: {
    color: '#555555',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 1,
  },
  itemColHeader: {
    flex: 2,
  },
  priceColHeader: {
    flex: 1.1,
    textAlign: 'right',
  },
  amountColHeader: {
    flex: 1.2,
    textAlign: 'right',
  },
  receiptItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  itemCol: {
    flex: 2,
  },
  priceCol: {
    flex: 1.1,
    textAlign: 'right',
  },
  amountCol: {
    flex: 1.2,
    textAlign: 'right',
  },
  receiptCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  receiptSectionTitle: {
    color: '#000000',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 4,
  },
  receiptBankDetail: {
    color: '#333333',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginVertical: 1,
  },
  signatureContainer: {
    alignItems: 'flex-end',
    marginTop: 16,
  },
  signatureTitle: {
    color: '#000000',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    fontWeight: '700',
  },
  signatureSpacer: {
    height: 40,
  },
  signatureLine: {
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  signatureSubtitle: {
    color: '#333333',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginRight: 10,
  },
  receiptFooterNote: {
    color: '#444444',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    marginVertical: 1,
  },
  actionsContainer: {
    width: '100%',
    marginTop: 20,
    gap: 8,
  },
  primaryBtn: {
    height: 50,
  },
  secondaryBtn: {
    height: 50,
  },
});
