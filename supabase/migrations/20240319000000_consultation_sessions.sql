-- Migration: Consultation Sessions + Profile Phase

-- 1. Add phase column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phase text DEFAULT 'new'
  CHECK (phase IN ('new', 'tu_van', 'bb', 'completed'));

-- 2. Consultation Sessions table
CREATE TABLE IF NOT EXISTS public.consultation_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_number int NOT NULL DEFAULT 1,
  scheduled_at timestamptz,
  tool text,
  tvv_staff_code text REFERENCES public.staff(staff_code),
  status text DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'reported')),
  notes text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.consultation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage consultation_sessions" ON public.consultation_sessions;
CREATE POLICY "Allow public manage consultation_sessions" ON public.consultation_sessions FOR ALL USING (true);

-- 3. Add session_id to records (link TV report to session)
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.consultation_sessions(id);
