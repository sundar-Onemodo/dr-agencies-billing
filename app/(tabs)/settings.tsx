import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Platform,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBilling } from '@/context/BillingContext';
import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { PrinterSimulationModal } from '@/components/ui/PrinterSimulationModal';

export default function SettingsScreen() {
  const router = useRouter();
  const {
    companySettings,
    updateCompanySettings,
    printerSettings,
    logout,
    refreshData,
  } = useBilling();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData();
    } catch (e) {
      console.warn('Settings refresh failed:', e);
    } finally {
      setRefreshing(false);
    }
  };

  // Local Form States
  const [name, setName] = useState(companySettings.name);
  const [address, setAddress] = useState(companySettings.address);
  const [gstin, setGstin] = useState(companySettings.gstin);
  const [phone, setPhone] = useState(companySettings.phone);
  const [email, setEmail] = useState(companySettings.email);
  
  // Bank Details States
  const [bankName, setBankName] = useState(companySettings.bankName);
  const [accountName, setAccountName] = useState(companySettings.accountName);
  const [accountNo, setAccountNo] = useState(companySettings.accountNo);
  const [ifsc, setIfsc] = useState(companySettings.ifsc);

  // Synchronize state with loaded companySettings from Redux/context
  useEffect(() => {
    setName(companySettings.name || '');
    setAddress(companySettings.address || '');
    setGstin(companySettings.gstin || '');
    setPhone(companySettings.phone || '');
    setEmail(companySettings.email || '');
    setBankName(companySettings.bankName || '');
    setAccountName(companySettings.accountName || '');
    setAccountNo(companySettings.accountNo || '');
    setIfsc(companySettings.ifsc || '');
  }, [companySettings]);

  // Printer Setup Modal State
  const [printerModalVisible, setPrinterModalVisible] = useState(false);

  // Save Store Details
  const handleSaveSettings = async () => {
    if (!name.trim() || !gstin.trim() || !address.trim()) {
      Alert.alert('Validation Error', 'Company Name, GSTIN, and Address are required.');
      return;
    }

    try {
      await updateCompanySettings({
        name,
        address,
        gstin,
        phone,
        email,
        bankName,
        accountName,
        accountNo,
        ifsc,
      });
      Alert.alert('Settings Saved', 'Business credentials updated successfully!');
    } catch (err: any) {
      Alert.alert('Save Error', err.message || 'Failed to save store profile.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Confirm Logout', 'Are you sure you want to log out of the billing portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure profile, billing, and printer interfaces</Text>
      </View>

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
        {/* Printer Setup Card */}
        <Text style={styles.sectionTitle}>Hardware Integration</Text>
        <GlassCard style={styles.printerCard} goldBorder={!!printerSettings.connectedPrinter}>
          <View style={styles.printerInfoRow}>
            <View style={styles.printerIconBg}>
              <Ionicons
                name="print"
                size={22}
                color={printerSettings.connectedPrinter ? '#D4AF37' : '#A0A0B0'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.printerLabel}>Thermal Printer</Text>
              <Text style={styles.printerStatus}>
                {printerSettings.connectedPrinter
                  ? `Connected: ${printerSettings.connectedPrinter}`
                  : 'Disconnected'}
              </Text>
              <Text style={styles.paperSizeText}>
                Active print layout: <Text style={{ color: '#D4AF37', fontWeight: '700' }}>{printerSettings.paperSize}</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.setupBtn}
              onPress={() => setPrinterModalVisible(true)}
            >
              <Text style={styles.setupBtnText}>Configure</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* Business Credentials Card */}
        <Text style={styles.sectionTitle}>Company Information</Text>
        <GlassCard style={styles.settingsCard}>
          <InputField
            label="Company Display Name"
            value={name}
            onChangeText={setName}
            iconName="business"
          />

          <InputField
            label="GSTIN"
            value={gstin}
            onChangeText={setGstin}
            iconName="shield-checkmark"
            autoCapitalize="characters"
          />

          <InputField
            label="Store Address"
            value={address}
            onChangeText={setAddress}
            iconName="location"
            multiline
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 12 }}>
              <InputField
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                iconName="call"
                keyboardType="phone-pad"
              />
            </View>
            <View style={{ flex: 1.2 }}>
              <InputField
                label="Email ID"
                value={email}
                onChangeText={setEmail}
                iconName="mail"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>
        </GlassCard>

        {/* Bank & Payment Credentials Card */}
        <Text style={styles.sectionTitle}>Payment & Bank Credentials</Text>
        <GlassCard style={styles.settingsCard}>
          <InputField
            label="Bank Name"
            value={bankName}
            onChangeText={setBankName}
            iconName="wallet-outline"
            placeholder="e.g. State Bank of India"
          />

          <InputField
            label="Account Beneficiary Name"
            value={accountName}
            onChangeText={setAccountName}
            iconName="person-outline"
            placeholder="e.g. D R AGENCIES"
          />

          <InputField
            label="Account Number"
            value={accountNo}
            onChangeText={setAccountNo}
            iconName="card-outline"
            keyboardType="numeric"
            placeholder="e.g. 987654321098"
          />

          <InputField
            label="IFSC Code"
            value={ifsc}
            onChangeText={setIfsc}
            iconName="barcode-outline"
            autoCapitalize="characters"
            placeholder="e.g. SBIN0001234"
          />
        </GlassCard>

        {/* Save Action */}
        <GoldButton
          title="Save Store Profile"
          onPress={handleSaveSettings}
          style={styles.saveBtn}
        />

        {/* Logout */}
        <GoldButton
          title="LOG OUT PORTAL"
          variant="danger"
          onPress={handleLogout}
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Printer Modal Setup */}
      <PrinterSimulationModal
        visible={printerModalVisible}
        onClose={() => setPrinterModalVisible(false)}
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4,
  },
  printerCard: {
    padding: 14,
    marginVertical: 4,
  },
  printerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  printerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1c1c24',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  printerLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  printerStatus: {
    color: '#A0A0B0',
    fontSize: 12,
    marginTop: 2,
  },
  paperSizeText: {
    color: '#6e6e7c',
    fontSize: 11,
    marginTop: 4,
  },
  setupBtn: {
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1,
    borderColor: '#D4AF37',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  setupBtnText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '700',
  },
  settingsCard: {
    padding: 14,
    marginVertical: 4,
  },
  row: {
    flexDirection: 'row',
  },
  saveBtn: {
    marginTop: 20,
  },
  logoutBtn: {
    marginTop: 10,
    backgroundColor: '#FF4B4B',
  },
});
