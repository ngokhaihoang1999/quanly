# Hệ Thống Quản Lý Hồ Sơ Telegram Bot - (Maize Tracking)

Đây là kho lưu trữ mã nguồn cho hệ thống Bot quản lý hồ sơ nhân sự, sử dụng **Supabase Edge Functions** (TypeScript/Deno) thay vì Google Apps Script, giúp đồng bộ 100% với hệ thống cơ sở dữ liệu và dễ dàng mở rộng, chỉnh sửa chung qua Git.

## Cấu trúc thư mục

- `supabase/functions/telegram-bot/`: Chứa toàn bộ mã logic của Telegram Bot. Code sẽ được chạy serverless với tốc độ cao.
- `.github/workflows/deploy.yml`: Hệ thống CI/CD để tự động cập nhật Bot lên Supabase khi bạn gõ lệnh `git push`.

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
