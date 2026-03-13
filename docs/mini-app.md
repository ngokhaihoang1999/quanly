# Mini App — Tài liệu kỹ thuật

## Tổng quan

Loại: Single Page Application (Vanilla HTML/CSS/JS — không framework)  
Mở qua: Telegram WebApp button từ Bot `/start`

---

## Cấu trúc module

```
mini-app/
├── index.html    # HTML template — chỉ markup (~278 dòng)
├── styles.css    # Design system — CSS variables, components (~170 dòng)
└── app.js        # Business logic — auth, data, UI (~994 dòng)
```

### Nguyên tắc thiết kế
- **Structure (HTML)** · **Presentation (CSS)** · **Behavior (JS)** tách biệt
- CSS dùng **CSS Variables** cho theming (dark/light mode)
- JS là vanilla — không dependency, load sau HTML render
- Supabase REST API gọi trực tiếp qua `sbFetch()` wrapper

---

## Authentication Flow
```
Telegram.WebApp.initDataUnsafe.user.id
  → sbFetch('/rest/v1/staff?telegram_id=eq.{id}')
  → Xác định staff_code, position
  → Load dashboard theo quyền
  → Admin: hiện View-As dropdown
```

---

## Modules trong app.js

### Helpers (global)
| Hàm | Mục đích |
|-----|----------|
| `sbFetch(path, opts)` | Wrapper gọi Supabase REST API |
| `getStaffCodeFromInput(id)` | Trích mã TĐ từ searchable input |
| `setStaffInputValue(id, code)` | Set giá trị searchable input |
| `populateStaffSelect(inputId)` | Populate datalist cho input search |
| `openGroupChat(url)` | Mở group Telegram qua WebApp SDK |
| `showToast(msg)` | Hiện toast notification |

### Dashboard
- Metrics responsive theo chức vụ (Admin/YJYN: overview; TJN/GYJN: manager; TĐ: personal)
- Danh sách hồ sơ gần đây + Hapja chờ duyệt

### Profiles (Hồ sơ)
- CRUD hồ sơ — 4 sub-tab:
  - **Trang bìa:** roles (NDD, TVV, GVBB, Lá) auto-sync từ `fruit_roles` + nút truy cập group
  - **Phiếu Thông tin:** 23 mục → `form_hanh_chinh.data` (JSON)
  - **Báo cáo Tư vấn:** Multiple records — click to view/edit (PATCH)
  - **Biên bản BB:** Multiple records — click to view/edit (PATCH)

### Staff (Nhân sự)
- Danh sách, tìm kiếm, đăng ký mới

### Structure (Cơ cấu)
- Tree view: Khu vực → Nhóm → Tổ → Thành viên
- Click node → modal sửa (tên, quản lý, thành viên)
- Permission-aware: chỉ hiện ✏️ cho node mình quản lý

---

## styles.css — Design System

### CSS Variables
```css
:root {                     /* Dark theme (default) */
  --bg, --surface, --surface2, --border
  --accent, --accent2, --green, --red, --yellow
  --text, --text2, --text3
  --radius, --radius-sm
  --header-bg, --modal-bg, --fab-shadow
}
[data-theme="light"] { ... }  /* Light theme override */
```

### Component classes
| Class | Mô tả |
|-------|-------|
| `.header` | Sticky header gradient |
| `.tab-bar` / `.tab` | Navigation tabs |
| `.profile-card` / `.staff-card` | List item cards |
| `.dash-stat` / `.dash-card` | Dashboard metrics |
| `.form-tab` / `.form-card` | Profile detail tabs |
| `.record-item` | Record list item |
| `.modal-overlay` / `.modal` | Bottom sheet modal |
| `.tree-node` | Structure tree node |
| `.fab` | Floating action button |
| `.toast` | Toast notification |
