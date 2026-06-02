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
 *     group.ts        → Group chat: /start, bot added, /link_profile, /assign_role, /set_level
 *     callbacks.ts    → All callback_query handlers (menu_*, link_fg_*, approve_*, setpos_*)
 *     private.ts      → Private chat: /start, /search, /check_hapja, /support, /reply
 */

import { supabase, ADMIN_STAFF_CODE, BOT_TOKEN, SUPABASE_URL } from "./config.ts";
import { sendText, getAdminTelegramId } from "./telegram.ts";
import { getStaffByTelegramId } from "./telegram.ts";
import { handleGroupChat } from "./handlers/group.ts";
import { handleCallback } from "./handlers/callbacks.ts";
import { handlePrivateChat } from "./handlers/private.ts";

// ============ MAIN REQUEST HANDLER ============


Deno.serve(async (req) => {
  try {
    // ── Handle CORS Preflight ──
    if (req.method === 'OPTIONS') {
      return new Response("OK", {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        }
      });
    }

    // ── Handle GET requests for file proxying ──
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const filePath = url.searchParams.get('file');
      
      if (!filePath) {
        return new Response("Missing 'file' parameter", { status: 400 });
      }

      if (!BOT_TOKEN) {
        return new Response("Bot token not configured on server", { status: 500 });
      }

      // Build the Telegram file URL
      const telegramFileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
      
      // Fetch the file from Telegram
      const tgRes = await fetch(telegramFileUrl);
      if (!tgRes.ok) {
        return new Response(`Error fetching file from Telegram: ${tgRes.statusText}`, { status: tgRes.status });
      }

      const contentType = tgRes.headers.get("content-type") || "application/octet-stream";
      
      return new Response(tgRes.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=31536000",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    // ── Handle POST requests for uploading files to Telegram ──
    if (req.method === 'POST') {
      const url = new URL(req.url);
      const forceDocument = url.searchParams.get('document') === 'true';
      const contentType = req.headers.get("content-type") || "";
      if (contentType.includes("multipart/form-data")) {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return new Response("Missing 'file' parameter", { status: 400 });
        }

        const adminChatId = await getAdminTelegramId();
        if (!adminChatId) {
          return new Response("Admin Telegram ID not configured in database", { status: 500 });
        }

        // If forceDocument is true, we treat it as document to preserve original quality
        const isImage = !forceDocument && (file.type.startsWith('image/') || /\.(jpeg|jpg|gif|png|webp|svg)$/i.test(file.name));
        
        let telegramApiMethod = 'sendDocument';
        let telegramField = 'document';
        
        if (isImage) {
          telegramApiMethod = 'sendPhoto';
          telegramField = 'photo';
        }

        const tgForm = new FormData();
        tgForm.append('chat_id', String(adminChatId));
        tgForm.append(telegramField, file);

        const sendPhotoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${telegramApiMethod}`, {
          method: "POST",
          body: tgForm
        });

        if (!sendPhotoRes.ok) {
          const errText = await sendPhotoRes.text();
          console.error(`${telegramApiMethod} error:`, errText);
          return new Response(`Telegram ${telegramApiMethod} failed: ${sendPhotoRes.statusText}`, { status: 500 });
        }

        const sendPhotoData = await sendPhotoRes.json();
        const messageId = sendPhotoData.result?.message_id;
        
        let fileId = '';
        if (isImage) {
          const photoArr = sendPhotoData.result?.photo;
          if (!photoArr || !photoArr.length) {
            return new Response("No photo data returned from Telegram", { status: 500 });
          }
          const largestPhoto = photoArr[photoArr.length - 1];
          fileId = largestPhoto.file_id;
        } else {
          fileId = sendPhotoData.result?.document?.file_id;
          if (!fileId) {
            return new Response("No document data returned from Telegram", { status: 500 });
          }
        }

        const getFileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
        if (!getFileRes.ok) {
          return new Response("Telegram getFile failed", { status: 500 });
        }

        const getFileData = await getFileRes.json();
        const filePath = getFileData.result?.file_path;

        if (!filePath) {
          return new Response("Failed to retrieve file_path from Telegram", { status: 500 });
        }

        if (messageId) {
          fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: adminChatId, message_id: messageId })
          }).catch(err => console.error("deleteMessage error:", err));
        }

        const proxyUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?file=${filePath}&name=${encodeURIComponent(file.name)}`;
        
        return new Response(JSON.stringify({ file_path: filePath, url: proxyUrl }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          }
        });
      }
    }

    const payload = await req.json();

    // ── Handle App to Telegram message sync (from DB Trigger) ──
    if (payload.type === 'app_message' && payload.record) {
      const record = payload.record;
      const profileId = record.profile_id;
      const messageText = record.message;
      const senderCode = record.sender_code;
      const recordId = record.id;

      // Find the linked Telegram group ID
      const { data: fg } = await supabase
        .from('fruit_groups')
        .select('telegram_group_id')
        .eq('profile_id', profileId)
        .single();

      if (fg?.telegram_group_id) {
        // Resolve sender display name
        let senderName = senderCode;
        const { data: staff } = await supabase
          .from('staff')
          .select('nickname, full_name')
          .eq('staff_code', senderCode)
          .single();
        if (staff) {
          senderName = staff.nickname || staff.full_name;
        }

        // Helper function to escape HTML special characters
        const escapeHTML = (str: string) => {
          return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        };

        const escapedSender = escapeHTML(senderName);
        const escapedMessage = escapeHTML(messageText);
        const textToSend = `💬 [App] <b>${escapedSender}</b>:\n${escapedMessage}`;

        const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: fg.telegram_group_id,
            text: textToSend,
            parse_mode: 'HTML'
          })
        });

        if (tgRes.ok) {
          const tgData = await tgRes.json();
          const tgMsgId = tgData.result?.message_id;
          if (tgMsgId) {
            // Update tg_message_id back in DB
            await supabase
              .from('profile_chats')
              .update({ tg_message_id: tgMsgId })
              .eq('id', recordId);
          }
        } else {
          const errText = await tgRes.text();
          console.error("Failed to send message to Telegram group:", errText);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        }
      });
    }

    const update = payload;

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
        // Reset telegram_group_id to null and clear invite_link so the profile shows "Chưa gắn group"
        await supabase.from('fruit_groups')
          .update({ telegram_group_id: null, telegram_group_title: null, invite_link: null, updated_at: new Date().toISOString() })
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
          await sendText(chatId, "⚠️ Cú pháp: `/register [Mã_JD]`\nVD: `/register 012345-ABC`");
          return new Response("OK");
        }
        const { data: existing } = await supabase.from('staff').select('*').eq('staff_code', code).single();
        if (!existing) { await sendText(chatId, "❌ Mã JD không tồn tại."); return new Response("OK"); }
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
        // Auto-resolve any tg:{telegramId} GVBB roles → replace with real staff_code
        const tempCode = `tg:${telegramId}`;
        await supabase.from('fruit_roles')
          .update({ staff_code: code, display_name: null })
          .eq('staff_code', tempCode);
        await sendText(chatId, `✅ Đăng ký thành công! Mừng *${existing.full_name}* (${code}).\nDùng /start để bắt đầu.`);
        return new Response("OK");
      }
      await sendText(chatId, `⚠️ Chưa nhận diện!\n👉 \`/register [Mã_JD]\`\nVD: \`/register 012345-ABC\``);
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
