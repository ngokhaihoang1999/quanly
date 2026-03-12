import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const ADMIN_STAFF_CODE = '000142-NKH';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ HELPERS ============

async function sendText(chatId: number, text: string, extra: any = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
  });
}

async function sendKeyboard(chatId: number, text: string, keyboard: any[]) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard }, parse_mode: "Markdown" })
  });
}

async function forwardMessage(fromChatId: number, toChatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId })
  });
}

async function getAdminTelegramId(): Promise<number | null> {
  const { data } = await supabase
    .from('staff')
    .select('telegram_id')
    .eq('staff_code', ADMIN_STAFF_CODE)
    .single();
  return data?.telegram_id || null;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    const msg = update.message || update.callback_query?.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;
    const telegramId = update.message ? update.message.from.id : update.callback_query.from.id;
    const text = update.message ? update.message.text : null;
    const messageId = update.message?.message_id;

    // 1. Nhận diện TĐ qua telegram_id
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    // 2. Chưa nhận diện → yêu cầu /register
    if (!staffData) {
      if (text && text.startsWith('/register')) {
        const code = text.split(" ")[1];
        if (!code) {
          await sendText(chatId, "⚠️ Vui lòng gõ đúng định dạng: `/register [Mã_TĐ]`\nVí dụ: `/register 012345-ABC`");
          return new Response("OK");
        }

        const { data: existingStaff } = await supabase
          .from('staff')
          .select('*')
          .eq('staff_code', code)
          .single();

        if (!existingStaff) {
          await sendText(chatId, "❌ Mã TĐ không tồn tại trong hệ thống.\nKiểm tra lại hoặc liên hệ Admin.");
          return new Response("OK");
        }

        // Đã có telegram_id khác → yêu cầu Admin duyệt
        if (existingStaff.telegram_id && existingStaff.telegram_id !== telegramId) {
          await supabase.from('staff')
            .update({ pending_telegram_id: telegramId, pending_requested_at: new Date().toISOString() })
            .eq('staff_code', code);

          await sendText(chatId,
            `⏳ Mã TĐ *${code}* đang liên kết với một tài khoản Telegram khác.\n\n` +
            `Yêu cầu thay đổi của bạn đã được ghi nhận và đang *chờ Admin phê duyệt*.\n` +
            `Bạn sẽ nhận thông báo khi có kết quả.`
          );

          // Thông báo Admin kèm nút duyệt/từ chối
          const adminId = await getAdminTelegramId();
          if (adminId) {
            await sendText(adminId,
              `🔔 *Yêu cầu đổi tài khoản Telegram*\n\n` +
              `TĐ: *${existingStaff.full_name}* (${code})\n` +
              `Telegram ID mới: \`${telegramId}\`\n\n` +
              `Phê duyệt hoặc từ chối:`,
              {
                reply_markup: {
                  inline_keyboard: [[
                    { text: "✅ Duyệt", callback_data: `approve_${code}` },
                    { text: "❌ Từ chối", callback_data: `deny_${code}` }
                  ]]
                }
              }
            );
          }
          return new Response("OK");
        }

        // Đăng ký bình thường (chưa có telegram_id)
        const { error: updateError } = await supabase
          .from('staff')
          .update({ telegram_id: telegramId })
          .eq('staff_code', code);

        if (updateError) {
          await sendText(chatId, "❌ Lỗi hệ thống khi đăng ký mã TĐ.");
          return new Response("OK");
        }

        await sendText(chatId,
          `✅ Khớp kết nối thành công! Mừng *${existingStaff.full_name}* (${code}) tham gia hệ thống.\n` +
          `Dùng lệnh /menu để xem chức năng.`
        );
        return new Response("OK");
      }

      // Chưa đăng ký, không phải /register
      await sendText(chatId,
        `⚠️ Chưa nhận diện thiết bị!\n\n` +
        `Hệ thống Checking Jondo cần khớp *Mã TĐ* của bạn với tài khoản Telegram.\n` +
        `👉 Vui lòng nhắn: \`/register [Mã_TĐ]\`\n` +
        `Ví dụ: \`/register 012345-ABC\``
      );
      return new Response("OK");
    }

    const isAdmin = staffData.staff_code === ADMIN_STAFF_CODE || staffData.role === 'admin';

    // 3. Xử lý Callback Query (nút bấm)
    if (update.callback_query) {
      const data = update.callback_query.data;

      // Danh sách hồ sơ
      if (data === "list_profiles") {
        const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
        if (!profiles || profiles.length === 0) {
          await sendText(chatId, "Chưa có hồ sơ nào trong hệ thống.");
          return new Response("OK");
        }
        const keyboard = profiles.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
        await sendKeyboard(chatId, "📋 Danh sách các hồ sơ gần đây:", keyboard);
      }

      // Xem chi tiết hồ sơ
      if (data.startsWith("view_p_")) {
        const profileId = data.replace("view_p_", "");
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
        if (!profile) {
          await sendText(chatId, "❌ Không tìm thấy hồ sơ này.");
          return new Response("OK");
        }
        const { data: hcData } = await supabase.from('form_hanh_chinh').select('data').eq('profile_id', profileId).single();
        const hc = hcData?.data || {};
        const { count: tvvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'to_3');
        const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'to_4');

        let msg = `👤 *${profile.full_name}*\n`;
        msg += `📱 SĐT: ${profile.phone_number || 'Chưa có'}\n`;
        msg += `👥 NDD: ${profile.ndd_staff_code || 'Chưa xác định'}\n`;
        if (hc.t2_nam_sinh) msg += `🎂 Năm sinh: ${hc.t2_nam_sinh}\n`;
        if (hc.t2_nghe_nghiep) msg += `💼 Nghề: ${hc.t2_nghe_nghiep}\n`;
        if (hc.t2_dia_chi) msg += `📍 Địa chỉ: ${hc.t2_dia_chi}\n`;
        msg += `\n📊 Phiếu TVV: ${tvvCount || 0} | BB: ${bbCount || 0}`;
        await sendText(chatId, msg);
      }

      // Admin: Duyệt đổi telegram_id
      if (isAdmin && data.startsWith("approve_")) {
        const staffCode = data.replace("approve_", "");
        const { data: pendingStaff } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
        if (!pendingStaff?.pending_telegram_id) {
          await sendText(chatId, "⚠️ Không tìm thấy yêu cầu pending cho mã này.");
          return new Response("OK");
        }
        await supabase.from('staff')
          .update({ telegram_id: pendingStaff.pending_telegram_id, pending_telegram_id: null, pending_requested_at: null })
          .eq('staff_code', staffCode);
        await sendText(chatId, `✅ Đã duyệt đổi tài khoản Telegram cho *${pendingStaff.full_name}* (${staffCode}).`);
        await sendText(pendingStaff.pending_telegram_id,
          `✅ Yêu cầu đổi tài khoản Telegram đã được *Admin phê duyệt*!\nDùng /menu để vào hệ thống.`
        );
      }

      // Admin: Từ chối đổi telegram_id
      if (isAdmin && data.startsWith("deny_")) {
        const staffCode = data.replace("deny_", "");
        const { data: pendingStaff } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
        if (!pendingStaff?.pending_telegram_id) {
          await sendText(chatId, "⚠️ Không tìm thấy yêu cầu pending cho mã này.");
          return new Response("OK");
        }
        const pendingId = pendingStaff.pending_telegram_id;
        await supabase.from('staff')
          .update({ pending_telegram_id: null, pending_requested_at: null })
          .eq('staff_code', staffCode);
        await sendText(chatId, `❌ Đã từ chối đổi tài khoản Telegram cho *${pendingStaff.full_name}* (${staffCode}).`);
        await sendText(pendingId,
          `❌ Yêu cầu đổi tài khoản Telegram của bạn đã bị *từ chối*.\nNếu cần hỗ trợ, nhắn /support [nội dung].`
        );
      }

      return new Response("OK");
    }

    // 4. Menu chính
    if (text === '/start' || text === '/menu') {
      const miniAppUrl = `https://ngokhaihoang1999.github.io/quanly/mini-app/index.html`;
      const keyboard = [
        [{ text: "📋 Danh bạ & Hồ sơ", callback_data: "list_profiles" }],
        [{ text: "🖥 Mở Quản Lý (Mini App)", web_app: { url: miniAppUrl } }]
      ];
      const welcomeMsg =
        `Xin chào, *${staffData.full_name}* (${staffData.staff_code})\n\n` +
        `Bạn đang sử dụng hệ thống *Checking Jondo*.\n\n` +
        `🔹 *Bot:* Tra cứu nhanh thông tin.\n` +
        `🔹 *Mini App:* Điền form Tờ 1, 2, 3, 4.\n` +
        `🔹 *Hỗ trợ:* /support [nội dung] để liên hệ Admin.`;
      await sendKeyboard(chatId, welcomeMsg, keyboard);
      return new Response("OK");
    }

    // 5. Tìm kiếm hồ sơ
    if (text && text.startsWith('/search ')) {
      const query = text.replace('/search ', '').trim();
      const { data: searchResults } = await supabase
        .from('profiles')
        .select('*')
        .ilike('full_name', `%${query}%`)
        .limit(5);
      if (!searchResults || searchResults.length === 0) {
        await sendText(chatId, `🔍 Không tìm thấy hồ sơ nào khớp với "${query}"`);
      } else {
        const keyboard = searchResults.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
        await sendKeyboard(chatId, `🔍 Kết quả cho "${query}":`, keyboard);
      }
      return new Response("OK");
    }

    // 6. Kênh hỗ trợ: TĐ gửi text đến Admin
    if (text && text.startsWith('/support')) {
      const supportMsg = text.replace('/support', '').trim();
      if (!supportMsg) {
        await sendText(chatId, "⚠️ Vui lòng nhập nội dung:\n`/support [nội dung cần hỗ trợ]`");
        return new Response("OK");
      }
      await supabase.from('support_messages').insert({
        from_staff_code: staffData.staff_code,
        from_telegram_id: telegramId,
        message: supportMsg,
        direction: 'to_admin'
      });
      const adminId = await getAdminTelegramId();
      if (adminId) {
        await sendText(adminId,
          `💬 *Hỗ trợ từ ${staffData.full_name}* (${staffData.staff_code}):\n\n${supportMsg}\n\n` +
          `_Trả lời: \`/reply ${staffData.staff_code} [nội dung]\`_`
        );
      }
      await sendText(chatId, "✅ Đã gửi tin nhắn đến Admin. Bạn sẽ sớm nhận được phản hồi!");
      return new Response("OK");
    }

    // 7. Admin: Reply cho TĐ
    if (isAdmin && text && text.startsWith('/reply ')) {
      const parts = text.split(' ');
      const targetCode = parts[1];
      const replyMsg = parts.slice(2).join(' ').trim();
      if (!targetCode || !replyMsg) {
        await sendText(chatId, "⚠️ Định dạng: `/reply [Mã_TĐ] [nội dung]`\nVí dụ: `/reply 000707-TNHA Đã nhận, mình xử lý ngay!`");
        return new Response("OK");
      }
      const { data: targetStaff } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
      if (!targetStaff?.telegram_id) {
        await sendText(chatId, `❌ Không tìm thấy TĐ *${targetCode}* hoặc họ chưa kết nối Telegram.`);
        return new Response("OK");
      }
      await sendText(targetStaff.telegram_id, `📩 *Phản hồi từ Admin:*\n\n${replyMsg}`);
      await supabase.from('support_messages').insert({
        from_staff_code: ADMIN_STAFF_CODE,
        from_telegram_id: telegramId,
        to_staff_code: targetCode,
        message: replyMsg,
        direction: 'from_admin'
      });
      await sendText(chatId, `✅ Đã gửi phản hồi đến *${targetStaff.full_name}* (${targetCode}).`);
      return new Response("OK");
    }

    // 8. TĐ gửi media/file → forward đến Admin
    const hasMedia = update.message && !text?.startsWith('/') &&
      (update.message.photo || update.message.document || update.message.video ||
       update.message.voice || update.message.audio || update.message.sticker);

    if (hasMedia && messageId) {
      const adminId = await getAdminTelegramId();
      if (adminId) {
        await sendText(adminId,
          `📎 *Media từ ${staffData.full_name}* (${staffData.staff_code}):\n` +
          `_Trả lời: \`/reply ${staffData.staff_code} [nội dung]\`_`
        );
        await forwardMessage(chatId, adminId, messageId);
      }
      await supabase.from('support_messages').insert({
        from_staff_code: staffData.staff_code,
        from_telegram_id: telegramId,
        message: '[media/file]',
        direction: 'to_admin'
      });
      await sendText(chatId, "✅ Đã gửi file/ảnh đến Admin!");
      return new Response("OK");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Hệ thống gặp lỗi xử lý.", { status: 500 });
  }
});
