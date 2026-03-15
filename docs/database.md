# Database Schema — Tài liệu kỹ thuật

## Tổng quan

Database: **Supabase (PostgreSQL)**  
Migrations: `supabase/migrations/` (chạy theo thứ tự timestamp)

---

## Bảng dữ liệu

### `staff` — Nhân sự (TĐ)
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | Auto-generated |
| staff_code | text (UNIQUE) | Mã TĐ: `000142-NKH` |
| full_name | text | Họ tên |
| position | text | Chức vụ: `td`, `bgyjn`, `gyjn`, `tjn`, `yjyn`, `admin`,... |
| telegram_id | bigint | Telegram user ID (liên kết qua `/register`) |
| phone | text | SĐT |
| email | text | Email |
| team_id | uuid (FK→teams) | Thuộc Tổ nào |
| pending_telegram_id | bigint | Chờ Admin duyệt liên kết Telegram |
| created_at | timestamptz | Ngày tạo |

### `areas` — Khu vực
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| name | text | Tên khu vực: `HCM`, `HN`,... |
| manager_staff_code | text (FK→staff) | YJYN phụ trách |
| created_at | timestamptz | |

### `org_groups` — Nhóm
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| name | text | Tên nhóm: `Nhóm 1`, `Nhóm 2` |
| area_id | uuid (FK→areas) | Thuộc khu vực |
| manager_staff_code | text (FK→staff) | TJN phụ trách |
| created_at | timestamptz | |

### `teams` — Tổ
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| name | text | Tên tổ: `Tổ 1`, `Tổ 2` |
| group_id | uuid (FK→org_groups) | Thuộc nhóm |
| manager_staff_code | text (FK→staff) | GYJN (Tổ trưởng) |
| manager2_staff_code | text (FK→staff) | BGYJN (Tổ phó) |
| created_at | timestamptz | |

### `profiles` — Hồ sơ Trái quả
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| full_name | text | Tên trái — **nguồn sự thật duy nhất**, sync từ form_hanh_chinh |
| birth_year | text | Năm sinh — sync từ form_hanh_chinh |
| gender | text | `Nam` / `Nữ` / `Khác` — sync từ form_hanh_chinh |
| phone_number | text | SĐT — sync từ form_hanh_chinh |
| ndd_staff_code | text | Mã TĐ của NDD (NĐĐ chính) |
| phase | text | Giai đoạn: `chakki` → `tu_van` → `bb` → `center` |
| fruit_status | text | `alive` (mặc định) hoặc `dropout` |
| is_kt_opened | boolean | Đã mở KT (áp dụng khi qua giai đoạn BB) |
| dropout_reason | text | Lý do drop-out (tuỳ chọn, nhập khi chuyển sang dropout) |
| status | text | `active` (kỹ thuật) |
| info_sheet | jsonb | Deprecated — dữ liệu đã chuyển sang form_hanh_chinh |
| created_by | text | Mã TĐ người tạo |
| created_at | timestamptz | Ngày tạo |

### `fruit_groups` — Group Chat gắn hồ sơ
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| telegram_group_id | bigint (UNIQUE partial) | Telegram group ID. NULL = placeholder (chưa gắn group thật) |
| telegram_group_title | text | Tên group |
| profile_id | uuid (FK→profiles) | Hồ sơ gắn (ON DELETE CASCADE) |
| level | text | `tu_van` hoặc `bb` |
| invite_link | text | Link mời vào group (bot tự lấy khi là admin) |
| created_at / updated_at | timestamptz | |

### `fruit_roles` — Vai trò trong Group
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| fruit_group_id | uuid (FK→fruit_groups) | |
| staff_code | text | Mã TĐ |
| role_type | text | `ndd`, `tvv`, `gvbb`, `la` |
| assigned_by | text | Người gán |
| Unique | | `(fruit_group_id, staff_code, role_type)` |

### `check_hapja` — Phiếu sàng lọc
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| full_name | text | Tên trái (mục 1) |
| birth_year / gender | text | |
| data | jsonb | 12 mục sàng lọc |
| status | text | `pending` → `approved` / `rejected` |
| created_by | text (FK→staff) | Mã TĐ người tạo |
| approved_by | text (FK→staff) | Mã TĐ người duyệt |
| profile_id | uuid (FK→profiles **ON DELETE CASCADE**) | Hồ sơ được tạo sau duyệt |
| created_at / approved_at | timestamptz | |

