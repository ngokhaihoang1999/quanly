-- Migration: Fix All RLS Policies for Full Mini App Compatibility
-- Date: 2026-06-03
-- Purpose: Ensure all Mini App operations (managing positions, semesters, profiles, records, notes, and staff) work seamlessly with anon key while RLS remains enabled.

-- 1. Table: positions
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "positions_select_policy" ON public.positions;
DROP POLICY IF EXISTS "positions_insert_policy" ON public.positions;
DROP POLICY IF EXISTS "positions_update_policy" ON public.positions;
DROP POLICY IF EXISTS "positions_delete_policy" ON public.positions;

CREATE POLICY "positions_select_policy" ON public.positions FOR SELECT USING (true);
CREATE POLICY "positions_insert_policy" ON public.positions FOR INSERT WITH CHECK (true);
CREATE POLICY "positions_update_policy" ON public.positions FOR UPDATE USING (true);
CREATE POLICY "positions_delete_policy" ON public.positions FOR DELETE USING (true);

-- 2. Table: semesters
ALTER TABLE IF EXISTS public.semesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "semesters_select_policy" ON public.semesters;
DROP POLICY IF EXISTS "semesters_insert_policy" ON public.semesters;
DROP POLICY IF EXISTS "semesters_update_policy" ON public.semesters;
DROP POLICY IF EXISTS "semesters_delete_policy" ON public.semesters;

CREATE POLICY "semesters_select_policy" ON public.semesters FOR SELECT USING (true);
CREATE POLICY "semesters_insert_policy" ON public.semesters FOR INSERT WITH CHECK (true);
CREATE POLICY "semesters_update_policy" ON public.semesters FOR UPDATE USING (true);
CREATE POLICY "semesters_delete_policy" ON public.semesters FOR DELETE USING (true);

-- 3. Table: profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (true);

-- 4. Table: form_hanh_chinh
ALTER TABLE IF EXISTS public.form_hanh_chinh ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "form_hanh_chinh_delete_policy" ON public.form_hanh_chinh;
CREATE POLICY "form_hanh_chinh_delete_policy" ON public.form_hanh_chinh FOR DELETE USING (true);

-- 5. Table: records
ALTER TABLE IF EXISTS public.records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "records_delete_policy" ON public.records;
CREATE POLICY "records_delete_policy" ON public.records FOR DELETE USING (true);

-- 6. Table: personal_notes
ALTER TABLE IF EXISTS public.personal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "personal_notes_delete_policy" ON public.personal_notes;
CREATE POLICY "personal_notes_delete_policy" ON public.personal_notes FOR DELETE USING (true);
