# Hệ Thống Quản Lý Tổ Chức — Checking Jondo

Bot Telegram + Mini App quản lý hồ sơ Trái quả, cấu trúc tổ chức, phân quyền theo chức vụ.  
Stack: **Supabase Edge Functions** (TypeScript/Deno) · **Telegram Bot API** · **Telegram Mini App**

---

## Cấu trúc thư mục

```
quan_ly/
├── .github/workflows/       # CI/CD — tự deploy khi git push
├── mini-app/
│   └── index.html           # Telegram Mini App (SPA)
├── supabase/
│   ├── functions/
│   │   └── telegram-bot/
│   │       ├── index.ts     # Toàn bộ logic Bot (783 dòng)
│   │       └── deno.json    # Deno config
│   └── migrations/          # 7 file SQL tạo/cập nhật database
└── README.md
```

---

## Tính năng chính

### 🏢 Cấu trúc tổ chức (3 tầng)
```
Khu vực (Area) → Nhóm (Group) → Tổ (Team)
```
- Quản lý qua Mini App tab **"Cơ cấu"**: tạo, sửa, xoá, gán quản lý cho từng tầng
- Mỗi tầng có quản lý riêng: YJYN (Khu vực), TJN (Nhóm), GYJN + BGYJN (Tổ)
- Thành viên được gán vào Tổ

### 👤 Chức vụ (Hierarchy — 6 cấp)

| Cấp | Chức vụ | Ghi chú |
|-----|---------|---------|
| 0 | TĐ | Trợ Dũ (nhân viên) |
| 1 | BGYJN | Tổ phó |
| 2 | GYJN | Tổ trưởng |
| 3 | TJN / GGN Chakki / SGN Jondo / GGN Jondo | Ngang hàng |
| 4 | YJYN | Quản lý cao nhất |
| 5 | Admin | Quản trị hệ thống |

### 🍎 Group Trái quả (Group Chat Telegram)

Khi bot được thêm vào Group Telegram → tự đăng ký group → hiện danh sách hồ sơ chưa gắn để chọn ngay.

**Quản lý hoàn toàn qua nút bấm** với lệnh `/menu`:

| Nút bấm | Chức năng |
|---------|-----------|
| 📋 Xem thông tin Group | Hiện tên trái, giai đoạn, vai trò |
| 👤 Xem hồ sơ Trái quả | Gửi đầy đủ hồ sơ vào chat (tên, năm sinh, đội ngũ, số phiếu TV/BB) |
| 🍎 Gắn hồ sơ | Chọn hồ sơ để gắn/đổi cho group (hỗ trợ đổi lại nếu bấm nhầm) |
| 👥 Xác nhận GVBB | Chọn TĐ trong group để gán vai trò GVBB |
| 🔄 Chuyển giai đoạn | Chuyển giữa Tư vấn ↔ BB |

> **Quy tắc:** NDD và TVV đã được xác định trước khi lập group — Bot chỉ hỏi xác nhận GVBB.  
> **Hiển thị:** Tất cả TĐ chỉ hiện dạng mã TĐ (VD: `000142-NKH`).

### 📋 Check Hapja (Phiếu sàng lọc)
- Tạo bằng nút ＋ trên Mini App (có form 12 mục chi tiết)
- Phiếu gửi đến YJYN/GGN Jondo để duyệt
- Duyệt → Tự động tạo Hồ sơ Trái quả

### 🤖 Bot cá nhân (Private chat)
- `/register [Mã_TĐ]` — Đăng ký liên kết Telegram
- `/start` — Mở Mini App
- `/search [tên]` — Tìm kiếm hồ sơ
- `/support [nội dung]` — Liên hệ Admin
- Admin: `/reply [mã_TĐ] [nội dung]` — Trả lời TĐ
- Hỗ trợ gửi ảnh/file/media qua Bot

### 📱 Mini App — 4 Tab chính

| Tab | Nội dung |
|-----|----------|
| **Dashboard** | Số liệu theo chức vụ (Admin: Tổng TĐ/Hồ sơ/Group; GYJN: Trái đang chăm/Hapja; TĐ: bảng cá nhân) |
| **Hồ sơ** | CRUD hồ sơ Trái quả — 4 sub-tab: Trang bìa, Thông tin, Tư vấn, BB |
| **TĐ** | Danh sách nhân sự, đăng ký TĐ mới, tìm kiếm |
| **Cơ cấu** | Tree view cấu trúc tổ chức, tạo/sửa/xoá từng tầng |

**Hồ sơ chi tiết gồm:**
- **Trang bìa:** Tên, năm sinh, giới tính, vai trò NDD/TVV/GVBB/Lá, nút "✈️ Truy cập group" mở thẳng group chat Telegram
- **Phiếu Thông tin:** 23 mục hành chính (nghề nghiệp, tôn giáo, tính cách, sở thích,...)
- **Báo cáo Tư vấn:** Nhiều phiếu — bấm xem/sửa nội dung, xoá
- **Biên bản BB:** Nhiều phiếu — bấm xem/sửa nội dung, xoá

**Tính năng UX nổi bật:**
- Toàn bộ dropdown mã TĐ là ô tìm kiếm (searchable datalist)
- GVBB tự đồng bộ từ Bot (fruit_roles) vào Trang bìa
- Dashboard tự cập nhật "Tổng Group" cho Admin

---

## 🗄️ Database (Supabase)

| Bảng | Mục đích |
|------|----------|
| `staff` | TĐ (staff_code, telegram_id, position, team_id) |
| `areas` | Khu vực |
| `org_groups` | Nhóm (thuộc khu vực) |
| `teams` | Tổ (thuộc nhóm) |
| `profiles` | Hồ sơ trái quả |
| `fruit_groups` | Group chat Telegram gắn với profile |
| `fruit_roles` | Vai trò trong group (NDD/TVV/GVBB/Lá) |
| `check_hapja` | Phiếu sàng lọc + workflow duyệt |
| `form_hanh_chinh` | Phiếu thông tin hành chính |
| `records` | Phiếu Báo cáo Tư vấn / Biên bản BB |
| `support_messages` | Kênh hỗ trợ 2 chiều |

---

## Bảng phân quyền

| Quyền | Ai được phép |
|-------|-------------|
| Quản lý cấu trúc | Admin, YJYN |
| Chỉ định chức vụ | Admin → YJYN → TJN → GYJN |
| Xác nhận GVBB | Admin, YJYN, TJN, GYJN, GGN Jondo |
| Tạo Check Hapja | YJYN, TJN, GYJN, BGYJN, GGN Jondo, GGN Chakki |
| Duyệt Check Hapja | YJYN, GGN Jondo |
| Gắn hồ sơ vào group | Admin, YJYN, GGN Jondo, TJN, GYJN |
| Chuyển giai đoạn group | GGN Jondo, TJN |
| Xem hồ sơ trong group | Tất cả thành viên |

---

## Deploy

1. **Supabase Access Token** → GitHub Secrets `SUPABASE_ACCESS_TOKEN`
2. **Edge Function Secrets**: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`
3. **Webhook**:
   ```
   https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot
   ```
4. `git push` → GitHub Actions tự động deploy!

---

## Biến môi trường (Edge Function Secrets)

| Key | Mô tả |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | Token từ @BotFather |
| `SERVICE_ROLE_KEY` | Supabase service role key (bypass RLS) |
| `SUPABASE_URL` | URL project Supabase |
