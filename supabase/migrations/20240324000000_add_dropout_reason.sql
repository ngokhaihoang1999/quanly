-- Add dropout_reason column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS dropout_reason text;
