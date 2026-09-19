import React, { createContext, useContext, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { loginUser, logoutUser, initializeAuth, logoutUserThunk } from '../store/slices/authSlice';
import { 
  fetchProducts, 
  addProduct as addProductThunk, 
  deleteProduct as deleteProductThunk,
  updateProduct as updateProductThunk,
  fetchStockLedger,
  addStockQty as addStockQtyThunk,
  StockLog
} from '../store/slices/productSlice';
import { API_URL, loadStoredEnvironment } from '../constants/Api';
import { 
  fetchRecentBills, 
  createBill as createBillThunk,
  updateBill as updateBillThunk,
  deleteBill as deleteBillThunk
} from '../store/slices/billSlice';
import { 
  fetchStoreProfile, 
  saveStoreProfile as saveStoreProfileThunk 
} from '../store/slices/storeSlice';
import { 
  updatePrinterSettings as updatePrinterSettingsAction 
} from '../store/slices/printerSlice';
import { 
  fetchCustomers, 
  addCustomer as addCustomerThunk,
  updateCustomer as updateCustomerThunk,
  updateCustomerPayment, 
  fetchCustomerPayments,
  Customer,
  CustomerPayment
} from '../store/slices/customerSlice';

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
  gstRate?: number;
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
  paymentStatus?: string;
  customerId?: string | null;
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
  updateBill: (id: string, updatedBill: Partial<Bill>) => Promise<void>;
  deleteBill: (id: string) => Promise<void>;
  companySettings: CompanySettings;
  updateCompanySettings: (settings: CompanySettings) => Promise<void>;
  printerSettings: PrinterSettings;
  updatePrinterSettings: (settings: Partial<PrinterSettings>) => void;
  generateNextInvoiceNumber: () => string;
  customers: Customer[];
  fetchCustomersList: () => Promise<void>;
  addCustomer: (customerData: { name: string; phone?: string; address?: string; gstin?: string; state?: string; total_received?: number }) => Promise<Customer>;
  updateCustomer: (customerData: { id: string; name?: string; phone?: string; address?: string; gstin?: string; state?: string }) => Promise<Customer>;
  recordCustomerPayment: (id: string, amount: number, paymentMode: string, paymentDate?: string) => Promise<void>;
  fetchCustomerPaymentsList: (customerId: string) => Promise<CustomerPayment[]>;
  customerPayments: Record<string, CustomerPayment[]>;
  fetchBillsRange: (from: string, to: string) => Promise<void>;
  fetchReportBillsRange: (from: string, to: string) => Promise<Bill[]>;
  refreshData: () => Promise<void>;
  fetchStockLedgerList: (from?: string, to?: string) => Promise<any[]>;
  addStockQty: (productId: string, quantity: number, referenceId?: string) => Promise<Product>;
  fetchProductStockLogs: (productId?: string, from?: string, to?: string) => Promise<StockLog[]>;
}

