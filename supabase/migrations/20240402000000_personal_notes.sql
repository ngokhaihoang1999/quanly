-- Personal Notes System
-- Allows staff members to create personal notes and share them with others

-- ===== TABLE: personal_notes =====
CREATE TABLE IF NOT EXISTS public.personal_notes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_staff_code text NOT NULL REFERENCES public.staff(staff_code) ON DELETE CASCADE,
  title text,
  content text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow', 'blue', 'green', 'pink', 'purple')),
  pinned boolean NOT NULL DEFAULT false,
  linked_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ===== TABLE: note_shares =====
CREATE TABLE IF NOT EXISTS public.note_shares (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id uuid NOT NULL REFERENCES public.personal_notes(id) ON DELETE CASCADE,
  shared_with text NOT NULL REFERENCES public.staff(staff_code) ON DELETE CASCADE,
  shared_by text NOT NULL REFERENCES public.staff(staff_code) ON DELETE CASCADE,
  can_edit boolean NOT NULL DEFAULT false,
  shared_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with)
);

-- ===== RLS =====
ALTER TABLE public.personal_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Allow all CRUD for anon (same pattern as rest of the app)
CREATE POLICY "Allow public select personal_notes" ON public.personal_notes FOR SELECT USING (true);
CREATE POLICY "Allow public insert personal_notes" ON public.personal_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update personal_notes" ON public.personal_notes FOR UPDATE USING (true);
CREATE POLICY "Allow public delete personal_notes" ON public.personal_notes FOR DELETE USING (true);

CREATE POLICY "Allow public select note_shares" ON public.note_shares FOR SELECT USING (true);
CREATE POLICY "Allow public insert note_shares" ON public.note_shares FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update note_shares" ON public.note_shares FOR UPDATE USING (true);
CREATE POLICY "Allow public delete note_shares" ON public.note_shares FOR DELETE USING (true);

-- ===== INDEXES =====
CREATE INDEX IF NOT EXISTS idx_personal_notes_owner ON public.personal_notes(owner_staff_code);
CREATE INDEX IF NOT EXISTS idx_personal_notes_linked ON public.personal_notes(linked_profile_id) WHERE linked_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_note_shares_with ON public.note_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_note_shares_note ON public.note_shares(note_id);
