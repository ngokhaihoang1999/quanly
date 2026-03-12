-- Migration: Add columns for Staff Management feature
-- Thêm cột level, phone, email cho bảng staff để hỗ trợ quản lý cấp bậc, chức vụ

-- 1. Thêm cột level (cấp độ: thuc_tap, chinh_thuc, truong_nhom, quan_ly)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS level text DEFAULT 'chinh_thuc';

-- 2. Thêm cột phone (số điện thoại nhân viên)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone text;

-- 3. Thêm cột email
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email text;

-- 4. Đảm bảo RLS cho bảng staff cho phép Mini App đọc/ghi
ALTER TABLE IF EXISTS public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read staff" ON public.staff;
CREATE POLICY "Allow public read staff" ON public.staff FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert staff" ON public.staff;
CREATE POLICY "Allow public insert staff" ON public.staff FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update staff" ON public.staff;
CREATE POLICY "Allow public update staff" ON public.staff FOR UPDATE USING (true);
