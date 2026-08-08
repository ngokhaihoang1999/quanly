-- Migration: Guarantee Full RLS Policies on profile_records and records
-- Purpose: Ensure anon key has full select/insert/update/delete permissions for both profile_records and records tables

ALTER TABLE IF EXISTS public.profile_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage profile_records" ON public.profile_records;
DROP POLICY IF EXISTS "profile_records_select_policy" ON public.profile_records;
DROP POLICY IF EXISTS "profile_records_insert_policy" ON public.profile_records;
DROP POLICY IF EXISTS "profile_records_update_policy" ON public.profile_records;
DROP POLICY IF EXISTS "profile_records_delete_policy" ON public.profile_records;

CREATE POLICY "Allow public manage profile_records" ON public.profile_records FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE IF EXISTS public.records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage records" ON public.records;
DROP POLICY IF EXISTS "records_select_policy" ON public.records;
DROP POLICY IF EXISTS "records_insert_policy" ON public.records;
DROP POLICY IF EXISTS "records_update_policy" ON public.records;
DROP POLICY IF EXISTS "records_delete_policy" ON public.records;

CREATE POLICY "Allow public manage records" ON public.records FOR ALL USING (true) WITH CHECK (true);
