import React, { useState, useEffect, useCallback } from 'react';
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
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { DateRangePickerModal } from '@/components/ui/DateRangePickerModal';

type FilterType = 'today' | 'weekly' | 'monthly' | 'custom';

interface StockLogItem {
  id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT';
  quantity: number;
  referenceId: string;
  createdAt: string;
}

export default function ProductLedgerScreen() {
  const router = useRouter();
  const { fetchStockLedgerList } = useBilling();

  const [activeFilter, setActiveFilter] = useState<FilterType>('monthly');
  const [showCalendar, setShowCalendar] = useState(false);
  const [customRange, setCustomRange] = useState<{ start: Date; end: Date } | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<StockLogItem[]>([]);

  // Fetch stock movement ledger logs
  const fetchLedgerData = useCallback(async (isPullToRefresh = false) => {
    try {
      if (!isPullToRefresh) setLoading(true);
      
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
        if (!isPullToRefresh) setLoading(false);
        return;
      }

      const ledgerLogs = await fetchStockLedgerList(fromStr, toStr);
      setLogs(ledgerLogs);
    } catch (err: any) {
      console.error('Error fetching stock ledger logs:', err);
      Alert.alert('Error', 'Failed to retrieve stock ledger records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter, customRange, fetchStockLedgerList]);

  useEffect(() => {
    fetchLedgerData();
  }, [fetchLedgerData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLedgerData(true);
  };

  // Helper to format date for display
  const formatDateForDisplay = (dateStr: string): string => {
    try {
      const d = new Date(dateStr);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      let hours = d.getHours();
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      return `${dd}-${mm}-${yyyy} ${hours}:${minutes} ${ampm}`;
    } catch (e) {
      return dateStr;
    }
  };

  // Stats calculations
  const totalIn = logs
    .filter(log => log.type === 'IN')
    .reduce((sum, log) => sum + log.quantity, 0);

  const totalOut = logs
    .filter(log => log.type === 'OUT')
    .reduce((sum, log) => sum + log.quantity, 0);

  const netMovement = totalIn - totalOut;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Stock Ledger</Text>
          <Text style={styles.subtitle}>Track product In/Out stock flows</Text>
        </View>
      </View>

      {/* Filter Tabs */}
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
            {customRange.start.toLocaleDateString('en-IN')} to {customRange.end.toLocaleDateString('en-IN')}
          </Text>
          <TouchableOpacity onPress={() => setShowCalendar(true)} style={styles.editRangeBtn}>
            <Text style={styles.editRangeText}>Edit</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Metrics Row */}
      <View style={styles.summaryContainer}>
        <GlassCard style={[styles.summaryCard, { borderColor: 'rgba(52, 199, 89, 0.15)' }]}>
          <Text style={styles.summaryLabel}>TOTAL IN</Text>
          <Text style={[styles.summaryValue, { color: '#34C759' }]}>+{totalIn.toFixed(2)} kg</Text>
        </GlassCard>
        <GlassCard style={[styles.summaryCard, { borderColor: 'rgba(255, 75, 75, 0.15)' }]}>
          <Text style={styles.summaryLabel}>TOTAL OUT</Text>
          <Text style={[styles.summaryValue, { color: '#FF4B4B' }]}>-{totalOut.toFixed(2)} kg</Text>
        </GlassCard>
        <GlassCard style={[styles.summaryCard, { borderColor: 'rgba(212, 175, 55, 0.15)' }]}>
          <Text style={styles.summaryLabel}>NET CHANGE</Text>
          <Text style={[styles.summaryValue, { color: netMovement >= 0 ? '#34C759' : '#FF4B4B' }]}>
            {netMovement >= 0 ? '+' : ''}{netMovement.toFixed(2)} kg
          </Text>
        </GlassCard>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Fetching stock movement logs...</Text>
        </View>
      ) : (
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
          {logs.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="cube-outline" size={40} color="#A0A0B0" style={{ marginBottom: 12, opacity: 0.7 }} />
              <Text style={styles.emptyText}>No stock logs recorded in this period</Text>
            </GlassCard>
          ) : (
            logs.map((log) => {
              const isEntryIn = log.type === 'IN';
              
              let refLabel = 'Manual Entry';
              if (log.referenceId === 'INITIAL') {
                refLabel = 'Initial stock setup';
              } else if (log.referenceId?.startsWith('BILL-')) {
                refLabel = `Sold via bill: ${log.referenceId.replace('BILL-', '')}`;
              } else if (log.referenceId?.startsWith('DELETE-BILL-')) {
                refLabel = `Restored via delete: ${log.referenceId.replace('DELETE-BILL-', '')}`;
              }

              return (
                <GlassCard key={log.id} style={styles.logCard}>
                  <View style={styles.logCardRow}>
                    {/* Direction icon indicator */}
                    <View style={[
                      styles.logIconContainer,
                      isEntryIn ? styles.logIconContainerIn : styles.logIconContainerOut
                    ]}>
                      <Ionicons
                        name={isEntryIn ? "arrow-up-outline" : "arrow-down-outline"}
                        size={16}
                        color={isEntryIn ? "#34C759" : "#FF4B4B"}
                      />
                    </View>
                    
                    {/* Text Details */}
                    <View style={styles.logDetails}>
                      <Text style={styles.productName}>{log.productName}</Text>
                      <Text style={styles.referenceText}>{refLabel}</Text>
                    </View>

                    {/* Quantity & Date */}
                    <View style={styles.logMeta}>
                      <Text style={[
                        styles.logQuantity,
                        isEntryIn ? styles.logQuantityIn : styles.logQuantityOut
                      ]}>
                        {isEntryIn ? '+' : '-'}{log.quantity.toFixed(2)} kg
                      </Text>
                      <Text style={styles.logDate}>
                        {formatDateForDisplay(log.createdAt)}
                      </Text>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Date Range Picker */}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  activeSegmentBtnText: {
    color: '#191820',
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
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    marginVertical: 0,
    borderWidth: 1,
  },
  summaryLabel: {
    color: '#6e6e7c',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 50,
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
  logCard: {
    padding: 12,
    marginBottom: 8,
    marginVertical: 0,
  },
  logCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logIconContainerIn: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
  },
  logIconContainerOut: {
    backgroundColor: 'rgba(255, 75, 75, 0.1)',
  },
  logDetails: {
    flex: 1.5,
    paddingRight: 6,
  },
  productName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  referenceText: {
    color: '#A0A0B0',
    fontSize: 11,
    marginTop: 2,
  },
  logMeta: {
    alignItems: 'flex-end',
    flex: 1.2,
  },
  logQuantity: {
    fontSize: 13,
    fontWeight: '800',
  },
  logQuantityIn: {
    color: '#34C759',
  },
  logQuantityOut: {
    color: '#FF4B4B',
  },
  logDate: {
    color: '#6e6e7c',
    fontSize: 9,
    marginTop: 3,
  },
});
