-- Migration: Pending approval flow + Support messages + Seed TĐ list

-- 1. Thêm cột pending cho bảng staff (phục vụ duyệt đổi Telegram ID)
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pending_telegram_id bigint;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS pending_requested_at timestamptz;

-- 2. Tạo bảng support_messages (kênh hỗ trợ 2 chiều)
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  from_staff_code text NOT NULL,
  from_telegram_id bigint,
  to_staff_code text,
  message text,
  direction text NOT NULL CHECK (direction IN ('to_admin', 'from_admin')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public manage support_messages" ON public.support_messages;
CREATE POLICY "Allow public manage support_messages" ON public.support_messages FOR ALL USING (true);

-- 3. Seed danh sách TĐ ban đầu
-- (ON CONFLICT DO NOTHING để không lỗi nếu đã tồn tại)
INSERT INTO public.staff (full_name, staff_code, role, level) VALUES
  ('TNHA', '000707-TNHA', 'ndd', 'chinh_thuc'),
  ('NKH',  '000142-NKH',  'admin', 'quan_ly'),
  ('NĐH',  '000105-NDH',  'ndd', 'chinh_thuc'),
  ('DHV',  '000481-DHV',  'ndd', 'chinh_thuc'),
  ('ĐXV',  '000118-DXV',  'ndd', 'chinh_thuc'),
  ('LTTL', '000054-LTTL', 'ndd', 'chinh_thuc'),
  ('PHHT', '000145-PHHT', 'ndd', 'chinh_thuc')
ON CONFLICT (staff_code) DO NOTHING;
