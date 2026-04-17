-- Add concept_the column to staff table for Sinka auto-fill
ALTER TABLE staff ADD COLUMN IF NOT EXISTS concept_the TEXT DEFAULT NULL;
