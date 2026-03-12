# Hệ Thống Quản Lý Hồ Sơ Telegram Bot - (Checking Jondo)

Đây là kho lưu trữ mã nguồn cho hệ thống Bot quản lý hồ sơ nhân sự, sử dụng **Supabase Edge Functions** (TypeScript/Deno) thay vì Google Apps Script, giúp đồng bộ 100% với hệ thống cơ sở dữ liệu và dễ dàng mở rộng, chỉnh sửa chung qua Git.

## Cấu trúc thư mục

- `supabase/functions/telegram-bot/`: Chứa toàn bộ mã logic của Telegram Bot (serverless).
- `supabase/migrations/`: Các file SQL tạo/cập nhật cơ sở dữ liệu.
- `mini-app/`: Telegram Mini App — giao diện quản lý hồ sơ trên điện thoại.
- `.github/workflows/`: CI/CD tự động deploy khi `git push`.

## Tính năng

### 🤖 Telegram Bot
- `/register [Mã_NV]` — Đăng ký thiết bị Telegram với mã nhân viên
- `/start` | `/menu` — Hiện menu chính (Danh bạ + Mở Mini App)
- `/search [tên]` — Tìm kiếm hồ sơ theo tên
- Bấm vào tên cá → Xem thông tin chi tiết (SĐT, NDD, nghề, địa chỉ, số phiếu TVV/BB)

### 📱 Mini App
- **Tab Hồ sơ**: Danh sách, tìm kiếm, thêm/xoá hồ sơ
  - **Tờ 1** — Duyệt Cá (lưu & load lại dữ liệu)
  - **Tờ 2** — Hành Chính (23 mục, bao gồm chip multi-select)
  - **Tờ 3** — Phiếu TVV (thêm/xoá phiếu tư vấn)
  - **Tờ 4** — Biên Bản BB (thêm/xoá biên bản)
- **Tab Nhân sự**: Quản lý nhân viên
  - Đăng ký nhân viên mới (tên, mã NV, chức vụ, cấp độ, SĐT, email)
  - Chức vụ: NDD, TVV, GGN, GVBB, Admin
  - Cấp độ: Thực tập, Chính thức, Trưởng nhóm, Quản lý
  - Trạng thái kết nối Telegram (🟢/⚪)

### 🗄️ Database (Supabase)
| Bảng | Mục đích |
|---|---|
| `staff` | Nhân viên (staff_code, telegram_id, role, level, phone, email) |
| `profiles` | Hồ sơ cá (full_name, phone_number, ndd_staff_code) |
| `form_hanh_chinh` | Dữ liệu Tờ 2 (profile_id, data JSON) |
| `records` | Phiếu TVV/BB + Tờ 1 (profile_id, record_type, content JSON) |

## Cách đẩy mã lên GitHub & Tự động Deploy

Vì dự án đã có GitHub Actions tích hợp, mỗi khi đổi code, bạn chỉ cần Push là nó tự lên môi trường thực.

**Bước 1: Lấy Token bảo mật từ Supabase để Github có quyền Deploy**
1. Đăng nhập Supabase Dashboard -> **Account** (góc dưới trái) -> **Access Tokens** -> **Generate New Token**.
2. Đặt tên token tuỳ ý và copy nó lại (chỉ hiện 1 lần).
3. Vào dự án **GitHub** của bạn -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
4. Ô Name nhập `SUPABASE_ACCESS_TOKEN`, ô Value dán mã Token vừa copy ở trên vào. Nhấn **Add secret**.

**Bước 2: Cài đặt Biến môi trường trên mạng (Edge Function Secrets)**
Trên Terminal của máy tính (cần dùng Supabase CLI) hoặc qua giao diện Supabase Cloud (vào **Edge Functions** -> **Secrets**), nhập các thông số bảo mật cho Bot lấy thông tin:
- `TELEGRAM_BOT_TOKEN`: Mã Bot cha BotFather
- `SUPABASE_URL`: `https://smzoomekyvllsgppgvxw.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: Lấy ở Supabase > Settings > API (Dùng khoá service_role thay vì anon key vì Bot đóng vai trò là server trung gian, cần quyền vượt giới hạn cấp nhân viên).

**Bước 3: Set Webhook cho Bot Telegram**
Để Bot lắng nghe tin nhắn và chuyển hướng về kho Edge Functions của bạn, chỉ cần mở trình duyệt web và dán đường link sau:  
*(Nhớ thay `<BOT_TOKEN>` bằng Token thực của bot)*

`https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot`

Nếu trả về `{"ok":true,"result":true,...}` là đã gắn não cho Bot thành công.

---
Mọi thao tác thay đổi ở file `index.ts`, chỉ cần lưu, `git add .`, `git commit` và `git push`. Github Actions sẽ lo việc đẩy code lên Supabase!
