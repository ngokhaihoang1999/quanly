-- Migration: Performance & Disk I/O Optimization Indexes
-- Fixes High Disk IO Consumption on Supabase instance smzoomekyvllsgppgvxw

-- 1. Index on profile_records(profile_id, record_type, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_profile_records_profile_type_created
  ON public.profile_records (profile_id, record_type, created_at DESC);

-- 2. Index on profile_records(profile_id, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_profile_records_profile_created
  ON public.profile_records (profile_id, created_at DESC);

-- 3. Index on consultation_sessions(profile_id, session_number ASC)
CREATE INDEX IF NOT EXISTS idx_consultation_sessions_profile_session
  ON public.consultation_sessions (profile_id, session_number ASC);

-- 4. Index on fruit_groups(profile_id)
CREATE INDEX IF NOT EXISTS idx_fruit_groups_profile_id
  ON public.fruit_groups (profile_id);

-- 5. Index on fruit_roles(fruit_group_id, role_type)
CREATE INDEX IF NOT EXISTS idx_fruit_roles_group_role
  ON public.fruit_roles (fruit_group_id, role_type);
