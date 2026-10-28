-- Database Schema Migration: Create or Update Product Stock Logs Table
-- Copy and execute this script inside the Supabase SQL Editor.

-- 1. Create product_stock_logs table if it does not exist
CREATE TABLE IF NOT EXISTS public.product_stock_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT,
    quantity NUMERIC(10, 2),
    reference_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Ensure columns exist if the table was previously created with the legacy schema
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS quantity NUMERIC(10, 2);
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS change_type TEXT;
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS qty_changed NUMERIC(10, 2);
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS previous_qty NUMERIC(10, 2);
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS new_qty NUMERIC(10, 2);
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.product_stock_logs ADD COLUMN IF NOT EXISTS bill_id BIGINT;

-- 3. Backfill modern columns from legacy columns if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'product_stock_logs' 
      AND column_name = 'qty_changed'
  ) THEN
    UPDATE public.product_stock_logs
    SET 
      type = CASE WHEN qty_changed >= 0 THEN 'IN' ELSE 'OUT' END,
      quantity = ABS(qty_changed),
      reference_id = COALESCE(notes, change_type, 'LOG')
    WHERE type IS NULL AND qty_changed IS NOT NULL;
  END IF;
END $$;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_logs_user_id ON public.product_stock_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product_id ON public.product_stock_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_created_at ON public.product_stock_logs(created_at);

-- 5. Disable Row Level Security (RLS) since authentication is managed by the Express backend
ALTER TABLE public.product_stock_logs DISABLE ROW LEVEL SECURITY;

-- 6. Seed existing products as initial 'IN' logs if no logs exist yet
INSERT INTO public.product_stock_logs (user_id, product_id, type, quantity, reference_id, created_at)
SELECT user_id, id, 'IN', stock_qty, 'INITIAL', created_at
FROM public.products
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_stock_logs WHERE product_id = products.id
);
