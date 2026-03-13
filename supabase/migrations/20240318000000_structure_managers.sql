-- Migration: Add manager assignments to structure tables
-- YJYN manages Area, TJN manages Group, GYJN/BGYJN manages Team

-- 1. Khu vực: YJYN quản lý
ALTER TABLE public.areas ADD COLUMN IF NOT EXISTS yjyn_staff_code text REFERENCES public.staff(staff_code);

-- 2. Nhóm: TJN quản lý
ALTER TABLE public.org_groups ADD COLUMN IF NOT EXISTS tjn_staff_code text REFERENCES public.staff(staff_code);

-- 3. Tổ: GYJN + BGYJN quản lý
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS gyjn_staff_code text REFERENCES public.staff(staff_code);
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS bgyjn_staff_code text REFERENCES public.staff(staff_code);
