-- Migration: Drop foreign key constraint on consultation_sessions.tvv_staff_code to allow unregistered TVV
ALTER TABLE public.consultation_sessions DROP CONSTRAINT IF EXISTS consultation_sessions_tvv_staff_code_fkey;
