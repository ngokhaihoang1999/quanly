# Mini App — Tài liệu kỹ thuật

## Tổng quan

Loại: Single Page Application (Vanilla HTML/CSS/JS — không framework)  
Mở qua: Telegram WebApp button từ Bot `/start`

---

## Cấu trúc module

```
mini-app/
├── index.html       # HTML template — chỉ markup, không chứa logic
├── styles.css       # Design system — CSS variables, components, dark/light theme
├── core.js          # Khởi tạo, sbFetch, helpers, globals, toggleFruitStatus, toggleTheme
├── dashboard.js     # Tab Đơn vị & Cá nhân: metrics, sub-unit tree, hapja, profile list
├── profiles.js      # Chi tiết hồ sơ, renderProfiles, saveInfoSheet, loadRecords
├── hapja.js         # Phiếu Check Hapja: tạo, duyệt, từ chối
├── records.js       # Chốt TV/BB/Center, Báo cáo TV/BB, Undo/Revert logic
├── staff.js         # Tab TĐ: danh sách, đăng ký mới
└── structure.js     # Tab Cơ cấu: tree view, chỉ định GGN/SGN
```

---

## 4 Tab chính

| Tab | ID | Nội dung |
|-----|----|----------|
| **🏢 Đơn vị** | `tab-unit` | Metrics đơn vị, sub-unit tree (Nhóm/Tổ), Hapja chờ duyệt, Hồ sơ Trái quả |
| **👤 Cá nhân** | `tab-personal` | Metrics cá nhân (trái tôi chăm, group tham gia), danh sách trái của tôi |
| **👥 TĐ** | `tab-staff` | Danh sách nhân sự, đăng ký mới |
| **🏗️ Cơ cấu** | `tab-structure` | Tree view cơ cấu tổ chức, chỉ định GGN/SGN |

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

### Metrics (4 stat cards — bấm để mở popup chi tiết)
- 🍎 **Trái Hapja** — phiếu check_hapja đã duyệt (`status=approved`)
- 💬 **Trái TV** — profile có TVV là thành viên đơn vị, fruit_status=alive
- 🎓 **Trái BB** — profile có GVBB là thành viên đơn vị, fruit_status=alive
- 👥 **Group BB** — fruit_group level=bb có NDD là thành viên đơn vị

> **Lưu ý:** Các số liệu trên **chỉ đếm profile Alive** — Drop-out tự động bị loại trừ.

### Sub-unit Tree (Nhóm → Tổ → Trái)
- **🏢 Nhóm** (border tím): hiện số TĐ + số 🍎 Alive, bấm để mở
- **📌 Tổ** (border xanh lá): hiện số TĐ + số 🍎 Alive, bấm để mở
- Bên trong: fruit cards hiện NDD/TVV/GVBB, hoạt động gần nhất, badge giai đoạn

---

## Hồ sơ Trái quả — Profile Detail

### Card thống nhất (unified card)
Gộp avatar + tên + badges + roles vào 1 card duy nhất:
```
┌──────────────────────────────────────────────┐
│  [Avatar]  Tên đầy đủ                       │
│            🟢 Alive  🟡 BB  1999 · Nam       │
│            [Lý do: ... nếu Drop-out]         │
│  ──────────────────────────────────────────  │
│  NDD: xxx      TVV: xxx                      │
│  GVBB: xxx     ⏱ Hoạt động gần nhất         │
└──────────────────────────────────────────────┘
```

### Trạng thái Alive / Drop-out
- Toggle bởi NDD / GYJN / BGYJN / Admin
- Khi chuyển sang Drop-out → hỏi lý do (tuỳ chọn, có thể để trống)
- Lý do hiển thị trong card nếu có
- Ngay sau khi toggle: local cache cập nhật, `filterProfiles()` + `loadDashboard()` gọi lại

### Danh sách profile (card nhỏ)
- 🔴 Drop-out: hiện `Drop-out · [lý do]` (hoặc chỉ `Drop-out` nếu không có lý do)
- 🟢 Alive: hiện `Alive · [năm sinh]`

