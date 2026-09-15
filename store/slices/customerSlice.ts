import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { API_URL } from '../../constants/Api';
import { RootState } from '../index';

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  gstin: string;
  state: string;
  totalBilled: number;
  totalReceived: number;
  pendingAmount: number;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  customerId: string;
  billId: string | null;
  amount: number;
  paymentMode: string;
  paymentDate: string;
  createdAt: string;
  type?: 'bill' | 'payment';
  paymentStatus?: string;
  invoiceNumber?: string;
}

interface CustomerState {
  items: Customer[];
  payments: Record<string, CustomerPayment[]>; // maps customerId -> payments history
  loading: boolean;
  error: string | null;
}

const initialState: CustomerState = {
  items: [],
  payments: {},
  loading: false,
  error: null,
};

// Helper for authorization headers
const getAuthHeaders = (state: RootState) => {
  const token = state.auth.token;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export const fetchCustomers = createAsyncThunk(
  'customers/fetchCustomers',
  async (_, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/customers`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch customers');
      }
      return data.customers as Customer[];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const addCustomer = createAsyncThunk(
  'customers/addCustomer',
  async (
    customerData: { name: string; phone?: string; address?: string; gstin?: string; state?: string; total_received?: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/customers`, {
        method: 'POST',
        headers,
        body: JSON.stringify(customerData)
      });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to create customer');
      }

      const rawCustomer = data.customer;
      const formattedCustomer: Customer = {
        id: String(rawCustomer.id),
        name: rawCustomer.name,
        phone: rawCustomer.phone || '',
        address: rawCustomer.address || '',
        gstin: rawCustomer.gstin || '',
        state: rawCustomer.state || 'Tamil Nadu',
        totalBilled: parseFloat(rawCustomer.totalBilled || 0),
        totalReceived: parseFloat(rawCustomer.totalReceived || 0),
        pendingAmount: parseFloat(rawCustomer.pendingAmount || 0),
        createdAt: rawCustomer.createdAt || new Date().toISOString()
      };

      return formattedCustomer;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const fetchCustomerPayments = createAsyncThunk(
  'customers/fetchCustomerPayments',
  async (customerId: string, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/customers/${customerId}/payments`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch customer payments');
      }
      return { customerId, payments: data.payments as CustomerPayment[] };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const updateCustomer = createAsyncThunk(
  'customers/updateCustomer',
  async (
    customerData: { id: string; name?: string; phone?: string; address?: string; gstin?: string; state?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/customers/${customerData.id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(customerData)
      });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to update customer');
      }

      const rawCustomer = data.customer;
      return {
        id: String(rawCustomer.id),
        name: rawCustomer.name,
        phone: rawCustomer.phone || '',
        address: rawCustomer.address || '',
        gstin: rawCustomer.gstin || '',
        state: rawCustomer.state || 'Tamil Nadu',
        totalBilled: parseFloat(rawCustomer.totalBilled || 0),
        totalReceived: parseFloat(rawCustomer.totalReceived || 0),
        pendingAmount: parseFloat(rawCustomer.pendingAmount || 0),
        createdAt: rawCustomer.createdAt || new Date().toISOString()
      } as Customer;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const updateCustomerPayment = createAsyncThunk(
  'customers/updateCustomerPayment',
  async (
    { id, amount, paymentMode, paymentDate }: { id: string; amount: number; paymentMode: string; paymentDate?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/customers/${id}/payments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount, paymentMode, paymentDate })
      });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to update customer payment');
      }
      return { 
        id, 
        totalReceived: data.totalReceived, 
        payment: data.payment as CustomerPayment 
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    clearCustomerError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Customers
      .addCase(fetchCustomers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCustomers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add Customer
      .addCase(addCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addCustomer.fulfilled, (state, action) => {
        state.loading = false;
        const existingIndex = state.items.findIndex(
          c => c.id === action.payload.id || c.name.toLowerCase() === action.payload.name.toLowerCase()
        );
        if (existingIndex >= 0) {
          state.items[existingIndex] = { ...state.items[existingIndex], ...action.payload };
        } else {
          state.items.push(action.payload);
        }
        state.items.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(addCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Customer
      .addCase(updateCustomer.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        state.loading = false;
        const existingIndex = state.items.findIndex(c => c.id === action.payload.id);
        if (existingIndex >= 0) {
          state.items[existingIndex] = {
            ...state.items[existingIndex],
            ...action.payload,
            totalBilled: state.items[existingIndex].totalBilled,
            totalReceived: action.payload.totalReceived || state.items[existingIndex].totalReceived,
            pendingAmount: Math.max(0, (state.items[existingIndex].totalBilled || 0) - (action.payload.totalReceived || state.items[existingIndex].totalReceived || 0)),
          };
        }
        state.items.sort((a, b) => a.name.localeCompare(b.name));
      })
      .addCase(updateCustomer.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Customer Payments
      .addCase(fetchCustomerPayments.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchCustomerPayments.fulfilled, (state, action) => {
        state.loading = false;
        state.payments[action.payload.customerId] = action.payload.payments;
      })
      .addCase(fetchCustomerPayments.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Update Customer Payment
      .addCase(updateCustomerPayment.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateCustomerPayment.fulfilled, (state, action) => {
        state.loading = false;
        // Update customer in list
        state.items = state.items.map(customer => {
          if (customer.id === action.payload.id) {
            const newTotalReceived = action.payload.totalReceived;
            return {
              ...customer,
              totalReceived: newTotalReceived,
              pendingAmount: Math.max(0, customer.totalBilled - newTotalReceived)
            };
          }
          return customer;
        });
        // Append payment log to customer's history
        const customerId = action.payload.id;
        if (!state.payments[customerId]) {
          state.payments[customerId] = [];
        }
        state.payments[customerId].unshift(action.payload.payment);
      })
      .addCase(updateCustomerPayment.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearCustomerError } = customerSlice.actions;
export default customerSlice.reducer;
