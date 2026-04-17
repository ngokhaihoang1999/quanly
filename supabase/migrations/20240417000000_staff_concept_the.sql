-- Add sinka_info column to staff table for Sinka identity (Tên/Bộ/KV/SĐT)
-- Safe: uses ADD COLUMN IF NOT EXISTS, works whether concept_the exists or not
DO $$
BEGIN
  -- If concept_the exists (from earlier migration), rename it
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='concept_the') THEN
    ALTER TABLE staff RENAME COLUMN concept_the TO sinka_info;
  -- Otherwise create fresh
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='sinka_info') THEN
    ALTER TABLE staff ADD COLUMN sinka_info TEXT DEFAULT NULL;
  END IF;
END $$;