### Tab bên trong hồ sơ
| Tab | Nội dung |
|-----|----------|
| 📋 Thông tin | Form 23 mục hành chính (`form_hanh_chinh`) |
| 🗓️ Giai đoạn | Dòng thời gian sự kiện, Chốt TV/BB/Center, Báo cáo TV/BB, Undo |

---

## Đồng bộ dữ liệu — Nguồn sự thật duy nhất

Các trường hiển thị ở nhiều nơi đều **lấy từ bảng `profiles`**:

| Trường | Nơi hiển thị |
|--------|-------------|
| `full_name` | Card hồ sơ, header unified, danh sách, dashboard fruit cards |
| `birth_year` | Card nhỏ (Alive), unified card |
| `gender` | Unified card |
| `phone_number` | Form hành chính |
| `fruit_status` | Badge, filter, dashboard count |
| `dropout_reason` | Unified card, card nhỏ |
| `phase` | Badge giai đoạn, tab Giai đoạn |

**Khi lưu Phiếu Thông tin (`saveInfoSheet`):**
1. Lưu vào `form_hanh_chinh.data`
2. PATCH `profiles` với: `full_name`, `birth_year`, `gender`, `phone_number`
3. Update `allProfiles` cache
4. Re-render unified card + danh sách

---

## Giai đoạn (Phase) & Timeline

### Thứ tự giai đoạn
`chakki` → `tu_van` → `bb` → `center`

### Events trên timeline (bảng `records`)
| record_type | Hiển thị |
|-------------|----------|
| `chot_tv` | Chốt TV (từ consultation_sessions) |
| `tu_van` | Báo cáo TV lần N |
| `chot_bb` | Chốt BB |
| `bien_ban` | Báo cáo BB buổi N |
| `chot_center` | Chốt Center |

### Undo / Revert logic
- **Hoàn tác giai đoạn**: xoá cascade tất cả báo cáo của phase đó + event chốt
  - BB → TV: xoá `bien_ban` records + `chot_bb` event
  - TV → Chakki: xoá `tu_van` records + `consultation_sessions` + `chot_tv` events
- **Xoá báo cáo**: chỉ xoá record mới nhất của phase hiện tại
- **Không cho xoá**: báo cáo phase trước khi đã lên phase sau

### Validation tạo Báo cáo TV
- Báo cáo TV lần N chỉ tạo được khi đã có `consultation_sessions` với `session_number=N`
- Tức là: phải **Chốt TV lần N** trước khi **Báo cáo TV lần N**

---

## Form Chốt TV
- **Lần thứ** (số, tự động gợi ý = lần tiếp theo)
- **Thời gian** (datetime-local)
- **Công cụ tư vấn** (bắt buộc)
- **TVV phụ trách** (datalist → staff)

## Form Chốt BB
- **GVBB phụ trách** (tuỳ chọn, datalist → staff)
- Sau khi chốt: GVBB được ghi vào `fruit_roles` với role_type=gvbb

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

## Hapja Detail Modal

Bấm vào phiếu Hapja → mở modal chi tiết.  
YJYN/GGN Jondo + status=pending → nút **Duyệt** / **Từ chối**.  
Duyệt → tự tạo hồ sơ Trái quả.

- **Orphan cleanup**: `check_hapja` có FK `profile_id → profiles(id) ON DELETE CASCADE`  
  → Xoá profile sẽ tự xoá check_hapja tương ứng.

---

## Quy tắc hiển thị

- **Mã TĐ**: chỉ hiện code (VD: `000142-NKH`), không kèm tên — áp dụng **toàn bộ** app
- **Chức vụ**: badge màu kế bên mã TĐ
- **Văn phong**: nghiêm túc xuyên suốt
- **Hoạt động gần nhất**: lấy event mới nhất trên dòng thời gian (records + consultation_sessions)
