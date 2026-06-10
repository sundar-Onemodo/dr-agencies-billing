import { useBilling } from '@/context/BillingContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import LoginScreen from './login';

export default function EntryPoint() {
  const { isAuthenticated, isInitialized } = useBilling();

  // Show a loading indicator until the auth state is restored from storage
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#D4AF37" />
      </View>
    );
  }

  // Basic check: direct to appropriate layout
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <LoginScreen />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
