import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { DateRangePickerModal } from '@/components/ui/DateRangePickerModal';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling, Bill } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { parseCustomerInfo } from '@/utils/customer';

type FilterType = 'today' | 'weekly' | 'monthly' | 'custom';

export default function ReportsScreen() {
  const router = useRouter();
  const { bills, deleteBill, fetchBillsRange } = useBilling();
  const [activeFilter, setActiveFilter] = useState<FilterType>('monthly'); // Default monthly to show mock data
  const [showCalendar, setShowCalendar] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const today = new Date();
      let fromStr = '';
      let toStr = '';

      const formatDateForApi = (date: Date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      };

      if (activeFilter === 'today') {
        fromStr = formatDateForApi(today);
        toStr = fromStr;
      } else if (activeFilter === 'weekly') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        fromStr = formatDateForApi(sevenDaysAgo);
        toStr = formatDateForApi(today);
      } else if (activeFilter === 'monthly') {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        fromStr = formatDateForApi(firstDayOfMonth);
        toStr = formatDateForApi(today);
      } else if (activeFilter === 'custom' && customRange) {
        fromStr = formatDateForApi(customRange.start);
        toStr = formatDateForApi(customRange.end);
      } else {
        return;
      }

      await fetchBillsRange(fromStr, toStr);
    } catch (e) {
      console.warn('Reports refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Fetch bills from server when filter changes
  React.useEffect(() => {
    const fetchFilteredData = async () => {
      try {
        setLoading(true);
        const today = new Date();
        let fromStr = '';
        let toStr = '';

        const formatDateForApi = (date: Date) => {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          return `${yyyy}-${mm}-${dd}`;
        };

        if (activeFilter === 'today') {
          fromStr = formatDateForApi(today);
          toStr = fromStr;
        } else if (activeFilter === 'weekly') {
          const sevenDaysAgo = new Date(today);
          sevenDaysAgo.setDate(today.getDate() - 7);
          fromStr = formatDateForApi(sevenDaysAgo);
          toStr = formatDateForApi(today);
        } else if (activeFilter === 'monthly') {
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          fromStr = formatDateForApi(firstDayOfMonth);
          toStr = formatDateForApi(today);
        } else if (activeFilter === 'custom' && customRange) {
          fromStr = formatDateForApi(customRange.start);
          toStr = formatDateForApi(customRange.end);
        } else {
          setLoading(false);
          return;
        }

        await fetchBillsRange(fromStr, toStr);
      } catch (err: any) {
        console.error('Error fetching bills for reports:', err);
        Alert.alert('Error', 'Failed to load report data from server');
      } finally {
        setLoading(false);
      }
    };

    fetchFilteredData();
  }, [activeFilter, customRange]);

  const handleDeleteBill = (id: string, invoiceNo: string) => {
    Alert.alert(
      'Delete Invoice',
      `Are you sure you want to delete invoice "${invoiceNo}"? This will restore product stock levels.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteBill(id);
              Alert.alert('Success', 'Invoice deleted successfully');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete invoice');
            }
          }
        }
      ]
    );
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

  // Filter bills dynamically
  const getFilteredBills = (): Bill[] => {
    return bills;
  };

  const filteredBills = getFilteredBills();

  // Dynamic calculations
  const totalSales = filteredBills.reduce((sum, b) => sum + b.total, 0);
  const totalGstCollected = filteredBills.reduce((sum, b) => sum + b.cgst + b.sgst, 0);
  const totalSubtotal = filteredBills.reduce((sum, b) => sum + b.subtotal, 0);

  // Formatting Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(val);
  };

  const handlePreviewBill = (billId: string) => {
    router.push({
      pathname: '/preview',
      params: { billId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reports & Analytics</Text>
        <Text style={styles.subtitle}>Track business revenue and GST logs</Text>
      </View>

      {/* Filter Tabs Segment */}
      <View style={styles.segmentContainer}>
        {(['today', 'weekly', 'monthly', 'custom'] as FilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeFilter === filter && styles.activeSegmentBtn]}
            onPress={() => {
              if (filter === 'custom') {
                setShowCalendar(true);
              } else {
                setActiveFilter(filter);
              }
            }}
          >
            <Text
              style={[
                styles.segmentBtnText,
                activeFilter === filter && styles.activeSegmentBtnText,
              ]}
            >
              {filter === 'custom' ? 'CUSTOM' : filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Custom Range Indicator */}
      {activeFilter === 'custom' && customRange && (
        <View style={styles.rangeIndicator}>
          <Ionicons name="calendar" size={14} color="#D4AF37" style={{ marginRight: 6 }} />
          <Text style={styles.rangeIndicatorText}>
            {formatDateForDisplay(customRange.start.toISOString())} to {formatDateForDisplay(customRange.end.toISOString())}
          </Text>
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.editRangeBtn}>
            <Text style={styles.editRangeText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

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
        {/* Dynamic Summary Cards */}
        <View style={styles.summaryContainer}>
          <GlassCard style={styles.summaryCard} goldBorder={true}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.cardLabel}>Total Revenue</Text>
                <Text style={styles.cardValue}>{formatCurrency(totalSales)}</Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
                <Ionicons name="trending-up-outline" size={24} color="#D4AF37" />
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>Base amount: {formatCurrency(totalSubtotal)}</Text>
            </View>
          </GlassCard>

          <GlassCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View>
                <Text style={styles.cardLabel}>GST Collected</Text>
                <Text style={[styles.cardValue, { color: '#34C759' }]}>
                  {formatCurrency(totalGstCollected)}
                </Text>
              </View>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
                <Ionicons name="shield-checkmark-outline" size={24} color="#34C759" />
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.footerLabel}>CGST + SGST (9% + 9%)</Text>
            </View>
          </GlassCard>
        </View>

        {/* Invoice breakdown list */}
        <Text style={styles.sectionTitle}>
          Transaction History ({filteredBills.length} invoices)
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingText}>Loading transactions...</Text>
          </View>
        ) : filteredBills.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color="#A0A0B0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No transactions recorded in this period</Text>
          </GlassCard>
        ) : (
          filteredBills.map((item) => (
            <View key={item.id} style={styles.invoiceRow}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                activeOpacity={0.7}
                onPress={() => handlePreviewBill(item.id)}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.invoiceIconBg}>
                    <Ionicons name="document-text" size={18} color="#D4AF37" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.invoiceNo} numberOfLines={1}>{item.invoiceNumber || item.id}</Text>
                    <Text style={styles.customerName} numberOfLines={1}>
                      {parseCustomerInfo(item.customerName).name}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowRight}>
                  <Text style={styles.invoiceAmt}>{formatCurrency(item.total)}</Text>
                  <Text style={styles.invoiceDate}>{formatDateForDisplay(item.date)}</Text>
                </View>
              </TouchableOpacity>
              
              <View style={styles.deleteDivider} />
              
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDeleteBill(item.id, item.invoiceNumber || item.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#FF4B4B" />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      <DateRangePickerModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onSelectRange={(start, end) => {
          setCustomRange({ start, end });
          setActiveFilter('custom');
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
  },
  header: {
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
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#1c1c24',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeSegmentBtn: {
    backgroundColor: '#D4AF37',
  },
  segmentBtnText: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeSegmentBtnText: {
    color: '#191820',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  summaryContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    padding: 16,
    marginVertical: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  cardValue: {
    color: '#D4AF37',
    fontSize: 16,
    fontWeight: '800',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    marginTop: 12,
    paddingTop: 8,
  },
  footerLabel: {
    color: '#6e6e7c',
    fontSize: 10,
    fontWeight: '500',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginVertical: 14,
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
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  invoiceRow: {
    backgroundColor: '#24242a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
  },
  invoiceIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  invoiceNo: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  customerName: {
    color: '#A0A0B0',
    fontSize: 11,
    marginTop: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    flex: 0.8,
  },
  invoiceAmt: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceDate: {
    color: '#6e6e7c',
    fontSize: 10,
    marginTop: 2,
  },
  deleteDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  deleteBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    marginBottom: 12,
  },
  rangeIndicatorText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  editRangeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  editRangeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
});
