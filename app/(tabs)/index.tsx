import React from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, TouchableOpacity, SafeAreaView, Dimensions, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { parseCustomerInfo } from '@/utils/customer';
import { useBilling } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';

export default function DashboardScreen() {
  const router = useRouter();
  const { bills, companySettings, deleteBill } = useBilling();

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

  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(value);
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
      const month = parseInt(parts[1], 10) - 1;
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

  // Calculate stats dynamically from context
  const today = new Date();
  const todayBills = bills.filter((b) => {
    const bDate = parseDateString(b.date);
    return (
      bDate.getDate() === today.getDate() &&
      bDate.getMonth() === today.getMonth() &&
      bDate.getFullYear() === today.getFullYear()
    );
  });
  
  // If no bills for "today" in the mock, fallback to sum of all bills for visualization, 
  // but prioritize showing actual today bills if user added one.
  const displayBills = todayBills.length > 0 ? todayBills : bills;
  const todaySalesVal = displayBills.reduce((sum, b) => sum + b.total, 0);
  const todayBillsCount = displayBills.length;
  
  // Labels indicating whether it's showing all-time fallback or today's active items
  const statsLabel = todayBills.length > 0 ? "Today's Summary" : "Overall Summary (Demo)";

  // Navigation handlers
  const handleQuickAction = (tabName: 'create-bill' | 'products' | 'reports' | 'settings') => {
    router.push(`/(tabs)/${tabName}`);
  };

  const handlePreviewBill = (billId: string) => {
    router.push({
      pathname: '/preview',
      params: { billId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerCompany}>{companySettings.name}</Text>
            <View style={styles.gstBadge}>
              <Ionicons name="shield-checkmark" size={13} color="#D4AF37" />
              <Text style={styles.headerGstin}>GSTIN: {companySettings.gstin}</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.notificationBtn}
            onPress={() => handleQuickAction('settings')}
          >
            <Ionicons name="cog-outline" size={24} color="#D4AF37" />
          </TouchableOpacity>
        </View>

        {/* Dashboard Summary Card */}
        <GlassCard style={styles.summaryCard} goldBorder={true}>
          <Text style={styles.summaryLabel}>{statsLabel}</Text>
          <View style={styles.summaryDivider} />
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.statSubTitle}>TODAY SALES</Text>
              <Text style={styles.statTitleValue}>{formatCurrency(todaySalesVal)}</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.summaryStatItem}>
              <Text style={styles.statSubTitle}>TOTAL BILLS</Text>
              <Text style={styles.statTitleValue}>{todayBillsCount} Bills</Text>
            </View>
          </View>
        </GlassCard>

        {/* Quick Actions Grid */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.gridContainer}>
          {/* Create Bill */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('create-bill')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(212, 175, 55, 0.12)' }]}>
              <Ionicons name="receipt" size={26} color="#D4AF37" />
            </View>
            <Text style={styles.gridLabel}>Create Bill</Text>
            <Text style={styles.gridSubLabel}>New invoice</Text>
          </TouchableOpacity>

          {/* Products */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('products')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(52, 199, 89, 0.12)' }]}>
              <Ionicons name="cube" size={26} color="#34C759" />
            </View>
            <Text style={styles.gridLabel}>Products</Text>
            <Text style={styles.gridSubLabel}>Stock list</Text>
          </TouchableOpacity>

          {/* Reports */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('reports')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(0, 122, 255, 0.12)' }]}>
              <Ionicons name="analytics" size={26} color="#007AFF" />
            </View>
            <Text style={styles.gridLabel}>Reports</Text>
            <Text style={styles.gridSubLabel}>Sales analytics</Text>
          </TouchableOpacity>

          {/* Settings */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('settings')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(175, 82, 222, 0.12)' }]}>
              <Ionicons name="settings" size={26} color="#AF52DE" />
            </View>
            <Text style={styles.gridLabel}>Settings</Text>
            <Text style={styles.gridSubLabel}>Store profile</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Bills List */}
        <View style={styles.recentBillsHeader}>
          <Text style={styles.sectionTitle}>Recent Invoices</Text>
          <TouchableOpacity onPress={() => handleQuickAction('reports')}>
            <Text style={styles.viewAllText}>View Reports</Text>
          </TouchableOpacity>
        </View>

        {bills.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={40} color="#A0A0B0" style={styles.emptyIcon} />
            <Text style={styles.emptyText}>No invoices generated yet</Text>
            <TouchableOpacity 
              style={styles.emptyButton} 
              onPress={() => handleQuickAction('create-bill')}
            >
              <Text style={styles.emptyButtonText}>Create First Bill</Text>
            </TouchableOpacity>
          </GlassCard>
        ) : (
          bills.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.billCard}>
              <TouchableOpacity
                style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                activeOpacity={0.7}
                onPress={() => handlePreviewBill(item.id)}
              >
                <View style={styles.billLeft}>
                  <View style={styles.billIconContainer}>
                    <Ionicons name="document-text" size={20} color="#D4AF37" />
                  </View>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.billInvoiceNo} numberOfLines={1}>{item.invoiceNumber || item.id}</Text>
                    <Text style={styles.billCustomer} numberOfLines={1}>{parseCustomerInfo(item.customerName).name}</Text>
                  </View>
                </View>
                <View style={styles.billRight}>
                  <Text style={styles.billAmount}>{formatCurrency(item.total)}</Text>
                  <View style={styles.billDateRow}>
                    <Text style={styles.billDate}>{formatDateForDisplay(item.date)}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#A0A0B0" style={{ marginLeft: 4 }} />
                  </View>
                </View>
              </TouchableOpacity>
              
              <View style={styles.billDeleteDivider} />
              
              <TouchableOpacity
                style={styles.billDeleteBtn}
                onPress={() => handleDeleteBill(item.id, item.invoiceNumber || item.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF4B4B" />
              </TouchableOpacity>
            </View>
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
  scrollContent: {
    padding: 16,
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 10,
  },
  headerCompany: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  gstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerGstin: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#24242a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCard: {
    padding: 20,
    marginBottom: 24,
  },
  summaryLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 14,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryStatItem: {
    flex: 1,
  },
  statSubTitle: {
    color: '#6e6e7c',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statTitleValue: {
    color: '#D4AF37',
    fontSize: 18,
    fontWeight: '800',
  },
  verticalDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.3,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  gridItem: {
    width: '48%',
    backgroundColor: '#24242a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    marginBottom: 16,
    // Shadows
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  gridIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  gridLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  gridSubLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
  },
  recentBillsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  viewAllText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
  },
  billCard: {
    backgroundColor: '#24242a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  billLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  billIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  billInvoiceNo: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  billCustomer: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
  },
  billRight: {
    alignItems: 'flex-end',
  },
  billAmount: {
    color: '#D4AF37',
    fontSize: 14,
    fontWeight: '700',
  },
  billDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  billDate: {
    color: '#6e6e7c',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 30,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  emptyIcon: {
    marginBottom: 10,
    opacity: 0.6,
  },
  emptyText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyButton: {
    marginTop: 12,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  emptyButtonText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '700',
  },
  billDeleteDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 12,
  },
  billDeleteBtn: {
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

