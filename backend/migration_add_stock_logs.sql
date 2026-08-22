-- Database Schema Migration: Create Product Stock Logs Table
-- Copy and execute this script inside the Supabase SQL Editor.

-- 1. Create product_stock_logs table
CREATE TABLE IF NOT EXISTS public.product_stock_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('IN', 'OUT')),
    quantity NUMERIC(10, 2) NOT NULL,
    reference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_logs_user_id ON public.product_stock_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON public.product_stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at ON public.product_stock_logs(created_at);

-- 3. Disable Row Level Security (RLS) since authentication is managed by the Express backend
ALTER TABLE public.product_stock_logs DISABLE ROW LEVEL SECURITY;

-- 4. Seed existing products as initial 'IN' logs
INSERT INTO public.product_stock_logs (user_id, product_id, type, quantity, reference_id, created_at)
SELECT user_id, id, 'IN', stock_qty, 'INITIAL', created_at
FROM public.products
ON CONFLICT DO NOTHING;
