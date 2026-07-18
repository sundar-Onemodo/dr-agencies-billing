import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling, BillItem, Product } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';
import { PrinterSimulationModal } from '@/components/ui/PrinterSimulationModal';
import { serializeCustomerInfo } from '@/utils/customer';
import { printA4Invoice } from '@/utils/printA4';

export default function CreateBillScreen() {
  const router = useRouter();
  const { products, addBill, generateNextInvoiceNumber, printerSettings, companySettings } = useBilling();

  // Printer modal visibility state
  const [printerModalVisible, setPrinterModalVisible] = useState(false);

  // Active Bill States
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerState, setCustomerState] = useState('Tamil Nadu');
  const [billingDate, setBillingDate] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  
  // Item Entry States
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  
  // GST Toggle State
  const [gstEnabled, setGstEnabled] = useState(true);
  
  // Payment Status State
  const [paymentStatus, setPaymentStatus] = useState<'Paid' | 'Pending'>('Pending');
  const [paymentMode, setPaymentMode] = useState<'Cash' | 'GPay' | 'PhonePe' | 'Paytm'>('Cash');

  // Load Initial Info
  useEffect(() => {
    setInvoiceNo(generateNextInvoiceNumber());
    // Default today's date
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    setBillingDate(`${dd}-${mm}-${yyyy}`);
  }, [generateNextInvoiceNumber]);

  // Handle Product Search
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setSearchQuery(product.name);
    setPrice(product.price.toString());
    setShowProductDropdown(false);
  };

  const handleAddItem = () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter or select a product name');
      return;
    }
    const q = parseInt(qty, 10);
    const p = parseFloat(price);

    if (isNaN(q) || q <= 0) {
      Alert.alert('Error', 'Please enter a valid quantity greater than 0');
      return;
    }
    if (isNaN(p) || p < 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    if (selectedProduct) {
      const existingQty = items
        .filter((item) => item.productId === selectedProduct.id)
        .reduce((sum, item) => sum + item.qty, 0);

      if (existingQty + q > selectedProduct.stockQty) {
        Alert.alert(
          'Insufficient Stock',
          `Cannot add item. Only ${selectedProduct.stockQty} items are available in stock. You have already added ${existingQty} items to this bill.`
        );
        return;
      }
    }

    const amount = q * p;
    const newItem: BillItem = {
      id: Date.now().toString(),
      productId: selectedProduct?.id,
      name: searchQuery,
      qty: q,
      price: p,
      amount,
    };

    setItems((prev) => [...prev, newItem]);
    
    // Reset item entry form
    setSelectedProduct(null);
    setSearchQuery('');
    setQty('1');
    setPrice('');
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const cgstRate = 0.09; // 9%
  const sgstRate = 0.09; // 9%
  
  const cgst = gstEnabled ? subtotal * cgstRate : 0;
  const sgst = gstEnabled ? subtotal * sgstRate : 0;
  const total = subtotal + cgst + sgst;

  // Format currency helper
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  // Save Bill
  const handleSaveBill = async () => {
    if (!customerName.trim()) {
      Alert.alert('Validation Error', 'Please enter Customer Name');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item to the invoice');
      return;
    }

    const finalBill = {
      invoiceNumber: invoiceNo,
      customerName: serializeCustomerInfo({
        name: customerName,
        address: customerAddress,
        gstin: customerGstin,
        state: customerState,
      }),
      date: billingDate,
      items,
      subtotal,
      gstEnabled,
      cgst,
      sgst,
      total,
      paymentStatus,
      paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
    };

    try {
      setSaving(true);
      const newInvoiceNo = await addBill(finalBill);
      Alert.alert('Success', `Invoice ${newInvoiceNo} saved successfully!`, [
        {
          text: 'OK',
          onPress: () => {
            // Reset Create Bill Screen
            setCustomerName('');
            setCustomerAddress('');
            setCustomerGstin('');
            setCustomerState('Tamil Nadu');
            setItems([]);
            setPaymentStatus('Pending');
            setPaymentMode('Cash');
            setInvoiceNo(generateNextInvoiceNumber());
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Billing Error', err.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  // Preview Bill
  const handlePreview = () => {
    if (!customerName.trim()) {
      Alert.alert('Validation Error', 'Please enter Customer Name to preview receipt');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one item to preview receipt');
      return;
    }

    // Build temporary draft details to display in preview screen
    const draftBill = {
      id: invoiceNo,
      customerName: serializeCustomerInfo({
        name: customerName,
        address: customerAddress,
        gstin: customerGstin,
        state: customerState,
      }),
      date: billingDate,
      items,
      subtotal,
      gstEnabled,
      cgst,
      sgst,
      total,
      paymentStatus,
      paymentMode: paymentStatus === 'Paid' ? paymentMode : undefined,
    };

    router.push({
      pathname: '/preview',
      params: { 
        billData: JSON.stringify(draftBill),
        isDraft: 'true'
      },
    });
  };

  // Print Bill
  const handlePrint = async () => {
    if (items.length === 0) {
      Alert.alert('Validation Error', 'Cannot print an empty invoice');
      return;
    }

    if (printerSettings.paperSize === 'A4') {
      try {
        await printA4Invoice({
          id: invoiceNo,
          invoiceNumber: invoiceNo,
          customerName: serializeCustomerInfo({
            name: customerName,
            address: customerAddress,
            gstin: customerGstin,
            state: customerState,
          }),
          date: billingDate,
          items,
          subtotal,
          gstEnabled,
          cgst,
          sgst,
          total,
        }, companySettings);
      } catch (error) {
        Alert.alert('Printing Error', 'Could not open print sheet.');
      }
      return;
    }
    
    const printerName = printerSettings.connectedPrinter;
    const printerAddress = printerSettings.connectedPrinterAddress;
    if (!printerName) {
      Alert.alert(
        'Printer Disconnected',
        'No active printer found. Would you like to connect a thermal printer now?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Connect Printer', onPress: () => setPrinterModalVisible(true) }
        ]
      );
      return;
    }

    if (!BluetoothEscposPrinter || !printerAddress || printerAddress.startsWith('pr-')) {
      Alert.alert(
        'Thermal Printer Active (Simulated)',
        `Sending invoice ${invoiceNo} to connected thermal printer "${printerName}" (${printerSettings.paperSize} width)...`,
        [{ text: 'Dismiss' }]
      );
      return;
    }

    try {
      // Real print logic
      await BluetoothEscposPrinter.printerInit();
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      
      const is58 = printerSettings.paperSize === '58mm';
      const colWidths = is58 ? [16, 6, 10] : [24, 8, 16];
      
      // Print Header
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printText(`${companySettings.name}\n`, {
        encoding: 'GBK',
        codepage: 0,
        widthtimes: 1,
        heigthtimes: 1,
        fonttype: 1
      });
      await BluetoothEscposPrinter.setBlob(0);
      
      await BluetoothEscposPrinter.printText(`${companySettings.address}\n`, {});
      await BluetoothEscposPrinter.printText(`Phone: ${companySettings.phone}\n`, {});
      await BluetoothEscposPrinter.printText(`GSTIN: ${companySettings.gstin}\n`, {});
      
      const divider = is58 ? '-'.repeat(32) + '\n' : '-'.repeat(48) + '\n';
      await BluetoothEscposPrinter.printText(divider, {});
      
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printText("TAX INVOICE\n", {});
      await BluetoothEscposPrinter.setBlob(0);
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // Print Meta Info
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.LEFT);
      await BluetoothEscposPrinter.printText(`Invoice No: ${invoiceNo}\n`, {});
      await BluetoothEscposPrinter.printText(`Date: ${billingDate}\n`, {});
      await BluetoothEscposPrinter.printText(`Billed To: ${customerName}\n`, {});
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // Print Table Headers
      await BluetoothEscposPrinter.printColumn(
        colWidths,
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.CENTER, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Item / Qty', 'Price', 'Amount'],
        {}
      );
      await BluetoothEscposPrinter.printText(divider, {});
      
      // Print Items
      for (const item of items) {
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
      
      // Calculations
      await BluetoothEscposPrinter.printColumn(
        is58 ? [16, 16] : [24, 24],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['Subtotal:', subtotal.toFixed(2)],
        {}
      );
      
      if (gstEnabled) {
        await BluetoothEscposPrinter.printColumn(
          is58 ? [16, 16] : [24, 24],
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
          ['CGST (9.0%):', cgst.toFixed(2)],
          {}
        );
        await BluetoothEscposPrinter.printColumn(
          is58 ? [16, 16] : [24, 24],
          [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
          ['SGST (9.0%):', sgst.toFixed(2)],
          {}
        );
      }
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printColumn(
        is58 ? [16, 16] : [24, 24],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['GRAND TOTAL:', formatCurrency(total)],
        {}
      );
      await BluetoothEscposPrinter.setBlob(0);
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // Bank details
      await BluetoothEscposPrinter.printText("BANK PAYMENT DETAILS\n", {});
      await BluetoothEscposPrinter.printText(`Bank: ${companySettings.bankName}\n`, {});
      await BluetoothEscposPrinter.printText(`Name: ${companySettings.accountName}\n`, {});
      await BluetoothEscposPrinter.printText(`A/C: ${companySettings.accountNo}\n`, {});
      await BluetoothEscposPrinter.printText(`IFSC: ${companySettings.ifsc}\n`, {});
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      // Footer signatures
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.RIGHT);
      await BluetoothEscposPrinter.printText(`For ${companySettings.name}\n\n\n`, {});
      await BluetoothEscposPrinter.printText("Authorized Signatory\n", {});
      
      await BluetoothEscposPrinter.printerAlign(BluetoothEscposPrinter.ALIGN.CENTER);
      await BluetoothEscposPrinter.printText("* Thanks for doing business! *\n", {});
      await BluetoothEscposPrinter.printText("Goods once sold will not be returned.\n\n\n\n", {});
      
      Alert.alert('Print Success', 'Invoice printed successfully!');
    } catch (error) {
      console.warn('Real print failed:', error);
      Alert.alert('Printing Error', 'Could not print to device. Please ensure it is powered on and connected.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Metadata */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>New Bill</Text>
              <Text style={styles.invoiceNoText}>{invoiceNo}</Text>
            </View>
            <View style={styles.dateContainer}>
              <Text style={styles.dateLabel}>Date</Text>
              <TextInput
                value={billingDate}
                onChangeText={setBillingDate}
                style={styles.dateInput}
                placeholder="DD-MM-YYYY"
                placeholderTextColor="#606070"
              />
            </View>
          </View>

          {/* Customer Input */}
          <GlassCard style={styles.inputCard}>
            <InputField
              label="Customer Name"
              placeholder="Enter customer / business name"
              value={customerName}
              onChangeText={setCustomerName}
              iconName="person"
            />
            <InputField
              label="Customer Address"
              placeholder="Enter customer address"
              value={customerAddress}
              onChangeText={setCustomerAddress}
              iconName="location-outline"
              multiline
            />
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <InputField
                  label="Customer GSTIN"
                  placeholder="e.g. 33AYUPA8362M1ZV"
                  value={customerGstin}
                  onChangeText={setCustomerGstin}
                  autoCapitalize="characters"
                  iconName="shield-checkmark-outline"
                />
              </View>
              <View style={{ flex: 1 }}>
                <InputField
                  label="Customer State"
                  placeholder="e.g. Tamil Nadu"
                  value={customerState}
                  onChangeText={setCustomerState}
                  iconName="map-outline"
                />
              </View>
            </View>
          </GlassCard>

          {/* Item Entry Section */}
          <GlassCard style={styles.entryCard} goldBorder={true}>
            <Text style={styles.cardSectionTitle}>Add Item Entry</Text>
            
            {/* Product Selector */}
            <View style={styles.productInputContainer}>
              <InputField
                label="Product / Item Name"
                placeholder="Search or enter product name"
                value={searchQuery}
                onChangeText={(text) => {
                  setSearchQuery(text);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                iconName="search-outline"
                containerStyle={{ marginVertical: 0 }}
              />
              {/* Product Autocomplete Dropdown */}
              {showProductDropdown && searchQuery.trim().length > 0 && (
                <View style={styles.dropdownList}>
                  {filteredProducts.length === 0 ? (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => setShowProductDropdown(false)}
                    >
                      <Text style={styles.dropdownItemText}>Use custom item &quot;{searchQuery}&quot;</Text>
                    </TouchableOpacity>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLowStock = p.stockQty > 0 && p.stockQty < 10;
                      const isOutOfStock = p.stockQty <= 0;

                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={styles.dropdownItem}
                          onPress={() => handleSelectProduct(p)}
                          disabled={isOutOfStock}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownItemText, isOutOfStock && { opacity: 0.5 }]}>
                              {p.name}
                            </Text>
                            {isOutOfStock ? (
                              <Text style={styles.dropdownItemOutOfStock}>Out of Stock</Text>
                            ) : isLowStock ? (
                              <Text style={styles.dropdownItemLowStock}>Only {p.stockQty} left</Text>
                            ) : (
                              <Text style={styles.dropdownItemStock}>Stock: {p.stockQty}</Text>
                            )}
                          </View>
                          <Text style={[styles.dropdownItemPrice, isOutOfStock && { opacity: 0.5 }]}>
                            {formatCurrency(p.price)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              )}
            </View>

            {/* Qty & Price Row */}
            <View style={styles.inputRow}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <InputField
                  label="Quantity"
                  placeholder="1"
                  value={qty}
                  onChangeText={setQty}
                  keyboardType="numeric"
                  iconName="calculator-outline"
                />
              </View>
              <View style={{ flex: 1.5 }}>
                <InputField
                  label="Price (₹)"
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  iconName="cash-outline"
                />
              </View>
            </View>

            {/* Add Button */}
            <GoldButton
              title="Add Item"
              variant="outlined"
              onPress={handleAddItem}
              style={styles.addItemBtn}
            />
          </GlassCard>

          {/* Items Table Card */}
          {items.length > 0 && (
            <GlassCard style={styles.tableCard}>
              <Text style={styles.cardSectionTitle}>Items List</Text>
              
              {/* Table Headers */}
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, styles.colItem]}>Item Name</Text>
                <Text style={[styles.th, styles.colQty]}>Qty</Text>
                <Text style={[styles.th, styles.colPrice]}>Price</Text>
                <Text style={[styles.th, styles.colAmt]}>Total</Text>
                <Text style={[styles.th, styles.colAction]}></Text>
              </View>

              {/* Table Rows */}
              {items.map((item) => (
                <View key={item.id} style={styles.tableDataRow}>
                  <Text style={[styles.td, styles.colItem]} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <Text style={[styles.td, styles.colQty]}>{item.qty}</Text>
                  <Text style={[styles.td, styles.colPrice]}>{item.price}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{formatCurrency(item.amount)}</Text>
                  <TouchableOpacity
                    style={[styles.colAction, styles.deleteBtn]}
                    onPress={() => handleDeleteItem(item.id)}
                  >
                    <Ionicons name="trash-outline" size={16} color="#FF4B4B" />
                  </TouchableOpacity>
                </View>
              ))}
            </GlassCard>
          )}

          {/* Calculations Summary Card */}
          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatCurrency(subtotal)}</Text>
            </View>

            {/* GST Config Toggle */}
            <View style={styles.gstToggleRow}>
              <View>
                <Text style={styles.gstToggleTitle}>GST (CGST + SGST @ 18%)</Text>
                <Text style={styles.gstToggleDesc}>Toggle ON to apply tax calculations</Text>
              </View>
              <Switch
                value={gstEnabled}
                onValueChange={setGstEnabled}
                trackColor={{ false: '#303038', true: '#D4AF37' }}
                thumbColor={gstEnabled ? '#FFFFFF' : '#A0A0B0'}
              />
            </View>

            {/* Payment Status Toggle */}
            <View style={styles.gstToggleRow}>
              <View>
                <Text style={styles.gstToggleTitle}>Payment Status (Paid / Pending)</Text>
                <Text style={styles.gstToggleDesc}>Toggle ON if customer paid at billing time</Text>
              </View>
              <Switch
                value={paymentStatus === 'Paid'}
                onValueChange={(val) => setPaymentStatus(val ? 'Paid' : 'Pending')}
                trackColor={{ false: '#303038', true: '#34C759' }}
                thumbColor={paymentStatus === 'Paid' ? '#FFFFFF' : '#A0A0B0'}
              />
            </View>

            {/* Payment Mode Selector */}
            {paymentStatus === 'Paid' && (
              <View style={styles.paymentModeSection}>
                <Text style={styles.paymentModeLabel}>Payment Mode</Text>
                <View style={styles.paymentModeContainer}>
                  {(['Cash', 'GPay', 'PhonePe', 'Paytm'] as const).map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={[
                        styles.paymentModeBtn,
                        paymentMode === mode && styles.paymentModeBtnActive
                      ]}
                      onPress={() => setPaymentMode(mode)}
                    >
                      <Text
                        style={[
                          styles.paymentModeBtnText,
                          paymentMode === mode && styles.paymentModeBtnTextActive
                        ]}
                      >
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {gstEnabled && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.taxLabel}>CGST (9%)</Text>
                  <Text style={styles.taxValue}>{formatCurrency(cgst)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.taxLabel}>SGST (9%)</Text>
                  <Text style={styles.taxValue}>{formatCurrency(sgst)}</Text>
                </View>
              </>
            )}

            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Grand Total</Text>
              <Text style={styles.totalValue}>{formatCurrency(total)}</Text>
            </View>
          </GlassCard>
        </ScrollView>

        {/* Sticky Action Footer Buttons */}
        <View style={styles.stickyFooter}>
          <TouchableOpacity style={[styles.footerBtn, styles.btnSecondary]} onPress={handlePreview}>
            <Ionicons name="eye-outline" size={20} color="#D4AF37" />
            <Text style={styles.btnSecondaryText}>Preview</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.footerBtn, styles.btnPrimary, saving && { opacity: 0.6 }]} 
            onPress={handleSaveBill}
            disabled={saving}
          >
            {saving ? (
              <Text style={styles.btnPrimaryText}>Saving...</Text>
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#191820" />
                <Text style={styles.btnPrimaryText}>Save Bill</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={[styles.footerBtn, styles.btnSecondary]} onPress={handlePrint}>
            <Ionicons name="print-outline" size={20} color="#D4AF37" />
            <Text style={styles.btnSecondaryText}>Print</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <PrinterSimulationModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
  },
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 100, // Cushion space for the sticky footer
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  invoiceNoText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  dateContainer: {
    backgroundColor: '#24242a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
  },
  dateLabel: {
    color: '#A0A0B0',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateInput: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    width: 90,
    padding: 0,
  },
  inputCard: {
    padding: 12,
    marginBottom: 12,
  },
  entryCard: {
    padding: 16,
    marginBottom: 12,
  },
  cardSectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  productInputContainer: {
    position: 'relative',
    zIndex: 10,
    marginBottom: 8,
  },
  dropdownList: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: '#24242a',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRadius: 12,
    zIndex: 100,
    maxHeight: 180,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownItemText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dropdownItemPrice: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  dropdownItemStock: {
    color: '#6e6e7c',
    fontSize: 11,
    marginTop: 2,
  },
  dropdownItemLowStock: {
    color: '#FFC84B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  dropdownItemOutOfStock: {
    color: '#FF4B4B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addItemBtn: {
    marginTop: 8,
    height: 44,
  },
  tableCard: {
    padding: 14,
    marginBottom: 12,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    paddingBottom: 8,
    marginBottom: 8,
  },
  th: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  td: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  colItem: {
    flex: 2,
    paddingRight: 6,
  },
  colQty: {
    flex: 0.6,
    textAlign: 'center',
  },
  colPrice: {
    flex: 1,
    textAlign: 'right',
  },
  colAmt: {
    flex: 1.2,
    textAlign: 'right',
  },
  colAction: {
    width: 30,
    alignItems: 'flex-end',
  },
  deleteBtn: {
    paddingVertical: 4,
  },
  summaryCard: {
    padding: 16,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  summaryLabel: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  gstToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c1c24',
    padding: 12,
    borderRadius: 12,
    marginVertical: 10,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  gstToggleTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  gstToggleDesc: {
    color: '#6e6e7c',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  taxLabel: {
    color: '#6e6e7c',
    fontSize: 13,
    fontWeight: '600',
  },
  taxValue: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
  },
  totalDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 10,
  },
  totalLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  totalValue: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '900',
  },
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1c1c24',
    flexDirection: 'row',
    padding: 12,
    gap: 10,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(212, 175, 55, 0.15)',
    // Shadow
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  footerBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: '#D4AF37',
    flex: 1.5,
  },
  btnPrimaryText: {
    color: '#191820',
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: '#D4AF37',
  },
  btnSecondaryText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
  },
  paymentModeSection: {
    marginVertical: 10,
  },
  paymentModeLabel: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  paymentModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#1c1c24',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  paymentModeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  paymentModeBtnActive: {
    backgroundColor: '#D4AF37',
  },
  paymentModeBtnText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
  },
  paymentModeBtnTextActive: {
    color: '#191820',
  },
});
