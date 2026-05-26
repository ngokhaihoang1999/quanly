-- Migration: Update Notification Preferences defaults and retroactively enable new event types for existing users
-- Target: public.notification_preferences

-- 1. Update the default value for new rows
ALTER TABLE public.notification_preferences
  ALTER COLUMN app_events SET DEFAULT '{hapja_created,hapja_approved,hapja_rejected,chot_tv,bc_tv,chot_bb,bc_bb,mo_kt,drop_out,pause,chot_center,reminder,bb_reminder,bb_report_reminder,bb_milestone,chat_mention}';

-- 2. Retroactively add new event types to existing preference records to ensure they are enabled by default
UPDATE public.notification_preferences
SET app_events = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(array_cat(app_events, ARRAY['pause', 'bb_reminder', 'bb_report_reminder', 'bb_milestone', 'chat_mention']::text[])) AS x
);
