import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, FlatList, TouchableOpacity, SafeAreaView, Dimensions, Platform, Alert, RefreshControl, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { parseCustomerInfo } from '@/utils/customer';
import { useBilling } from '@/context/BillingContext';
import { useAlert } from '@/context/AlertContext';
import { GlassCard } from '@/components/ui/GlassCard';

export default function DashboardScreen() {
  const router = useRouter();
  const { bills, companySettings, deleteBill, refreshData } = useBilling();
  const { showDelete, showSuccess, showError } = useAlert();
  const [refreshing, setRefreshing] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e) {
      console.warn('Dashboard refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteBill = (id: string, invoiceNo: string) => {
    showDelete(
      'Delete Invoice',
      `Are you sure you want to delete invoice "${invoiceNo}"? This will restore product stock levels.`,
      async () => {
        try {
          await deleteBill(id);
          showSuccess('Invoice Deleted', `Invoice "${invoiceNo}" was deleted and stock restored.`, undefined, 'trash');
        } catch (err: any) {
          showError('Error', err.message || 'Failed to delete invoice');
        }
      }
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
  
  const todaySalesVal = todayBills.reduce((sum, b) => sum + b.total, 0);
  const todayBillsCount = todayBills.length;
  
  // Label for today's summary metrics
  const statsLabel = "Today's Summary";

  // Navigation handlers
  const handleQuickAction = (action: 'create-bill' | 'products' | 'reports' | 'settings' | 'payments' | 'customers') => {
    if (action === 'customers') {
      router.push('/customers');
    } else {
      router.push(`/(tabs)/${action}`);
    }
  };

  const handlePreviewBill = (billId: string) => {
    router.push({
      pathname: '/preview',
      params: { billId },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
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
        {/* Top Navbar */}
        <View style={styles.header}>
          <View style={styles.headerLeftRow}>
            <TouchableOpacity
              onPress={() => setDrawerVisible(true)}
              style={styles.hamburgerBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="menu-outline" size={26} color="#D4AF37" />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerCompany}>{companySettings.name}</Text>
              <Text style={styles.headerSubtitle}>Billing & Inventory POS</Text>
            </View>
          </View>
          <View style={styles.gstBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#D4AF37" style={{ marginRight: 4 }} />
            <Text style={styles.gstText}>GST ENABLED</Text>
          </View>
        </View>

        {/* Dynamic Metric Stat Banner */}
        <GlassCard style={styles.bannerCard} goldBorder={true}>
          <View style={styles.bannerHeader}>
            <View style={styles.bannerTitleRow}>
              <View style={styles.dotIndicator} />
              <Text style={styles.bannerSubtitle}>{statsLabel}</Text>
            </View>
            <View style={styles.todayDateBadge}>
              <Text style={styles.todayDateText}>{formatDateForDisplay(today.toISOString())}</Text>
            </View>
          </View>

          <View style={styles.summaryStatsRow}>
            <View style={styles.summaryStatItem}>
              <Text style={styles.statSubTitle}>TODAY'S REVENUE</Text>
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

          {/* Customers Directory */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('customers')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(255, 149, 0, 0.12)' }]}>
              <Ionicons name="people" size={26} color="#FF9500" />
            </View>
            <Text style={styles.gridLabel}>Customers</Text>
            <Text style={styles.gridSubLabel}>Directory & add</Text>
          </TouchableOpacity>

          {/* Customer Ledger */}
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.gridItem}
            onPress={() => handleQuickAction('payments')}
          >
            <View style={[styles.gridIconContainer, { backgroundColor: 'rgba(255, 45, 85, 0.12)' }]}>
              <Ionicons name="wallet" size={26} color="#FF2D55" />
            </View>
            <Text style={styles.gridLabel}>Ledger</Text>
            <Text style={styles.gridSubLabel}>Track balances</Text>
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
              
              <View style={styles.billActionsRow}>
                <TouchableOpacity
                  style={styles.billActionBtn}
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/create-bill',
                      params: { editBillId: String(item.id) },
                    })
                  }
                >
                  <Ionicons name="create-outline" size={19} color="#D4AF37" />
                </TouchableOpacity>

                <View style={styles.billActionDivider} />

                <TouchableOpacity
                  style={styles.billActionBtn}
                  onPress={() => handleDeleteBill(item.id, item.invoiceNumber || item.id)}
                >
                  <Ionicons name="trash-outline" size={19} color="#FF4B4B" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Sidebar Drawer Menu Modal */}
      <Modal
        visible={drawerVisible}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setDrawerVisible(false)}
          />
          <SafeAreaView style={styles.drawerContainer}>
            {/* Drawer Header */}
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrandRow}>
                <View style={styles.drawerLogoBadge}>
                  <Ionicons name="storefront" size={20} color="#191820" />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.drawerCompanyName} numberOfLines={1}>
                    {companySettings.name}
                  </Text>
                  <Text style={styles.drawerSubtitle}>Billing & POS Portal</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setDrawerVisible(false)}
                  style={styles.drawerCloseBtn}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={24} color="#A0A0B0" />
                </TouchableOpacity>
              </View>

              {companySettings.gstin ? (
                <View style={styles.drawerGstBadge}>
                  <Ionicons name="shield-checkmark" size={12} color="#D4AF37" style={{ marginRight: 4 }} />
                  <Text style={styles.drawerGstText}>GST: {companySettings.gstin}</Text>
                </View>
              ) : null}
            </View>

            {/* Quick Add Customer CTA */}
            <TouchableOpacity
              style={styles.drawerQuickAddBtn}
              activeOpacity={0.8}
              onPress={() => {
                setDrawerVisible(false);
                router.push('/customers');
              }}
            >
              <Ionicons name="person-add" size={18} color="#191820" style={{ marginRight: 6 }} />
              <Text style={styles.drawerQuickAddText}>+ Add New Customer</Text>
            </TouchableOpacity>

            {/* Drawer Menu Items */}
            <ScrollView style={styles.drawerMenuScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.drawerSectionLabel}>MAIN MENU</Text>

              {/* Dashboard */}
              <TouchableOpacity
                style={[styles.drawerMenuItem, styles.drawerMenuItemActive]}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(212, 175, 55, 0.15)' }]}>
                  <Ionicons name="grid" size={20} color="#D4AF37" />
                </View>
                <Text style={[styles.drawerMenuLabel, { color: '#D4AF37', fontWeight: '700' }]}>Dashboard</Text>
                <Ionicons name="chevron-forward" size={16} color="#D4AF37" />
              </TouchableOpacity>

              {/* Quick Bill */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)/create-bill');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(212, 175, 55, 0.1)' }]}>
                  <Ionicons name="receipt-outline" size={20} color="#D4AF37" />
                </View>
                <Text style={styles.drawerMenuLabel}>Quick Bill</Text>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>

              {/* Ledger */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)/payments');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(255, 45, 85, 0.1)' }]}>
                  <Ionicons name="wallet-outline" size={20} color="#FF2D55" />
                </View>
                <Text style={styles.drawerMenuLabel}>Customer Ledger</Text>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>

              {/* Customers */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/customers');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(255, 149, 0, 0.1)' }]}>
                  <Ionicons name="people-outline" size={20} color="#FF9500" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.drawerMenuLabel}>Customers Directory</Text>
                  <Text style={styles.drawerMenuSubLabel}>Add & manage accounts</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>

              <Text style={[styles.drawerSectionLabel, { marginTop: 16 }]}>INVENTORY & INSIGHTS</Text>

              {/* Products */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)/products');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                  <Ionicons name="cube-outline" size={20} color="#34C759" />
                </View>
                <Text style={styles.drawerMenuLabel}>Products & Stock</Text>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>

              {/* Reports */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)/reports');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(90, 200, 250, 0.1)' }]}>
                  <Ionicons name="analytics-outline" size={20} color="#5AC8FA" />
                </View>
                <Text style={styles.drawerMenuLabel}>Reports & Analytics</Text>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>

              {/* Settings */}
              <TouchableOpacity
                style={styles.drawerMenuItem}
                activeOpacity={0.7}
                onPress={() => {
                  setDrawerVisible(false);
                  router.push('/(tabs)/settings');
                }}
              >
                <View style={[styles.drawerMenuIcon, { backgroundColor: 'rgba(160, 160, 176, 0.1)' }]}>
                  <Ionicons name="settings-outline" size={20} color="#A0A0B0" />
                </View>
                <Text style={styles.drawerMenuLabel}>Store Settings</Text>
                <Ionicons name="chevron-forward" size={16} color="#6e6e7c" />
              </TouchableOpacity>
            </ScrollView>

            {/* Drawer Footer */}
            <View style={styles.drawerFooter}>
              <Text style={styles.drawerFooterText}>DR Agencies Billing POS</Text>
              <Text style={styles.drawerFooterSub}>Version 1.2.0 • Online Mode</Text>
            </View>
          </SafeAreaView>
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
  headerLeftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hamburgerBtn: {
    padding: 8,
    marginRight: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  headerCompany: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  gstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  gstText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerGstin: {
    color: '#D4AF37',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
  },
  bannerCard: {
    padding: 16,
    marginBottom: 24,
  },
  bannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34C759',
    marginRight: 6,
  },
  bannerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D4AF37',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  todayDateBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  todayDateText: {
    fontSize: 11,
    color: '#A0A0B0',
    fontWeight: '600',
  },
  summaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
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
  billActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  billActionDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 4,
  },
  billActionBtn: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Drawer Styles
  drawerOverlay: {
    flex: 1,
    flexDirection: 'row',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  drawerContainer: {
    width: '82%',
    maxWidth: 320,
    backgroundColor: '#1c1c24',
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: 'rgba(212, 175, 55, 0.2)',
    paddingTop: Platform.OS === 'android' ? 40 : 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  drawerHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 16,
    marginBottom: 14,
  },
  drawerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  drawerLogoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerCompanyName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  drawerSubtitle: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  drawerCloseBtn: {
    padding: 4,
  },
  drawerGstBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  drawerGstText: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
  },
  drawerQuickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D4AF37',
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  drawerQuickAddText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '800',
  },
  drawerMenuScroll: {
    flex: 1,
  },
  drawerSectionLabel: {
    color: '#6e6e7c',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  drawerMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginBottom: 4,
  },
  drawerMenuItemActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  drawerMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  drawerMenuLabel: {
    flex: 1,
    color: '#E0E0E8',
    fontSize: 14,
    fontWeight: '600',
  },
  drawerMenuSubLabel: {
    color: '#6e6e7c',
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  drawerFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 12,
    alignItems: 'center',
  },
  drawerFooterText: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '700',
  },
  drawerFooterSub: {
    color: '#6e6e7c',
    fontSize: 9,
    marginTop: 2,
  },
});

