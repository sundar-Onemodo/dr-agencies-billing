import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Backend API URLs
 */
export const LIVE_API_URL = 'https://dr-agencies-billing.vercel.app';
export const TEST_API_URL = 'https://dr-agencies-billing-test.vercel.app';

export type AppEnvironment = 'LIVE' | 'TEST';

export const ENV_STORAGE_KEY = '@dr_agencies_environment';

// Default active environment
let currentEnvironment: AppEnvironment = 'LIVE';
let activeApiUrl: string = LIVE_API_URL;

/**
 * Dynamic object that stringifies to current activeApiUrl.
 * Works seamlessly in template literals `${API_URL}/endpoint` without restarting the app.
 */
class DynamicApiUrl {
  toString(): string {
    return activeApiUrl;
  }
  valueOf(): string {
    return activeApiUrl;
  }
  [Symbol.toPrimitive](): string {
    return activeApiUrl;
  }
}

export const API_URL = new DynamicApiUrl() as unknown as string;

export const getApiUrl = (): string => activeApiUrl;

export const getCurrentEnvironment = (): AppEnvironment => currentEnvironment;

export const setAppEnvironment = async (env: AppEnvironment): Promise<void> => {
  currentEnvironment = env;
  activeApiUrl = env === 'TEST' ? TEST_API_URL : LIVE_API_URL;
  try {
    await AsyncStorage.setItem(ENV_STORAGE_KEY, env);
  } catch (e) {
    console.error('Failed to save environment:', e);
  }
};

export const loadStoredEnvironment = async (): Promise<AppEnvironment> => {
  try {
    const savedEnv = await AsyncStorage.getItem(ENV_STORAGE_KEY);
    if (savedEnv === 'TEST' || savedEnv === 'LIVE') {
      currentEnvironment = savedEnv;
      activeApiUrl = savedEnv === 'TEST' ? TEST_API_URL : LIVE_API_URL;
      return savedEnv;
    }
  } catch (e) {
    console.error('Failed to load environment:', e);
  }
  return currentEnvironment;
};

