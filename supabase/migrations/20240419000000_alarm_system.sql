-- Migration: Alarm system for notes + index for alarm polling

-- 1. Add reminder_at to personal_notes for note alarms
ALTER TABLE public.personal_notes
ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMPTZ;

ALTER TABLE public.personal_notes
ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;

-- 2. Index for efficient alarm polling on notes
CREATE INDEX IF NOT EXISTS idx_notes_reminder_at
  ON public.personal_notes(reminder_at)
  WHERE reminder_sent = false AND reminder_at IS NOT NULL;

-- 3. Better index for calendar alarm polling
CREATE INDEX IF NOT EXISTS idx_cal_reminder_polling
  ON public.calendar_events(staff_code, reminder_at)
  WHERE reminder_sent = false AND reminder_at IS NOT NULL;
