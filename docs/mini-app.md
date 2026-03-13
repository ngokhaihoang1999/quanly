# Mini App — Tài liệu kỹ thuật

## Tổng quan

File: `mini-app/index.html`  
Loại: Single Page Application (Vanilla HTML/CSS/JS)  
Mở qua: Telegram WebApp button từ Bot `/start`

---

## Kiến trúc

- **Không framework** — một file HTML duy nhất chứa toàn bộ CSS + JS
- **Supabase REST API** — gọi trực tiếp qua `sbFetch()` helper
- **Telegram WebApp SDK** — nhận `initData` để xác thực user

### Authentication Flow
```
Telegram.WebApp.initDataUnsafe.user.id
  → sbFetch('/rest/v1/staff?telegram_id=eq.{id}')
  → Xác định staff_code, position
  → Load dashboard theo quyền
```

### View As (Admin)
Admin có thể giả lập quyền hạn của bất kỳ chức vụ nào qua dropdown "Test:" ở header.

---

## 4 Tab chính

### 1. Dashboard
- **Admin/YJYN:** Tổng TĐ, Tổng hồ sơ, Hapja chờ duyệt, Tổng Group
- **TJN/GYJN/BGYJN:** Trái đang chăm, Hapja cần duyệt, Group tham gia
- **TĐ/TVV/NDD:** Trái đang chăm, Group tham gia, Hapja của tôi

Bên dưới: danh sách hồ sơ gần đây + phiếu Hapja chờ duyệt

### 2. Hồ sơ Trái quả
- Danh sách + tìm kiếm
- Xem chi tiết: 4 sub-tab

#### Sub-tab: Trang bìa
| Field | Ghi chú |
|-------|---------|
| Tên trái quả | `profiles.full_name` |
| Năm sinh | `profiles.birth_year` |
| Giới tính | `profiles.gender` |
| NDD | Searchable datalist → `profiles.ndd_staff_code` |
| TVV | `profiles.info_sheet.tvv_name` hoặc đọc từ `fruit_roles` |
| GVBB | Ưu tiên đọc từ `fruit_roles` (Bot gán), fallback `info_sheet.gvbb_name` |
| Lá | `profiles.info_sheet.la_name` |
| Truy cập group | Nút → `Telegram.WebApp.openTelegramLink(t.me/c/{id}/1)` |

#### Sub-tab: Phiếu Thông tin
- 23 mục hành chính (họ tên, nghề nghiệp, tôn giáo, tính cách,...)
- Lưu vào `form_hanh_chinh.data` (JSON)

#### Sub-tab: Báo cáo Tư vấn
- Nhiều phiếu — lưu vào `records` (record_type = `tu_van`)
- 6 fields: tên công cụ, kết quả test, biên bản, phản hồi, lịch hẹn, đề xuất
- **Bấm vào phiếu → mở modal xem/sửa nội dung (PATCH)**

#### Sub-tab: Biên bản BB
- Nhiều phiếu — lưu vào `records` (record_type = `bien_ban`)
- 7 fields: mục tiêu, phản hồi HS, tình hình, nội dung, vấn đề mới, đề xuất, lưu ý
- **Bấm vào phiếu → mở modal xem/sửa nội dung (PATCH)**

### 3. TĐ (Nhân sự)
- Danh sách toàn bộ TĐ + badge chức vụ
- Tìm kiếm theo tên/mã/chức vụ
- Đăng ký TĐ mới (cần chức vụ phù hợp)

### 4. Cơ cấu
- Tree view: Khu vực → Nhóm → Tổ
- Bấm vào node → modal sửa (đổi tên, gán quản lý, quản lý thành viên Tổ)
- Nút tạo mới từng tầng
- Quyền: Admin/YJYN

---

## Hàm helper quan trọng

| Hàm | Mục đích |
|-----|----------|
| `sbFetch(path, opts)` | Wrapper gọi Supabase REST API với auth header |
| `getStaffCodeFromInput(id)` | Trích mã TĐ từ searchable input `"NKH (000142-NKH)"` → `"000142-NKH"` |
| `setStaffInputValue(id, code)` | Đặt giá trị searchable input từ mã TĐ |
| `populateStaffSelect(inputId, ...)` | Populate datalist options cho ô tìm TĐ |
| `getChipValues(containerId)` | Lấy mảng chip đã chọn |
| `getCurrentPosition()` | Lấy chức vụ hiện tại (có View As) |
| `getEffectiveStaffCode()` | Lấy mã TĐ hiện tại (có View As) |
| `openGroupChat(url)` | Mở group Telegram qua WebApp SDK |

---

## Các Modal

| Modal | Trigger | Dữ liệu |
|-------|---------|----------|
| Check Hapja | FAB ＋ | 12 mục sàng lọc → `check_hapja` |
| Thêm/Sửa phiếu | Nút "＋ Thêm" hoặc bấm vào phiếu | `records` |
| Thêm TĐ | Tab TĐ → nút thêm | `staff` |
| Tạo cấu trúc | Tab Cơ cấu → nút tạo | `areas` / `org_groups` / `teams` |
| Sửa cấu trúc | Bấm vào node cơ cấu | update tương ứng |
