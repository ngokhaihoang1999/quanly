-- Migration: Dynamic Positions & Permissions System
-- Thay thế hệ thống chức vụ hard-code bằng hệ thống động từ DB

-- 1. Bảng positions: định nghĩa chức vụ
CREATE TABLE IF NOT EXISTS public.positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'management' CHECK (category IN ('management', 'specialist')),
  scope_level TEXT NOT NULL DEFAULT 'team' CHECK (scope_level IN ('system', 'area', 'group', 'team')),
  level INT NOT NULL DEFAULT 0,
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_system BOOLEAN DEFAULT FALSE,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. RLS cho positions
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read positions" ON public.positions;
CREATE POLICY "Allow public read positions" ON public.positions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow public insert positions" ON public.positions;
CREATE POLICY "Allow public insert positions" ON public.positions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Allow public update positions" ON public.positions;
CREATE POLICY "Allow public update positions" ON public.positions FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Allow public delete positions" ON public.positions;
CREATE POLICY "Allow public delete positions" ON public.positions FOR DELETE USING (true);

-- 3. Thêm cột specialist_position vào staff
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS specialist_position TEXT;

-- 4. Seed chức vụ mặc định (Quản trị)
INSERT INTO public.positions (code, name, category, scope_level, level, permissions, is_system, color)
VALUES
  ('admin', 'Admin', 'management', 'system', 100,
   '["manage_positions","manage_structure","assign_position","manage_staff","create_hapja","approve_hapja","assign_role","link_profile","change_phase","toggle_kt","toggle_fruit_status","edit_profile","create_report","delete_record","view_dashboard"]'::jsonb,
   TRUE, '#ef4444'),

  ('yjyn', 'YJYN', 'management', 'area', 80,
   '["manage_structure","assign_position","create_hapja","approve_hapja","assign_role","link_profile","toggle_kt","toggle_fruit_status","edit_profile","create_report","delete_record","view_dashboard"]'::jsonb,
   TRUE, '#8b5cf6'),

  ('tjn', 'TJN', 'management', 'group', 60,
   '["assign_position","create_hapja","assign_role","link_profile","change_phase","toggle_kt","toggle_fruit_status","edit_profile","create_report","delete_record","view_dashboard"]'::jsonb,
   TRUE, '#3b82f6'),

  ('gyjn', 'GYJN (Tổ trưởng)', 'management', 'team', 40,
   '["assign_position","create_hapja","assign_role","link_profile","toggle_kt","toggle_fruit_status","edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#10b981'),

  ('bgyjn', 'BGYJN (Tổ phó)', 'management', 'team', 30,
   '["create_hapja","toggle_kt","toggle_fruit_status","edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#14b8a6'),

  ('td', 'TĐ', 'management', 'team', 10,
   '["edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#6b7280')
ON CONFLICT (code) DO NOTHING;

-- 5. Seed chức vụ mặc định (Chuyên môn)
INSERT INTO public.positions (code, name, category, scope_level, level, permissions, is_system, color)
VALUES
  ('ggn_jondo', 'GGN Jondo', 'specialist', 'area', 60,
   '["create_hapja","approve_hapja","assign_role","link_profile","change_phase","toggle_kt","toggle_fruit_status","edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#f59e0b'),

  ('ggn_chakki', 'GGN Chakki', 'specialist', 'area', 60,
   '["create_hapja","edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#f97316'),

  ('sgn_jondo', 'SGN Jondo', 'specialist', 'area', 60,
   '["create_hapja","edit_profile","create_report","view_dashboard"]'::jsonb,
   TRUE, '#eab308')
ON CONFLICT (code) DO NOTHING;
