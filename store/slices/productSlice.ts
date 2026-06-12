import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { API_URL } from '../../constants/Api';
import { RootState } from '../index';

export interface Product {
  id: string;
  name: string;
  price: number;
  gstRate: number;
}

interface ProductState {
  items: Product[];
  loading: boolean;
  error: string | null;
}

const initialState: ProductState = {
  items: [],
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

export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (_, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/products/list`, { headers });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to fetch products');
      }
      return data.products as Product[];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const addProduct = createAsyncThunk(
  'products/addProduct',
  async (productData: Omit<Product, 'id'>, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/products/add`, {
        method: 'POST',
        headers,
        body: JSON.stringify(productData)
      });
      const data = await response.json();

      console.log('Product Added:', data);


      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to add product');
      }

      console.log("Product added successfully", data.product);
      return data.product as Product;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

export const deleteProduct = createAsyncThunk(
  'products/deleteProduct',
  async (productId: string, { getState, rejectWithValue }) => {
    try {
      const headers = getAuthHeaders(getState() as RootState);
      const response = await fetch(`${API_URL}/products/${productId}`, {
        method: 'DELETE',
        headers
      });
      const data = await response.json();

      if (!response.ok) {
        return rejectWithValue(data.error || 'Failed to delete product');
      }
      return productId; // return ID of deleted product
    } catch (err: any) {
      return rejectWithValue(err.message || 'Server connection failed');
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    clearProductError: (state) => {
      state.error = null;
    },
    updateProductLocal: (state, action: PayloadAction<Product>) => {
      state.items = state.items.map(p => p.id === action.payload.id ? action.payload : p);
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch Products
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Add Product
      .addCase(addProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.items.unshift(action.payload); // Add to top of list
      })
      .addCase(addProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Delete Product
      .addCase(deleteProduct.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteProduct.fulfilled, (state, action) => {
        state.loading = false;
        state.items = state.items.filter(item => item.id !== action.payload);
      })
      .addCase(deleteProduct.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  }
});

export const { clearProductError, updateProductLocal } = productSlice.actions;
export default productSlice.reducer;
