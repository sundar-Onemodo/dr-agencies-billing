-- Complete Database Schema for DR Agencies Billing Backend
-- Copy and execute this script inside the Supabase SQL Editor.
-- WARNING: This will drop existing tables and recreate them if running full reset.
-- For safe non-destructive migration on an existing database, use migration_add_customers.sql instead!

-- Enable UUID extension (for auth.users referencing)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Stores Table (Store Profile settings)
CREATE TABLE IF NOT EXISTS public.stores (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    gstin TEXT,
    phone TEXT,
    email TEXT,
    bank_name TEXT,
    account_name TEXT,
    account_no TEXT,
    ifsc TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- e.g. 18.00
    stock_qty NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Product Stock Logs Table
CREATE TABLE IF NOT EXISTS public.product_stock_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    change_type TEXT NOT NULL, -- 'INITIAL', 'ADD_PURCHASE', 'MANUAL_CORRECTION', 'BILL_SALE'
    qty_changed NUMERIC(10, 2) NOT NULL,
    previous_qty NUMERIC(10, 2) NOT NULL,
    new_qty NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    bill_id BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Customers Table
CREATE TABLE IF NOT EXISTS public.customers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    gstin TEXT,
    state TEXT DEFAULT 'Tamil Nadu',
    total_received NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_customer_name UNIQUE (user_id, name)
);

-- 5. Create Bills Table (Invoices)
CREATE TABLE IF NOT EXISTS public.bills (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Bill Items Table
CREATE TABLE IF NOT EXISTS public.bill_items (
    id BIGSERIAL PRIMARY KEY,
    bill_id BIGINT NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Customer Payments Table
CREATE TABLE IF NOT EXISTS public.customer_payments (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    bill_id BIGINT REFERENCES public.bills(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    payment_mode TEXT NOT NULL, -- 'Cash', 'GPay', 'PhonePe', 'Paytm'
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable indexes for high query performance
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON public.stores(user_id);
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_product_stock_logs_product_id ON public.product_stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills(customer_id);
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_id ON public.bill_items(bill_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON public.customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_user_id ON public.customer_payments(user_id);

-- Disable Row Level Security (RLS) since multi-tenancy is scoped per authenticated user in Express server
ALTER TABLE public.stores DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_stock_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments DISABLE ROW LEVEL SECURITY;

-- 8. Helper Function for atomic/concurrent stock decrement and validation
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_id BIGINT,
  p_qty NUMERIC,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.products
  SET stock_qty = stock_qty - p_qty
  WHERE id = p_id AND user_id = p_user_id AND stock_qty >= p_qty;
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;
