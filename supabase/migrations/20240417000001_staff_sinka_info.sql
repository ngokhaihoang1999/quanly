-- Add sinka_info column to staff table for Sinka identity (Tên/Bộ/KV/SĐT)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS sinka_info TEXT DEFAULT NULL;
-- Drop concept_the if it exists (was temporary)
ALTER TABLE staff DROP COLUMN IF EXISTS concept_the;
