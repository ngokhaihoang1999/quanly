-- Migration: Clean up duplicate calendar events
-- Group by profile_id, staff_code, event_type, and the extracted session/report number, keeping only the latest event (newest created_at).

WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY profile_id, staff_code, event_type, 
                        regexp_replace(title, '^([^0-9]+ (lần|buổi) \d+).*', '\1')
           ORDER BY created_at DESC
         ) as rnum
  FROM public.calendar_events
  WHERE event_type IN ('chot_tv', 'hoc_bb')
)
DELETE FROM public.calendar_events
WHERE id IN (
  SELECT id FROM duplicates WHERE rnum > 1
);
