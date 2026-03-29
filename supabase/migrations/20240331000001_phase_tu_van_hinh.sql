-- 1. Drop old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phase_check;

-- 2. Add new constraint with all phases
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phase_check
  CHECK (phase IN ('new', 'chakki', 'tu_van_hinh', 'tu_van', 'bb', 'center', 'completed'));

-- 3. Data alignment (Optional/Best Effort based on structure)
-- Before, all TV was 'tu_van'. Now, TV 1 is 'chakki', TV 2+ is 'tu_van_hinh', 12-session without KT is 'tu_van'.
-- We can't perfectly migrate via SQL without complex joins on records, so for safety we will handle it gracefully in the UI.
-- (If needed we could update profiles currently in 'tu_van' to 'tu_van_hinh' if they have multiple consultation_sessions, but that might be overkill if data integrity is handled via App logic loading).
