# Hệ Thống Quản Lý Tổ Chức — Checking Jondo

Bot Telegram + Mini App quản lý hồ sơ Trái quả, cấu trúc tổ chức, phân quyền theo chức vụ.  
Stack: **Supabase Edge Functions** (TypeScript/Deno) · **Telegram Bot API** · **Telegram Mini App**

---

## Cấu trúc thư mục

```
quan_ly/
├── .github/workflows/              # CI/CD — tự deploy khi git push
├── mini-app/
│   ├── index.html                  # HTML template (~278 dòng)
│   ├── styles.css                  # CSS design system (~170 dòng)
│   └── app.js                      # Toàn bộ logic JS (~994 dòng)
├── supabase/
│   ├── functions/telegram-bot/
│   │   ├── index.ts                # Router chính (~90 dòng)
│   │   ├── config.ts               # Constants, Supabase client, labels
│   │   ├── permissions.ts          # Permission checks (canDefineStructure, canAssignRole,...)
│   │   ├── telegram.ts             # Telegram API helpers (sendText, sendKeyboard,...)
│   │   └── handlers/
│   │       ├── group.ts            # Group chat: /menu, bot added, /link_profile,...
│   │       ├── callbacks.ts        # Callback query: menu_*, link_fg_*, approve_*,...
│   │       └── private.ts          # Private chat: /start, /search, /support,...
│   └── migrations/                 # 7 file SQL tạo/cập nhật database
├── docs/
│   ├── telegram-bot.md             # Tài liệu kỹ thuật Bot
│   ├── mini-app.md                 # Tài liệu kỹ thuật Mini App
│   └── database.md                 # Database schema
└── README.md
```

---

## Kiến trúc & Nguyên tắc thiết kế

### Separation of Concerns
- **Bot:** Mỗi handler xử lý đúng 1 domain — group chat, callback queries, private chat
- **Mini App:** HTML template tách biệt CSS (design system) và JS (business logic)
- **Shared:** `config.ts` chứa constants, `permissions.ts` chứa ACL, `telegram.ts` chứa I/O

### Request Flow (Bot)
```
Telegram Webhook → index.ts (router)
  ├── Group message?  → handlers/group.ts
  ├── Callback query? → handlers/callbacks.ts
  ├── Unregistered?   → Registration inline
  └── Private msg?    → handlers/private.ts
```

### Permission Model
```
config.ts (POSITION_LEVELS) ← permissions.ts (canDefineStructure, canAssignRole,...)
                              ↑ imported by handlers/*
```

---

## Tính năng chính

### 🏢 Cấu trúc tổ chức (3 tầng)
```
Khu vực (Area) → Nhóm (Group) → Tổ (Team)
```
- Quản lý qua Mini App tab **"Cơ cấu"**: tạo, sửa, xoá, gán quản lý
- Mỗi tầng có quản lý riêng: YJYN (Khu vực), TJN (Nhóm), GYJN + BGYJN (Tổ)

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

Bot thêm vào Group → tự đăng ký → hiện danh sách hồ sơ chưa gắn.  
**Menu quản lý qua nút bấm** (`/menu`):

| Nút | Chức năng |
|-----|-----------|
| 📋 Xem thông tin Group | Tên trái, giai đoạn, vai trò |
| 👤 Xem hồ sơ Trái quả | Gửi đầy đủ hồ sơ vào chat |
| 🍎 Gắn hồ sơ | Chọn/đổi hồ sơ cho group |
| 👥 Xác nhận GVBB | Gán vai trò GVBB |
| 🔄 Chuyển giai đoạn | Tư vấn ↔ BB |

### 📋 Check Hapja
- Form 12 mục trong Mini App → YJYN/GGN Jondo duyệt → tạo Hồ sơ tự động

### 📱 Mini App — 4 Tab

| Tab | Nội dung |
|-----|----------|
| **Dashboard** | Metrics theo quyền, danh sách gần đây |
| **Hồ sơ** | Trang bìa · Phiếu Thông tin · Tư vấn · BB + nút "✈️ Truy cập group" |
| **TĐ** | Nhân sự, đăng ký mới |
| **Cơ cấu** | Tree view cấu trúc |

---

## 🗄️ Database (11 bảng)

| Bảng | Mục đích |
|------|----------|
| `staff` | TĐ (staff_code, telegram_id, position, team_id) |
| `areas` / `org_groups` / `teams` | 3 tầng cấu trúc tổ chức |
| `profiles` | Hồ sơ trái quả |
| `fruit_groups` | Group chat gắn profile |
| `fruit_roles` | Vai trò (NDD/TVV/GVBB/Lá) |
| `check_hapja` | Phiếu sàng lọc + workflow |
| `form_hanh_chinh` | Phiếu thông tin hành chính |
| `records` | Báo cáo Tư vấn / BB |
| `support_messages` | Kênh hỗ trợ 2 chiều |

---

## Bảng phân quyền

| Quyền | Ai được phép |
|-------|-------------|
| Quản lý cấu trúc | Admin, YJYN |
| Chỉ định chức vụ | Admin → YJYN → TJN → GYJN |
| Xác nhận GVBB | Admin, YJYN, TJN, GYJN, GGN Jondo |
| Tạo Check Hapja | YJYN, TJN, GYJ, BGYJN, GGN Jondo, GGN Chakki |
| Duyệt Check Hapja | YJYN, GGN Jondo |
| Gắn hồ sơ vào group | Admin, YJYN, GGN Jondo, TJN, GYJN |
| Chuyển giai đoạn | GGN Jondo, TJN |

---

## Deploy

1. **Supabase Access Token** → GitHub Secrets `SUPABASE_ACCESS_TOKEN`
2. **Edge Function Secrets**: `TELEGRAM_BOT_TOKEN`, `SUPABASE_URL`, `SERVICE_ROLE_KEY`
3. **Webhook**: `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://smzoomekyvllsgppgvxw.supabase.co/functions/v1/telegram-bot`
4. `git push` → GitHub Actions tự deploy!
