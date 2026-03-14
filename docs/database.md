# Database Schema — Tài liệu kỹ thuật

## Tổng quan

Database: **Supabase (PostgreSQL)**  
Migrations: `supabase/migrations/` (7 files, chạy theo thứ tự timestamp)

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
| team_id | uuid (FK) | Thuộc Tổ nào |
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
| full_name | text | Tên trái |
| birth_year | text | Năm sinh |
| gender | text | `Nam` / `Nữ` / `Khác` |
| phone_number | text | SĐT |
| ndd_staff_code | text | Mã TĐ của NDD |
| info_sheet | jsonb | Dữ liệu mở rộng (tvv_name, gvbb_name, la_name,...) |
| status | text | Trạng thái kỹ thuật: `active` |
| fruit_status | text | Tình trạng trái quả: `alive` (mặc định) hoặc `dropout` |
| dropout_reason | text | Lý do drop-out (nhập khi chuyển sang dropout) |
| created_at | timestamptz | Ngày tạo |

### `fruit_groups` — Group Chat gắn hồ sơ
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| telegram_group_id | bigint (UNIQUE) | Telegram group ID |
| telegram_group_title | text | Tên group |
| profile_id | uuid (FK→profiles) | Hồ sơ đã gắn |
| level | text | `tu_van` hoặc `bb` |
| created_at / updated_at | timestamptz | |

### `fruit_roles` — Vai trò trong Group
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| fruit_group_id | uuid (FK→fruit_groups) | |
| staff_code | text | Mã TĐ |
| role_type | text | `ndd`, `tvv`, `gvbb`, `la` |
| assigned_by | text | Người gán |
| Unique constraint | | `(fruit_group_id, staff_code, role_type)` |

### `check_hapja` — Phiếu sàng lọc
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| full_name | text | Tên trái (mục 1) |
| data | jsonb | 12 mục sàng lọc |
| status | text | `pending` → `approved` / `rejected` |
| created_by | text | Mã TĐ người tạo |
| approved_by | text | Mã TĐ người duyệt |
| created_at | timestamptz | |

### `form_hanh_chinh` — Phiếu Thông tin
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| profile_id | uuid (FK→profiles) | 1:1 với profile |
| data | jsonb | 23 mục hành chính |

### `records` — Báo cáo Tư vấn & Biên bản BB
| Cột | Kiểu | Ghi chú |
|-----|------|---------|
| id | uuid (PK) | |
| profile_id | uuid (FK→profiles) | |
| record_type | text | `tu_van` hoặc `bien_ban` |
| content | jsonb | Nội dung phiếu |
| created_at | timestamptz | |

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
profiles ──1:1──> fruit_groups ──1:N──> fruit_roles
profiles ──1:1──> form_hanh_chinh
profiles ──1:N──> records
```

---

## RLS (Row Level Security)

Bật cho tất cả các bảng. Bot sử dụng `SERVICE_ROLE_KEY` (bypass RLS) để đọc/ghi trực tiếp.  
Mini App gọi qua REST API với anon key, cần cấu hình policy phù hợp cho từng bảng.
