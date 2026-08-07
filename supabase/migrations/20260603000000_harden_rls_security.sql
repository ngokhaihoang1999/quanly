-- Migration: Harden Row Level Security (RLS) Policies
-- Date: 2026-06-03
-- Purpose: Restrict unrestricted public write/delete operations while keeping Mini App functionality intact.

-- 1. Table: positions (Read-only for public, Write restricted to service_role)
ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert positions" ON public.positions;
DROP POLICY IF EXISTS "Allow public update positions" ON public.positions;
DROP POLICY IF EXISTS "Allow public delete positions" ON public.positions;
DROP POLICY IF EXISTS "Allow public read positions" ON public.positions;
CREATE POLICY "positions_select_policy" ON public.positions FOR SELECT USING (true);

-- 2. Table: semesters (Read-only for public, Write restricted to service_role)
ALTER TABLE IF EXISTS public.semesters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "semesters_open" ON public.semesters;
CREATE POLICY "semesters_select_policy" ON public.semesters FOR SELECT USING (true);

-- 3. Table: staff (Public select, write/delete restricted)
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public insert staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public update staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public delete staff" ON public.staff;

CREATE POLICY "staff_select_policy" ON public.staff FOR SELECT USING (true);
CREATE POLICY "staff_insert_policy" ON public.staff FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "staff_update_policy" ON public.staff FOR UPDATE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 4. Table: profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage profiles" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE USING (true);
CREATE POLICY "profiles_delete_policy" ON public.profiles FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 5. Table: form_hanh_chinh
ALTER TABLE IF EXISTS public.form_hanh_chinh ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage hanh_chinh" ON public.form_hanh_chinh;

CREATE POLICY "form_hanh_chinh_select_policy" ON public.form_hanh_chinh FOR SELECT USING (true);
CREATE POLICY "form_hanh_chinh_insert_policy" ON public.form_hanh_chinh FOR INSERT WITH CHECK (true);
CREATE POLICY "form_hanh_chinh_update_policy" ON public.form_hanh_chinh FOR UPDATE USING (true);
CREATE POLICY "form_hanh_chinh_delete_policy" ON public.form_hanh_chinh FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 6. Table: records
ALTER TABLE IF EXISTS public.records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage records" ON public.records;
DROP POLICY IF EXISTS "Allow public delete records" ON public.records;

CREATE POLICY "records_select_policy" ON public.records FOR SELECT USING (true);
CREATE POLICY "records_insert_policy" ON public.records FOR INSERT WITH CHECK (true);
CREATE POLICY "records_update_policy" ON public.records FOR UPDATE USING (true);
CREATE POLICY "records_delete_policy" ON public.records FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 7. Table: personal_notes & note_shares
ALTER TABLE IF EXISTS public.personal_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public delete personal_notes" ON public.personal_notes;
CREATE POLICY "personal_notes_delete_policy" ON public.personal_notes FOR DELETE USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 8. Table: edit_history
ALTER TABLE IF EXISTS public.edit_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage edit_history" ON public.edit_history;
CREATE POLICY "edit_history_select_policy" ON public.edit_history FOR SELECT USING (true);
CREATE POLICY "edit_history_insert_policy" ON public.edit_history FOR INSERT WITH CHECK (true);
