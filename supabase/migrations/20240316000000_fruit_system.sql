-- Migration: Fruit Group System (Group Trái quả + Vai trò)

-- ============================================================
-- 1. Bảng Group Trái quả (Telegram Group Chat gắn với 1 profile)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fruit_groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_group_id bigint UNIQUE NOT NULL,
  telegram_group_title text,
  profile_id uuid REFERENCES public.profiles(id),
  level text NOT NULL DEFAULT 'tu_van' CHECK (level IN ('tu_van', 'bb')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fruit_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage fruit_groups" ON public.fruit_groups;
CREATE POLICY "Allow public manage fruit_groups" ON public.fruit_groups FOR ALL USING (true);

-- ============================================================
-- 2. Bảng Vai trò trong Group Trái quả (NDD, TVV, GVBB, Lá)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fruit_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  fruit_group_id uuid NOT NULL REFERENCES public.fruit_groups(id) ON DELETE CASCADE,
  staff_code text NOT NULL REFERENCES public.staff(staff_code),
  role_type text NOT NULL CHECK (role_type IN ('ndd', 'tvv', 'gvbb', 'la')),
  assigned_by text REFERENCES public.staff(staff_code),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(fruit_group_id, staff_code, role_type)
);

ALTER TABLE public.fruit_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage fruit_roles" ON public.fruit_roles;
CREATE POLICY "Allow public manage fruit_roles" ON public.fruit_roles FOR ALL USING (true);
