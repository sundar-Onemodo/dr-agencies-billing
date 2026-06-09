import React, { createContext, useContext, useState, useEffect } from 'react';

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

// Initial Mock Products
const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Premium Copper Wire 1.5mm', price: 1250, gstRate: 18 },
  { id: 'p2', name: 'Industrial PVC Conduit Pipe', price: 340, gstRate: 18 },
  { id: 'p3', name: 'Brass Valve Fitting 1/2"', price: 450, gstRate: 18 },
  { id: 'p4', name: 'LED Panel Downlight 12W', price: 280, gstRate: 12 },
  { id: 'p5', name: 'Heavy Duty MCB Double Pole', price: 980, gstRate: 18 },
  { id: 'p6', name: 'Modular Switch Plate 6 Module', price: 150, gstRate: 18 },
];

// Initial Mock Bills
const INITIAL_BILLS: Bill[] = [
  {
    id: 'INV-2026-0001',
    customerName: 'Karan Electricals',
    date: '05-06-2026',
    items: [
      { id: '1', name: 'Premium Copper Wire 1.5mm', qty: 10, price: 1250, amount: 12500 },
      { id: '2', name: 'Brass Valve Fitting 1/2"', qty: 5, price: 450, amount: 2250 },
    ],
    subtotal: 14750,
    gstEnabled: true,
    cgst: 1327.5,
    sgst: 1327.5,
    total: 17405,
  },
  {
    id: 'INV-2026-0002',
    customerName: 'Balaji Builders',
    date: '06-06-2026',
    items: [
      { id: '1', name: 'Industrial PVC Conduit Pipe', qty: 25, price: 340, amount: 8500 },
    ],
    subtotal: 8500,
    gstEnabled: true,
    cgst: 765,
    sgst: 765,
    total: 10030,
  },
  {
    id: 'INV-2026-0003',
    customerName: 'Ramesh Sharma (Retail)',
    date: '07-06-2026',
    items: [
      { id: '1', name: 'LED Panel Downlight 12W', qty: 8, price: 280, amount: 2240 },
      { id: '2', name: 'Modular Switch Plate 6 Module', qty: 10, price: 150, amount: 1500 },
    ],
    subtotal: 3740,
    gstEnabled: false,
    cgst: 0,
    sgst: 0,
    total: 3740,
  },
];

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

export const BillingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [bills, setBills] = useState<Bill[]>(INITIAL_BILLS);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(DEFAULT_COMPANY_SETTINGS);
  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>({
    paperSize: '58mm',
    connectedPrinter: null,
    connectedPrinterAddress: null,
  });

  const login = async (email: string, password: string): Promise<boolean> => {
    // Basic simulation of a login check
    if (email.trim() && password.length >= 4) {
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const addProduct = (newProduct: Omit<Product, 'id'>) => {
    const productWithId: Product = {
      ...newProduct,
      id: `p-${Date.now()}`,
    };
    setProducts((prev) => [productWithId, ...prev]);
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
    );
  };

  const deleteProduct = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
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
    const nextInvoiceId = generateNextInvoiceNumber();
    const finalBill: Bill = {
      ...newBill,
      id: nextInvoiceId,
    };
    setBills((prev) => [finalBill, ...prev]);
    return nextInvoiceId;
  };

  const updateCompanySettings = (settings: CompanySettings) => {
    setCompanySettings(settings);
  };

  const updatePrinterSettings = (settings: Partial<PrinterSettings>) => {
    setPrinterSettings((prev) => ({ ...prev, ...settings }));
  };

  return (
    <BillingContext.Provider
      value={{
        isAuthenticated,
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
