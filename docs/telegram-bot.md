# Telegram Bot — Tài liệu kỹ thuật

## Tổng quan

Runtime: Supabase Edge Function (Deno)  
Entry point: `index.ts` — thin router (~90 dòng)

---

## Cấu trúc module

```
supabase/functions/telegram-bot/
├── index.ts          # Router — phân luồng request
├── config.ts         # Constants, Supabase client, position labels
├── permissions.ts    # ACL: canDefineStructure, canAssignPosition,...
├── telegram.ts       # API helpers: sendText, sendKeyboard, getChatAdmins,...
└── handlers/
    ├── group.ts      # Group chat handler
    ├── callbacks.ts  # Callback query handler
    └── private.ts    # Private chat handler
```

### Nguyên tắc thiết kế
- **Single Responsibility:** Mỗi file xử lý đúng 1 domain
- **Dependency flow:** `config.ts` → `permissions.ts` / `telegram.ts` → `handlers/*` → `index.ts`
- **Không circular imports:** Dependency chỉ chạy 1 chiều

---

## Request Flow

```
Telegram Webhook → Deno.serve() (index.ts)
  │
  ├── Group message?
  │   └── handleGroupChat(update) → handlers/group.ts
  │       Bot added → register group, show unlinked profiles
  │       /menu → inline keyboard (5 nút)
  │       /link_profile, /assign_role, /set_level, /group_info
  │
  ├── Callback query?
  │   └── handleCallback(update, staffData) → handlers/callbacks.ts
  │       menu_info, menu_view_profile, menu_link_profile
  │       menu_assign_role, menu_set_level
  │       link_fg_*, assign_gvbb_*, action_set_level_*
  │       approve_hapja_*, reject_hapja_*
  │       approve_*, deny_*, setpos_*
  │       list_profiles, view_p_*
  │
  ├── Unregistered user?
  │   └── /register inline (index.ts)
  │       Nếu mã TĐ đã liên kết TG khác → pending approval
  │
  └── Private message?
      └── handlePrivateChat(update, staffData) → handlers/private.ts
          /start, /menu → Mini App button
          /search, /check_hapja, /assign_pos, /structure
          /create_area, /create_group, /create_team
          /support, /reply (admin), media forwarding
```

---

## modules

### config.ts
| Export | Mô tả |
|--------|-------|
| `BOT_TOKEN` | Token từ @BotFather |
| `SUPABASE_URL` | URL Supabase project |
| `ADMIN_STAFF_CODE` | `000142-NKH` |
| `supabase` | Supabase client instance |
| `POSITION_LEVELS` | Map chức vụ → cấp (0-5) |
| `POSITION_LABELS` | Map chức vụ → tên hiển thị |
| `ROLE_LABELS` | Map role_type → tên (NDD, TVV, GVBB, Lá) |

### permissions.ts
| Export | Chức vụ được phép |
|--------|-------------------|
| `posLevel(p)` | Trả về cấp số |
| `canDefineStructure(p)` | admin, yjyn |
| `canAssignPosition(p)` | admin, yjyn, tjn, gyjn |
| `canAssignRole(p)` | admin, yjyn, tjn, gyjn, ggn_jondo |
| `canCreateHapja(p)` | yjyn, tjn, gyjn, bgyjn, ggn_jondo, ggn_chakki |
| `canApproveHapja(p)` | yjyn, ggn_jondo |
| `canLinkProfile(p)` | admin, yjyn, ggn_jondo, tjn, gyjn |
| `canChangeLevel(p)` | ggn_jondo, tjn |

### telegram.ts
| Export | Mô tả |
|--------|-------|
| `sendText(chatId, text, extra?)` | Gửi Markdown message |
| `sendKeyboard(chatId, text, keyboard)` | Gửi inline keyboard |
| `editMessageReplyMarkup(chatId, msgId, markup?)` | Sửa/xoá keyboard |
| `forwardMessage(from, to, msgId)` | Chuyển tiếp message |
| `getChatAdmins(chatId)` | Lấy admin list |
| `getBotId()` | Lấy bot user ID |
| `getAdminTelegramId()` | Lấy Admin telegram_id từ DB |
| `getStaffByTelegramId(tid)` | Tra cứu staff theo TG ID |

---

## Quy tắc business

- **Mã TĐ** chỉ hiện code: `000142-NKH` (không kèm tên)
- **Ngôn ngữ** nghiêm túc
- **Inline keyboard** tự ẩn sau khi chọn
- **"Cấp độ"** gọi là **"Giai đoạn"** xuyên suốt
