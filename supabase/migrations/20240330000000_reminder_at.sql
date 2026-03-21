-- Migration: add reminder_at and improve calendar events schema
-- Run this in Supabase SQL Editor

-- 1. Add reminder_at column (absolute timestamp for custom reminders)
ALTER TABLE calendar_events 
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

-- 2. Add reminder_sent flag to avoid duplicate sends
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 3. Index for cron job: find events that need reminders soon
CREATE INDEX IF NOT EXISTS idx_calendar_reminder_at 
  ON calendar_events(reminder_at) 
  WHERE reminder_sent = false AND reminder_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_not_reminded
  ON calendar_events(event_date, event_time, reminder_sent)
  WHERE reminder_sent = false;

-- 4. Create a function the cron job will call to send reminders
CREATE OR REPLACE FUNCTION trigger_due_reminders()
RETURNS TABLE(event_id UUID, staff_code TEXT, title TEXT, event_date DATE, event_time TIME, reminder_type TEXT)
LANGUAGE sql
AS $$
  -- Return events where reminder_at is in the past (within last 5 mins) and not yet sent
  SELECT id, staff_code, title, event_date, event_time, 'custom' as reminder_type
  FROM calendar_events
  WHERE reminder_at IS NOT NULL
    AND reminder_at <= NOW()
    AND reminder_at >= NOW() - INTERVAL '5 minutes'
    AND reminder_sent = false
  
  UNION ALL
  
  -- Return events where event is in X minutes (based on reminder_minutes array)
  -- X minutes before event = event_datetime - reminder_minutes[i] minutes
  SELECT DISTINCT ON (id) id, staff_code, title, event_date, event_time, 'preset' as reminder_type
  FROM calendar_events
  WHERE reminder_minutes IS NOT NULL 
    AND array_length(reminder_minutes, 1) > 0
    AND event_time IS NOT NULL
    AND reminder_sent = false
    AND EXISTS (
      SELECT 1 FROM unnest(reminder_minutes) AS m
      WHERE (event_date + event_time)::TIMESTAMPTZ - (m || ' minutes')::INTERVAL
        BETWEEN NOW() - INTERVAL '5 minutes' AND NOW()
    );
$$;

-- Mark reminders as sent
CREATE OR REPLACE FUNCTION mark_reminder_sent(p_event_id UUID)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE calendar_events SET reminder_sent = true WHERE id = p_event_id;
$$;
