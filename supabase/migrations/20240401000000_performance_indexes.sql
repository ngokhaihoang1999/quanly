-- Migration: Performance Indexes for Scale (100-1000 users)
-- Adds missing indexes on frequently queried columns to eliminate full table scans

-- ============================================================
-- 1. staff — telegram_id (every bot request authenticates by this)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_staff_telegram_id ON public.staff (telegram_id);

-- ============================================================
-- 2. fruit_groups — telegram_group_id (group handler lookups)
-- ============================================================
-- Already has UNIQUE constraint which creates an index, but let's be explicit
CREATE INDEX IF NOT EXISTS idx_fruit_groups_profile_id ON public.fruit_groups (profile_id);

-- ============================================================
-- 3. fruit_roles — staff_code (dashboard heavy queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_fruit_roles_staff_code ON public.fruit_roles (staff_code);
CREATE INDEX IF NOT EXISTS idx_fruit_roles_fruit_group_id ON public.fruit_roles (fruit_group_id);
CREATE INDEX IF NOT EXISTS idx_fruit_roles_role_type ON public.fruit_roles (role_type);

-- ============================================================
-- 4. records — profile_id + record_type (dashboard pre-fetch, mindmap)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_records_profile_id ON public.records (profile_id);
CREATE INDEX IF NOT EXISTS idx_records_profile_type ON public.records (profile_id, record_type);
CREATE INDEX IF NOT EXISTS idx_records_created_at ON public.records (created_at DESC);

-- ============================================================
-- 5. check_hapja — status + created_by (dashboard hapja queries)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_check_hapja_status ON public.check_hapja (status);
CREATE INDEX IF NOT EXISTS idx_check_hapja_created_by ON public.check_hapja (created_by);
CREATE INDEX IF NOT EXISTS idx_check_hapja_semester_id ON public.check_hapja (semester_id);

-- ============================================================
-- 6. form_hanh_chinh — profile_id (profile detail, mindmap)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_form_hanh_chinh_profile_id ON public.form_hanh_chinh (profile_id);

-- ============================================================
-- 7. profiles — semester_id (semester filter)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_semester_id ON public.profiles (semester_id);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- ============================================================
-- 8. consultation_sessions — profile_id (dashboard session fetch)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_profile_id ON public.consultation_sessions (profile_id);
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_created_at ON public.consultation_sessions (created_at DESC);

-- ============================================================
-- 9. calendar_events — for calendar tab
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_calendar_events_staff_code ON public.calendar_events (staff_code);

-- ============================================================
-- 10. Composite index for common dashboard query pattern
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_check_hapja_composite ON public.check_hapja (status, created_by, semester_id);
