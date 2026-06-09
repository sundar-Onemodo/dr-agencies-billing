import { useBilling } from '@/context/BillingContext';
import { Redirect } from 'expo-router';
import React from 'react';
import { StyleSheet } from 'react-native';
import LoginScreen from './login';

export default function EntryPoint() {
  const { isAuthenticated } = useBilling();

  // Basic check: direct to appropriate layout
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <LoginScreen/>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191820',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
