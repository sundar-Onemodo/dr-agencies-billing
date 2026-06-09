import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling, Bill } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';

type FilterType = 'today' | 'weekly' | 'monthly';

export default function ReportsScreen() {
  const router = useRouter();
  const { bills } = useBilling();
  const [activeFilter, setActiveFilter] = useState<FilterType>('monthly'); // Default monthly to show mock data

  // Helper to parse DD-MM-YYYY string to Date object
  const parseDateString = (dateStr: string): Date => {
    const parts = dateStr.split('-');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const year = parseInt(parts[2], 10);
    return new Date(year, month, day);
  };

  // Filter bills dynamically
  const getFilteredBills = (): Bill[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return bills.filter((bill) => {
      const billDate = parseDateString(bill.date);
      billDate.setHours(0, 0, 0, 0);

      if (activeFilter === 'today') {
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        const todayStr = `${dd}-${mm}-${yyyy}`;
        return bill.date === todayStr;
      }

      if (activeFilter === 'weekly') {
        const diffTime = Math.abs(today.getTime() - billDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays <= 7;
      }

      if (activeFilter === 'monthly') {
        // Match same month and year
        return (
          billDate.getMonth() === today.getMonth() &&
          billDate.getFullYear() === today.getFullYear()
        );
      }

      return true;
    });
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
        {(['today', 'weekly', 'monthly'] as FilterType[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            activeOpacity={0.8}
            style={[styles.segmentBtn, activeFilter === filter && styles.activeSegmentBtn]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.segmentBtnText,
                activeFilter === filter && styles.activeSegmentBtnText,
              ]}
            >
              {filter.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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

        {filteredBills.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="receipt-outline" size={40} color="#A0A0B0" style={{ marginBottom: 12 }} />
            <Text style={styles.emptyText}>No transactions recorded in this period</Text>
          </GlassCard>
        ) : (
          filteredBills.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.invoiceRow}
              activeOpacity={0.7}
              onPress={() => handlePreviewBill(item.id)}
            >
              <View style={styles.rowLeft}>
                <View style={styles.invoiceIconBg}>
                  <Ionicons name="document-text" size={18} color="#D4AF37" />
                </View>
                <View>
                  <Text style={styles.invoiceNo}>{item.id}</Text>
                  <Text style={styles.customerName} numberOfLines={1}>
                    {item.customerName}
                  </Text>
                </View>
              </View>

              <View style={styles.rowRight}>
                <Text style={styles.invoiceAmt}>{formatCurrency(item.total)}</Text>
                <Text style={styles.invoiceDate}>{item.date}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
});
