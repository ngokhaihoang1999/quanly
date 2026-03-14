/**
 * Checking Jondo — Telegram Bot Entry Point
 * 
 * This is the main router. All business logic is delegated to handler modules.
 * 
 * Architecture:
 *   index.ts          → Router (this file)
 *   config.ts         → Constants, Supabase client, labels
 *   permissions.ts    → Permission checks (canDefineStructure, canAssignRole, etc.)
 *   telegram.ts       → Telegram API helpers (sendText, sendKeyboard, etc.)
 *   handlers/
 *     group.ts        → Group chat: /menu, bot added, /link_profile, /assign_role, /set_level
 *     callbacks.ts    → All callback_query handlers (menu_*, link_fg_*, approve_*, setpos_*)
 *     private.ts      → Private chat: /start, /search, /check_hapja, /support, /reply
 */

import { supabase, ADMIN_STAFF_CODE } from "./config.ts";
import { sendText } from "./telegram.ts";
import { getStaffByTelegramId } from "./telegram.ts";
import { handleGroupChat } from "./handlers/group.ts";
import { handleCallback } from "./handlers/callbacks.ts";
import { handlePrivateChat } from "./handlers/private.ts";

// ============ MAIN REQUEST HANDLER ============

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // Detect chat type
    const chatType = update.message?.chat?.type
      || update.callback_query?.message?.chat?.type
      || update.my_chat_member?.chat?.type
      || 'private';
    const isGroup = chatType === 'group' || chatType === 'supergroup';

    // ── Bot kicked/left from a group → unlink group ──
    if (update.my_chat_member) {
      const mcm = update.my_chat_member;
      const newStatus = mcm.new_chat_member?.status;
      const groupId = mcm.chat?.id;
      if (groupId && (newStatus === 'kicked' || newStatus === 'left')) {
        // Reset telegram_group_id to 0 so the profile shows "Chưa gắn group"
        await supabase.from('fruit_groups')
          .update({ telegram_group_id: 0, telegram_group_title: null, updated_at: new Date().toISOString() })
          .eq('telegram_group_id', groupId);
      }
      return new Response("OK");
    }

    // ── Group message → delegate to group handler ──
    if (isGroup && update.message) {
      await handleGroupChat(update);
      return new Response("OK");
    }

    const msg = update.message || update.callback_query?.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;
    const telegramId = update.message ? update.message.from.id : update.callback_query.from.id;
    const text = update.message?.text || null;

    // ── Identify staff ──
    const staffData = await getStaffByTelegramId(telegramId);

    // ── Unregistered user ──
    if (!staffData) {
      if (text && text.startsWith('/register')) {
        const code = text.split(" ")[1];
        if (!code) {
          await sendText(chatId, "⚠️ Cú pháp: `/register [Mã_TĐ]`\nVD: `/register 012345-ABC`");
          return new Response("OK");
        }
        const { data: existing } = await supabase.from('staff').select('*').eq('staff_code', code).single();
        if (!existing) { await sendText(chatId, "❌ Mã TĐ không tồn tại."); return new Response("OK"); }
        if (existing.telegram_id && existing.telegram_id !== telegramId) {
          // Request TG change approval
          await supabase.from('staff')
            .update({ pending_telegram_id: telegramId, pending_requested_at: new Date().toISOString() })
            .eq('staff_code', code);
          await sendText(chatId, `⏳ Mã *${code}* đang liên kết TG khác. Yêu cầu đã gửi Admin.`);
          const { data: adminStaff } = await supabase.from('staff').select('telegram_id').eq('staff_code', ADMIN_STAFF_CODE).single();
          if (adminStaff?.telegram_id) {
            await sendText(adminStaff.telegram_id, `🔔 *Yêu cầu đổi TG*\nTĐ: *${existing.full_name}* (${code})\nID mới: \`${telegramId}\``, {
              reply_markup: { inline_keyboard: [[
                { text: "✅ Duyệt", callback_data: `approve_${code}` },
                { text: "❌ Từ chối", callback_data: `deny_${code}` }
              ]]}
            });
          }
          return new Response("OK");
        }
        await supabase.from('staff').update({ telegram_id: telegramId }).eq('staff_code', code);
        await sendText(chatId, `✅ Đăng ký thành công! Mừng *${existing.full_name}* (${code}).\nDùng /menu để bắt đầu.`);
        return new Response("OK");
      }
      await sendText(chatId, `⚠️ Chưa nhận diện!\n👉 \`/register [Mã_TĐ]\`\nVD: \`/register 012345-ABC\``);
      return new Response("OK");
    }

    // ── Callback query → delegate to callback handler ──
    if (update.callback_query) {
      await handleCallback(update, staffData);
      return new Response("OK");
    }

    // ── Private message → delegate to private handler ──
    if (update.message) {
      await handlePrivateChat(update, staffData);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Hệ thống gặp lỗi.", { status: 500 });
  }
});
