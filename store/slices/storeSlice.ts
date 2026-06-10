import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { API_URL } from '../../constants/Api';
import { RootState } from '../index';

export interface CompanySettings {
  name: string;
  address: string;
  gstin: string;
  phone: string;
  email: string;
  bankName: string;
  accountName: string;
  accountNo: string;
  ifsc: string;
}

interface StoreState {
  profile: CompanySettings;
  loading: boolean;
  error: string | null;
}

const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  name: 'D R AGENCIES',
  address: 'No. 45/A, Commercial Street, Next to SBI, Bangalore - 560001',
  gstin: '29AABCD1234F1Z5',
  phone: '+91 98765 43210',
  email: 'contact@dragencies.com',
  bankName: 'State Bank of India',
  accountName: 'D R AGENCIES',
  accountNo: '987654321098',
  ifsc: 'SBIN0001234',
};

const initialState: StoreState = {
  profile: DEFAULT_COMPANY_SETTINGS,
  loading: false,
  error: null,
};

const getAuthHeaders = (state: RootState) => {
  const token = state.auth.token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchStoreProfile = createAsyncThunk(
  'store/fetchStoreProfile',
  async (_, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/store/me`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch store settings');
      }
      return data.store; // can be null if not set
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const saveStoreProfile = createAsyncThunk(
  'store/saveStoreProfile',
  async (profileData: CompanySettings, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/store/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify(profileData)
      });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to save store settings');
      }
      return data.store;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

const storeSlice = createSlice({
  name: 'store',
  initialState,
  reducers: {
    clearStoreError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Store Profile
      .addCase(fetchStoreProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchStoreProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.profile = action.payload;
        }
      })
      .addCase(fetchStoreProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Save Store Profile
      .addCase(saveStoreProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(saveStoreProfile.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.profile = action.payload;
        }
      })
      .addCase(saveStoreProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearStoreError } = storeSlice.actions;
export default storeSlice.reducer;
