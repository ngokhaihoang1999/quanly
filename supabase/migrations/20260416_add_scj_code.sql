-- Add SCJ code column to staff table
-- Mã TĐ SCJ: mã định danh riêng trong SCJ, khác với staff_code (mã JD đăng nhập)
-- Mỗi TĐ tự điền trong phần Cá nhân hoá -> dùng cho Giấy Sinka

ALTER TABLE staff ADD COLUMN IF NOT EXISTS scj_code TEXT DEFAULT NULL;

COMMENT ON COLUMN staff.scj_code IS 'Mã định danh TĐ trong SCJ (khác với staff_code). TĐ tự nhập trong Cá nhân hoá.';
