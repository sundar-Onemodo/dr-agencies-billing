import React, { useState } from 'react';
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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useBilling, Product } from '@/context/BillingContext';
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
  const { products, addProduct, updateProduct, deleteProduct, refreshData } = useBilling();

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

  // Handle Save
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Product Name is required');
      return;
    }
    const p = parseFloat(price);
    const g = parseInt(gstRate, 10);
    const s = parseFloat(stockQty);

    if (isNaN(p) || p <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid price greater than 0');
      return;
    }
    if (isNaN(g) || g < 0) {
      Alert.alert('Validation Error', 'Please enter a valid GST percentage');
      return;
    }
    if (isNaN(s) || s < 0) {
      Alert.alert('Validation Error', 'Stock Quantity cannot be negative');
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
      } else {
        // Create
        await addProduct({
          name: finalName,
          price: p,
          gstRate: g,
          stockQty: s,
        });
      }
      setModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save product');
    }
  };

  // Handle Delete
  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Confirm Delete',
      `Are you sure you want to remove "${name}" from inventory?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProduct(id),
        },
      ]
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
              <GlassCard key={item.id} style={styles.productCard}>
                <View style={styles.cardInfo}>
                  <Text style={styles.productName}>{parsed.name}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.productPrice}>{formatCurrency(item.price)}</Text>
                    {parsed.hsn ? (
                      <View style={styles.hsnBadge}>
                        <Text style={styles.hsnBadgeText}>HSN {parsed.hsn}</Text>
                      </View>
                    ) : null}
                    <View style={styles.gstBadge}>
                      <Text style={styles.gstText}>GST {item.gstRate}%</Text>
                    </View>
                    {isOutOfStock ? (
                      <View style={[styles.stockBadge, styles.outOfStockBadge]}>
                        <Text style={[styles.stockText, styles.outOfStockText]}>OUT OF STOCK</Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.stockBadge,
                          isLowStock ? styles.lowStockBadge : styles.inStockBadge,
                        ]}
                      >
                        <Text
                          style={[
                            styles.stockText,
                            isLowStock ? styles.lowStockText : styles.inStockText,
                          ]}
                        >
                          Stock: {item.stockQty} kg
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleOpenEdit(item)}>
                    <Ionicons name="pencil" size={18} color="#D4AF37" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionIconBtn} onPress={() => handleDelete(item.id, item.name)}>
                    <Ionicons name="trash-outline" size={18} color="#FF4B4B" />
                  </TouchableOpacity>
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
  productCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    marginVertical: 6,
  },
  cardInfo: {
    flex: 1,
    paddingRight: 12,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  productPrice: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
  },
  gstBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gstText: {
    color: '#A0A0B0',
    fontSize: 10,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
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
});
