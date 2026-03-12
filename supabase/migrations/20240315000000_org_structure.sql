-- Migration: Organizational Structure (Khu vực → Nhóm → Tổ)
-- + Update staff table with new position system

-- ============================================================
-- 1. Bảng Khu vực (Areas)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.areas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  created_by text REFERENCES public.staff(staff_code),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage areas" ON public.areas;
CREATE POLICY "Allow public manage areas" ON public.areas FOR ALL USING (true);

-- ============================================================
-- 2. Bảng Nhóm (Groups) — thuộc Khu vực
-- ============================================================
CREATE TABLE IF NOT EXISTS public.org_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  area_id uuid NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by text REFERENCES public.staff(staff_code),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.org_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage org_groups" ON public.org_groups;
CREATE POLICY "Allow public manage org_groups" ON public.org_groups FOR ALL USING (true);

-- ============================================================
-- 3. Bảng Tổ (Teams) — thuộc Nhóm
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.org_groups(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by text REFERENCES public.staff(staff_code),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage teams" ON public.teams;
CREATE POLICY "Allow public manage teams" ON public.teams FOR ALL USING (true);

-- ============================================================
-- 4. Cập nhật bảng Staff: thêm position (chức vụ mới) + team_id
-- ============================================================
-- Chức vụ mới: td, bgyjn, gyjn, thu_ki_jondo, ggn_jondo, ggn_chakki, tjn, yjyn, admin
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS position text DEFAULT 'td';
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id);

-- Migrate dữ liệu cũ: role → position
UPDATE public.staff SET position = 'admin' WHERE role = 'admin';
UPDATE public.staff SET position = 'td' WHERE role IS NULL OR role NOT IN ('admin');
