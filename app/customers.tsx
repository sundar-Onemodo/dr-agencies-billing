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
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling } from '@/context/BillingContext';
import { useAlert } from '@/context/AlertContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { Customer } from '@/store/slices/customerSlice';

export default function CustomersScreen() {
  const router = useRouter();
  const {
    customers,
    fetchCustomersList,
    addCustomer,
    updateCustomer,
  } = useBilling();
  const { showSuccess, showUpdate, showWarning, showError } = useAlert();

  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Add / Edit Customer Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState('');
  const [custAddress, setCustAddress] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custGstin, setCustGstin] = useState('');
  const [custState, setCustState] = useState('Tamil Nadu');
  const [submittingCustomer, setSubmittingCustomer] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      await fetchCustomersList();
    } catch (err: any) {
      console.warn('Error loading customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchCustomersList();
    } catch (err) {
      console.warn('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Open Add Customer Modal
  const openAddModal = () => {
    setEditingCustomer(null);
    setCustName('');
    setCustAddress('');
    setCustPhone('');
    setCustGstin('');
    setCustState('Tamil Nadu');
    setModalVisible(true);
  };

  // Open Edit Customer Modal
  const openEditModal = (customer: Customer) => {
    setEditingCustomer(customer);
    setCustName(customer.name || '');
    setCustAddress(customer.address || '');
    setCustPhone(customer.phone || '');
    setCustGstin(customer.gstin || '');
    setCustState(customer.state || 'Tamil Nadu');
    setModalVisible(true);
  };

  // Handle Save (Add or Edit) Customer with Duplicate Prevention
  const handleSaveCustomer = async () => {
    const trimmedName = custName.trim();
    const trimmedPhone = custPhone.trim();

    if (!trimmedName) {
      showWarning('Validation Error', 'Please enter the Customer / Business Name.');
      return;
    }

    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      showWarning('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return;
    }

    // Duplicate checks
    if (editingCustomer) {
      // Check if another customer already has this name
      const duplicateByName = customers.find(
        (c) => c.id !== editingCustomer.id && c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateByName) {
        showWarning(
          'Duplicate Customer Name',
          `Another customer named "${trimmedName}" already exists in your directory.`
        );
        return;
      }

      // Check if another customer already has this phone
      if (trimmedPhone) {
        const duplicateByPhone = customers.find(
          (c) => c.id !== editingCustomer.id && c.phone && c.phone.trim() === trimmedPhone
        );
        if (duplicateByPhone) {
          showWarning(
            'Duplicate Contact Number',
            `Contact number "${trimmedPhone}" is already assigned to "${duplicateByPhone.name}".`
          );
          return;
        }
      }
    } else {
      // Add mode duplicate checks
      const duplicateByName = customers.find(
        (c) => c.name.trim().toLowerCase() === trimmedName.toLowerCase()
      );
      if (duplicateByName) {
        showWarning(
          'Duplicate Customer',
          `A customer named "${trimmedName}" already exists in your directory.\n\nAddress: ${duplicateByName.address || 'N/A'}`
        );
        return;
      }

      if (trimmedPhone) {
        const duplicateByPhone = customers.find(
          (c) => c.phone && c.phone.trim() === trimmedPhone
        );
        if (duplicateByPhone) {
          showWarning(
            'Duplicate Contact Number',
            `Contact number "${trimmedPhone}" is already registered to "${duplicateByPhone.name}".`
          );
          return;
        }
      }
    }

    try {
      setSubmittingCustomer(true);
      if (editingCustomer) {
        await updateCustomer({
          id: editingCustomer.id,
          name: trimmedName,
          phone: trimmedPhone,
          address: custAddress.trim(),
          gstin: custGstin.trim().toUpperCase(),
          state: custState.trim() || 'Tamil Nadu',
        });
        showUpdate('Customer Updated', `"${trimmedName}" profile details have been updated successfully.`, undefined, 'checkmark-done-circle');
      } else {
        await addCustomer({
          name: trimmedName,
          phone: trimmedPhone,
          address: custAddress.trim(),
          gstin: custGstin.trim().toUpperCase(),
          state: custState.trim() || 'Tamil Nadu',
        });
        showSuccess('Customer Added', `"${trimmedName}" has been added to your Customer Directory successfully.`, undefined, 'person-add');
      }

      setModalVisible(false);
      setEditingCustomer(null);
    } catch (err: any) {
      showError('Error', err.message || 'Failed to save customer');
    } finally {
      setSubmittingCustomer(false);
    }
  };

  // Filter customers by search
  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q)) ||
      (c.gstin && c.gstin.toLowerCase().includes(q)) ||
      (c.state && c.state.toLowerCase().includes(q))
    );
  });

  const gstCount = customers.filter((c) => !!c.gstin && c.gstin.trim().length > 0).length;
  const uniqueStatesCount = new Set(customers.map((c) => (c.state || 'Tamil Nadu').trim())).size;

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#D4AF37" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.navTitle}>Customers Directory</Text>
          <Text style={styles.navSubtitle}>{customers.length} Registered Accounts</Text>
        </View>
        <TouchableOpacity style={styles.navAddBtn} onPress={openAddModal} activeOpacity={0.8}>
          <Ionicons name="person-add" size={15} color="#191820" style={{ marginRight: 5 }} />
          <Text style={styles.navAddBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <InputField
          label="Search Directory"
          placeholder="Search by name, phone no, address or GSTIN..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          iconName="search-outline"
          showClearButton={true}
          onClear={() => setSearchQuery('')}
          containerStyle={{ marginVertical: 0 }}
        />
      </View>

      {/* Directory Summary Strip */}
      <View style={styles.summaryContainer}>
        <GlassCard style={styles.summaryCard}>
          <Ionicons name="people" size={16} color="#D4AF37" style={{ marginBottom: 2 }} />
          <Text style={styles.summaryLabel}>TOTAL CUSTOMERS</Text>
          <Text style={styles.summaryValue}>{customers.length}</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Ionicons name="shield-checkmark" size={16} color="#34C759" style={{ marginBottom: 2 }} />
          <Text style={styles.summaryLabel}>GST REGISTERED</Text>
          <Text style={[styles.summaryValue, { color: '#34C759' }]}>{gstCount}</Text>
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Ionicons name="map" size={16} color="#4DA6FF" style={{ marginBottom: 2 }} />
          <Text style={styles.summaryLabel}>REGIONS / STATES</Text>
          <Text style={[styles.summaryValue, { color: '#4DA6FF' }]}>{uniqueStatesCount}</Text>
        </GlassCard>
      </View>

      {/* Quick Ledger Navigation Banner */}
      <TouchableOpacity
        style={styles.ledgerBanner}
        onPress={() => router.push('/(tabs)/payments')}
        activeOpacity={0.85}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <View style={styles.ledgerBannerIconBox}>
            <Ionicons name="wallet-outline" size={18} color="#D4AF37" />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.ledgerBannerTitle}>Looking for Sales & Payment Ledger?</Text>
            <Text style={styles.ledgerBannerSubtitle}>View balances, payment logs & download PDF statements</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#D4AF37" />
      </TouchableOpacity>

      {loading && customers.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={styles.loadingText}>Loading customer records...</Text>
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
              <Ionicons name="people-outline" size={48} color="rgba(212, 175, 55, 0.4)" />
              <Text style={styles.emptyTitle}>No Customers Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No matching customer records for this search query.'
                  : 'Start adding your business customers to the directory.'}
              </Text>
              <GoldButton
                title="+ Add New Customer"
                onPress={openAddModal}
                style={{ marginTop: 16 }}
              />
            </GlassCard>
          ) : (
            filteredCustomers.map((customer) => {
              const initial = customer.name ? customer.name.charAt(0).toUpperCase() : 'C';

              return (
                <GlassCard key={customer.id} style={styles.customerCard}>
                  {/* Card Header with Avatar, Name, State and Edit Action */}
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.customerName}>{customer.name}</Text>
                      <View style={styles.stateTag}>
                        <Ionicons name="location" size={10} color="#D4AF37" style={{ marginRight: 3 }} />
                        <Text style={styles.stateTagText}>{customer.state || 'Tamil Nadu'}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.headerEditBtn}
                      onPress={() => openEditModal(customer)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil" size={14} color="#D4AF37" />
                      <Text style={styles.headerEditText}>Edit</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.cardDivider} />

                  {/* Customer Information Details */}
                  <View style={styles.detailsContainer}>
                    {/* Phone Number */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}>
                        <Ionicons name="call-outline" size={14} color="#D4AF37" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>Phone Number</Text>
                        {customer.phone ? (
                          <TouchableOpacity
                            onPress={() => Linking.openURL(`tel:${customer.phone}`)}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.infoValueClickable}>{customer.phone}</Text>
                          </TouchableOpacity>
                        ) : (
                          <Text style={styles.infoValueEmpty}>Not provided</Text>
                        )}
                      </View>
                    </View>

                    {/* Address */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}>
                        <Ionicons name="navigate-outline" size={14} color="#D4AF37" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>Address / Location</Text>
                        <Text style={customer.address ? styles.infoValue : styles.infoValueEmpty}>
                          {customer.address || 'No address specified'}
                        </Text>
                      </View>
                    </View>

                    {/* GSTIN */}
                    <View style={styles.infoRow}>
                      <View style={styles.infoIconBox}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#D4AF37" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.infoLabel}>GSTIN (Tax ID)</Text>
                        {customer.gstin ? (
                          <View style={styles.gstinBadge}>
                            <Text style={styles.gstinBadgeText}>{customer.gstin}</Text>
                          </View>
                        ) : (
                          <Text style={styles.infoValueEmpty}>Unregistered (No GSTIN)</Text>
                        )}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              );
            })
          )}
        </ScrollView>
      )}

      {/* Add / Edit Customer Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  {editingCustomer ? 'Edit Customer Details' : 'Add New Customer'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editingCustomer
                    ? 'Update name, contact, address & tax info'
                    : 'Save new customer profile to directory'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color="#A0A0B0" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              <InputField
                label="Customer / Business Name *"
                placeholder="e.g. Surya Enterprises"
                value={custName}
                onChangeText={setCustName}
                iconName="person"
              />

              <InputField
                label="Contact Number (10 digits)"
                placeholder="e.g. 9876543210"
                value={custPhone}
                onChangeText={(text) => {
                  const sanitized = text.replace(/[^0-9]/g, '');
                  if (sanitized.length <= 10) setCustPhone(sanitized);
                }}
                keyboardType="phone-pad"
                iconName="call-outline"
                maxLength={10}
              />

              <InputField
                label="Address / Location"
                placeholder="e.g. 14 Main Road, Palaganatham"
                value={custAddress}
                onChangeText={setCustAddress}
                iconName="location-outline"
                multiline
              />

              <View style={styles.inputRow}>
                <View style={{ flex: 1.2, marginRight: 10 }}>
                  <InputField
                    label="GSTIN (Optional)"
                    placeholder="e.g. 33AYUPA8362M1ZV"
                    value={custGstin}
                    onChangeText={setCustGstin}
                    autoCapitalize="characters"
                    iconName="shield-checkmark-outline"
                  />
                </View>
                <View style={{ flex: 0.9 }}>
                  <InputField
                    label="State"
                    placeholder="Tamil Nadu"
                    value={custState}
                    onChangeText={setCustState}
                    iconName="map-outline"
                  />
                </View>
              </View>

              <View style={styles.modalActionButtons}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSaveBtn, submittingCustomer && { opacity: 0.6 }]}
                  onPress={handleSaveCustomer}
                  disabled={submittingCustomer}
                >
                  {submittingCustomer ? (
                    <ActivityIndicator size="small" color="#191820" />
                  ) : (
                    <>
                      <Ionicons
                        name={editingCustomer ? 'checkmark-circle' : 'person-add'}
                        size={16}
                        color="#191820"
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.modalSaveText}>
                        {editingCustomer ? 'Update Customer' : 'Save Customer'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(212, 175, 55, 0.15)',
    marginTop: Platform.OS === 'android' ? 24 : 0,
  },
  backBtn: {
    padding: 6,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  navSubtitle: {
    fontSize: 11,
    color: '#D4AF37',
    fontWeight: '600',
  },
  navAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D4AF37',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 8,
  },
  navAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#191820',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginVertical: 6,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  summaryLabel: {
    fontSize: 8,
    color: '#A0A0B0',
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
    marginBottom: 2,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#D4AF37',
  },
  ledgerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    padding: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  ledgerBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ledgerBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ledgerBannerSubtitle: {
    fontSize: 10,
    color: '#A0A0B0',
    marginTop: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#A0A0B0',
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 12,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#A0A0B0',
    textAlign: 'center',
    lineHeight: 18,
  },
  customerCard: {
    marginBottom: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '800',
    color: '#D4AF37',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  stateTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(212, 175, 55, 0.25)',
    marginTop: 3,
  },
  stateTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#D4AF37',
  },
  headerEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  headerEditText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D4AF37',
    marginLeft: 3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
    marginVertical: 12,
  },
  detailsContainer: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  infoLabel: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  infoValue: {
    fontSize: 13,
    color: '#E0E0E0',
    fontWeight: '500',
    marginTop: 1,
    lineHeight: 17,
  },
  infoValueClickable: {
    fontSize: 13,
    color: '#D4AF37',
    fontWeight: '700',
    marginTop: 1,
  },
  infoValueEmpty: {
    fontSize: 12,
    color: '#666675',
    fontStyle: 'italic',
    marginTop: 1,
  },
  gstinBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'rgba(52, 199, 89, 0.3)',
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  gstinBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#34C759',
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1E28',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#A0A0B0',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  modalBody: {
    maxHeight: 480,
  },
  modalActionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    marginBottom: 24,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A0A0B0',
  },
  modalSaveBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#191820',
  },
});
