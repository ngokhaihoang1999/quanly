# Mini App — Tài liệu kỹ thuật

## Tổng quan

Loại: Single Page Application (Vanilla HTML/CSS/JS — không framework)  
Mở qua: Telegram WebApp button từ Bot `/start`

---

## Cấu trúc module

```
mini-app/
├── index.html    # HTML template — chỉ markup
├── styles.css    # Design system — CSS variables, components
└── app.js        # Business logic — auth, data, UI
```

---

## 4 Tab chính

| Tab | ID | Nội dung |
|-----|----|----------|
| **🏢 Đơn vị** | `tab-unit` | Metrics đơn vị (theo scope chức vụ), Hapja chờ duyệt, Hồ sơ Trái quả |
| **👤 Cá nhân** | `tab-personal` | Metrics cá nhân (trái tôi chăm, group tham gia), danh sách trái của tôi |
| **👥 TĐ** | `tab-staff` | Danh sách nhân sự, đăng ký mới |
| **🏗️ Cơ cấu** | `tab-structure` | Tree view cấu trúc tổ chức, chỉ định GGN/SGN |

---

## Dashboard — Phạm vi theo chức vụ

### Tab Đơn vị — Scope

| Chức vụ | Phạm vi hiển thị |
|---------|------------------|
| Admin | Toàn hệ thống |
| YJYN | Khu vực mình quản lý |
| TJN | Nhóm mình quản lý |
| GYJN/BGYJN | Tổ mình quản lý |
| GGN/SGN | Cả Khu vực (nơi mình thuộc) |
| TĐ | Tổ mình thuộc |

Metrics: TĐ trong đơn vị, Trái quả, Group, Hapja chờ  
Danh sách trái quả trong đơn vị (deduplicated, max 8)

### Tab Cá nhân — Luôn là dữ liệu cá nhân
- Trái tôi chăm (fruit_roles của staff_code)
- Group tham gia
- Hapja tôi tạo
- Danh sách trái với vai trò (NDD/TVV/GVBB/Lá)

---

## Hapja Detail Modal

Bấm vào phiếu Hapja trên Dashboard → mở modal chi tiết hiện tất cả trường (16 mục).  
Nếu là YJYN/GGN Jondo + status=pending → hiện nút **Duyệt** / **Từ chối** ở dưới modal.  
Duyệt → tự tạo hồ sơ Trái quả.

---

## Cơ cấu — Tính năng

### Hiển thị
- Manager mỗi cấp hiện **mã TĐ + badge chức vụ** (YJYN, TJN, GYJN, BGYJN)
- Thành viên Tổ hiện **mã TĐ + badge** (nếu không phải TĐ)

### Chỉ định GGN/SGN
- YJYN/Admin mở sửa Tổ → mỗi thành viên có **dropdown chức vụ**
- Options: TĐ, GGN Jondo, GGN Chakki, SGN Jondo, BGYJN, GYJN
- Thay đổi → PATCH `/rest/v1/staff` → cập nhật position

---

## Báo cáo — Template fields

### Báo cáo Tư vấn (7 trường)
1. Lần thứ
2. Tên công cụ tư vấn
3. Kết quả test công cụ
4. Vấn đề / Nhu cầu / Thông tin khai thác được
5. Phản hồi / Cảm nhận của trái sau tư vấn
6. Điểm hái trái
7. Đề xuất của TVV

### Báo cáo BB (8 trường)
1. Buổi thứ
2. Nội dung buổi học
3. Phản ứng của HS trong và sau buổi học
4. Khai thác mới về HS
5. Tương tác với HS đáng chú ý
6. Đề xuất hướng chăm sóc tiếp theo
7. Buổi gặp tiếp theo (DD/MM/YYYY HH:mm)
8. Nội dung buổi tiếp theo

---

## Quy tắc hiển thị

- **Mã TĐ**: chỉ hiện code (VD: `000142-NKH`), không kèm tên — áp dụng **toàn bộ** app
- **Chức vụ**: hiện dạng badge màu kế bên mã TĐ
- **Văn phong**: nghiêm túc xuyên suốt
