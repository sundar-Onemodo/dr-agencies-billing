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
import { parseCustomerInfo } from '@/utils/customer';
import { printA4Invoice } from '@/utils/printA4';

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

export default function BillPreviewScreen() {
  const router = useRouter();
  const { billId, billData, isDraft } = useLocalSearchParams<{
    billId?: string;
    billData?: string;
    isDraft?: string;
  }>();
  
  const { bills, companySettings, printerSettings } = useBilling();
  const [bill, setBill] = useState<Bill | null>(null);

  const isA4 = printerSettings.paperSize === 'A4';
  const customer = bill ? parseCustomerInfo(bill.customerName) : { name: '', address: '', gstin: '', state: 'Tamil Nadu' };
  const extractPhone = (addressStr: string) => {
    const phoneMatch = addressStr.match(/\b\d{10}\b/);
    return phoneMatch ? phoneMatch[0] : '';
  };
  const phone = extractPhone(customer.address) || '9385707011';
  const cleanAddress = (customer.address || '').replace(/\b\d{10}\b/, '').replace(/Contact\s*No\.?\s*:\s*/i, '').trim();
  
  // Calculate dynamic GST rates if subtotal is available
  const subtotal = bill?.subtotal || 0;
  const totalQty = bill?.items.reduce((sum, item) => sum + item.qty, 0) || 0;
  
  const groupedGst: Record<number, number> = {};
  bill?.items.forEach((item) => {
    const { gstRate } = parseItemNameAndHsn(item.name);
    const itemSubtotal = item.amount || (item.qty * item.price);
    const itemGstVal = bill.gstEnabled ? (itemSubtotal * (gstRate / 100)) : 0;
    if (itemGstVal > 0) {
      groupedGst[gstRate] = (groupedGst[gstRate] || 0) + itemGstVal;
    }
  });

  const totalGst = Object.values(groupedGst).reduce((sum, val) => sum + val, 0);

  const getCompanyInitials = (name: string): string => {
    if (!name) return 'DR';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .substring(0, 3)
      .toUpperCase();
  };

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

  const initials = getCompanyInitials(companySettings.name || 'KM');

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
    if (printerSettings.paperSize === 'A4') {
      try {
        await printA4Invoice(bill!, companySettings);
      } catch (error) {
        Alert.alert('Printing Error', 'Could not open print sheet.');
      }
      return;
    }

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
          ['Total GST:', totalGst.toFixed(2)],
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
  const getPaperWidthStyle = (): any => {
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
          {isA4 ? (
            <View style={styles.a4MainContainer}>
              {/* Centered Document Title */}
              <Text style={styles.a4PageTitle}>Tax Invoice</Text>

              {/* Boxed Border Wrapper */}
              <View style={styles.a4BoxedContainer}>
                {/* Watermark Overlay */}
                <View style={styles.a4WatermarkContainer} pointerEvents="none">
                  <Text style={styles.a4WatermarkText}>DR AGENCIES</Text>
                </View>

                {/* Header Table */}
                <View style={styles.a4HeaderContainer}>
                  {/* Left Column: Seller Details */}
                  <View style={styles.a4SellerCol}>
                    <View style={styles.a4LogoAndNameRow}>
                      <View style={styles.a4LogoCircle}>
                        <Text style={styles.a4LogoText}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.a4SellerName}>{companySettings.name}</Text>
                        <Text style={styles.a4SellerDetailText}>{companySettings.address}</Text>
                        <Text style={styles.a4SellerDetailText}>Email: {companySettings.email || 'krishnamarketingagency6@gmail.com'}</Text>
                        <Text style={[styles.a4SellerDetailText, { fontWeight: '700' }]}>GSTIN: {companySettings.gstin}</Text>
                        <Text style={styles.a4SellerDetailText}>State: 33-Tamil Nadu</Text>
                      </View>
                    </View>
                  </View>

                  {/* Right Column: Meta Info */}
                  <View style={styles.a4MetaCol}>
                    <View style={styles.a4MetaTopRow}>
                      <View style={styles.a4InvoiceNoBox}>
                        <Text style={styles.a4MetaHeader}>Invoice No.</Text>
                        <Text style={styles.a4MetaText}>{bill.invoiceNumber || bill.id}</Text>
                      </View>
                      <View style={styles.a4DateBox}>
                        <Text style={styles.a4MetaHeader}>Date</Text>
                        <Text style={styles.a4MetaText}>{formatDateForDisplay(bill.date)}</Text>
                      </View>
                    </View>
                    <View style={styles.a4PlaceOfSupplyBox}>
                      <Text style={styles.a4MetaHeader}>Place of supply</Text>
                      <Text style={styles.a4MetaText}>33-Tamil Nadu</Text>
                    </View>
                  </View>
                </View>

                {/* Bill To Section */}
                <View style={styles.a4BillToBox}>
                  <Text style={styles.a4BillToHeader}>Bill To</Text>
                  <Text style={styles.a4BillToName}>{customer.name}</Text>
                  <Text style={styles.a4BillToText}>{cleanAddress || 'PALAGANATHAM'}</Text>
                  <Text style={styles.a4BillToText}>Contact No.: {phone}</Text>
                  <Text style={styles.a4BillToText}>GSTIN : {customer.gstin || '33KSBPS0649G1ZL'}</Text>
                  <Text style={styles.a4BillToText}>State: {customer.state || '33-Tamil Nadu'}</Text>
                </View>

                {/* Items Grid Header */}
                <View style={styles.a4GridHeader}>
                  <Text style={[styles.a4GridTh, { width: '5%', textAlign: 'center' }]}>#</Text>
                  <Text style={[styles.a4GridTh, { width: '35%', textAlign: 'left' }]}>Item name</Text>
                  <Text style={[styles.a4GridTh, { width: '12%', textAlign: 'center' }]}>HSN/ SAC</Text>
                  <Text style={[styles.a4GridTh, { width: '10%', textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.a4GridTh, { width: '13%', textAlign: 'right' }]}>Price</Text>
                  <Text style={[styles.a4GridTh, { width: '13%', textAlign: 'right' }]}>GST</Text>
                  <Text style={[styles.a4GridTh, { width: '12%', textAlign: 'right' }]}>Amount</Text>
                </View>

                {/* Items Grid Rows */}
                {bill.items.map((item, index) => {
                  const { name, hsn, gstRate } = parseItemNameAndHsn(item.name);
                  
                  // Calculate dynamic per-item GST and total amount
                  const itemSubtotal = item.amount || (item.qty * item.price);
                  const itemGstVal = bill.gstEnabled ? (itemSubtotal * (gstRate / 100)) : 0;
                  const itemTotalAmt = itemSubtotal + itemGstVal;
                  
                  const gstText = bill.gstEnabled 
                    ? `₹${itemGstVal.toFixed(1)} (${gstRate}%)` 
                    : '₹0.0 (0%)';

                  return (
                    <View key={item.id || index} style={styles.a4GridRow}>
                      <View style={[styles.a4GridTd, { width: '5%', alignItems: 'center' }]}>
                        <Text style={styles.a4TdText}>{index + 1}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '35%', alignItems: 'flex-start' }]}>
                        <Text style={[styles.a4TdText, { fontWeight: '600' }]} numberOfLines={2}>{name}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '12%', alignItems: 'center' }]}>
                        <Text style={styles.a4TdText}>{hsn || '21039040'}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '10%', alignItems: 'center' }]}>
                        <Text style={styles.a4TdText}>{item.qty}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '13%', alignItems: 'flex-end' }]}>
                        <Text style={styles.a4TdText}>₹{item.price.toFixed(2)}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '13%', alignItems: 'flex-end' }]}>
                        <Text style={styles.a4TdText} numberOfLines={1}>{gstText}</Text>
                      </View>
                      <View style={[styles.a4GridTd, { width: '12%', alignItems: 'flex-end', borderRightWidth: 0 }]}>
                        <Text style={styles.a4TdText}>₹{itemSubtotal.toFixed(2)}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Items Grid Spacer (simulates extended lines if few items) */}
                <View style={[styles.a4GridSpacer, { height: Math.max(40, 160 - (bill.items.length * 35)) }]}>
                  <View style={{ width: '5%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '35%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '12%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '10%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '13%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '13%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '12%' }} />
                </View>

                {/* Items Grid Total Row */}
                <View style={styles.a4GridTotalRow}>
                  <View style={{ width: '52%', paddingHorizontal: 4, justifyContent: 'center' }}>
                    <Text style={styles.a4TotalRowTextBold}>Total</Text>
                  </View>
                  <View style={{ width: '10%', borderRightWidth: 1, borderColor: '#000000', paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.a4TotalRowTextBold}>{totalQty}</Text>
                  </View>
                  <View style={{ width: '13%', borderRightWidth: 1, borderColor: '#000000' }} />
                  <View style={{ width: '13%', borderRightWidth: 1, borderColor: '#000000', paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.a4TotalRowTextBold} numberOfLines={1}>₹{totalGst.toFixed(2)}</Text>
                  </View>
                  <View style={{ width: '12%', paddingHorizontal: 4, alignItems: 'flex-end', justifyContent: 'center' }}>
                    <Text style={styles.a4TotalRowTextBold} numberOfLines={1}>₹{subtotal.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Summary Calculations Block */}
                <View style={styles.a4SummaryBlock}>
                  <View style={styles.a4WordsBox}>
                    <Text style={styles.a4WordsLabel}>Invoice Amount in Words</Text>
                    <Text style={styles.a4WordsText}>{numberToWords(bill.total)}</Text>
                  </View>
                  <View style={styles.a4AmountsBox}>
                    <View style={styles.a4AmountRow}>
                      <Text style={styles.a4AmountLabel}>Sub Total:</Text>
                      <Text style={styles.a4AmountValue}>₹{subtotal.toFixed(2)}</Text>
                    </View>
                    {bill.gstEnabled && Object.entries(groupedGst).map(([rate, amt]) => (
                      <View key={rate} style={styles.a4AmountRow}>
                        <Text style={styles.a4AmountLabel}>GST ({rate}%):</Text>
                        <Text style={styles.a4AmountValue}>₹{amt.toFixed(2)}</Text>
                      </View>
                    ))}
                    <View style={styles.a4AmountRowDivider} />
                    <View style={styles.a4AmountRow}>
                      <Text style={[styles.a4AmountLabel, { fontWeight: '700' }]}>Total:</Text>
                      <Text style={[styles.a4AmountValue, { fontWeight: '700' }]}>₹{bill.total.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>

                {/* Footer Section */}
                <View style={styles.a4FooterSection}>
                  {/* Bank Details */}
                  <View style={styles.a4FooterBankBox}>
                    <Text style={styles.a4FooterBoxTitle}>Bank Details</Text>
                    <Text style={styles.a4BankDetailText}>Name: <Text style={{ fontWeight: '600', fontSize: 8 }}>{companySettings.bankName || 'CANARA BANK, GOMATHIPURAM,MADURAI'}</Text></Text>
                    <Text style={styles.a4BankDetailText}>Account No: <Text style={{ fontWeight: '600', fontSize: 8 }}>{companySettings.accountNo || '120000798208'}</Text></Text>
                    <Text style={styles.a4BankDetailText}>IFSC code: <Text style={{ fontWeight: '600', fontSize: 8 }}>{companySettings.ifsc || 'CNRBL0003420'}</Text></Text>
                    <Text style={styles.a4BankDetailText}>Account holder: <Text style={{ fontWeight: '600', fontSize: 8 }}>{companySettings.accountName || companySettings.name}</Text></Text>
                  </View>

                  {/* Terms */}
                  <View style={styles.a4FooterTermsBox}>
                    <Text style={styles.a4FooterBoxTitle}>Terms and conditions</Text>
                    <Text style={styles.a4TermsText}>Thanks for doing business with us!</Text>
                  </View>

                  {/* Signatory */}
                  <View style={styles.a4FooterSignatoryBox}>
                    <Text style={styles.a4SignatoryCompanyText}>For: {companySettings.name}</Text>
                    <Text style={styles.a4SignatoryTitleText}>Authorized Signatory</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ width: '100%' }}>
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
              <Text style={styles.receiptMetaText}>Billed To: {parseCustomerInfo(bill.customerName).name}</Text>
              
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

              {bill.gstEnabled && Object.entries(groupedGst).map(([rate, amt]) => (
                <View key={rate} style={styles.receiptCalcRow}>
                  <Text style={styles.receiptText}>GST ({rate}%):</Text>
                  <Text style={styles.receiptText}>{amt.toFixed(2)}</Text>
                </View>
              ))}

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
          )}
        </View>

        {/* Action Controls */}
        <View style={styles.actionsContainer}>
          <GoldButton
            title={printerSettings.paperSize === 'A4' ? "Print Invoice (A4 Laser/WiFi)" : "Bluetooth Print (Thermal)"}
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
  a4MainContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
  },
  a4PageTitle: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  a4BoxedContainer: {
    borderWidth: 1,
    borderColor: '#000000',
    width: '100%',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    overflow: 'hidden',
  },
  a4WatermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  a4WatermarkText: {
    fontSize: 42,
    fontWeight: '900',
    color: 'rgba(0, 0, 0, 0.04)',
    transform: [{ rotate: '-30deg' }],
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  a4HeaderContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  a4SellerCol: {
    flex: 1.1,
    borderRightWidth: 1,
    borderColor: '#000000',
    padding: 8,
  },
  a4LogoAndNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  a4SellerName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  a4SellerDetailText: {
    fontSize: 8.5,
    color: '#000000',
    lineHeight: 11,
  },
  a4MetaCol: {
    flex: 0.9,
  },
  a4MetaTopRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    flex: 1,
  },
  a4InvoiceNoBox: {
    flex: 1,
    borderRightWidth: 1,
    borderColor: '#000000',
    padding: 6,
  },
  a4DateBox: {
    flex: 1,
    padding: 6,
  },
  a4MetaHeader: {
    fontSize: 8.5,
    color: '#555555',
    fontWeight: '700',
  },
  a4MetaText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    marginTop: 2,
  },
  a4PlaceOfSupplyBox: {
    flex: 1,
    padding: 6,
  },
  a4BillToBox: {
    padding: 8,
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  a4BillToHeader: {
    fontSize: 9,
    fontWeight: '700',
    color: '#555555',
    marginBottom: 2,
  },
  a4BillToName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  a4BillToText: {
    fontSize: 9,
    color: '#000000',
    lineHeight: 12,
  },
  a4GridHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    backgroundColor: '#fbfbfb',
    paddingVertical: 4,
  },
  a4GridTh: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000000',
    paddingHorizontal: 2,
  },
  a4GridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingVertical: 5,
  },
  a4GridTd: {
    borderRightWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  a4TdText: {
    fontSize: 8.5,
    color: '#000000',
  },
  a4GridSpacer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  a4GridTotalRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
    paddingVertical: 5,
  },
  a4TotalRowTextBold: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#000000',
  },
  a4SummaryBlock: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000000',
  },
  a4WordsBox: {
    flex: 1.2,
    borderRightWidth: 1,
    borderColor: '#000000',
    padding: 8,
  },
  a4WordsLabel: {
    fontSize: 8.5,
    color: '#555555',
    fontWeight: '700',
  },
  a4WordsText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#000000',
    marginTop: 2,
  },
  a4AmountsBox: {
    flex: 0.8,
    padding: 6,
  },
  a4AmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  a4AmountRowDivider: {
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 0.5,
    borderColor: '#000000',
    marginVertical: 3,
  },
  a4AmountLabel: {
    fontSize: 9.5,
    color: '#000000',
  },
  a4AmountValue: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#000000',
  },
  a4FooterSection: {
    flexDirection: 'row',
  },
  a4FooterBankBox: {
    flex: 1.2,
    borderRightWidth: 1,
    borderColor: '#000000',
    padding: 8,
  },
  a4FooterBoxTitle: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#555555',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  a4BankDetailText: {
    fontSize: 8,
    color: '#000000',
    lineHeight: 11,
  },
  a4FooterTermsBox: {
    flex: 0.9,
    borderRightWidth: 1,
    borderColor: '#000000',
    padding: 8,
  },
  a4TermsText: {
    fontSize: 8,
    color: '#444444',
  },
  a4FooterSignatoryBox: {
    flex: 0.9,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 80,
  },
  a4SignatoryCompanyText: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  a4SignatoryTitleText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  a4LogoCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: '#007aff',
    backgroundColor: '#fcfcfc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  a4LogoText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#007aff',
  },
});