const BillingContext = createContext<BillingContextType | undefined>(undefined);

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const dispatch = useAppDispatch();

  // Selectors
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const isInitialized = useAppSelector((state) => state.auth.isInitialized);
  const token = useAppSelector((state) => state.auth.token);
  const products = useAppSelector((state) => state.products.items);
  const bills = useAppSelector((state) => state.bills.items);
  const companySettings = useAppSelector((state) => state.store.profile);
  const printerSettings = useAppSelector((state) => state.printer);
  const customers = useAppSelector((state) => state.customers.items);
  const customerPayments = useAppSelector((state) => state.customers.payments);

  // Fetch initial auth state and environment from storage
  useEffect(() => {
    loadStoredEnvironment().finally(() => {
      dispatch(initializeAuth());
    });
  }, [dispatch]);

  // Fetch initial data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchProducts());
      dispatch(fetchStoreProfile());
      dispatch(fetchRecentBills());
      dispatch(fetchCustomers());
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
    let maxSerial = 0;
    
    // Find the maximum serial number among all existing bills
    bills.forEach((bill) => {
      const invNum = bill.invoiceNumber;
      if (invNum) {
        let serial = 0;
        // Check if new format: starts with digits followed by letters (e.g. 01DRA2026)
        const newFormatMatch = invNum.match(/^(\d+)[a-zA-Z]/);
        if (newFormatMatch) {
          serial = parseInt(newFormatMatch[1], 10);
        } else if (/^\d+$/.test(invNum)) {
          // Old format: entirely digits (e.g. 0120260822)
          if (invNum.length > 8) {
            serial = parseInt(invNum.substring(0, invNum.length - 8), 10);
          } else {
            serial = parseInt(invNum, 10);
          }
        } else {
          // Fallback regex match for leading digits
          const match = invNum.match(/^(\d+)/);
          if (match) {
            serial = parseInt(match[1], 10);
          }
        }
        if (!isNaN(serial) && serial > maxSerial) {
          maxSerial = serial;
        }
      }
    });

    const nextSerial = maxSerial + 1;
    // Format serial number as at least 2 digits (e.g., 01, 02, etc.)
    const serialStr = String(nextSerial).padStart(2, '0');
    
    // Get store initials
    const getCompanyInitials = (name: string): string => {
      if (!name) return 'DR';
      return name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .substring(0, 3)
        .toUpperCase();
    };
    
    const initials = getCompanyInitials(companySettings.name || 'DRA');
    const currentYear = new Date().getFullYear();
    
    return `${serialStr}${initials}${currentYear}`;
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
    
    // Automatically refresh products and customers list to reflect updated stock/ledger in UI
    dispatch(fetchProducts());
    dispatch(fetchCustomers());
    
    return nextInvoiceId;
  };

  const updateBill = async (id: string, updatedBill: Partial<Bill>): Promise<void> => {
    const resultAction = await dispatch(updateBillThunk({ id, billData: updatedBill }));
    if (updateBillThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to update bill');
    }
    // Automatically refresh products, customers, and recent bills
    dispatch(fetchProducts());
    dispatch(fetchCustomers());
    dispatch(fetchRecentBills());
  };

  const deleteBill = async (id: string): Promise<void> => {
    const resultAction = await dispatch(deleteBillThunk(id));
    if (deleteBillThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to delete bill');
    }
    // Automatically refresh products and customers list to reflect updated stock/ledger in UI
    dispatch(fetchProducts());
    dispatch(fetchCustomers());
  };

  const fetchCustomersList = async (): Promise<void> => {
    await dispatch(fetchCustomers());
  };

  const addCustomer = async (customerData: { name: string; phone?: string; address?: string; gstin?: string; state?: string; total_received?: number }): Promise<Customer> => {
    const resultAction = await dispatch(addCustomerThunk(customerData));
    if (addCustomerThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to create customer');
    }
    return resultAction.payload as Customer;
  };

  const updateCustomer = async (customerData: { id: string; name?: string; phone?: string; address?: string; gstin?: string; state?: string }): Promise<Customer> => {
    const resultAction = await dispatch(updateCustomerThunk(customerData));
    if (updateCustomerThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to update customer');
    }
    return resultAction.payload as Customer;
  };

  const recordCustomerPayment = async (customerId: string, amount: number, paymentMode: string, paymentDate?: string): Promise<void> => {
    const resultAction = await dispatch(updateCustomerPayment({ id: customerId, amount, paymentMode, paymentDate }));
    if (updateCustomerPayment.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to update customer payment');
    }
    dispatch(fetchCustomers());
  };

  const fetchCustomerPaymentsList = async (customerId: string): Promise<CustomerPayment[]> => {
    const resultAction = await dispatch(fetchCustomerPayments(customerId));
    if (fetchCustomerPayments.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to fetch customer payments');
    }
    return (resultAction.payload as any).payments as CustomerPayment[];
  };

  const fetchBillsRange = async (from: string, to: string): Promise<void> => {
    await dispatch(fetchRecentBills({ from, to }));
  };

  const refreshData = async (): Promise<void> => {
    await Promise.all([
      dispatch(fetchProducts()),
      dispatch(fetchStoreProfile()),
      dispatch(fetchRecentBills()),
      dispatch(fetchCustomers()),
    ]);
  };

  const updateCompanySettings = async (settings: CompanySettings): Promise<void> => {
    const resultAction = await dispatch(saveStoreProfileThunk(settings));
    if (saveStoreProfileThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to save store settings');
    }
  };

  const fetchStockLedgerList = async (from?: string, to?: string): Promise<any[]> => {
    const resultAction = await dispatch(fetchStockLedger({ from, to }));
    if (fetchStockLedger.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to fetch stock ledger');
    }
    return resultAction.payload as any[];
  };

  const fetchReportBillsRange = async (from: string, to: string): Promise<Bill[]> => {
    const response = await fetch(`${API_URL}/bills/recent?from=${from}&to=${to}`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch report bills');
    }
    return (data.bills || []) as Bill[];
  };

  const addStockQty = async (productId: string, quantity: number, referenceId?: string): Promise<Product> => {
    const resultAction = await dispatch(addStockQtyThunk({ productId, quantity, referenceId }));
    if (addStockQtyThunk.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to add stock quantity');
    }
    return resultAction.payload as Product;
  };

  const fetchProductStockLogs = async (productId?: string, from?: string, to?: string): Promise<StockLog[]> => {
    const resultAction = await dispatch(fetchStockLedger({ productId, from, to }));
    if (fetchStockLedger.rejected.match(resultAction)) {
      throw new Error(resultAction.payload as string || 'Failed to fetch product stock logs');
    }
    return resultAction.payload as StockLog[];
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
        updateBill,
        deleteBill,
        companySettings,
        updateCompanySettings,
        printerSettings,
        updatePrinterSettings,
        generateNextInvoiceNumber,
        customers,
        fetchCustomersList,
        addCustomer,
        updateCustomer,
        recordCustomerPayment,
        fetchCustomerPaymentsList,
        customerPayments,
        fetchBillsRange,
        fetchReportBillsRange,
        refreshData,
        fetchStockLedgerList,
        addStockQty,
        fetchProductStockLogs,
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
