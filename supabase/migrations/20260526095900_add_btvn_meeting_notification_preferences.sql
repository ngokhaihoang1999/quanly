-- Migration: Update defaults and enable new notification event types (hapja_resubmitted, new_btvn, new_team_meeting) for existing users
-- Target: public.notification_preferences

-- 1. Update default value for app_events to include new events
ALTER TABLE public.notification_preferences
  ALTER COLUMN app_events SET DEFAULT '{hapja_created,hapja_approved,hapja_rejected,hapja_resubmitted,chot_tv,bc_tv,lap_group_tv_bb,bc_bb,mo_kt,drop_out,pause,chot_center,reminder,bb_reminder,bb_report_reminder,bb_milestone,chat_mention,new_btvn,new_team_meeting}';

-- 2. Retroactively add new event types to existing app_events arrays
UPDATE public.notification_preferences
SET app_events = (
  SELECT array_agg(DISTINCT x)
  FROM unnest(array_cat(app_events, ARRAY['hapja_resubmitted', 'new_btvn', 'new_team_meeting']::text[])) AS x
);
