-- Migration: Add unique_key column to calendar_events and add a unique constraint
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS unique_key TEXT;

-- Add UNIQUE constraint on unique_key
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_unique_key_key;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_unique_key_key UNIQUE (unique_key);
