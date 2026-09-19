import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { useAlert } from '@/context/AlertContext';
import { useBilling } from '@/context/BillingContext';
import {
  AppEnvironment,
  LIVE_API_URL,
  TEST_API_URL,
  getCurrentEnvironment,
  loadStoredEnvironment,
  setAppEnvironment,
} from '@/constants/Api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useBilling();
  const { showError } = useAlert();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Environment State (LIVE vs TEST)
  const [environment, setEnvironment] = useState<AppEnvironment>(getCurrentEnvironment());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    loadStoredEnvironment().then((savedEnv) => {
      setEnvironment(savedEnv);
    });
  }, []);

  const handleSelectEnvironment = async (env: AppEnvironment) => {
    setEnvironment(env);
    setIsDropdownOpen(false);
    await setAppEnvironment(env);
  };

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim()) {
      newErrors.email = 'Email or Mobile Number is required';
    } else if (email.includes('@') && !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    } else if (!email.includes('@') && email.length < 10 && isNaN(Number(email))) {
      newErrors.email = 'Please enter a valid email or 10-digit mobile number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 4) {
      newErrors.password = 'Password must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    try {
      const success = await login(email, password);
      if (success) {
        // Successful login
        router.replace('/(tabs)');
      } else {
        showError(
          'Login Failed',
          `Invalid credentials for ${environment === 'LIVE' ? 'Live' : 'Testing'} server. Please check your login details.`
        );
      }
    } catch (err) {
      showError('Login Error', 'Something went wrong. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLive = environment === 'LIVE';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        {/* Top Spacer */}
        <View style={styles.logoContainer}>
          {/* Glowing Emblem */}
          <View style={styles.logoBadge}>
            <Text style={styles.logoLetter}>DR</Text>
          </View>
          <Text style={styles.logoTitle}>D R AGENCIES</Text>
          <Text style={styles.logoSubtitle}>GST Billing Portal</Text>
        </View>

        {/* Input Card */}
        <GlassCard style={styles.card}>
          <Text style={styles.welcomeText}>Welcome Back</Text>
          <Text style={styles.subWelcomeText}>Sign in to manage your billing</Text>

          {/* Environment Selector Dropdown */}
          <View style={styles.envSection}>
            <Text style={styles.envLabel}>SERVER ENVIRONMENT</Text>
            
            <TouchableOpacity
              style={[
                styles.envSelector,
                isLive ? styles.envSelectorLive : styles.envSelectorTest,
              ]}
              activeOpacity={0.8}
              onPress={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <View style={styles.envSelectorLeft}>
                <View
                  style={[
                    styles.envDot,
                    { backgroundColor: isLive ? '#22C55E' : '#F59E0B' },
                  ]}
                />
                <View>
                  <Text style={styles.envSelectorText}>
                    {isLive ? 'Live Server (Production)' : 'Testing Server (Staging)'}
                  </Text>
                  <Text style={styles.envSelectorUrl} numberOfLines={1}>
                    {isLive ? LIVE_API_URL : TEST_API_URL}
                  </Text>
                </View>
              </View>
              <Ionicons
                name={isDropdownOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#D4AF37"
              />
            </TouchableOpacity>

            {/* Dropdown Options Menu */}
            {isDropdownOpen && (
              <View style={styles.dropdownMenu}>
                {/* Live Option */}
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    isLive && styles.dropdownItemActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectEnvironment('LIVE')}
                >
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.envDot, { backgroundColor: '#22C55E' }]} />
                    <View>
                      <Text
                        style={[
                          styles.dropdownItemTitle,
                          isLive && styles.dropdownItemTitleActive,
                        ]}
                      >
                        Live Server (Production)
                      </Text>
                      <Text style={styles.dropdownItemDesc}>
                        Live client data (yuvi12@gmail.com)
                      </Text>
                    </View>
                  </View>
                  {isLive && <Ionicons name="checkmark-circle" size={18} color="#22C55E" />}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dropdownDivider} />

                {/* Testing Option */}
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    !isLive && styles.dropdownItemActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectEnvironment('TEST')}
                >
                  <View style={styles.dropdownItemLeft}>
                    <View style={[styles.envDot, { backgroundColor: '#F59E0B' }]} />
                    <View>
                      <Text
                        style={[
                          styles.dropdownItemTitle,
                          !isLive && styles.dropdownItemTitleActive,
                        ]}
                      >
                        Testing Server (Staging)
                      </Text>
                      <Text style={styles.dropdownItemDesc}>
                        Safe testing for bills, stock & test users
                      </Text>
                    </View>
                  </View>
                  {!isLive && <Ionicons name="checkmark-circle" size={18} color="#F59E0B" />}
                </TouchableOpacity>
              </View>
            )}

            {/* Status Hint Badge */}
            <View
              style={[
                styles.envBadge,
                isLive ? styles.envBadgeLive : styles.envBadgeTest,
              ]}
            >
              <Ionicons
                name={isLive ? 'shield-checkmark-outline' : 'flask-outline'}
                size={14}
                color={isLive ? '#22C55E' : '#F59E0B'}
              />
              <Text
                style={[
                  styles.envBadgeText,
                  { color: isLive ? '#22C55E' : '#F59E0B' },
                ]}
              >
                {isLive
                  ? 'Connected to Live Server'
                  : 'Testing Mode Active • Safe from Live Data'}
              </Text>
            </View>
          </View>

          <InputField
            label="Email or Mobile Number"
            placeholder="e.g. sales@dragencies.com or 9876543210"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
            }}
            iconName="person-outline"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <InputField
            label="Password"
            placeholder="••••••••"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
            }}
            iconName="lock-closed-outline"
            secureTextEntry
            autoCapitalize="none"
            error={errors.password}
          />

          {/* Remember me & Forgot Password */}
          <View style={styles.optionsRow}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              activeOpacity={0.8}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                {rememberMe && <Ionicons name="checkmark" size={14} color="#191820" />}
              </View>
              <Text style={styles.checkboxLabel}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          <GoldButton
            title={isLive ? 'LOG IN TO LIVE' : 'LOG IN TO TEST'}
            onPress={handleLogin}
            loading={isLoading}
            style={styles.button}
          />
        </GlassCard>

        {/* Footer info */}
        <Text style={styles.footerText}>Secure, Fast & GST Compliant Billing System</Text>
        <Text style={styles.footerVersion}>v1.0.0</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoBadge: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#24242a',
    borderWidth: 2,
    borderColor: '#D4AF37',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#D4AF37',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  logoLetter: {
    color: '#D4AF37',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  logoTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 2,
  },
  logoSubtitle: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 3,
    marginTop: 6,
  },
  card: {
    padding: 20,
    width: '100%',
  },
  welcomeText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  subWelcomeText: {
    color: '#A0A0B0',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  envSection: {
    marginBottom: 18,
  },
  envLabel: {
    color: '#A0A0B0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 6,
  },
  envSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#15151b',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
  },
  envSelectorLive: {
    borderColor: '#22C55E40',
  },
  envSelectorTest: {
    borderColor: '#F59E0B60',
  },
  envSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  envDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  envSelectorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  envSelectorUrl: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  dropdownMenu: {
    backgroundColor: '#1F1F28',
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#3F3F46',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: '#272733',
  },
  dropdownItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dropdownItemTitle: {
    color: '#D4D4D8',
    fontSize: 13,
    fontWeight: '600',
  },
  dropdownItemTitleActive: {
    color: '#FFFFFF',
  },
  dropdownItemDesc: {
    color: '#71717A',
    fontSize: 11,
    marginTop: 2,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#2E2E38',
  },
  envBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  envBadgeLive: {
    backgroundColor: '#22C55E15',
  },
  envBadgeTest: {
    backgroundColor: '#F59E0B15',
  },
  envBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 14,
    paddingHorizontal: 2,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#A0A0B0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxActive: {
    backgroundColor: '#D4AF37',
    borderColor: '#D4AF37',
  },
  checkboxLabel: {
    color: '#A0A0B0',
    fontSize: 14,
    fontWeight: '500',
  },
  forgotText: {
    color: '#D4AF37',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    marginTop: 10,
  },
  footerText: {
    color: '#6e6e7c',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 40,
    fontWeight: '500',
  },
  footerVersion: {
    color: '#4e4e58',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 6,
  },
});

