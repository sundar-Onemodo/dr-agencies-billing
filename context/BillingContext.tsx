import React, { createContext, useContext, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginUser, logoutUser, initializeAuth, logoutUserThunk } from '../store/slices/authSlice';
import { 
  fetchProducts, 
  addProduct as addProductThunk, 
  deleteProduct as deleteProductThunk,
  updateProduct as updateProductThunk
} from '../store/slices/productSlice';
import { 
  fetchRecentBills, 
  createBill as createBillThunk,
  deleteBill as deleteBillThunk
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
  stockQty: number;
}

export interface BillItem {
  id: string;
  productId?: string;
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
  addProduct: (product: Omit<Product, 'id'>) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => void;
  bills: Bill[];
  addBill: (bill: Omit<Bill, 'id'>) => Promise<string>; // returns generated invoice ID
  deleteBill: (id: string) => Promise<void>;
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

  const addProduct = async (newProduct: Omit<Product, 'id'>): Promise<void> => {
    const resultAction = await dispatch(addProductThunk(newProduct));
    if (addProductThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to add product');
    }
  };

  const updateProduct = async (updatedProduct: Product): Promise<void> => {
    const resultAction = await dispatch(updateProductThunk(updatedProduct));
    if (updateProductThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to update product');
    }
  };

  const deleteProduct = (id: string) => {
    dispatch(deleteProductThunk(id));
  };

  const generateNextInvoiceNumber = (): string => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}${mm}${dd}`; // e.g. "20260610"

    let maxSerial = 0;
    bills.forEach((bill) => {
      const invNum = bill.invoiceNumber;
      if (invNum && invNum.endsWith(todayStr)) {
        const serialStr = invNum.substring(0, invNum.length - todayStr.length);
        const serial = parseInt(serialStr, 10);
        if (!isNaN(serial) && serial > maxSerial) {
          maxSerial = serial;
        }
      }
    });

    const nextSerial = maxSerial + 1;
    const serialPrefix = String(nextSerial).padStart(2, '0');
    return `${serialPrefix}${todayStr}`;
  };

  const addBill = async (newBill: Omit<Bill, 'id'>): Promise<string> => {
    const nextInvoiceId = newBill.invoiceNumber || generateNextInvoiceNumber();
    const { date, ...billDetails } = newBill;

    const resultAction = await dispatch(createBillThunk({
      ...billDetails,
      invoiceNumber: nextInvoiceId
    }));
    
    if (createBillThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to create bill');
    }
    
    // Automatically refresh products list to reflect updated stock in UI
    dispatch(fetchProducts());
    
    return nextInvoiceId;
  };

  const deleteBill = async (id: string): Promise<void> => {
    const resultAction = await dispatch(deleteBillThunk(id));
    if (deleteBillThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to delete bill');
    }
    // Automatically refresh products list to reflect updated stock in UI
    dispatch(fetchProducts());
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
        deleteBill,
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
