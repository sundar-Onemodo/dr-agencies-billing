-- Migration to add Customer Ledger & Payment Tracking
-- Copy and execute this script inside the Supabase SQL Editor.

-- 1. Create customers table
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

-- 2. Add customer_id and payment_status to bills table
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS customer_id BIGINT REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'Pending';

-- 3. Create index for customer_id on bills
CREATE INDEX IF NOT EXISTS idx_bills_customer_id ON public.bills(customer_id);

-- 4. Enable indexes for performance on customers
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- 5. Disable RLS for customers table (since authentication is managed by Express server like other tables)
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;

-- 6. Populate customers table from existing bills
INSERT INTO public.customers (user_id, name, address, gstin, state, total_received, created_at, updated_at)
SELECT DISTINCT 
    b.user_id,
    -- Extract name from Name||Address||GSTIN||State
    COALESCE(
        CASE 
            WHEN b.customer_name LIKE '%||%' THEN split_part(b.customer_name, '||', 1)
            ELSE b.customer_name
        END, 
        'Unknown'
    ) AS name,
    -- Extract address
    CASE 
        WHEN b.customer_name LIKE '%||%' THEN split_part(b.customer_name, '||', 2)
        ELSE ''
    END AS address,
    -- Extract gstin
    CASE 
        WHEN b.customer_name LIKE '%||%' THEN split_part(b.customer_name, '||', 3)
        ELSE ''
    END AS gstin,
    -- Extract state
    CASE 
        WHEN b.customer_name LIKE '%||%' AND split_part(b.customer_name, '||', 4) <> '' THEN split_part(b.customer_name, '||', 4)
        ELSE 'Tamil Nadu'
    END AS state,
    0.00 AS total_received,
    MIN(b.created_at) AS created_at,
    MAX(b.created_at) AS updated_at
FROM public.bills b
WHERE NOT EXISTS (
    SELECT 1 FROM public.customers c 
    WHERE c.user_id = b.user_id 
    AND c.name = COALESCE(
        CASE 
            WHEN b.customer_name LIKE '%||%' THEN split_part(b.customer_name, '||', 1)
            ELSE b.customer_name
        END, 
        'Unknown'
    )
)
GROUP BY b.user_id, b.customer_name;

-- 7. Link existing bills to the newly created customers
UPDATE public.bills b
SET customer_id = c.id
FROM public.customers c
WHERE c.user_id = b.user_id 
AND c.name = COALESCE(
    CASE 
        WHEN b.customer_name LIKE '%||%' THEN split_part(b.customer_name, '||', 1)
        ELSE b.customer_name
    END, 
    'Unknown'
);
