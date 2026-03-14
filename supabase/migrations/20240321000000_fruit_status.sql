-- Add fruit_status column to profiles: 'alive' (default) or 'dropout'
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fruit_status text DEFAULT 'alive';
ALTER TABLE public.profiles ADD CONSTRAINT profiles_fruit_status_check
  CHECK (fruit_status IN ('alive', 'dropout'));
