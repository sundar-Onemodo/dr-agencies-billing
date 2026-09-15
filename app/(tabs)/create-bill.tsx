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
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling, BillItem, Product } from '@/context/BillingContext';
import { useAlert } from '@/context/AlertContext';
import { Customer } from '@/store/slices/customerSlice';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { BluetoothEscposPrinter } from 'react-native-bluetooth-escpos-printer';
import { PrinterSimulationModal } from '@/components/ui/PrinterSimulationModal';
import { serializeCustomerInfo, parseCustomerInfo } from '@/utils/customer';
import { printA4Invoice, downloadA4InvoicePdf } from '@/utils/printA4';

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

export default function CreateBillScreen() {
  const router = useRouter();
  const { editBillId } = useLocalSearchParams<{ editBillId?: string }>();
  const {
    products,
    bills,
    addBill,
    updateBill,
    generateNextInvoiceNumber,
    printerSettings,
    companySettings,
    customers,
    addCustomer,
    refreshData,
  } = useBilling();
  const { showSuccess, showWarning, showError, showConfirm, showAlert } = useAlert();

  // Printer modal visibility state
  const [printerModalVisible, setPrinterModalVisible] = useState(false);

  // Edit Bill State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);

  // Edit Single Item Modal State
  const [editingItemModalVisible, setEditingItemModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<BillItem | null>(null);
  const [editItemQty, setEditItemQty] = useState('');
  const [editItemPrice, setEditItemPrice] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemGstRate, setEditItemGstRate] = useState(18);

  // Active Bill States
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerState, setCustomerState] = useState('Tamil Nadu');
  const [billingDate, setBillingDate] = useState('');
  const [items, setItems] = useState<BillItem[]>([]);
  const [originalBillItems, setOriginalBillItems] = useState<BillItem[]>([]);

  // Customer Autocomplete & Quick Add States
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [addingCustomerToDir, setAddingCustomerToDir] = useState(false);
  
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

  // Post Save Actions Modal States
  const [showPostSaveModal, setShowPostSaveModal] = useState(false);
  const [savedBillForActions, setSavedBillForActions] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load / Pre-fill Bill Info or Initialize New Bill
  useEffect(() => {
    if (editBillId) {
      setEditingBillId(editBillId);
      const existing = bills.find((b) => b.id === editBillId);
      if (existing) {
        setInvoiceNo(existing.invoiceNumber || existing.id);
        const customerInfo = parseCustomerInfo(existing.customerName);
        setCustomerName(customerInfo.name);
        setCustomerAddress(customerInfo.address || '');
        setCustomerPhone(customerInfo.phone || '');
        setCustomerGstin(customerInfo.gstin || '');
        setCustomerState(customerInfo.state || 'Tamil Nadu');

        if (existing.date) {
          try {
            const d = existing.date.includes('T') || existing.date.match(/^\d{4}-\d{2}-\d{2}/)
              ? new Date(existing.date)
              : null;
            if (d) {
              const dd = String(d.getDate()).padStart(2, '0');
              const mm = String(d.getMonth() + 1).padStart(2, '0');
              const yyyy = d.getFullYear();
              setBillingDate(`${dd}-${mm}-${yyyy}`);
            } else {
              setBillingDate(existing.date);
            }
          } catch {
            setBillingDate(existing.date);
          }
        }

        // Link product IDs if missing from stored bill items
        const loadedItems = (existing.items || []).map((it) => {
          if (it.productId) return it;
          const cleanName = it.name.replace(/\(.*?\)/g, '').trim().toLowerCase();
          const matchedProd = products.find(
            (p) => p.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === cleanName
          );
          return matchedProd ? { ...it, productId: matchedProd.id } : it;
        });
        setItems(loadedItems);
        setOriginalBillItems(loadedItems);
        setGstEnabled(existing.gstEnabled ?? true);
        setPaymentStatus((existing.paymentStatus as any) || 'Pending');
      }
    } else {
      setEditingBillId(null);
      setOriginalBillItems([]);
      setInvoiceNo(generateNextInvoiceNumber());
      const today = new Date();
      const dd = String(today.getDate()).padStart(2, '0');
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const yyyy = today.getFullYear();
      setBillingDate(`${dd}-${mm}-${yyyy}`);
    }
  }, [editBillId, bills, generateNextInvoiceNumber]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
      if (!editingBillId) {
        setInvoiceNo(generateNextInvoiceNumber());
      }
    } catch (e) {
      console.warn('Quick Bill refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingBillId(null);
    router.setParams({ editBillId: undefined });
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setCustomerGstin('');
    setCustomerState('Tamil Nadu');
    setItems([]);
    setOriginalBillItems([]);
    setPaymentStatus('Pending');
    setPaymentMode('Cash');
    setInvoiceNo(generateNextInvoiceNumber());
  };

  // Filter customers matching customerName input
  const filteredCustomers = customerName.trim().length > 0
    ? customers.filter((c) =>
        c.name.toLowerCase().includes(customerName.toLowerCase()) ||
        (c.phone && c.phone.includes(customerName))
      )
    : [];

  const exactCustomerMatch = customers.find(
    (c) => c.name.trim().toLowerCase() === customerName.trim().toLowerCase()
  );
  const isNewCustomer = customerName.trim().length > 0 && !exactCustomerMatch;

  const handleSelectCustomer = (c: Customer) => {
    setCustomerName(c.name);
    setCustomerAddress(c.address || '');
    setCustomerPhone(c.phone || '');
    setCustomerGstin(c.gstin || '');
    setCustomerState(c.state || 'Tamil Nadu');
    setShowCustomerDropdown(false);
  };

  const handleQuickAddCustomer = async () => {
    const trimmedName = customerName.trim();
    if (!trimmedName) {
      showWarning('Validation Error', 'Please enter customer name.');
      return;
    }

    if (exactCustomerMatch) {
      showWarning('Notice', `Customer "${trimmedName}" is already in your directory.`);
      return;
    }

    if (customerPhone.trim()) {
      const dupPhone = customers.find((c) => c.phone && c.phone.trim() === customerPhone.trim());
      if (dupPhone) {
        showWarning('Duplicate Contact', `Contact number "${customerPhone.trim()}" is already saved for "${dupPhone.name}".`);
        return;
      }
    }

    try {
      setAddingCustomerToDir(true);
      await addCustomer({
        name: trimmedName,
        phone: customerPhone.trim(),
        address: customerAddress.trim(),
        gstin: customerGstin.trim().toUpperCase(),
        state: customerState.trim() || 'Tamil Nadu',
      });
      showSuccess('Customer Saved', `"${trimmedName}" has been added to your Customer Directory!`, undefined, 'person-add');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save customer');
    } finally {
      setAddingCustomerToDir(false);
    }
  };

  // Helper to compute available stock accurately taking original saved bill items into account
  const getProductStockInfo = (productId?: string | null, itemName?: string) => {
    const cleanItemName = (itemName || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
    const matchedProd = products.find(
      (p) =>
        (productId && p.id === productId) ||
        p.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === cleanItemName
    );

    if (!matchedProd) {
      const isAlreadyInBill = items.some(
        (it) => it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === cleanItemName
      );
      const currentBillQty = items
        .filter((it) => it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === cleanItemName)
        .reduce((sum, it) => sum + it.qty, 0);

      return {
        matchedProd: null,
        dbStock: 0,
        originalBillQty: 0,
        currentBillQty,
        remainingStoreStock: 9999,
        maxAllowed: 9999,
        isAlreadyInBill,
      };
    }

    const prodId = matchedProd.id;
    const prodCleanName = matchedProd.name.replace(/\(.*?\)/g, '').trim().toLowerCase();

    // Quantity originally deducted from store stock for this bill in database
    const originalBillQty = editingBillId
      ? originalBillItems
          .filter(
            (it) =>
              (it.productId && it.productId === prodId) ||
              it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === prodCleanName
          )
          .reduce((sum, it) => sum + it.qty, 0)
      : 0;

    // Total quantity currently in active bill items
    const currentBillQty = items
      .filter(
        (it) =>
          (it.productId && it.productId === prodId) ||
          it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === prodCleanName
      )
      .reduce((sum, it) => sum + it.qty, 0);

    const isAlreadyInBill = currentBillQty > 0;

    // Total inventory pool = DB stock + restored original bill quantity
    const totalStockPool = matchedProd.stockQty + originalBillQty;
    // Remaining available stock in store to add or increase
    const remainingStoreStock = Math.max(0, totalStockPool - currentBillQty);
    const maxAllowed = totalStockPool;

    return {
      matchedProd,
      dbStock: matchedProd.stockQty,
      originalBillQty,
      currentBillQty,
      remainingStoreStock,
      maxAllowed,
      isAlreadyInBill,
    };
  };

  // Handle Product Search
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectProduct = (product: Product) => {
    const stockInfo = getProductStockInfo(product.id, product.name);
    if (stockInfo.isAlreadyInBill) {
      showWarning(
        'Item Already in Invoice',
        `"${product.name}" is already in this invoice (${stockInfo.currentBillQty} kg).\n\nPlease edit its quantity directly from the Items List below instead of adding a duplicate row.`
      );
      setShowProductDropdown(false);
      return;
    }

    setSelectedProduct(product);
    const parsed = parseItemNameAndHsn(product.name);
    setSearchQuery(parsed.name);
    setPrice(product.price.toString());
    setShowProductDropdown(false);
  };

  const handleAddItem = () => {
    if (!searchQuery.trim()) {
      showWarning('Select Product', 'Please enter or select a product name.');
      return;
    }
    const q = parseFloat(qty);
    const p = parseFloat(price);

    if (isNaN(q) || q <= 0) {
      showWarning('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    if (isNaN(p) || p < 0) {
      showWarning('Invalid Price', 'Please enter a valid price.');
      return;
    }

    const stockInfo = getProductStockInfo(selectedProduct?.id, searchQuery);
    if (stockInfo.isAlreadyInBill) {
      showWarning(
        'Item Already in Invoice',
        `"${stockInfo.matchedProd ? stockInfo.matchedProd.name : searchQuery}" is already in this invoice (${stockInfo.currentBillQty} kg).\n\nPlease edit its quantity directly from the Items List below instead of adding a duplicate row.`
      );
      return;
    }

    if (stockInfo.matchedProd) {
      if (q > stockInfo.remainingStoreStock) {
        showWarning(
          'Insufficient Stock',
          `Cannot add item. Only ${stockInfo.remainingStoreStock} kg are available in store stock.`
        );
        return;
      }
    }

    const amount = q * p;
    const gstRateVal = selectedProduct ? selectedProduct.gstRate : 18;
    const finalItemName = selectedProduct
      ? `${selectedProduct.name} (GST: ${gstRateVal}%)`
      : searchQuery.includes('GST:') ? searchQuery : `${searchQuery} (GST: 18%)`;

    const newItem: BillItem = {
      id: Date.now().toString(),
      productId: selectedProduct?.id,
      name: finalItemName,
      qty: q,
      price: p,
      amount,
      gstRate: gstRateVal,
    };

    setItems((prev) => [...prev, newItem]);
    
    // Reset item entry form
    setSelectedProduct(null);
    setSearchQuery('');
    setQty('1');
    setPrice('');
  };

  const handleOpenEditItem = (item: BillItem) => {
    setEditingItem(item);
    setEditItemQty(String(item.qty));
    setEditItemPrice(String(item.price));
    setEditItemName(item.name);
    setEditItemGstRate(item.gstRate !== undefined ? item.gstRate : parseGstRateFromName(item.name));
    setEditingItemModalVisible(true);
  };

  const handleAdjustEditQty = (delta: number) => {
    const current = parseFloat(editItemQty) || 0;
    let next = current + delta;
    if (next < 0.5) next = 0.5;

    const stockInfo = getProductStockInfo(editingItem?.productId, editItemName);
    if (stockInfo.matchedProd) {
      const currentItemQty = editingItem?.qty || 0;
      const otherItemsQty = items
        .filter((it) => it.id !== editingItem?.id && (
          (it.productId && it.productId === stockInfo.matchedProd?.id) ||
          it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === editItemName.replace(/\(.*?\)/g, '').trim().toLowerCase()
        ))
        .reduce((sum, it) => sum + it.qty, 0);

      const maxAllowed = stockInfo.maxAllowed - otherItemsQty;

      if (delta > 0 && next > maxAllowed) {
        showWarning(
          'Stock Limit Reached',
          `Cannot increase quantity beyond ${maxAllowed} kg (${currentItemQty} kg in this bill + ${stockInfo.remainingStoreStock} kg remaining in store).`
        );
        return;
      }
    }

    setEditItemQty(String(Number(next.toFixed(2))));
  };

  const handleSaveEditedItem = () => {
    if (!editingItem) return;
    const q = parseFloat(editItemQty);
    const p = parseFloat(editItemPrice);

    if (isNaN(q) || q <= 0) {
      showWarning('Invalid Quantity', 'Please enter a valid quantity greater than 0.');
      return;
    }
    if (isNaN(p) || p < 0) {
      showWarning('Invalid Price', 'Please enter a valid unit price.');
      return;
    }

    const stockInfo = getProductStockInfo(editingItem.productId, editItemName);
    if (stockInfo.matchedProd) {
      const currentItemQty = editingItem.qty || 0;
      const otherItemsQty = items
        .filter((it) => it.id !== editingItem.id && (
          (it.productId && it.productId === stockInfo.matchedProd?.id) ||
          it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === editItemName.replace(/\(.*?\)/g, '').trim().toLowerCase()
        ))
        .reduce((sum, it) => sum + it.qty, 0);

      const maxAllowed = stockInfo.maxAllowed - otherItemsQty;

      if (q > maxAllowed) {
        showWarning(
          'Insufficient Stock',
          `Cannot set quantity to ${q} kg. Maximum allowed is ${maxAllowed} kg (${currentItemQty} kg in this bill + ${stockInfo.remainingStoreStock} kg remaining in store).`
        );
        return;
      }
    }

    const amount = q * p;
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === editingItem.id) {
          return {
            ...it,
            name: editItemName,
            qty: q,
            price: p,
            amount,
            gstRate: editItemGstRate,
            productId: it.productId || stockInfo.matchedProd?.id,
          };
        }
        return it;
      })
    );

    setEditingItemModalVisible(false);
    setEditingItem(null);
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Calculations
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  
  const parseGstRateFromName = (name: string): number => {
    const match = name.match(/GST:\s*(\d+)%/i);
    return match ? parseInt(match[1], 10) : 18;
  };

  const groupedGst: Record<number, number> = {};
  items.forEach((item) => {
    const itemGstRate = item.gstRate !== undefined ? item.gstRate : parseGstRateFromName(item.name);
    const itemGst = gstEnabled ? item.amount * (itemGstRate / 100) : 0;
    if (itemGst > 0) {
      groupedGst[itemGstRate] = (groupedGst[itemGstRate] || 0) + itemGst;
    }
  });

  const totalGst = Object.values(groupedGst).reduce((sum, val) => sum + val, 0);
  const cgst = totalGst / 2;
  const sgst = totalGst / 2;
  const rawTotal = subtotal + totalGst;
  const total = Math.round(rawTotal);
  const roundOff = total - rawTotal;

  // Dynamic GST Toggle Title
  const currentGstRates: number[] = [];
  if (items.length > 0) {
    items.forEach((item) => {
      currentGstRates.push(item.gstRate !== undefined ? item.gstRate : parseGstRateFromName(item.name));
    });
  } else if (selectedProduct) {
    currentGstRates.push(selectedProduct.gstRate);
  }

  const uniqueGstRates = Array.from(new Set(currentGstRates)).sort((a, b) => a - b);
  const gstToggleTitle = uniqueGstRates.length > 0
    ? `GST (${uniqueGstRates.map(rate => `${rate}%`).join(', ')})`
    : 'GST';

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
      showWarning('Validation Error', 'Please enter Customer Name.');
      return;
    }
    if (items.length === 0) {
      showWarning('Validation Error', 'Please add at least one item to the invoice.');
      return;
    }

    const finalBill = {
      invoiceNumber: invoiceNo,
      customerName: serializeCustomerInfo({
        name: customerName,
        address: customerAddress.trim(),
        phone: customerPhone.trim(),
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
      if (editingBillId) {
        await updateBill(editingBillId, finalBill);
        showSuccess(
          'Invoice Updated',
          `Invoice "${invoiceNo}" has been updated successfully!`,
          () => {
            router.push({
              pathname: '/preview',
              params: { billId: editingBillId }
            });
          },
          'checkmark-done'
        );
      } else {
        const newInvoiceNo = await addBill(finalBill);
        
        // Set saved bill data for modal print/pdf actions
        setSavedBillForActions({
          ...finalBill,
          id: newInvoiceNo,
          invoiceNumber: newInvoiceNo
        });

        // Show action choices modal
        setShowPostSaveModal(true);
      }
    } catch (err: any) {
      showError('Billing Error', err.message || 'Failed to save bill');
    } finally {
      setSaving(false);
    }
  };

  // Print Saved Bill from Modal
  const handlePrintSavedBill = async () => {
    if (!savedBillForActions) return;

    if (printerSettings.paperSize === 'A4') {
      try {
        await printA4Invoice(savedBillForActions, companySettings);
      } catch (error) {
        showError('Printing Error', 'Could not open print sheet.');
      }
      return;
    }

    const printerName = printerSettings.connectedPrinter;
    const printerAddress = printerSettings.connectedPrinterAddress;
    if (!printerName) {
      showConfirm(
        'Printer Disconnected',
        'No active printer found. Would you like to connect a thermal printer now?',
        () => setPrinterModalVisible(true),
        undefined,
        'Connect Printer',
        'Cancel'
      );
      return;
    }

    if (!BluetoothEscposPrinter || !printerAddress || printerAddress.startsWith('pr-')) {
      showAlert({
        title: 'Thermal Printer Active (Simulated)',
        message: `Sending invoice ${savedBillForActions.invoiceNumber} to connected thermal printer "${printerName}" (${printerSettings.paperSize} width)...`,
        type: 'info',
        iconName: 'print-outline',
      });
      return;
    }

    try {
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
      await BluetoothEscposPrinter.printText(`Invoice No: ${savedBillForActions.invoiceNumber}\n`, {});
      await BluetoothEscposPrinter.printText(`Date: ${savedBillForActions.date}\n`, {});
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
      for (const item of savedBillForActions.items) {
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
        ['Subtotal:', savedBillForActions.subtotal.toFixed(2)],
        {}
      );
      
      if (gstEnabled) {
        for (const [rateStr, amt] of Object.entries(groupedGst)) {
          const rate = parseFloat(rateStr);
          const splitRate = rate / 2;
          const splitAmt = amt / 2;
          await BluetoothEscposPrinter.printColumn(
            is58 ? [16, 16] : [24, 24],
            [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
            [`CGST (${splitRate}%):`, splitAmt.toFixed(2)],
            {}
          );
          await BluetoothEscposPrinter.printColumn(
            is58 ? [16, 16] : [24, 24],
            [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
            [`SGST (${splitRate}%):`, splitAmt.toFixed(2)],
            {}
          );
        }
      }
      
      await BluetoothEscposPrinter.printText(divider, {});
      
      await BluetoothEscposPrinter.setBlob(1);
      await BluetoothEscposPrinter.printColumn(
        is58 ? [16, 16] : [24, 24],
        [BluetoothEscposPrinter.ALIGN.LEFT, BluetoothEscposPrinter.ALIGN.RIGHT],
        ['GRAND TOTAL:', formatCurrency(savedBillForActions.total)],
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
      
      showSuccess('Print Success', 'Invoice printed successfully!', undefined, 'print');
    } catch (error) {
      console.warn('Real print failed:', error);
      showError('Printing Error', 'Could not print to device. Please ensure it is powered on and connected.');
    }
  };

  // Download PDF from Modal
  const handleDownloadSavedBillPdf = async () => {
    if (!savedBillForActions) return;
    try {
      await downloadA4InvoicePdf(savedBillForActions, companySettings);
    } catch (error) {
      console.error('Failed to download PDF:', error);
    }
  };

  // Close Action Modal and Reset Form
  const handleClosePostSaveModal = () => {
    setShowPostSaveModal(false);
    setSavedBillForActions(null);
    
    // Reset Form
    setCustomerName('');
    setCustomerAddress('');
    setCustomerPhone('');
    setCustomerGstin('');
    setCustomerState('Tamil Nadu');
    setItems([]);
    setOriginalBillItems([]);
    setPaymentStatus('Pending');
    setPaymentMode('Cash');
    setInvoiceNo(generateNextInvoiceNumber());
  };

  // Preview Bill
  const handlePreview = () => {
    if (!customerName.trim()) {
      showWarning('Validation Error', 'Please enter Customer Name to preview receipt.');
      return;
    }
    if (items.length === 0) {
      showWarning('Validation Error', 'Please add at least one item to preview receipt.');
      return;
    }

    // Build temporary draft details to display in preview screen
    const draftBill = {
      id: invoiceNo,
      customerName: serializeCustomerInfo({
        name: customerName,
        address: customerAddress.trim(),
        phone: customerPhone.trim(),
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
      showWarning('Validation Error', 'Cannot print an empty invoice.');
      return;
    }

    if (printerSettings.paperSize === 'A4') {
      try {
        await printA4Invoice({
          id: invoiceNo,
          invoiceNumber: invoiceNo,
          customerName: serializeCustomerInfo({
            name: customerName,
            address: customerAddress.trim(),
            phone: customerPhone.trim(),
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
        showError('Printing Error', 'Could not open print sheet.');
      }
      return;
    }
    
    const printerName = printerSettings.connectedPrinter;
    const printerAddress = printerSettings.connectedPrinterAddress;
    if (!printerName) {
      showConfirm(
        'Printer Disconnected',
        'No active printer found. Would you like to connect a thermal printer now?',
        () => setPrinterModalVisible(true),
        undefined,
        'Connect Printer',
        'Cancel'
      );
      return;
    }

    if (!BluetoothEscposPrinter || !printerAddress || printerAddress.startsWith('pr-')) {
      showAlert({
        title: 'Thermal Printer Active (Simulated)',
        message: `Sending invoice ${invoiceNo} to connected thermal printer "${printerName}" (${printerSettings.paperSize} width)...`,
        type: 'info',
        iconName: 'print-outline',
      });
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
          ['Total GST:', totalGst.toFixed(2)],
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
      
      showSuccess('Print Success', 'Invoice printed successfully!', undefined, 'print');
    } catch (error) {
      console.warn('Real print failed:', error);
      showError('Printing Error', 'Could not print to device. Please ensure it is powered on and connected.');
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
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
            />
          }
        >
          {/* Editing Mode Banner */}
          {editingBillId && (
            <View style={styles.editingBanner}>
              <View style={styles.editingBannerLeft}>
                <Ionicons name="pencil" size={16} color="#191820" />
                <Text style={styles.editingBannerText}>
                  Editing Invoice <Text style={{ fontWeight: '900' }}>#{invoiceNo}</Text>
                </Text>
              </View>
              <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelEditBtn} activeOpacity={0.8}>
                <Ionicons name="close-circle" size={16} color="#FF4B4B" style={{ marginRight: 4 }} />
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Header Metadata */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {editingBillId ? 'Edit Invoice' : 'New Bill'}
              </Text>
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
            <View style={styles.customerCardHeader}>
              <Text style={styles.cardSectionTitle}>Customer Information</Text>
              <TouchableOpacity
                style={styles.manageCustLink}
                onPress={() => router.push('/customers')}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={14} color="#D4AF37" style={{ marginRight: 4 }} />
                <Text style={styles.manageCustText}>Directory</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.customerInputContainer}>
              <InputField
                label="Customer Name *"
                placeholder="Type customer name (e.g. Surya)"
                value={customerName}
                onChangeText={(text) => {
                  setCustomerName(text);
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
                iconName="person"
                containerStyle={{ marginVertical: 0 }}
              />

              {/* Customer Autocomplete Dropdown */}
              {showCustomerDropdown && filteredCustomers.length > 0 && (
                <View style={styles.customerDropdownList}>
                  {filteredCustomers.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.customerDropdownItem}
                      onPress={() => handleSelectCustomer(c)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.customerDropdownName}>{c.name}</Text>
                        <Text style={styles.customerDropdownSub} numberOfLines={1}>
                          {c.phone ? `📞 ${c.phone}` : ''} {c.address ? `• 📍 ${c.address}` : ''}
                        </Text>
                      </View>
                      <View style={styles.autoFillBadge}>
                        <Ionicons name="flash" size={11} color="#D4AF37" style={{ marginRight: 2 }} />
                        <Text style={styles.autoFillText}>Select</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <InputField
              label="Customer Address"
              placeholder="Enter customer address"
              value={customerAddress}
              onChangeText={setCustomerAddress}
              iconName="location-outline"
              multiline
            />

            <InputField
              label="Customer Contact No"
              placeholder="Enter 10-digit phone number"
              value={customerPhone}
              onChangeText={(text) => {
                const sanitized = text.replace(/[^0-9]/g, '');
                if (sanitized.length <= 10) {
                  setCustomerPhone(sanitized);
                }
              }}
              keyboardType="phone-pad"
              iconName="call-outline"
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

            {/* Quick Add Button if New Customer */}
            {isNewCustomer && (
              <TouchableOpacity
                style={styles.quickAddCustomerBtn}
                onPress={handleQuickAddCustomer}
                disabled={addingCustomerToDir}
                activeOpacity={0.8}
              >
                {addingCustomerToDir ? (
                  <ActivityIndicator size="small" color="#D4AF37" style={{ marginRight: 6 }} />
                ) : (
                  <Ionicons name="person-add-outline" size={16} color="#D4AF37" style={{ marginRight: 6 }} />
                )}
                <Text style={styles.quickAddCustomerText}>
                  {addingCustomerToDir ? "Saving to Directory..." : `+ Save "${customerName}" to Directory`}
                </Text>
              </TouchableOpacity>
            )}
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
              {selectedProduct && (
                <View style={styles.selectedProductStockBadge}>
                  <Ionicons name="cube-outline" size={12} color="#D4AF37" />
                  <Text style={styles.selectedProductStockText}>
                    Available Stock: <Text style={styles.goldTextBold}>{getProductStockInfo(selectedProduct.id, selectedProduct.name).remainingStoreStock} kg</Text>
                  </Text>
                </View>
              )}
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
                      const stockInfo = getProductStockInfo(p.id, p.name);
                      const isAlreadyInBill = stockInfo.isAlreadyInBill;
                      const remainingStock = stockInfo.remainingStoreStock;
                      const isOutOfStock = !isAlreadyInBill && remainingStock <= 0;
                      const isLowStock = !isAlreadyInBill && remainingStock > 0 && remainingStock < 10;
                      const parsed = parseItemNameAndHsn(p.name);

                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.dropdownItem,
                            isAlreadyInBill && styles.dropdownItemAlreadyAdded,
                          ]}
                          onPress={() => handleSelectProduct(p)}
                          disabled={isOutOfStock}
                          activeOpacity={0.7}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.dropdownItemText, isOutOfStock && { opacity: 0.5 }]}>
                              {parsed.name} {parsed.hsn && `(HSN: ${parsed.hsn})`}
                            </Text>
                            {isAlreadyInBill ? (
                              <View style={styles.dropdownItemAlreadyAddedBadge}>
                                <Ionicons name="checkmark-circle" size={12} color="#D4AF37" style={{ marginRight: 3 }} />
                                <Text style={styles.dropdownItemAlreadyAddedText}>
                                  Added in invoice ({stockInfo.currentBillQty} kg) • Tap to edit below
                                </Text>
                              </View>
                            ) : isOutOfStock ? (
                              <Text style={styles.dropdownItemOutOfStock}>Out of Stock</Text>
                            ) : isLowStock ? (
                              <Text style={styles.dropdownItemLowStock}>Only {remainingStock} kg left</Text>
                            ) : (
                              <Text style={styles.dropdownItemStock}>Stock: {remainingStock} kg</Text>
                            )}
                          </View>
                          <Text style={[styles.dropdownItemPrice, isOutOfStock && { opacity: 0.5 }, isAlreadyInBill && { color: '#D4AF37' }]}>
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
                  label="Quantity (kg)"
                  placeholder="1.0"
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
                <Text style={[styles.th, styles.colQty]}>Qty (kg)</Text>
                <Text style={[styles.th, styles.colPrice]}>Price</Text>
                <Text style={[styles.th, styles.colAmt]}>Total</Text>
                <Text style={[styles.th, styles.colAction]}>Action</Text>
              </View>

              {/* Table Rows */}
              {items.map((item) => (
                <View key={item.id} style={styles.tableDataRow}>
                  <TouchableOpacity
                    style={styles.colItem}
                    onPress={() => handleOpenEditItem(item)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tdItemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.td, styles.colQty]}>{item.qty} kg</Text>
                  <Text style={[styles.td, styles.colPrice]}>₹{item.price.toFixed(2)}</Text>
                  <Text style={[styles.td, styles.colAmt]}>{formatCurrency(item.amount)}</Text>
                  <View style={styles.itemRowActions}>
                    <TouchableOpacity
                      style={styles.itemEditBtn}
                      onPress={() => handleOpenEditItem(item)}
                    >
                      <Ionicons name="create-outline" size={17} color="#D4AF37" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.itemDeleteBtn}
                      onPress={() => handleDeleteItem(item.id)}
                    >
                      <Ionicons name="trash-outline" size={17} color="#FF4B4B" />
                    </TouchableOpacity>
                  </View>
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
                <Text style={styles.gstToggleTitle}>{gstToggleTitle}</Text>
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

            {gstEnabled && Object.entries(groupedGst).map(([rateStr, amt]) => {
              const rate = parseFloat(rateStr);
              const splitRate = rate / 2;
              const splitAmt = amt / 2;
              return (
                <React.Fragment key={rateStr}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.taxLabel}>CGST ({splitRate}%)</Text>
                    <Text style={styles.taxValue}>{formatCurrency(splitAmt)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.taxLabel}>SGST ({splitRate}%)</Text>
                    <Text style={styles.taxValue}>{formatCurrency(splitAmt)}</Text>
                  </View>
                </React.Fragment>
              );
            })}

            {Math.abs(roundOff) > 0.009 && (
              <View style={styles.summaryRow}>
                <Text style={styles.taxLabel}>Round Off</Text>
                <Text style={styles.taxValue}>
                  {roundOff > 0 ? '+' : ''}{roundOff.toFixed(2)}
                </Text>
              </View>
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
              <Text style={styles.btnPrimaryText}>{editingBillId ? 'Updating...' : 'Saving...'}</Text>
            ) : (
              <>
                <Ionicons name={editingBillId ? "checkmark-done-circle-outline" : "save-outline"} size={20} color="#191820" />
                <Text style={styles.btnPrimaryText}>{editingBillId ? 'Update Invoice' : 'Save Bill'}</Text>
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
      {/* Post Save Actions Modal */}
      <Modal
        visible={showPostSaveModal}
        transparent={true}
        animationType="slide"
        statusBarTranslucent={true}
        onRequestClose={handleClosePostSaveModal}
      >
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.postSaveCard} goldBorder={true}>
            <View style={styles.successIconBadge}>
              <Ionicons name="checkmark-circle" size={48} color="#34C759" />
            </View>
            <Text style={styles.postSaveTitle}>Invoice Saved Successfully!</Text>
            <Text style={styles.postSaveSubtitle}>
              Bill Number: <Text style={styles.goldText}>{savedBillForActions?.invoiceNumber}</Text>
            </Text>

            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handlePrintSavedBill}
              >
                <Ionicons name="print-outline" size={20} color="#191820" />
                <Text style={styles.modalBtnPrimaryText}>Print Invoice</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnSecondary]}
                onPress={handleDownloadSavedBillPdf}
              >
                <Ionicons name="download-outline" size={20} color="#D4AF37" />
                <Text style={styles.modalBtnSecondaryText}>Download PDF</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnOutline]}
                onPress={handleClosePostSaveModal}
              >
                <Ionicons name="arrow-forward-outline" size={20} color="#A0A0B0" />
                <Text style={styles.modalBtnOutlineText}>Done / New Bill</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        visible={editingItemModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setEditingItemModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <GlassCard style={styles.editItemModalCard} goldBorder={true}>
            {/* Modal Header */}
            <View style={styles.editItemModalHeader}>
              <View style={styles.editItemModalTitleRow}>
                <View style={styles.editItemIconBadge}>
                  <Ionicons name="create" size={20} color="#191820" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.editItemModalTitle}>Edit Item</Text>
                  <Text style={styles.editItemModalSubtitle} numberOfLines={1}>
                    {editingItem?.name}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setEditingItemModalVisible(false)}
                style={styles.editItemCloseBtn}
              >
                <Ionicons name="close" size={22} color="#A0A0B0" />
              </TouchableOpacity>
            </View>

            {/* Stock breakdown calculation card */}
            {(() => {
              if (!editingItem) return null;
              const stockInfo = getProductStockInfo(editingItem.productId, editItemName);
              if (!stockInfo.matchedProd) return null;

              const currentBillItemQty = editingItem.qty || 0;
              const remainingStoreStock = stockInfo.remainingStoreStock;
              const otherItemsQty = items
                .filter((it) => it.id !== editingItem.id && (
                  (it.productId && it.productId === stockInfo.matchedProd?.id) ||
                  it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === (editItemName || '').replace(/\(.*?\)/g, '').trim().toLowerCase()
                ))
                .reduce((sum, it) => sum + it.qty, 0);

              const maxAllowed = stockInfo.maxAllowed - otherItemsQty;

              return (
                <View style={styles.stockBreakdownContainer}>
                  <View style={styles.stockBreakdownRow}>
                    <View style={styles.stockBreakdownBox}>
                      <Text style={styles.stockBreakdownLabel}>In This Bill</Text>
                      <Text style={styles.stockBreakdownValue}>{currentBillItemQty} kg</Text>
                    </View>
                    <Text style={styles.stockBreakdownSign}>+</Text>
                    <View style={styles.stockBreakdownBox}>
                      <Text style={styles.stockBreakdownLabel}>Store Stock</Text>
                      <Text
                        style={[
                          styles.stockBreakdownValue,
                          remainingStoreStock <= 0 && { color: '#FF4B4B' },
                        ]}
                      >
                        {remainingStoreStock} kg
                      </Text>
                    </View>
                    <Text style={styles.stockBreakdownSign}>=</Text>
                    <View style={[styles.stockBreakdownBox, styles.stockBreakdownBoxTotal]}>
                      <Text style={styles.stockBreakdownLabelTotal}>Max Allowed</Text>
                      <Text style={styles.stockBreakdownValueTotal}>{maxAllowed} kg</Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* Quantity Stepper & Direct Input */}
            <View style={styles.editFieldSection}>
              <Text style={styles.editFieldLabel}>Quantity (kg)</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustEditQty(-1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={22} color="#D4AF37" />
                </TouchableOpacity>

                <TextInput
                  style={styles.stepperInput}
                  value={editItemQty}
                  onChangeText={setEditItemQty}
                  keyboardType="numeric"
                  placeholder="1.0"
                  placeholderTextColor="#6e6e7c"
                  selectTextOnFocus
                />

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => handleAdjustEditQty(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color="#D4AF37" />
                </TouchableOpacity>
              </View>

              {/* Quick Stepper Presets */}
              <View style={styles.quickQtyRow}>
                {[1, 2, 3, 4, 5, 10, 25, 50].map((preset) => {
                  const stockInfo = getProductStockInfo(editingItem?.productId, editItemName);
                  const otherItemsQty = items
                    .filter((it) => it.id !== editingItem?.id && (
                      (it.productId && it.productId === stockInfo.matchedProd?.id) ||
                      it.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === (editItemName || '').replace(/\(.*?\)/g, '').trim().toLowerCase()
                    ))
                    .reduce((sum, it) => sum + it.qty, 0);

                  const maxAllowed = stockInfo.matchedProd
                    ? stockInfo.maxAllowed - otherItemsQty
                    : 9999;
                  const isExceedingStock = preset > maxAllowed;

                  return (
                    <TouchableOpacity
                      key={preset}
                      disabled={Boolean(isExceedingStock)}
                      style={[
                        styles.quickQtyChip,
                        parseFloat(editItemQty) === preset && styles.quickQtyChipActive,
                        isExceedingStock && { opacity: 0.25, borderColor: 'rgba(255, 255, 255, 0.05)' },
                      ]}
                      onPress={() => setEditItemQty(String(preset))}
                    >
                      <Text
                        style={[
                          styles.quickQtyChipText,
                          parseFloat(editItemQty) === preset && styles.quickQtyChipTextActive,
                          isExceedingStock && { color: '#6e6e7c' },
                        ]}
                      >
                        {preset} kg
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Price Input */}
            <View style={styles.editFieldSection}>
              <Text style={styles.editFieldLabel}>Unit Price (₹ per kg)</Text>
              <TextInput
                style={styles.editPriceInput}
                value={editItemPrice}
                onChangeText={setEditItemPrice}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor="#6e6e7c"
              />
            </View>

            {/* Live Total Calculation Banner */}
            <View style={styles.editTotalBanner}>
              <Text style={styles.editTotalLabel}>Item Total</Text>
              <Text style={styles.editTotalValue}>
                {formatCurrency(
                  (parseFloat(editItemQty) || 0) * (parseFloat(editItemPrice) || 0)
                )}
              </Text>
            </View>

            {/* Modal Action Buttons */}
            <View style={styles.editModalBtnRow}>
              <TouchableOpacity
                style={[styles.editModalBtn, styles.editModalCancelBtn]}
                onPress={() => setEditingItemModalVisible(false)}
              >
                <Text style={styles.editModalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.editModalBtn, styles.editModalSaveBtn]}
                onPress={handleSaveEditedItem}
              >
                <Ionicons name="checkmark-done" size={18} color="#191820" style={{ marginRight: 6 }} />
                <Text style={styles.editModalSaveText}>Update Item</Text>
              </TouchableOpacity>
            </View>
          </GlassCard>
        </KeyboardAvoidingView>
      </Modal>
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
  editingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D4AF37',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 14,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  editingBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  editingBannerText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '700',
  },
  cancelEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  cancelEditText: {
    color: '#FF4B4B',
    fontSize: 11,
    fontWeight: '800',
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
    padding: 14,
    marginBottom: 12,
  },
  customerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  manageCustLink: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  manageCustText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  customerInputContainer: {
    position: 'relative',
    zIndex: 20,
    marginBottom: 8,
  },
  customerDropdownList: {
    position: 'absolute',
    top: 66,
    left: 0,
    right: 0,
    backgroundColor: '#24242a',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
    borderRadius: 12,
    zIndex: 200,
    maxHeight: 200,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  customerDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customerDropdownName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  customerDropdownSub: {
    color: '#A0A0B0',
    fontSize: 11,
    marginTop: 2,
  },
  autoFillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  autoFillText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  quickAddCustomerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginTop: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D4AF37',
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
  },
  quickAddCustomerText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '700',
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
  dropdownItemAlreadyAdded: {
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    borderLeftWidth: 3,
    borderLeftColor: '#D4AF37',
  },
  dropdownItemAlreadyAddedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    marginTop: 3,
    alignSelf: 'flex-start',
  },
  dropdownItemAlreadyAddedText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(25, 24, 32, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  postSaveCard: {
    width: '100%',
    padding: 24,
    alignItems: 'center',
  },
  successIconBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  postSaveTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  postSaveSubtitle: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
  },
  goldText: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  modalButtonsContainer: {
    width: '100%',
    gap: 12,
  },
  modalBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnPrimary: {
    backgroundColor: '#D4AF37',
  },
  modalBtnPrimaryText: {
    color: '#191820',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#D4AF37',
  },
  modalBtnSecondaryText: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '800',
  },
  modalBtnOutline: {
    backgroundColor: '#24242a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalBtnOutlineText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedProductStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  selectedProductStockText: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '600',
  },
  goldTextBold: {
    color: '#D4AF37',
    fontWeight: '700',
  },
  tdItemName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  itemRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: 60,
    gap: 8,
  },
  itemEditBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDeleteBtn: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Edit Item Modal Styles
  editItemModalCard: {
    width: '100%',
    maxWidth: 400,
    padding: 20,
  },
  editItemModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 14,
    marginBottom: 14,
  },
  editItemModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  editItemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editItemModalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  editItemModalSubtitle: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  editItemCloseBtn: {
    padding: 6,
  },
  // Stock Breakdown Card Styles
  stockBreakdownContainer: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  stockBreakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stockBreakdownBox: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#191820',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stockBreakdownBoxTotal: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderColor: '#D4AF37',
  },
  stockBreakdownLabel: {
    color: '#A0A0B0',
    fontSize: 9,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  stockBreakdownValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  stockBreakdownLabelTotal: {
    color: '#D4AF37',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  stockBreakdownValueTotal: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '900',
  },
  stockBreakdownSign: {
    color: '#D4AF37',
    fontSize: 15,
    fontWeight: '800',
    marginHorizontal: 3,
  },
  editItemStockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  editItemStockText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
  },
  editFieldSection: {
    marginBottom: 14,
  },
  editFieldLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#191820',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    overflow: 'hidden',
  },
  stepperBtn: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  stepperInput: {
    flex: 1,
    height: 48,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  quickQtyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickQtyChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  quickQtyChipActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.2)',
    borderColor: '#D4AF37',
  },
  quickQtyChipText: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '600',
  },
  quickQtyChipTextActive: {
    color: '#D4AF37',
    fontWeight: '800',
  },
  editPriceInput: {
    height: 48,
    backgroundColor: '#191820',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingHorizontal: 14,
  },
  editTotalBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  editTotalLabel: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  editTotalValue: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '900',
  },
  editModalBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editModalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editModalCancelBtn: {
    backgroundColor: '#24242a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  editModalCancelText: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '700',
  },
  editModalSaveBtn: {
    backgroundColor: '#D4AF37',
  },
  editModalSaveText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '800',
  },
});
