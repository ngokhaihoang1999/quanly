-- Migration: clean up deadline events + add visible_at to priority_tasks
-- Run this in Supabase SQL Editor

-- 1. Remove all deadline_bc_tv and deadline_bc_bb events (no longer used)
DELETE FROM calendar_events 
WHERE event_type IN ('deadline_bc_tv', 'deadline_bc_bb');

-- 2. Add visible_at column if not exists (for deferred priority tasks)
ALTER TABLE priority_tasks
ADD COLUMN IF NOT EXISTS visible_at TIMESTAMPTZ;

-- 3. Add reminder_at and reminder_sent to calendar_events if not exists
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 4. Index for priority tasks visible_at
CREATE INDEX IF NOT EXISTS idx_priority_tasks_visible_at
  ON priority_tasks(visible_at)
  WHERE is_completed = false AND visible_at IS NOT NULL;
