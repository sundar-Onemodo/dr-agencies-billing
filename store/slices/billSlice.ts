import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../../constants/Api';
import { RootState } from '../index';

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  amount: number;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  customerName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  gstEnabled: boolean;
  cgst: number;
  sgst: number;
  total: number;
}

interface BillState {
  items: Bill[];
  currentBill: Bill | null;
  loading: boolean;
  error: string | null;
}

const initialState: BillState = {
  items: [],
  currentBill: null,
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

export const fetchRecentBills = createAsyncThunk(
  'bills/fetchRecentBills',
  async (_, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/bills/recent`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch recent bills');
      }
      return data.bills as Bill[];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const createBill = createAsyncThunk(
  'bills/createBill',
  async (billData: Omit<Bill, 'id' | 'date'> & { invoiceNumber: string }, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/bills/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(billData)
      });
      const data = await response.json();

      console.log('Create Bill:', data);


      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to create bill');
      }
      return data.bill as Bill;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const fetchBillDetails = createAsyncThunk(
  'bills/fetchBillDetails',
  async (billId: string, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/bills/${billId}`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch bill details');
      }
      return data.bill as Bill;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

const billSlice = createSlice({
  name: 'bills',
  initialState,
  reducers: {
    clearBillError: (state) => {
      state.error = null;
    },
    clearCurrentBill: (state) => {
      state.currentBill = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Recent Bills
      .addCase(fetchRecentBills.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRecentBills.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchRecentBills.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Create Bill
      .addCase(createBill.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createBill.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload); // Add to recent bills list
        state.currentBill = action.payload;
      })
      .addCase(createBill.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Bill Details
      .addCase(fetchBillDetails.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchBillDetails.fulfilled, (state, action) => {
        state.loading = false;
        state.currentBill = action.payload;
      })
      .addCase(fetchBillDetails.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearBillError, clearCurrentBill } = billSlice.actions;
export default billSlice.reducer;
