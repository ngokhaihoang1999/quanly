-- Migration: add reminder_channels to calendar_events
-- Run this in Supabase SQL Editor

-- 1. Add reminder_channels column (JSON array of channel targets: 'app', 'chat')
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS reminder_channels TEXT[] DEFAULT ARRAY['app']::TEXT[];

-- 2. Update existing reminder events to include both app and chat channels for auto events
UPDATE calendar_events 
SET reminder_channels = ARRAY['app', 'chat']
WHERE is_auto = true AND is_system = true AND reminder_channels = ARRAY['app']::TEXT[];
