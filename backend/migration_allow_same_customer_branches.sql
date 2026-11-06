-- Migration: Allow multiple shop/branch locations with the same customer name
-- Copy and execute this script inside the Supabase SQL Editor:

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS unique_user_customer_name;

