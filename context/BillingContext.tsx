import React, { createContext, useContext, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginUser, logoutUser, initializeAuth, logoutUserThunk } from '../store/slices/authSlice';
import { 
  fetchProducts, 
  addProduct as addProductThunk, 
  deleteProduct as deleteProductThunk,
  updateProductLocal
} from '../store/slices/productSlice';
import { 
  fetchRecentBills, 
  createBill as createBillThunk 
} from '../store/slices/billSlice';
import { 
  fetchStoreProfile, 
  saveStoreProfile as saveStoreProfileThunk 
} from '../store/slices/storeSlice';
import { 
  updatePrinterSettings as updatePrinterSettingsAction 
} from '../store/slices/printerSlice';

export interface Product {
  id: string;
  name: string;
  price: number;
  gstRate: number; // e.g. 18 for 18%
}

export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  amount: number;
}

export interface Bill {
  id: string; // e.g. "INV-2026-0001"
  customerName: string;
  date: string;
  items: BillItem[];
  subtotal: number;
  gstEnabled: boolean;
  cgst: number;
  sgst: number;
  total: number;
}

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

export interface PrinterSettings {
  paperSize: '58mm' | '80mm' | 'A4';
  connectedPrinter: string | null;
  connectedPrinterAddress: string | null;
}

interface BillingContextType {
  isAuthenticated: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  products: Product[];
  addProduct: (product: Omit<Product, 'id'>) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  bills: Bill[];
  addBill: (bill: Omit<Bill, 'id'>) => string; // returns generated invoice ID
  companySettings: CompanySettings;
  updateCompanySettings: (settings: CompanySettings) => void;
  printerSettings: PrinterSettings;
  updatePrinterSettings: (settings: Partial<PrinterSettings>) => void;
  generateNextInvoiceNumber: () => string;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();

  // Selectors
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);
  const products = useAppSelector((state) => state.products.items);
  const bills = useAppSelector((state) => state.bills.items);
  const companySettings = useAppSelector((state) => state.store.profile);
  const printerSettings = useAppSelector((state) => state.printer);

  // Fetch initial auth state from storage
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchProducts());
      dispatch(fetchStoreProfile());
      dispatch(fetchRecentBills());
    }
  }, [isAuthenticated, dispatch]);

  const login = async (email: string, password: string): Promise<boolean> => {
    const resultAction = await dispatch(loginUser({ email, password }));
    return loginUser.fulfilled.match(resultAction);
  };

  const logout = () => {
    dispatch(logoutUserThunk());
  };

  const addProduct = (newProduct: Omit<Product, 'id'>) => {
    dispatch(addProductThunk(newProduct));
  };

  const updateProduct = (updatedProduct: Product) => {
    dispatch(updateProductLocal(updatedProduct));
  };

  const deleteProduct = (id: string) => {
    dispatch(deleteProductThunk(id));
  };

  const generateNextInvoiceNumber = (): string => {
    if (bills.length === 0) {
      return 'INV-2026-0001';
    }
    // Search max invoice ID number
    let maxNum = 0;
    bills.forEach((bill) => {
      const match = bill.id.match(/INV-2026-(\d+)/);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });
    const nextNum = maxNum + 1;
    return `INV-2026-${nextNum.toString().padStart(4, '0')}`;
  };

  const addBill = (newBill: Omit<Bill, 'id'>): string => {
    // Generate the next invoice number
    const nextInvoiceId = generateNextInvoiceNumber();
    
    // Destructure date since it's not expected in the creation payload
    const { date, ...billDetails } = newBill;

    // Dispatch thunk to create bill in Supabase
    dispatch(createBillThunk({
      ...billDetails,
      invoiceNumber: nextInvoiceId
    }));
    
    return nextInvoiceId;
  };

  const updateCompanySettings = (settings: CompanySettings) => {
    dispatch(saveStoreProfileThunk(settings));
  };

  const updatePrinterSettings = (settings: Partial<PrinterSettings>) => {
    dispatch(updatePrinterSettingsAction(settings));
  };

  return (
    <BillingContext.Provider
      value={{
        isAuthenticated,
        isInitialized,
        login,
        logout,
        products,
        addProduct,
        updateProduct,
        deleteProduct,
        bills,
        addBill,
        companySettings,
        updateCompanySettings,
        printerSettings,
        updatePrinterSettings,
        generateNextInvoiceNumber,
      }}
    >
      {children}
    </BillingContext.Provider>
  );
};

export const useBilling = () => {
  const context = useContext(BillingContext);
  if (context === undefined) {
    throw new Error('useBilling must be used within a BillingProvider');
  }
  return context;
};
