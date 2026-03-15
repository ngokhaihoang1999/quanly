-- Add is_kt_opened column to profiles to track if KT is opened (valid for bb, center phases)
ALTER TABLE profiles ADD COLUMN is_kt_opened BOOLEAN DEFAULT FALSE;
