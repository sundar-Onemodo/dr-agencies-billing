import { GlassCard } from '@/components/ui/GlassCard';
import { GoldButton } from '@/components/ui/GoldButton';
import { InputField } from '@/components/ui/InputField';
import { useBilling } from '@/context/BillingContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
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

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
        Alert.alert('Error', 'Invalid credentials. Please enter any email and 4+ character password.');
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            title="LOG IN"
            onPress={handleLogin}
            loading={isLoading}
            style={styles.button}
          />
        </GlassCard>

        {/* Footer info */}
        <Text style={styles.footerText}>Secure, Fast & GST Compliant Billing System</Text>
        <Text style={styles.footerVersion}>v1.0.0 (Expo)</Text>
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
    marginBottom: 32,
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
    // Accent shadow
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
    marginBottom: 20,
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
