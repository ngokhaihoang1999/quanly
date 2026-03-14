-- Update phase constraint: add 'chakki' and 'center', rename 'new' data
-- 1. Drop old constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phase_check;

-- 2. Add new constraint with all phases
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phase_check
  CHECK (phase IN ('new', 'chakki', 'tu_van', 'bb', 'center', 'completed'));

-- 3. Migrate existing 'new' rows to 'chakki'
UPDATE public.profiles SET phase = 'chakki' WHERE phase = 'new';
