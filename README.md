# Hệ Thống Quản Lý Tổ Chức — Checking Jondo

Bot Telegram + Mini App quản lý hồ sơ, cấu trúc tổ chức, phân quyền theo chức vụ. Sử dụng **Supabase Edge Functions** (TypeScript/Deno).

## Cấu trúc thư mục

- `supabase/functions/telegram-bot/` — Toàn bộ logic Bot (serverless)
- `supabase/migrations/` — SQL tạo/cập nhật Database
- `mini-app/` — Telegram Mini App
- `.github/workflows/` — CI/CD tự động deploy khi `git push`

## Tính năng

### 🏢 Cấu trúc tổ chức
```
Khu vực (Area) → Nhóm (Group) → Tổ (Team)
```
- `/create_area [tên]` — Tạo khu vực
- `/create_group [khu vực] | [tên nhóm]` — Tạo nhóm
- `/create_team [nhóm] | [tên tổ]` — Tạo tổ
- `/structure` — Xem cấu trúc

### 👤 Chức vụ (8 cấp bậc)
`TĐ → BGYJN → GYJN → Thư kí Jondo → GGN Chakki → GGN Jondo → TJN → YJYN → Admin`

- `/assign_pos [mã_TĐ]` — Chỉ định chức vụ cho cấp dưới

### 🍎 Group Trái quả (Group Chat)
- Tạo group Telegram → Add bot → Bot tự nhận diện
- `/link_profile [tên]` — Gắn hồ sơ cho group
- `/assign_role [mã_TĐ] [ndd/tvv/gvbb/la]` — Gắn vai trò
- `/set_level [tu_van/bb]` — Chuyển cấp độ group
- `/group_info` — Xem thông tin group

### 📋 Check Hapja (Phiếu sàng lọc)
- `/check_hapja [Họ tên]` — Tạo phiếu (cần chức vụ phù hợp)
- Phiếu gửi đến YJYN/GGN Jondo để duyệt
- Duyệt → Tự động tạo Hồ sơ Trái quả

### 🤖 Bot cá nhân
- `/register [Mã_TĐ]` — Đăng ký Telegram
- `/start` | `/menu` — Menu chính
- `/search [tên]` — Tìm kiếm hồ sơ
- `/support [nội dung]` — Liên hệ Admin

### 📱 Mini App
- Quản lý hồ sơ (Trang bìa + Thông tin + TVV + BB)
- Quản lý nhân sự

### 🗄️ Database (Supabase)
| Bảng | Mục đích |
|---|---|
| `staff` | TĐ (staff_code, telegram_id, position, team_id) |
| `areas` | Khu vực |
| `org_groups` | Nhóm (thuộc khu vực) |
| `teams` | Tổ (thuộc nhóm) |
| `profiles` | Hồ sơ trái quả |
| `fruit_groups` | Group chat Telegram gắn với profile |
| `fruit_roles` | Vai trò trong group (NDD/TVV/GVBB/Lá) |
| `check_hapja` | Phiếu sàng lọc + workflow duyệt |
| `form_hanh_chinh` | Dữ liệu hành chính |
| `records` | Phiếu TVV/BB |
| `support_messages` | Kênh hỗ trợ |

### Bảng phân quyền
| Quyền | Ai được phép |
|---|---|
| Quản lý cấu trúc | Admin, YJYN |
| Chỉ định chức vụ | Admin → YJYN → TJN → GYJN |
| Chỉ định vai trò | Admin, YJYN, TJN, GYJN, GGN Jondo |
| Tạo Check Hapja | YJYN, TJN, GYJN, BGYJN, GGN Jondo, GGN Chakki |
| Duyệt Check Hapja | YJYN, GGN Jondo |
| Gắn hồ sơ group | YJYN, GGN Jondo, TJN, GYJN |
| Chuyển cấp group | GGN Jondo, TJN |

## Deploy

1. **Supabase Access Token** → GitHub Secrets → `SUPABASE_ACCESS_TOKEN`
2. **Edge Function Secrets**: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`
3. **Webhook**: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot`
4. `git push` → GitHub Actions tự deploy!
