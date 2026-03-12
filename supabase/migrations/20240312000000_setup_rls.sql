-- Migration: Setup RLS Policies for Mini App
-- Cho phép Mini App có thể đọc/ghi dữ liệu công khai (dùng anon key)

-- 1. Quyền cho bảng Staff
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
CREATE POLICY "Allow public read staff" ON public.staff FOR SELECT USING (true);

-- 2. Quyền cho bảng Profiles (Tờ 1)
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage profiles" ON public.profiles;
CREATE POLICY "Allow public manage profiles" ON public.profiles FOR ALL USING (true);

-- 3. Quyền cho bảng Form Hành Chính (Tờ 2)
ALTER TABLE IF EXISTS public.form_hanh_chinh ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage hanh_chinh" ON public.form_hanh_chinh;
CREATE POLICY "Allow public manage hanh_chinh" ON public.form_hanh_chinh FOR ALL USING (true);

-- 4. Quyền cho bảng Records (Tờ 3, 4)
ALTER TABLE IF EXISTS public.records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage records" ON public.records;
CREATE POLICY "Allow public manage records" ON public.records FOR ALL USING (true);
