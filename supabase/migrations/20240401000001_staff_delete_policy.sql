-- Migration: Add DELETE policy for staff table
-- The staff table had RLS enabled with SELECT/INSERT/UPDATE policies but NO DELETE policy,
-- causing the Mini App (using anon key) to fail when trying to delete a staff member.

DROP POLICY IF EXISTS "Allow public delete staff" ON public.staff;
CREATE POLICY "Allow public delete staff" ON public.staff FOR DELETE USING (true);
