import { Platform } from 'react-native';

/**
 * API Connection URL Configuration.
 * 
 * - iOS Simulator / Web: http://localhost:5000
 * - Android Emulator: http://10.0.2.2:5000 (maps to your computer's localhost)
 * - Physical test device: Replace with your PC's local Wi-Fi IP (e.g., http://192.168.1.15:5000)
 * - Production: Replace with your deployed server URL (e.g., https://your-backend.onrender.com)
 */
const LOCAL_API_URL = Platform.select({
  android: 'https://dr-agencies-billing.vercel.app', // Points to localhost on Android Emulator
  ios: 'https://dr-agencies-billing.vercel.app',
  default: 'https://dr-agencies-billing.vercel.app',
});

// Uses local server in development, Vercel in production
export const API_URL = LOCAL_API_URL;