### `form_hanh_chinh` — Phiếu Thông tin 23 mục
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| profile_id | uuid (FK→profiles) | 1:1 với profile |
| data | jsonb | 23 mục hành chính (`t2_ho_ten`, `t2_gioi_tinh`, `t2_nam_sinh`, `t2_sdt`, ...) |

> **Sync rule:** Khi lưu form_hanh_chinh, các trường `full_name`, `birth_year`, `gender`, `phone_number` được PATCH ngược lại vào `profiles` để đảm bảo nhất quán toàn hệ thống.

### `records` — Báo cáo & Sự kiện timeline
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| profile_id | uuid (FK→profiles) | |
| record_type | text | `tu_van`, `bien_ban`, `chot_bb`, `chot_center` |
| content | jsonb | Nội dung phiếu hoặc event metadata |
| created_at | timestamptz | |

> `chot_tv` events được lưu trong `consultation_sessions`, không phải `records`.

### `consultation_sessions` — Phiên Chốt TV
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| profile_id | uuid (FK→profiles) | |
| session_number | int | Lần thứ N |
| tool | text | Công cụ tư vấn |
| tvv_staff_code | text | TVV phụ trách (1 TVV/lần chốt; nhiều TVV lưu qua fruit_roles) |
| scheduled_at | timestamptz | Thời gian chốt (nullable) |
| created_at | timestamptz | |

> **Validation:** Báo cáo TV lần N chỉ tạo được khi `consultation_sessions` có `session_number=N` cho profile đó.
> **TVV nhiều người:** TVV lấy từ cả `tvv_staff_code` (session) và `fruit_roles` (role_type='tvv'). Mini App và bot hiển thị tất cả TVV join bằng dấu phẩy.

### `support_messages` — Kênh hỗ trợ
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| from_staff_code | text | Người gửi |
| from_telegram_id | bigint | |
| to_staff_code | text | Người nhận (nếu có) |
| message | text | Nội dung |
| direction | text | `to_admin` hoặc `from_admin` |
| created_at | timestamptz | |

---

## Quan hệ chính

```
areas ──1:N──> org_groups ──1:N──> teams ──1:N──> staff
profiles ──1:N──> fruit_groups ──1:N──> fruit_roles
profiles ──1:1──> form_hanh_chinh
profiles ──1:N──> records
profiles ──1:N──> consultation_sessions
profiles ──1:1──> check_hapja (profile_id, ON DELETE CASCADE)
```

---

## Logic mở Group BB (Mini App)

Nút **"Mở Group →"** chỉ hiện khi:
- `phase` ∈ `['bb', 'center', 'completed']`
- `fruit_groups.telegram_group_id IS NOT NULL` **và** `> -1e12` (loại bỏ placeholder cũ `-Date.now()`)

Thứ tự ưu tiên mở:
1. `invite_link` (bot lưu khi join group với quyền admin Invite Users)
2. `t.me/c/` nếu supergroup (ID bắt đầu bằng `-100`)
3. Alert thông báo nếu không có link

> ⚠️ Button dùng `data-gid` và `data-link` attribute (không inline template string) để tránh lỗi escaping với ký tự đặc biệt trong invite link (`+`, `=`).

---

## Migrations (theo thứ tự)

| File | Nội dung |
|------|----------|
| `20240315000000_initial.sql` | Bảng cơ bản: staff, areas, org_groups, teams |
| `20240317000000_check_hapja.sql` | Bảng check_hapja, thêm cột profiles (birth_year, gender, info_sheet, status, created_by) |
| `20240320000000_...` | fruit_groups, fruit_roles, consultation_sessions |
| `20240321000000_fruit_status.sql` | Cột fruit_status (alive/dropout) cho profiles |
| `20240322000000_allow_delete_records.sql` | RLS policy DELETE cho records và consultation_sessions |
| `20240323000000_cleanup_orphan_hapja.sql` | ON DELETE CASCADE cho check_hapja.profile_id |
| `20240324000000_add_dropout_reason.sql` | Cột dropout_reason cho profiles |
| `20240325000000_allow_null_group_id.sql` | telegram_group_id cho phép NULL; partial unique index |
| `20240326000000_add_invite_link.sql` | Cột invite_link cho fruit_groups |


---

## RLS (Row Level Security)

Bật cho tất cả các bảng.  
- Bot dùng `SERVICE_ROLE_KEY` (bypass RLS).  
- Mini App dùng `anon key` — cần policy phù hợp.  
- Policy chung: `FOR ALL USING (true)` — mở toàn bộ cho anon (phù hợp môi trường nội bộ kiểm soát qua Telegram auth).
