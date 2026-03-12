-- Migration: Check Hapja System (Phiếu sàng lọc + Duyệt)

-- ============================================================
-- 1. Bảng Check Hapja
-- ============================================================
CREATE TABLE IF NOT EXISTS public.check_hapja (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Thông tin cá/trái
  full_name text NOT NULL,
  birth_year text,
  gender text,
  -- Thông tin Check Hapja (9 mục + lý do loại)
  data jsonb NOT NULL DEFAULT '{}',
  -- Workflow
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by text NOT NULL REFERENCES public.staff(staff_code),
  approved_by text REFERENCES public.staff(staff_code),
  rejection_reason text,
  -- Liên kết với profile (tạo sau khi duyệt)
  profile_id uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  approved_at timestamptz
);

ALTER TABLE public.check_hapja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage check_hapja" ON public.check_hapja;
CREATE POLICY "Allow public manage check_hapja" ON public.check_hapja FOR ALL USING (true);

-- ============================================================
-- 2. Cập nhật bảng profiles: thêm trường cho Hồ sơ Trái quả mới
-- ============================================================
-- Trường bìa hồ sơ
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_year text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;
-- Phiếu Thông tin (23 mục) — lưu JSON
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS info_sheet jsonb DEFAULT '{}';
-- Trạng thái
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
