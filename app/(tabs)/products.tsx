import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useBilling, Product } from '@/context/BillingContext';
import { useAlert } from '@/context/AlertContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';

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

export default function ProductsScreen() {
  const router = useRouter();
  const { 
    products, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    refreshData,
    addStockQty,
    fetchProductStockLogs 
  } = useBilling();
  const { showSuccess, showUpdate, showWarning, showError, showDelete } = useAlert();

  // Search filter State
  const [searchQuery, setSearchQuery] = useState('');

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form States
  const [name, setName] = useState('');
  const [hsn, setHsn] = useState('');
  const [price, setPrice] = useState('');
  const [gstRate, setGstRate] = useState('18'); // Default 18% GST
  const [stockQty, setStockQty] = useState('0');
  const [refreshing, setRefreshing] = useState(false);

  // Stock Movement & History Modal States
  const [stockModalVisible, setStockModalVisible] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<any[]>([]);
  const [loadingStockLogs, setLoadingStockLogs] = useState(false);
  const [addStockAmount, setAddStockAmount] = useState('');
  const [addStockNote, setAddStockNote] = useState('');
  const [submittingAddStock, setSubmittingAddStock] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e) {
      console.warn('Inventory refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Open modal for stock history
  const handleOpenStockHistory = (product: Product) => {
    setSelectedProductForStock(product);
    setAddStockAmount('');
    setAddStockNote('');
    setStockModalVisible(true);
    loadProductStockHistory(product.id);
  };

  const loadProductStockHistory = async (productId: string) => {
    try {
      setLoadingStockLogs(true);
      const rawLogs = await fetchProductStockLogs(productId);
      
      // Strict product isolation: only process logs for this specific product
      const productOnlyLogs = (rawLogs || []).filter((log) => {
        const logProdId = String(log.productId || (log as any).product_id || '');
        return logProdId === String(productId);
      });

      // Calculate running balance step by step (chronological order)
      const sortedAsc = [...productOnlyLogs].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

      let runningBal = 0;
      const logsWithBal = sortedAsc.map((log) => {
        const qty = typeof log.quantity === 'number' ? log.quantity : parseFloat(String(log.quantity)) || 0;
        if (log.type === 'IN') {
          runningBal += qty;
        } else {
          runningBal = Math.max(0, runningBal - qty);
        }
        return {
          ...log,
          inQty: log.type === 'IN' ? qty : 0,
          outQty: log.type === 'OUT' ? qty : 0,
          balance: parseFloat(runningBal.toFixed(2))
        };
      });

      // Show newest first on top
      setStockLogs(logsWithBal.reverse());
    } catch (err: any) {
      console.error('Error fetching stock history:', err);
    } finally {
      setLoadingStockLogs(false);
    }
  };

  // Memoized In/Out Totals
  const { totalInQty, totalOutQty } = useMemo(() => {
    let inTotal = 0;
    let outTotal = 0;
    stockLogs.forEach((log) => {
      if (log.type === 'IN') {
        inTotal += log.inQty || 0;
      } else if (log.type === 'OUT') {
        outTotal += log.outQty || 0;
      }
    });
    return { 
      totalInQty: parseFloat(inTotal.toFixed(2)), 
      totalOutQty: parseFloat(outTotal.toFixed(2)) 
    };
  }, [stockLogs]);

  const handleAddStockSubmit = async () => {
    if (!selectedProductForStock) return;
    const addQty = parseFloat(addStockAmount);
    if (isNaN(addQty) || addQty <= 0) {
      showWarning('Validation Error', 'Please enter a valid positive quantity in kg.');
      return;
    }

    try {
      setSubmittingAddStock(true);
      const updated = await addStockQty(
        selectedProductForStock.id, 
        addQty, 
        addStockNote.trim() || 'RESTOCK'
      );
      setSelectedProductForStock(updated);
      setAddStockAmount('');
      setAddStockNote('');
      await loadProductStockHistory(selectedProductForStock.id);
      showSuccess('Stock Updated', `Added +${addQty} kg to "${updated.name}". Current Stock: ${updated.stockQty} kg.`, undefined, 'trending-up');
    } catch (err: any) {
      showError('Error', err.message || 'Failed to add stock quantity.');
    } finally {
      setSubmittingAddStock(false);
    }
  };

  // Open modal for adding
  const handleOpenAdd = () => {
    setEditingProduct(null);
    setName('');
    setHsn('');
    setPrice('');
    setGstRate('18');
    setStockQty('0');
    setModalVisible(true);
  };

  // Open modal for editing
  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    const parsed = parseItemNameAndHsn(product.name);
    setName(parsed.name);
    setHsn(parsed.hsn);
    setPrice(product.price.toString());
    setGstRate(product.gstRate.toString());
    setStockQty(product.stockQty?.toString() || '0');
    setModalVisible(true);
  };

  // Format date helper
  const formatDateTimeForDisplay = (dateStr: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      let hours = d.getHours();
      const mins = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${dd}-${mm}-${yyyy} ${hours}:${mins} ${ampm}`;
    } catch {
      return dateStr;
    }
  };

  // Helper for reference label
  const getReferenceLabel = (ref: string, type: 'IN' | 'OUT') => {
    if (!ref || ref === 'RESTOCK') return type === 'IN' ? 'Stock Added / Restock' : 'Stock Out';
    if (ref === 'INITIAL') return 'Initial Stock Opening';
    if (ref === 'MANUAL_UPDATE') return 'Manual Stock Update';
    if (ref.startsWith('BILL-')) return `Sale Bill: ${ref.replace('BILL-', '')}`;
    if (ref.startsWith('DELETE-BILL-')) return `Restored (Deleted Bill: ${ref.replace('DELETE-BILL-', '')})`;
    return ref;
  };

  // Handle Save
  const handleSave = async () => {
    if (!name.trim()) {
      showWarning('Validation Error', 'Product Name is required.');
      return;
    }
    const p = parseFloat(price);
    const g = parseInt(gstRate, 10);
    const s = parseFloat(stockQty);

    if (isNaN(p) || p <= 0) {
      showWarning('Validation Error', 'Please enter a valid price greater than 0.');
      return;
    }
    if (isNaN(g) || g < 0) {
      showWarning('Validation Error', 'Please enter a valid GST percentage.');
      return;
    }
    if (isNaN(s) || s < 0) {
      showWarning('Validation Error', 'Stock Quantity cannot be negative.');
      return;
    }

    const finalName = hsn.trim() ? `${name.trim()} HSN: ${hsn.trim()}` : name.trim();

    try {
      if (editingProduct) {
        // Update
        await updateProduct({
          id: editingProduct.id,
          name: finalName,
          price: p,
          gstRate: g,
          stockQty: s,
        });
        showUpdate('Product Updated', `"${finalName}" details have been updated successfully.`, undefined, 'cube');
      } else {
        // Create
        await addProduct({
          name: finalName,
          price: p,
          gstRate: g,
          stockQty: s,
        });
        showSuccess('Product Added', `"${finalName}" has been added to inventory successfully.`, undefined, 'cube');
      }
      setModalVisible(false);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save product.');
    }
  };

  // Handle Delete
  const handleDelete = (id: string, name: string) => {
    showDelete(
      'Confirm Delete',
      `Are you sure you want to remove "${name}" from inventory?`,
      () => deleteProduct(id)
    );
  };

  // Filter products
  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Currency Formatter
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Search and Header Section */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Inventory</Text>
          <Text style={styles.subtitle}>{products.length} Products listed</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.stockLogsBtn} onPress={() => router.push('/product-ledger')}>
            <Ionicons name="calendar-outline" size={16} color="#D4AF37" />
            <Text style={styles.stockLogsBtnText}>Logs</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenAdd}>
            <Ionicons name="add" size={18} color="#191820" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <InputField
          label=""
          placeholder="Search items by name..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          iconName="search-outline"
          showClearButton={true}
          onClear={() => setSearchQuery('')}
          containerStyle={{ marginVertical: 0 }}
        />
      </View>

      {/* Scrollable list */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
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
        {filteredProducts.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="cube-outline" size={40} color="#A0A0B0" style={{ marginBottom: 12, opacity: 0.7 }} />
            <Text style={styles.emptyText}>No products match your search</Text>
            <TouchableOpacity style={styles.resetBtn} onPress={() => setSearchQuery('')}>
              <Text style={styles.resetBtnText}>Clear Search</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          filteredProducts.map((item) => {
            const isLowStock = item.stockQty > 0 && item.stockQty < 10;
            const isOutOfStock = item.stockQty <= 0;
            const parsed = parseItemNameAndHsn(item.name);

            return (
              <GlassCard key={item.id} style={styles.modernProductCard}>
                {/* Top Row: Icon + Name/HSN + Stock Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.cardTitleContainer}>
                    <View style={styles.productIconBox}>
                      <Ionicons name="cube" size={18} color="#D4AF37" />
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.modernProductName} numberOfLines={1}>
                        {parsed.name}
                      </Text>
                      <Text style={styles.modernHsnText}>
                        {parsed.hsn ? `HSN: ${parsed.hsn}` : 'General Inventory'}
                      </Text>
                    </View>
                  </View>

                  {/* Stock Status Pill */}
                  {isOutOfStock ? (
                    <View style={[styles.modernStockPill, styles.stockPillOut]}>
                      <View style={[styles.stockDot, { backgroundColor: '#FF4B4B' }]} />
                      <Text style={[styles.modernStockPillText, { color: '#FF4B4B' }]}>0 kg Out</Text>
                    </View>
                  ) : isLowStock ? (
                    <View style={[styles.modernStockPill, styles.stockPillLow]}>
                      <View style={[styles.stockDot, { backgroundColor: '#FFC84B' }]} />
                      <Text style={[styles.modernStockPillText, { color: '#FFC84B' }]}>{item.stockQty} kg Low</Text>
                    </View>
                  ) : (
                    <View style={[styles.modernStockPill, styles.stockPillIn]}>
                      <View style={[styles.stockDot, { backgroundColor: '#34C759' }]} />
                      <Text style={[styles.modernStockPillText, { color: '#34C759' }]}>{item.stockQty} kg</Text>
                    </View>
                  )}
                </View>

                {/* Middle Row: Price, Tax & Stock Metrics Grid */}
                <View style={styles.cardInfoGrid}>
                  <View style={styles.infoChip}>
                    <Text style={styles.infoChipLabel}>UNIT PRICE</Text>
                    <Text style={styles.infoChipPrice}>{formatCurrency(item.price)}</Text>
                  </View>

                  <View style={styles.infoChipDivider} />

                  <View style={styles.infoChip}>
                    <Text style={styles.infoChipLabel}>TAX RATE</Text>
                    <Text style={styles.infoChipGst}>GST {item.gstRate}%</Text>
                  </View>

                  <View style={styles.infoChipDivider} />

                  <View style={styles.infoChip}>
                    <Text style={styles.infoChipLabel}>AVAILABLE</Text>
                    <Text style={[
                      styles.infoChipStock,
                      { color: isOutOfStock ? '#FF4B4B' : isLowStock ? '#FFC84B' : '#34C759' }
                    ]}>
                      {item.stockQty} kg
                    </Text>
                  </View>
                </View>

                {/* Bottom Row: Stock History Button & Quick Actions */}
                <View style={styles.cardFooterRow}>
                  <TouchableOpacity
                    style={styles.historyPillBtn}
                    onPress={() => handleOpenStockHistory(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={15} color="#D4AF37" style={{ marginRight: 5 }} />
                    <Text style={styles.historyPillBtnText}>Stock History</Text>
                  </TouchableOpacity>

                  <View style={styles.cardRightActions}>
                    <TouchableOpacity
                      style={styles.modernEditBtn}
                      onPress={() => handleOpenEdit(item)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                      <Text style={styles.modernEditBtnText}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modernDeleteBtn}
                      onPress={() => handleDelete(item.id, item.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={15} color="#FF4B4B" />
                    </TouchableOpacity>
                  </View>
                </View>
              </GlassCard>
            );
          })
        )}
      </ScrollView>

      {/* Add/Edit Product Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProduct ? 'Edit Product Details' : 'Add New Product'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <InputField
                label="Product / Service Name"
                placeholder="e.g. Copper Pipe 2-inch"
                value={name}
                onChangeText={setName}
                iconName="cube-outline"
              />

              <InputField
                label="HSN / SAC Code"
                placeholder="e.g. 15131900 (optional)"
                value={hsn}
                onChangeText={setHsn}
                keyboardType="numeric"
                iconName="barcode-outline"
              />

              <InputField
                label="Base Price (₹)"
                placeholder="e.g. 450"
                value={price}
                onChangeText={setPrice}
                keyboardType="numeric"
                iconName="cash-outline"
              />

              <InputField
                label="GST Rate (%)"
                placeholder="e.g. 18"
                value={gstRate}
                onChangeText={setGstRate}
                keyboardType="numeric"
                iconName="receipt-outline"
              />

              <InputField
                label="Stock Quantity (kg)"
                placeholder="e.g. 100.5"
                value={stockQty}
                onChangeText={setStockQty}
                keyboardType="numeric"
                iconName="layers-outline"
              />

              <View style={styles.gstShortcuts}>
                <Text style={styles.shortcutLabel}>Quick GST selection:</Text>
                <View style={styles.shortcutRow}>
                  {['0', '5', '12', '18', '28'].map((rate) => (
                    <TouchableOpacity
                      key={rate}
                      style={[styles.shortcutBtn, gstRate === rate && styles.activeShortcutBtn]}
                      onPress={() => setGstRate(rate)}
                    >
                      <Text
                        style={[
                          styles.shortcutBtnText,
                          gstRate === rate && styles.activeShortcutBtnText,
                        ]}
                      >
                        {rate}%
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <GoldButton
                title={editingProduct ? 'Update Product' : 'Add Product'}
                onPress={handleSave}
                style={styles.modalSaveBtn}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Product Stock Movement & History Modal */}
      <Modal
        visible={stockModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setStockModalVisible(false)}
      >
        <SafeAreaView style={styles.stockScreenContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#191820" />
          
          {/* Header */}
          <View style={styles.stockScreenHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.stockScreenTitle} numberOfLines={1}>
                {selectedProductForStock?.name || 'Stock History'}
              </Text>
              <View style={styles.headerStockBadgeRow}>
                <Text style={styles.headerStockLabel}>Current Stock: </Text>
                <Text style={styles.headerStockValue}>
                  {selectedProductForStock?.stockQty ?? 0} kg
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.closeModalBtn} 
              onPress={() => setStockModalVisible(false)}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            contentContainerStyle={styles.stockScreenScroll} 
            showsVerticalScrollIndicator={false}
          >
            {/* Quick Restock Entry Box */}
            <GlassCard style={styles.restockCard}>
              <View style={styles.restockTitleRow}>
                <Ionicons name="add-circle-outline" size={18} color="#34C759" style={{ marginRight: 6 }} />
                <Text style={styles.restockCardTitle}>Add Stock (Update Quantity)</Text>
              </View>

              <View style={styles.restockInputsRow}>
                <View style={{ flex: 1 }}>
                  <InputField
                    label="Quantity to Add (kg) *"
                    placeholder="e.g. 50"
                    value={addStockAmount}
                    onChangeText={setAddStockAmount}
                    keyboardType="numeric"
                    iconName="layers-outline"
                    containerStyle={{ marginVertical: 4 }}
                  />
                </View>
                <View style={{ flex: 1.2 }}>
                  <InputField
                    label="Reference / Note"
                    placeholder="e.g. New Batch"
                    value={addStockNote}
                    onChangeText={setAddStockNote}
                    iconName="document-text-outline"
                    containerStyle={{ marginVertical: 4 }}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.addStockBtn, submittingAddStock && { opacity: 0.6 }]}
                onPress={handleAddStockSubmit}
                disabled={submittingAddStock}
                activeOpacity={0.8}
              >
                {submittingAddStock ? (
                  <ActivityIndicator size="small" color="#191820" />
                ) : (
                  <>
                    <Ionicons name="arrow-down-circle" size={18} color="#191820" style={{ marginRight: 6 }} />
                    <Text style={styles.addStockBtnText}>+ Add Stock to Inventory</Text>
                  </>
                )}
              </TouchableOpacity>
            </GlassCard>

            {/* Summary KPI Strip */}
            <View style={styles.summaryKpiRow}>
              <View style={[styles.kpiCard, { borderColor: 'rgba(52, 199, 89, 0.25)' }]}>
                <Text style={styles.kpiLabel}>TOTAL IN</Text>
                <Text style={[styles.kpiValue, { color: '#34C759' }]}>+{totalInQty} kg</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: 'rgba(255, 75, 75, 0.25)' }]}>
                <Text style={styles.kpiLabel}>TOTAL OUT</Text>
                <Text style={[styles.kpiValue, { color: '#FF4B4B' }]}>-{totalOutQty} kg</Text>
              </View>

              <View style={[styles.kpiCard, { borderColor: 'rgba(212, 175, 55, 0.25)' }]}>
                <Text style={styles.kpiLabel}>BALANCE</Text>
                <Text style={[styles.kpiValue, { color: '#D4AF37' }]}>
                  {selectedProductForStock?.stockQty ?? 0} kg
                </Text>
              </View>
            </View>

            {/* History List Section Title */}
            <View style={styles.historySectionHeader}>
              <Text style={styles.historySectionTitle}>
                Stock Movement Records ({stockLogs.length})
              </Text>
              <TouchableOpacity
                onPress={() => selectedProductForStock && loadProductStockHistory(selectedProductForStock.id)}
                style={styles.historyRefreshBtn}
              >
                <Ionicons name="refresh" size={14} color="#D4AF37" style={{ marginRight: 4 }} />
                <Text style={styles.historyRefreshText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            {/* History Cards List */}
            {loadingStockLogs ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color="#D4AF37" />
                <Text style={styles.loadingBoxText}>Loading stock history...</Text>
              </View>
            ) : stockLogs.length === 0 ? (
              <GlassCard style={styles.emptyHistoryCard}>
                <Ionicons name="cube-outline" size={38} color="#A0A0B0" style={{ marginBottom: 8, opacity: 0.7 }} />
                <Text style={styles.emptyHistoryTitle}>No stock history yet</Text>
                <Text style={styles.emptyHistorySub}>
                  Add stock above or create a bill with this item to see records.
                </Text>
              </GlassCard>
            ) : (
              <View style={styles.historyList}>
                {stockLogs.map((log, index) => {
                  const isIncoming = log.type === 'IN';
                  return (
                    <GlassCard key={log.id || index} style={styles.historyCard}>
                      {/* Top Row: Type Badge + Date */}
                      <View style={styles.historyCardTopRow}>
                        <View style={[
                          styles.typeBadge,
                          isIncoming ? styles.typeBadgeIn : styles.typeBadgeOut
                        ]}>
                          <Ionicons 
                            name={isIncoming ? "arrow-down-circle" : "arrow-up-circle"} 
                            size={14} 
                            color={isIncoming ? "#34C759" : "#FF4B4B"} 
                            style={{ marginRight: 4 }}
                          />
                          <Text style={[
                            styles.typeBadgeText,
                            isIncoming ? styles.typeBadgeTextIn : styles.typeBadgeTextOut
                          ]}>
                            {isIncoming ? 'STOCK ADDED' : 'SALE / BILLED'}
                          </Text>
                        </View>

                        <Text style={styles.historyDateText}>
                          {formatDateTimeForDisplay(log.createdAt)}
                        </Text>
                      </View>

                      {/* Reference / Note Row */}
                      <View style={styles.historyRefRow}>
                        <Text style={styles.historyRefLabel}>Reference: </Text>
                        <Text style={styles.historyRefValue} numberOfLines={1}>
                          {getReferenceLabel(log.referenceId, log.type)}
                        </Text>
                      </View>

                      {/* 3-Column Stock Figures Box: IN KG | OUT KG | BALANCE KG */}
                      <View style={styles.stockFiguresBox}>
                        <View style={styles.figureCol}>
                          <Text style={styles.figureColLabel}>IN (kg)</Text>
                          <Text style={[styles.figureColValue, { color: isIncoming ? '#34C759' : '#6e6e7c' }]}>
                            {isIncoming ? `+${log.inQty} kg` : '-'}
                          </Text>
                        </View>

                        <View style={styles.figureColDivider} />

                        <View style={styles.figureCol}>
                          <Text style={styles.figureColLabel}>OUT (kg)</Text>
                          <Text style={[styles.figureColValue, { color: !isIncoming ? '#FF4B4B' : '#6e6e7c' }]}>
                            {!isIncoming ? `-${log.outQty} kg` : '-'}
                          </Text>
                        </View>

                        <View style={styles.figureColDivider} />

                        <View style={styles.figureCol}>
                          <Text style={styles.figureColLabel}>BALANCE (kg)</Text>
                          <Text style={[styles.figureColValue, { color: '#D4AF37', fontWeight: '900' }]}>
                            {log.balance} kg
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  addBtnText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  /* Modern Luxury Product Card Styles */
  modernProductCard: {
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#1b1a23',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.07)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  modernProductName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  modernHsnText: {
    color: '#8E8E9F',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  modernStockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  stockPillIn: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  stockPillLow: {
    backgroundColor: 'rgba(255, 200, 75, 0.12)',
    borderColor: 'rgba(255, 200, 75, 0.3)',
  },
  stockPillOut: {
    backgroundColor: 'rgba(255, 75, 75, 0.12)',
    borderColor: 'rgba(255, 75, 75, 0.3)',
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  modernStockPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  cardInfoGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  infoChip: {
    flex: 1,
    alignItems: 'center',
  },
  infoChipLabel: {
    color: '#8E8E9F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  infoChipPrice: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '800',
  },
  infoChipGst: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  infoChipStock: {
    fontSize: 12,
    fontWeight: '800',
  },
  infoChipDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  historyPillBtnText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modernEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#262530',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modernEditBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  modernDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 75, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  emptyText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  resetBtn: {
    marginTop: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  resetBtnText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#191820',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalScroll: {
    paddingBottom: 24,
  },
  gstShortcuts: {
    marginVertical: 12,
  },
  shortcutLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  shortcutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  shortcutBtn: {
    flex: 1,
    height: 38,
    backgroundColor: '#24242a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeShortcutBtn: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  shortcutBtnText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
  },
  activeShortcutBtnText: {
    color: '#191820',
  },
  modalSaveBtn: {
    marginTop: 24,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  inStockBadge: {
    backgroundColor: 'rgba(75, 255, 75, 0.06)',
    borderColor: 'rgba(75, 255, 75, 0.15)',
  },
  lowStockBadge: {
    backgroundColor: 'rgba(255, 200, 75, 0.08)',
    borderColor: 'rgba(255, 200, 75, 0.2)',
  },
  outOfStockBadge: {
    backgroundColor: 'rgba(255, 75, 75, 0.08)',
    borderColor: 'rgba(255, 75, 75, 0.2)',
  },
  stockText: {
    fontSize: 10,
    fontWeight: '700',
  },
  inStockText: {
    color: '#4BFF4B',
  },
  lowStockText: {
    color: '#FFC84B',
  },
  outOfStockText: {
    color: '#FF4B4B',
  },
  hsnBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  hsnBadgeText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
  },
  stockLogsBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.2,
    borderColor: '#D4AF37',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4,
  },
  stockLogsBtnText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '700',
  },
  stockHistoryIconBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stockHistoryBtnText: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
  },

  /* -------------------------------------------------------------
     STOCK HISTORY SCREEN & CARD STYLES
  ------------------------------------------------------------- */
  stockScreenContainer: {
    flex: 1,
    backgroundColor: '#141318',
  },
  stockScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 36 : 14,
    paddingBottom: 14,
    backgroundColor: '#191820',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  stockScreenTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  headerStockBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  headerStockLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '500',
  },
  headerStockValue: {
    color: '#34C759',
    fontSize: 13,
    fontWeight: '800',
  },
  closeModalBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stockScreenScroll: {
    padding: 16,
    paddingBottom: 40,
  },

  /* Restock Form */
  restockCard: {
    padding: 14,
    marginBottom: 14,
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: 'rgba(52, 199, 89, 0.25)',
  },
  restockTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  restockCardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  restockInputsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addStockBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34C759',
    paddingVertical: 11,
    borderRadius: 8,
    marginTop: 8,
  },
  addStockBtnText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '800',
  },

  /* KPI Row */
  summaryKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#191820',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  kpiLabel: {
    color: '#8E8E9F',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '800',
  },

  /* Section Header */
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  historySectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  historyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  historyRefreshText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
  },

  /* History Cards */
  historyList: {
    gap: 10,
  },
  historyCard: {
    padding: 12,
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeBadgeIn: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  typeBadgeOut: {
    backgroundColor: 'rgba(255, 75, 75, 0.15)',
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  typeBadgeTextIn: {
    color: '#34C759',
  },
  typeBadgeTextOut: {
    color: '#FF4B4B',
  },
  historyDateText: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '500',
  },
  historyRefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  historyRefLabel: {
    color: '#6e6e7c',
    fontSize: 11,
    fontWeight: '500',
  },
  historyRefValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  /* 3-Column Figures Box */
  stockFiguresBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  figureCol: {
    flex: 1,
    alignItems: 'center',
  },
  figureColLabel: {
    color: '#8E8E9F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  figureColValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  figureColDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 2,
  },

  /* Empty & Loading States */
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  loadingBoxText: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 8,
  },
  emptyHistoryCard: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 16,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  emptyHistoryTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptyHistorySub: {
    color: '#8E8E9F',
    fontSize: 12,
    textAlign: 'center',
  },
});


