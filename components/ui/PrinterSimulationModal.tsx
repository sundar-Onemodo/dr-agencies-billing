import { useBilling } from '@/context/BillingContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BluetoothManager } from 'react-native-bluetooth-escpos-printer';
import { GoldButton } from './GoldButton';

interface PrinterSimulationModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SimulatedPrinter {
  id: string;
  name: string;
  address?: string;
  type: 'Bluetooth' | 'WiFi';
  status: 'available' | 'connected';
}

export const PrinterSimulationModal: React.FC<PrinterSimulationModalProps> = ({ visible, onClose }) => {
  const { printerSettings, updatePrinterSettings } = useBilling();
  const [isSearching, setIsSearching] = useState(false);
  const [printers, setPrinters] = useState<SimulatedPrinter[]>([]);

  const simulatedDevices: SimulatedPrinter[] = [
    { id: 'pr-0', name: 'Standard 58mm Thermal', type: 'Bluetooth', status: 'available' },
    { id: 'pr-1', name: 'TVS RP-3200 Thermal', type: 'Bluetooth', status: 'available' },
    { id: 'pr-2', name: 'EPSON TM-T82III (80mm)', type: 'Bluetooth', status: 'available' },
    { id: 'pr-3', name: 'NGX BTP-320 Mobile Printer', type: 'Bluetooth', status: 'available' },
    { id: 'pr-4', name: 'HP LaserJet M1005 (A4)', type: 'WiFi', status: 'available' },
  ];

  useEffect(() => {
    if (visible) {
      startSearch();
    }
  }, [visible]);

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      if (Platform.Version >= 31) {
        // Android 12+ permissions
        const scanGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          {
            title: 'Bluetooth Scan Permission',
            message: 'DR Agencies needs Bluetooth scanning permission to search for nearby thermal printers.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const connectGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          {
            title: 'Bluetooth Connect Permission',
            message: 'DR Agencies needs Bluetooth connection permission to connect to your thermal printer.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        const locationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth scanning requires Location permission on Android.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return (
          scanGranted === PermissionsAndroid.RESULTS.GRANTED &&
          connectGranted === PermissionsAndroid.RESULTS.GRANTED &&
          locationGranted === PermissionsAndroid.RESULTS.GRANTED
        );
      } else {
        // Android 11 and below
        const locationGranted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Bluetooth scanning requires Location permission.',
            buttonNeutral: 'Ask Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return locationGranted === PermissionsAndroid.RESULTS.GRANTED;
      }
    } catch (err) {
      console.warn('Bluetooth permission request failed:', err);
      return false;
    }
  };

  const startSearch = async () => {
    setIsSearching(true);
    setPrinters([]);

    // Fallback: If BluetoothManager is not defined (e.g. on Expo Web or iOS without native bridging)
    if (!BluetoothManager) {
      console.log('BluetoothManager not available. Running simulation mode.');
      runSimulationScan();
      return;
    }

    const hasPermissions = await requestBluetoothPermissions();
    if (!hasPermissions) {
      Alert.alert(
        'Permissions Required',
        'Bluetooth permissions are required to scan for real devices. Tapping OK will show simulator devices.',
        [
          { text: 'OK', onPress: () => runSimulationScan() },
          { text: 'Cancel', onPress: () => setIsSearching(false), style: 'cancel' }
        ]
      );
      return;
    }

    try {
      const isEnabled = await BluetoothManager.checkBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Disabled',
          'Please turn on Bluetooth to scan for printers. Tapping OK will show simulator devices.',
          [
            { text: 'OK', onPress: () => runSimulationScan() },
            { text: 'Cancel', onPress: () => setIsSearching(false), style: 'cancel' }
          ]
        );
        return;
      }

      const scanResultStr = await BluetoothManager.scanDevices();
      const scanResult = JSON.parse(scanResultStr);
      
      const foundList = typeof scanResult.found === 'string' ? JSON.parse(scanResult.found) : (scanResult.found || []);
      const pairedList = typeof scanResult.paired === 'string' ? JSON.parse(scanResult.paired) : (scanResult.paired || []);
      
      const combined = [...pairedList, ...foundList];
      
      const mappedDevices: SimulatedPrinter[] = combined.map((d: any) => ({
        id: d.address,
        name: d.name || 'Unnamed Bluetooth Device',
        address: d.address,
        type: 'Bluetooth',
        status: printerSettings.connectedPrinterAddress === d.address ? 'connected' : 'available',
      }));

      // Remove duplicate MAC addresses
      const uniqueDevices = mappedDevices.filter((value, index, self) =>
        index === self.findIndex((t) => t.address === value.address)
      );

      setPrinters(uniqueDevices);
      setIsSearching(false);
    } catch (error) {
      console.warn('Real Bluetooth scan failed, running simulation:', error);
      runSimulationScan();
    }
  };

  const runSimulationScan = () => {
    setTimeout(() => {
      setPrinters(
        simulatedDevices.map((d) =>
          d.name === printerSettings.connectedPrinter ? { ...d, status: 'connected' } : d
        )
      );
      setIsSearching(false);
    }, 1500);
  };

  const handleConnect = async (printer: SimulatedPrinter) => {
    const isCurrentlyConnected = printerSettings.connectedPrinterAddress === printer.address || 
                                 (printer.name && printerSettings.connectedPrinter === printer.name);

    if (isCurrentlyConnected) {
      // Disconnect
      if (BluetoothManager && printer.address) {
        try {
          await BluetoothManager.disconnect();
        } catch (err) {
          console.warn('Failed to disconnect from bluetooth printer:', err);
        }
      }
      updatePrinterSettings({ connectedPrinter: null, connectedPrinterAddress: null });
      setPrinters((prev) =>
        prev.map((p) => (p.id === printer.id ? { ...p, status: 'available' } : p))
      );
      Alert.alert('Disconnected', `Disconnected from ${printer.name}`);
    } else {
      // Connect
      if (BluetoothManager && printer.address) {
        setIsSearching(true);
        try {
          await BluetoothManager.connect(printer.address);
          updatePrinterSettings({ 
            connectedPrinter: printer.name, 
            connectedPrinterAddress: printer.address 
          });
          setPrinters((prev) =>
            prev.map((p) =>
              p.id === printer.id ? { ...p, status: 'connected' } : { ...p, status: 'available' }
            )
          );
          setIsSearching(false);
          Alert.alert('Connected', `Successfully connected to ${printer.name}`);
        } catch (err) {
          setIsSearching(false);
          console.warn('Bluetooth connection failed:', err);
          Alert.alert(
            'Connection Failed', 
            `Could not connect to ${printer.name}. Please ensure the printer is turned on and paired in your Android Bluetooth system settings.`
          );
        }
      } else {
        // Simulation connect
        updatePrinterSettings({ 
          connectedPrinter: printer.name, 
          connectedPrinterAddress: printer.id 
        });
        setPrinters((prev) =>
          prev.map((p) =>
            p.id === printer.id ? { ...p, status: 'connected' } : { ...p, status: 'available' }
          )
        );
        Alert.alert('Simulated Connected', `Connected to simulated device: ${printer.name}`);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Printer Setup</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Paper Size Selector */}
          <View style={styles.paperSizeContainer}>
            <Text style={styles.sectionTitle}>Paper Width Settings</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.sizeButton,
                  printerSettings.paperSize === '58mm' && styles.activeSizeButton,
                ]}
                onPress={() => updatePrinterSettings({ paperSize: '58mm' })}
              >
                <Ionicons
                  name="receipt-outline"
                  size={16}
                  color={printerSettings.paperSize === '58mm' ? '#191820' : '#A0A0B0'}
                />
                <Text
                  style={[
                    styles.sizeButtonText,
                    printerSettings.paperSize === '58mm' && styles.activeSizeButtonText,
                  ]}
                >
                  58mm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sizeButton,
                  printerSettings.paperSize === '80mm' && styles.activeSizeButton,
                ]}
                onPress={() => updatePrinterSettings({ paperSize: '80mm' })}
              >
                <Ionicons
                  name="receipt-outline"
                  size={16}
                  color={printerSettings.paperSize === '80mm' ? '#191820' : '#A0A0B0'}
                />
                <Text
                  style={[
                    styles.sizeButtonText,
                    printerSettings.paperSize === '80mm' && styles.activeSizeButtonText,
                  ]}
                >
                  80mm
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sizeButton,
                  printerSettings.paperSize === 'A4' && styles.activeSizeButton,
                ]}
                onPress={() => updatePrinterSettings({ paperSize: 'A4' })}
              >
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={printerSettings.paperSize === 'A4' ? '#191820' : '#A0A0B0'}
                />
                <Text
                  style={[
                    styles.sizeButtonText,
                    printerSettings.paperSize === 'A4' && styles.activeSizeButtonText,
                  ]}
                >
                  A4
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Device List Section */}
          <Text style={styles.sectionTitle}>Nearby Devices</Text>

          {isSearching ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text style={styles.loadingText}>Scanning via Bluetooth...</Text>
            </View>
          ) : (
            <FlatList
              data={printers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No compatible printers found.</Text>
              }
              renderItem={({ item }) => {
                const isConnected = printerSettings.connectedPrinter === item.name;
                return (
                  <TouchableOpacity
                    style={[styles.printerCard, isConnected && styles.connectedPrinterCard]}
                    activeOpacity={0.7}
                    onPress={() => handleConnect(item)}
                  >
                    <View style={styles.printerInfo}>
                      <Ionicons
                        name={item.type === 'Bluetooth' ? 'bluetooth' : 'wifi'}
                        size={24}
                        color={isConnected ? '#D4AF37' : '#A0A0B0'}
                        style={styles.printerIcon}
                      />
                      <View>
                        <Text style={[styles.printerName, isConnected && styles.connectedText]}>
                          {item.name}
                        </Text>
                        <Text style={styles.printerType}>
                          {item.type} Connection
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        isConnected ? styles.connectedBadge : styles.availableBadge,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isConnected ? 'Connected' : 'Connect'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}

          {/* Footer Scan Button */}
          {!isSearching && (
            <GoldButton
              title="Rescan Devices"
              variant="outlined"
              onPress={startSearch}
              style={styles.scanButton}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#191820',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: '60%',
    maxHeight: '85%',
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    padding: 4,
  },
  sectionTitle: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  paperSizeContainer: {
    marginBottom: 24,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 12,
  },
  sizeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#24242a',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    height: 45,
  },
  activeSizeButton: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  sizeButtonText: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '600',
  },
  activeSizeButtonText: {
    color: '#191820',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#A0A0B0',
    marginTop: 12,
    fontSize: 14,
  },
  listContainer: {
    paddingBottom: 16,
  },
  printerCard: {
    backgroundColor: '#24242a',
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  connectedPrinterCard: {
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: '#282830',
  },
  printerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  printerIcon: {
    marginRight: 14,
  },
  printerName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  connectedText: {
    color: '#D4AF37',
  },
  printerType: {
    color: '#A0A0B0',
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  availableBadge: {
    backgroundColor: '#1c1c24',
  },
  connectedBadge: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  statusText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#A0A0B0',
    textAlign: 'center',
    paddingVertical: 30,
  },
  scanButton: {
    marginTop: 16,
  },
});
