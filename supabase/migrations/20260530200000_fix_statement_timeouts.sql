-- Migration: Additional Performance Indexes to Fix Statement Timeouts
-- Target: records, check_hapja

-- 1. Index on check_hapja(profile_id) to optimize `/check_hapja?profile_id=eq...` queries
CREATE INDEX IF NOT EXISTS idx_check_hapja_profile_id_perf 
  ON public.check_hapja (profile_id);

-- 2. Composite index on check_hapja(semester_id, status, created_at DESC) to optimize the dashboard status query
CREATE INDEX IF NOT EXISTS idx_check_hapja_sem_status_created_perf 
  ON public.check_hapja (semester_id, status, created_at DESC);

-- 3. Composite index on records(profile_id, record_type, created_at DESC) to optimize journey timeline fetching
CREATE INDEX IF NOT EXISTS idx_records_profile_type_created_perf 
  ON public.records (profile_id, record_type, created_at DESC);
