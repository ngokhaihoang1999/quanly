-- Xóa các thông báo test cũ
DELETE FROM notifications 
WHERE recipient_staff_code = '000142-NKH' 
  AND body LIKE '[TEST]%';

-- Chèn danh sách thông báo test mới cho các event_type khác nhau
INSERT INTO notifications (
  recipient_staff_code, 
  event_type, 
  title, 
  body, 
  profile_id, 
  source_staff_code, 
  is_read, 
  channel
) VALUES
('000142-NKH', 'new_btvn', '📝 Bài tập về nhà mới', '[TEST] BTVN Buổi 5: Đọc sách và thảo luận nhóm của Nguyễn Tiến Nam', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'new_team_meeting', '🤝 Họp Team mới', '[TEST] Ghi nhận họp Team tuần này về tiến độ học viên', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'hapja_resubmitted', '📝 Hapja sửa xong', '[TEST] Phiếu Hapja của Nguyễn Tiến Nam đã được cập nhật sửa đổi', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'bb_milestone', '🚩 Mốc tiến độ BB (Bài đặc biệt, PV, ĐK Center)', '[TEST] Nguyễn Tiến Nam đã hoàn thành Mốc tiến độ Đăng ký Center', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'mo_kt', '🔑 Xác nhận mở KT', '[TEST] Đã xác nhận mở lớp Kinh Thánh cho học viên Nguyễn Tiến Nam', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'chat_mention', '💬 Thảo luận', '[TEST] Đã nhắc đến bạn trong Thảo luận về Nguyễn Tiến Nam', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app'),
('000142-NKH', 'system', '⚙️ Hệ thống', '[TEST] Thông báo hệ thống khẩn cấp: Bảo trì máy chủ định kỳ', 'bd88348a-9971-4e50-9d89-ddeeccb3e147', '000123-ĐĐC', false, 'app');
