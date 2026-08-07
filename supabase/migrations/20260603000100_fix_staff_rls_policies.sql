-- Migration: Fix Staff RLS Policies for Mini App Management
-- Date: 2026-06-03
-- Purpose: Allow Mini App (using anon key) to add, update, and manage staff members.

ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_insert_policy" ON public.staff;
DROP POLICY IF EXISTS "staff_update_policy" ON public.staff;
DROP POLICY IF EXISTS "staff_delete_policy" ON public.staff;

CREATE POLICY "staff_insert_policy" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "staff_update_policy" ON public.staff FOR UPDATE USING (true);
CREATE POLICY "staff_delete_policy" ON public.staff FOR DELETE USING (true);
