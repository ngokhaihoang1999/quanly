-- =====================================================
-- Semesters (Khai Giảng) system
-- =====================================================

-- 1. Bảng Khai Giảng
CREATE TABLE IF NOT EXISTS semesters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean DEFAULT false,
  created_by text,
  created_at timestamptz DEFAULT now()
);

-- 2. Tag profiles theo semester
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES semesters(id);

-- 3. Tag check_hapja theo semester
ALTER TABLE check_hapja ADD COLUMN IF NOT EXISTS semester_id uuid REFERENCES semesters(id);

-- 4. RLS
ALTER TABLE semesters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "semesters_open" ON semesters FOR ALL USING (true);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_semester ON profiles(semester_id);
CREATE INDEX IF NOT EXISTS idx_hapja_semester ON check_hapja(semester_id);
