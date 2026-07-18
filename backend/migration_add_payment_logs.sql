-- Migration to add detailed Customer Payment Log tracking
-- Copy and execute this script inside the Supabase SQL Editor.

-- 1. Create customer_payments table
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

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON public.customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_user_id ON public.customer_payments(user_id);

-- 3. Disable RLS for customer_payments (authentication managed by Express backend)
ALTER TABLE public.customer_payments DISABLE ROW LEVEL SECURITY;
