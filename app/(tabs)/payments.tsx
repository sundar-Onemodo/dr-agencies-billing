import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { InputField } from '@/components/ui/InputField';
import { Customer } from '@/store/slices/customerSlice';

export default function PaymentsScreen() {
  const { 
    customers, 
    fetchCustomersList, 
    recordCustomerPayment, 
    fetchCustomerPaymentsList,
    customerPayments 
  } = useBilling();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Payment recording state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isOnline, setIsOnline] = useState(false);
  const [onlineMethod, setOnlineMethod] = useState<'GPay' | 'PhonePe' | 'Paytm'>('GPay');
  const [paymentDate, setPaymentDate] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Expanded History states
  const [expandedCustomerId, setExpandedCustomerId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);

  // Pull to refresh state
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchCustomersList();
      // If a customer is expanded, also refresh their payment history
      if (expandedCustomerId) {
        await fetchCustomerPaymentsList(expandedCustomerId);
      }
    } catch (err: any) {
      console.error('Error refreshing ledger:', err);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCustomersList, expandedCustomerId, fetchCustomerPaymentsList]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      await fetchCustomersList();
    } catch (err: any) {
      console.error('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTodayString = () => {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const parseDateString = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        if (!isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    } catch (e) {
      console.error('Error parsing date:', e);
    }
    return new Date().toISOString();
  };

  const openPaymentModal = (customer: Customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setIsOnline(false);
    setOnlineMethod('GPay');
    setPaymentDate(getTodayString());
    setModalVisible(true);
  };

  const handleSavePayment = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(paymentAmount);

    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid payment amount greater than 0.');
      return;
    }

    // Validate paymentDate format (DD-MM-YYYY)
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (paymentDate && !dateRegex.test(paymentDate)) {
      Alert.alert('Invalid Date Format', 'Please enter date in DD-MM-YYYY format.');
      return;
    }

    try {
      setSubmitting(true);
      const isoDate = paymentDate ? parseDateString(paymentDate) : new Date().toISOString();
      const finalMode = isOnline ? onlineMethod : 'Cash';
      
      await recordCustomerPayment(selectedCustomer.id, amount, finalMode, isoDate);
      
      // Re-fetch customer payments list to update history list dynamically
      try {
        await fetchCustomerPaymentsList(selectedCustomer.id);
      } catch (historyErr) {
        console.error('Error updating history:', historyErr);
      }

      Alert.alert(
        'Payment Recorded',
        `Successfully recorded payment of ${formatCurrency(amount)} via ${finalMode} for "${selectedCustomer.name}".`
      );
      setModalVisible(false);
      setSelectedCustomer(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleExpandCustomer = async (customerId: string) => {
    if (expandedCustomerId === customerId) {
      setExpandedCustomerId(null);
    } else {
      setExpandedCustomerId(customerId);
      try {
        setHistoryLoading(customerId);
        await fetchCustomerPaymentsList(customerId);
      } catch (err: any) {
        console.error('Error fetching payments:', err);
      } finally {
        setHistoryLoading(null);
      }
    }
  };

  // Filter customers by search
  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Totals calculations
  const totalBilledAll = customers.reduce((sum, c) => sum + c.totalBilled, 0);
  const totalReceivedAll = customers.reduce((sum, c) => sum + c.totalReceived, 0);
  const totalPendingAll = Math.max(0, totalBilledAll - totalReceivedAll);

  // Formatting Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Customer Ledger</Text>
        <Text style={styles.subtitle}>Track pending payments and clear balances</Text>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <InputField
          label="Search Customers"
          placeholder="Search by customer name or address..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          iconName="search-outline"
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Summary Cards */}
      <View style={styles.summaryContainer}>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'rgba(212, 175, 55, 0.15)' }}>
          <Text style={styles.summaryLabel}>TOTAL BILLED</Text>
          <Text style={styles.summaryValue}>{formatCurrency(totalBilledAll)}</Text>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'rgba(52, 199, 89, 0.15)' }}>
          <Text style={styles.summaryLabel}>RECEIVED</Text>
          <Text style={[styles.summaryValue, { color: '#34C759' }]}>{formatCurrency(totalReceivedAll)}</Text>
        </GlassCard>
        <GlassCard style={{ ...styles.summaryCard, borderColor: 'rgba(255, 75, 75, 0.15)' }}>
          <Text style={styles.summaryLabel}>PENDING</Text>
          <Text style={[styles.summaryValue, { color: '#FF4B4B' }]}>{formatCurrency(totalPendingAll)}</Text>
        </GlassCard>
      </View>

      {loading && customers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Loading ledger records...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#D4AF37"
              colors={['#D4AF37']}
            />
          }
        >
          {filteredCustomers.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Ionicons name="people-outline" size={40} color="rgba(212, 175, 55, 0.4)" />
              <Text style={styles.emptyText}>No customers found matching your search.</Text>
            </GlassCard>
          ) : (
            filteredCustomers.map((customer) => {
              const hasPending = customer.pendingAmount > 0;
              const isExpanded = expandedCustomerId === customer.id;
              
              return (
                <GlassCard
                  key={customer.id}
                  style={styles.customerCard}
                  goldBorder={hasPending}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.customerDetails}>
                      <Text style={styles.customerName}>{customer.name}</Text>
                      {customer.address ? (
                        <Text style={styles.customerAddress} numberOfLines={1}>
                          <Ionicons name="location-outline" size={11} /> {customer.address}
                        </Text>
                      ) : null}
                      {customer.gstin ? (
                        <Text style={styles.customerGstin}>
                          GSTIN: {customer.gstin}
                        </Text>
                      ) : null}
                    </View>
                    
                    {/* Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        hasPending ? styles.pendingBadge : styles.paidBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          hasPending ? styles.pendingBadgeText : styles.paidBadgeText,
                        ]}
                      >
                        {hasPending ? 'PENDING' : 'CLEARED'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.amountGrid}>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Total Billed</Text>
                      <Text style={styles.amountValue}>{formatCurrency(customer.totalBilled)}</Text>
                    </View>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Total Received</Text>
                      <Text style={[styles.amountValue, { color: '#34C759' }]}>
                        {formatCurrency(customer.totalReceived)}
                      </Text>
                    </View>
                    <View style={styles.amountItem}>
                      <Text style={styles.amountLabel}>Balance Due</Text>
                      <Text
                        style={[
                          styles.amountValue,
                          hasPending ? { color: '#FF4B4B', fontWeight: '800' } : { color: '#A0A0B0' },
                        ]}
                      >
                        {formatCurrency(customer.pendingAmount)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.cardActionRow}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={[styles.historyBtn, isExpanded && styles.historyBtnActive]}
                      onPress={() => toggleExpandCustomer(customer.id)}
                    >
                      <Ionicons 
                        name={isExpanded ? "chevron-up-outline" : "chevron-down-outline"} 
                        size={15} 
                        color={isExpanded ? "#191820" : "#D4AF37"} 
                        style={{ marginRight: 4 }} 
                      />
                      <Text style={[styles.historyBtnText, isExpanded && styles.historyBtnTextActive]}>
                        {isExpanded ? 'Hide History' : 'View History'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.recordPaymentBtn}
                      onPress={() => openPaymentModal(customer)}
                    >
                      <Ionicons name="cash-outline" size={15} color="#191820" style={{ marginRight: 6 }} />
                      <Text style={styles.recordPaymentText}>Record Payment</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Expanded Payment History Logs */}
                  {isExpanded && (
                    <View style={styles.historyContainer}>
                      <View style={styles.historyDivider} />
                      <Text style={styles.historyTitle}>Payment Ledger Logs</Text>
                      
                      {historyLoading === customer.id ? (
                        <View style={styles.historyLoadingBox}>
                          <ActivityIndicator size="small" color="#D4AF37" />
                          <Text style={styles.historyLoadingText}>Fetching payments...</Text>
                        </View>
                      ) : (
                        <View style={styles.historyList}>
                          {!customerPayments[customer.id] || customerPayments[customer.id].length === 0 ? (
                            <Text style={styles.noHistoryText}>No transactions recorded in history.</Text>
                          ) : (
                            customerPayments[customer.id].map((item) => {
                              let formattedDate = '';
                              try {
                                const d = new Date(item.paymentDate);
                                formattedDate = d.toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                });
                              } catch (e) {
                                formattedDate = item.paymentDate;
                              }

                              const isBill = item.type === 'bill';

                              return (
                                <View key={item.id} style={styles.historyItem}>
                                  <View style={styles.historyItemLeft}>
                                    <Text style={styles.historyItemDate}>{formattedDate}</Text>
                                    {isBill ? (
                                      <View style={[
                                        styles.modeBadge,
                                        item.paymentStatus === 'Paid' ? styles.modeBadgePaidBill : styles.modeBadgePendingBill
                                      ]}>
                                        <Text style={styles.modeBadgeText}>
                                          {item.invoiceNumber || 'Bill'} ({item.paymentStatus})
                                        </Text>
                                      </View>
                                    ) : (
                                      <View style={[
                                        styles.modeBadge,
                                        item.paymentMode === 'Cash' ? styles.modeBadgeCash : styles.modeBadgeOnline
                                      ]}>
                                        <Text style={styles.modeBadgeText}>{item.paymentMode}</Text>
                                      </View>
                                    )}
                                  </View>
                                  <Text style={[
                                    styles.historyItemAmount,
                                    isBill ? { color: '#FF4B4B' } : { color: '#34C759' }
                                  ]}>
                                    {isBill ? '-' : '+'} {formatCurrency(item.amount)}
                                  </Text>
                                </View>
                              );
                            })
                          )}
                        </View>
                      )}
                    </View>
                  )}
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Record Payment Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record Customer Payment</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#A0A0B0" />
              </TouchableOpacity>
            </View>

            {/* Modal Body */}
            {selectedCustomer && (
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <View style={styles.modalCustCard}>
                  <Text style={styles.modalCustName}>{selectedCustomer.name}</Text>
                  <Text style={styles.modalCustPending}>
                    Total Balance Due: <Text style={{ color: '#FF4B4B', fontWeight: '800' }}>{formatCurrency(selectedCustomer.pendingAmount)}</Text>
                  </Text>
                </View>

                <InputField
                  label="Payment Amount Received (₹)"
                  placeholder="e.g. 2000"
                  value={paymentAmount}
                  onChangeText={setPaymentAmount}
                  keyboardType="numeric"
                  iconName="cash-outline"
                  autoFocus={true}
                />

                <InputField
                  label="Payment Date (DD-MM-YYYY)"
                  placeholder="DD-MM-YYYY"
                  value={paymentDate}
                  onChangeText={setPaymentDate}
                  iconName="calendar-outline"
                />

                {/* Payment Type Selector */}
                <View style={styles.modalModeSection}>
                  <Text style={styles.modalModeLabel}>Payment Type</Text>
                  <View style={styles.modalModeContainer}>
                    <TouchableOpacity
                      style={[styles.modalModeBtn, !isOnline && styles.modalModeBtnActive]}
                      onPress={() => setIsOnline(false)}
                    >
                      <Text style={[styles.modalModeBtnText, !isOnline && styles.modalModeBtnTextActive]}>
                        Cash
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalModeBtn, isOnline && styles.modalModeBtnActive]}
                      onPress={() => setIsOnline(true)}
                    >
                      <Text style={[styles.modalModeBtnText, isOnline && styles.modalModeBtnTextActive]}>
                        Online
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Online Sub-Method Selection */}
                {isOnline && (
                  <View style={styles.modalModeSection}>
                    <Text style={styles.modalModeLabel}>Online Platform Selection</Text>
                    <View style={styles.modalModeContainer}>
                      {(['GPay', 'PhonePe', 'Paytm'] as const).map((method) => (
                        <TouchableOpacity
                          key={method}
                          style={[
                            styles.modalModeBtn,
                            onlineMethod === method && styles.modalModeBtnActiveOnline
                          ]}
                          onPress={() => setOnlineMethod(method)}
                        >
                          <Text
                            style={[
                              styles.modalModeBtnText,
                              onlineMethod === method && styles.modalModeBtnTextActiveOnline
                            ]}
                          >
                            {method}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalCancelBtn]}
                    onPress={() => setModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.modalSaveBtn, submitting && { opacity: 0.6 }]}
                    onPress={handleSavePayment}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator size="small" color="#191820" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle-outline" size={18} color="#191820" style={{ marginRight: 6 }} />
                        <Text style={styles.modalSaveText}>Save Payment</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
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
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  searchInput: {
    marginVertical: 0,
  },
  summaryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
    marginTop: 6,
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  summaryValue: {
    color: '#D4AF37',
    fontSize: 14,
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
  customerCard: {
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  customerDetails: {
    flex: 1,
    paddingRight: 8,
  },
  customerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  customerAddress: {
    color: '#A0A0B0',
    fontSize: 11,
    marginTop: 4,
    alignItems: 'center',
  },
  customerGstin: {
    color: '#D4AF37',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  pendingBadge: {
    backgroundColor: 'rgba(255, 75, 75, 0.08)',
    borderColor: 'rgba(255, 75, 75, 0.2)',
  },
  paidBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderColor: 'rgba(52, 199, 89, 0.2)',
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pendingBadgeText: {
    color: '#FF4B4B',
  },
  paidBadgeText: {
    color: '#34C759',
  },
  cardDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 12,
  },
  amountGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  amountItem: {
    flex: 1,
  },
  amountLabel: {
    color: '#6e6e7c',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountValue: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cardActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.2,
    borderColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  historyBtnActive: {
    backgroundColor: '#D4AF37',
  },
  historyBtnText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '700',
  },
  historyBtnTextActive: {
    color: '#191820',
  },
  recordPaymentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  recordPaymentText: {
    color: '#191820',
    fontSize: 12,
    fontWeight: '700',
  },
  
  // History Logs styling
  historyContainer: {
    marginTop: 14,
  },
  historyDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 12,
  },
  historyTitle: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  historyLoadingBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyLoadingText: {
    color: '#6e6e7c',
    fontSize: 11,
    marginTop: 4,
  },
  historyList: {
    gap: 8,
  },
  noHistoryText: {
    color: '#6e6e7c',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  historyItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyItemDate: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  modeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  modeBadgeCash: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  modeBadgeOnline: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  modeBadgePaidBill: {
    backgroundColor: 'rgba(52, 199, 89, 0.12)',
  },
  modeBadgePendingBill: {
    backgroundColor: 'rgba(255, 75, 75, 0.12)',
  },
  modeBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    opacity: 0.8,
  },
  historyItemAmount: {
    color: '#34C759',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#24242a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: 16,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    width: '100%',
  },
  modalCustCard: {
    backgroundColor: '#191820',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  modalCustName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalCustPending: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  modalModeSection: {
    marginVertical: 8,
  },
  modalModeLabel: {
    color: '#A0A0B0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    marginLeft: 4,
  },
  modalModeContainer: {
    flexDirection: 'row',
    backgroundColor: '#191820',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 4,
  },
  modalModeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  modalModeBtnActive: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: '#D4AF37',
  },
  modalModeBtnActiveOnline: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    borderWidth: 1,
    borderColor: '#34C759',
  },
  modalModeBtnText: {
    color: '#6e6e7c',
    fontSize: 12,
    fontWeight: '700',
  },
  modalModeBtnTextActive: {
    color: '#D4AF37',
  },
  modalModeBtnTextActiveOnline: {
    color: '#34C759',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    marginBottom: 10,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalCancelText: {
    color: '#A0A0B0',
    fontSize: 13,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#D4AF37',
    flex: 1,
  },
  modalSaveText: {
    color: '#191820',
    fontSize: 13,
    fontWeight: '700',
  },
});
