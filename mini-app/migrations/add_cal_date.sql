-- Add cal_date column to personal_notes for linking notes to calendar dates
ALTER TABLE personal_notes ADD COLUMN IF NOT EXISTS cal_date DATE;

-- Index for efficient calendar queries
CREATE INDEX IF NOT EXISTS idx_personal_notes_cal_date ON personal_notes(cal_date) WHERE cal_date IS NOT NULL;
