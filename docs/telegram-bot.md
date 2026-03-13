# Telegram Bot — Tài liệu kỹ thuật

## Tổng quan

File: `supabase/functions/telegram-bot/index.ts`  
Runtime: Supabase Edge Function (Deno)  
Webhook: nhận mọi update từ Telegram Bot API

---

## Kiến trúc xử lý

```
Telegram Update
  ├── callback_query?  → handleCallback()
  ├── group chat?      → handleGroupChat()
  └── private chat?    → Xử lý inline (register, search, support,...)
```

### Helper Functions

| Hàm | Mục đích |
|-----|----------|
| `sendText(chatId, text)` | Gửi tin nhắn Markdown |
| `sendKeyboard(chatId, text, keyboard)` | Gửi inline keyboard |
| `editMessageReplyMarkup(chatId, msgId, markup)` | Xóa/sửa inline keyboard (tránh bấm trùng) |
| `getChatAdmins(chatId)` | Lấy danh sách admin của group |
| `getStaffByTelegramId(tid)` | Tra cứu TĐ qua Telegram ID |
| `forwardMessage(from, to, msgId)` | Chuyển tiếp tin nhắn |

---

## Permission Functions

| Hàm | Chức vụ được phép |
|-----|-------------------|
| `canDefineStructure(p)` | admin, yjyn |
| `canAssignPosition(p)` | admin, yjyn, tjn, gyjn |
| `canAssignRole(p)` | admin, yjyn, tjn, gyjn, ggn_jondo |
| `canCreateHapja(p)` | yjyn, tjn, gyjn, bgyjn, ggn_jondo, ggn_chakki |
| `canApproveHapja(p)` | yjyn, ggn_jondo |
| `canLinkProfile(p)` | admin, yjyn, ggn_jondo, tjn, gyjn |
| `canChangeLevel(p)` | ggn_jondo, tjn |

---

## Group Chat Flow

### Bot được thêm vào Group:
1. Tự đăng ký group vào `fruit_groups`
2. Gửi thông báo chào → hướng dẫn `/menu`
3. Hiện danh sách hồ sơ chưa gắn group (inline buttons)

### `/menu` — Menu tương tác (5 nút):

```
📋 Xem thông tin Group     → menu_info
👤 Xem hồ sơ Trái quả     → menu_view_profile
🍎 Gắn hồ sơ              → menu_link_profile
👥 Xác nhận GVBB           → menu_assign_role
🔄 Chuyển giai đoạn        → menu_set_level
```

### Callback Flow:

```
menu_link_profile
  → Hiện ALL profiles (cho phép đổi lại)
  → click link_fg_{id}
  → Gắn profile, xóa keyboard

menu_assign_role
  → getChatAdmins → map telegram_id → staff_code
  → Hiện danh sách TĐ (chỉ mã TĐ)
  → click assign_gvbb_{code}
  → Upsert fruit_roles(gvbb)

menu_set_level
  → Hiện 2 nút: Tư vấn / BB
  → click action_set_level_{level}
  → Update fruit_groups.level

menu_view_profile
  → Fetch profile + roles + records count
  → Gửi text đầy đủ hồ sơ vào chat
```

---

## Private Chat Flow

| Lệnh / Hành động | Xử lý |
|-------------------|-------|
| `/start` | Kiểm tra đăng ký → Mở Mini App hoặc hướng dẫn `/register` |
| `/register [mã_TĐ]` | Liên kết telegram_id ↔ staff_code (cần Admin duyệt) |
| `/search [tên]` | Tìm trong `profiles` → hiện kết quả + nút mở chi tiết |
| `/support [nội dung]` | Forward tin nhắn đến Admin |
| `/reply [mã_TĐ] [nội dung]` | Admin trả lời cho TĐ |
| Media gửi vào | Tự forward đến Admin |

---

## Quy tắc hiển thị

- **Mã TĐ** hiển thị nguyên gốc: `000142-NKH` (không kèm tên)
- **Ngôn ngữ** nghiêm túc, dùng kính ngữ
- **Inline keyboard** tự ẩn sau khi chọn (editMessageReplyMarkup → null)
- **"Cấp độ"** đổi thành **"Giai đoạn"** xuyên suốt

---

## Biến môi trường

| Key | Nguồn |
|-----|-------|
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API |
| `SUPABASE_URL` | Hardcoded: `https://smzoomekyvllsgppgvxw.supabase.co` |
| `ADMIN_STAFF_CODE` | Hardcoded: `000142-NKH` |
