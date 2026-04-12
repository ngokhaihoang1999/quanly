import { supabase, ADMIN_STAFF_CODE, POSITION_LABELS } from "../config.ts";
import { posLevel, canDefineStructure, canAssignPosition, canCreateHapja } from "../permissions.ts";
import { sendText, sendKeyboard, forwardMessage, getAdminTelegramId } from "../telegram.ts";

// ============ PRIVATE CHAT HANDLER ============

export async function handlePrivateChat(update: any, staffData: any) {
  const msg = update.message;
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const text = msg.text || '';
  const messageId = msg.message_id;
  const pos = staffData.position || 'td';

  if (text === '/start') {
    const miniAppUrl = `https://ngokhaihoang1999.github.io/quanly/mini-app/index.html`;
    const posLabel = POSITION_LABELS[pos] || pos;

    // Build keyboard based on position
    const keyboard: any[] = [
      [{ text: "🖥️ Mở Quản Lý (Mini App)", web_app: { url: miniAppUrl } }],
      [{ text: "💬 Liên hệ Admin", callback_data: "btn_support" }, { text: "🚪 Đăng xuất mã JD", callback_data: "btn_logout" }],
    ];

    await sendKeyboard(chatId,
      `Xin chào, *${staffData.full_name}* (${staffData.staff_code})\n` +
      `Chức vụ: *${posLabel}*\n\n` +
      `Mọi thao tác quản lý hồ sơ làm qua Mini App 👆`,
      keyboard);
    return;
  }


  // /search — Tìm hồ sơ
  if (text.startsWith('/search ')) {
    const q = text.replace('/search ', '').trim();
    const { data: res } = await supabase.from('profiles').select('*').ilike('full_name', `%${q}%`).limit(5);
    if (!res || res.length === 0) { await sendText(chatId, `🔍 Không tìm thấy "${q}"`); }
    else {
      const kb = res.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
      await sendKeyboard(chatId, `🔍 Kết quả cho "${q}":`, kb);
    }
    return;
  }

  // /check_hapja — Tạo phiếu Check Hapja
  if (text.startsWith('/check_hapja')) {
    if (!canCreateHapja(pos)) {
      await sendText(chatId, `⛔ Chức vụ *${POSITION_LABELS[pos]}* không có quyền tạo phiếu Check Hapja.`);
      return;
    }
    const parts = text.replace('/check_hapja', '').trim();
    if (!parts) {
      await sendText(chatId,
        `📝 *Tạo phiếu Check Hapja*\n\n` +
        `Cú pháp: \`/check_hapja [Họ tên]\`\n` +
        `VD: \`/check_hapja Nguyễn Văn A\`\n\n` +
        `Sau khi tạo, phiếu sẽ được gửi lên YJYN/GGN Jondo để duyệt.`);
      return;
    }
    const { data: hapja } = await supabase.from('check_hapja').insert({
      full_name: parts, created_by: staffData.staff_code, data: {}, status: 'pending'
    }).select().single();
    // Notify approvers
    const { data: approvers } = await supabase.from('staff')
      .select('telegram_id, full_name').in('position', ['yjyn', 'ggn_jondo']);
    const adminId = await getAdminTelegramId();
    const notified = new Set<number>();
    if (adminId) notified.add(adminId);
    if (approvers) approvers.forEach((a: any) => { if (a.telegram_id) notified.add(a.telegram_id); });
    for (const tid of notified) {
      await sendText(tid,
        `📋 *Phiếu Check Hapja mới*\n\n` +
        `Tên: *${parts}*\n` +
        `Người tạo: ${staffData.full_name} (${staffData.staff_code})\n`,
        { reply_markup: { inline_keyboard: [[
          { text: "✅ Duyệt", callback_data: `approve_hapja_${hapja?.id}` },
          { text: "❌ Từ chối", callback_data: `reject_hapja_${hapja?.id}` }
        ]]} }
      );
    }
    await sendText(chatId, `✅ Đã tạo phiếu Check Hapja cho *${parts}*.\nPhiếu đang chờ duyệt.`);
    return;
  }

  // /assign_pos — Chỉ định chức vụ
  if (text.startsWith('/assign_pos')) {
    if (!canAssignPosition(pos)) {
      await sendText(chatId, `⛔ Không có quyền chỉ định chức vụ.`); return;
    }
    const parts = text.split(/\s+/);
    if (parts.length < 2) {
      await sendText(chatId, `⚠️ Cú pháp: \`/assign_pos [mã_JD]\`\nVD: \`/assign_pos 000707-TNHA\``);
      return;
    }
    const targetCode = parts[1];
    const { data: target } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!target) { await sendText(chatId, `❌ Không tìm thấy mã *${targetCode}*.`); return; }
    const { POSITION_LEVELS } = await import("../config.ts");
    const assignable = Object.keys(POSITION_LEVELS).filter(p => posLevel(p) < posLevel(pos) && p !== 'admin');
    const kb = assignable.map(p => [{ text: POSITION_LABELS[p], callback_data: `setpos_${targetCode}_${p}` }]);
    await sendKeyboard(chatId,
      `Chọn chức vụ mới cho *${target.full_name}* (${targetCode}):\n(Hiện tại: ${POSITION_LABELS[target.position || 'td']})`, kb);
    return;
  }

  // /structure — Xem cấu trúc
  if (text.startsWith('/structure')) {
    if (!canDefineStructure(pos)) {
      await sendText(chatId, `⛔ Chỉ Admin/YJYN được quản lý cấu trúc.`); return;
    }
    const { data: areas } = await supabase.from('areas').select('*, org_groups(*, teams(*))');
    if (!areas || areas.length === 0) {
      await sendText(chatId,
        `📐 *Cấu trúc tổ chức*\n\nChưa có khu vực nào.\n\n` +
        `Tạo mới: \`/create_area [tên]\`\n` +
        `Tạo nhóm: \`/create_group [tên khu vực] [tên nhóm]\`\n` +
        `Tạo tổ: \`/create_team [tên nhóm] [tên tổ]\``);
      return;
    }
    let msg = `📐 *Cấu trúc tổ chức*\n\n`;
    for (const area of areas) {
      msg += `🏢 *${area.name}*\n`;
      if (area.org_groups) {
        for (const g of area.org_groups) {
          msg += `  📁 ${g.name}\n`;
          if (g.teams) {
            for (const t of g.teams) { msg += `    👥 ${t.name}\n`; }
          }
        }
      }
    }
    await sendText(chatId, msg);
    return;
  }

  // /create_area, /create_group, /create_team
  if (text.startsWith('/create_area')) {
    if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return; }
    const name = text.replace('/create_area', '').trim();
    if (!name) { await sendText(chatId, `⚠️ \`/create_area [tên]\``); return; }
    await supabase.from('areas').insert({ name, created_by: staffData.staff_code });
    await sendText(chatId, `✅ Đã tạo khu vực *${name}*.`);
    return;
  }
  if (text.startsWith('/create_group')) {
    if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return; }
    const parts = text.replace('/create_group', '').trim().split('|').map((s: string) => s.trim());
    if (parts.length < 2) { await sendText(chatId, `⚠️ \`/create_group [tên khu vực] | [tên nhóm]\``); return; }
    const { data: area } = await supabase.from('areas').select('id').ilike('name', parts[0]).single();
    if (!area) { await sendText(chatId, `❌ Không tìm thấy khu vực "${parts[0]}".`); return; }
    await supabase.from('org_groups').insert({ area_id: area.id, name: parts[1], created_by: staffData.staff_code });
    await sendText(chatId, `✅ Đã tạo nhóm *${parts[1]}* trong khu vực *${parts[0]}*.`);
    return;
  }
  if (text.startsWith('/create_team')) {
    if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return; }
    const parts = text.replace('/create_team', '').trim().split('|').map((s: string) => s.trim());
    if (parts.length < 2) { await sendText(chatId, `⚠️ \`/create_team [tên nhóm] | [tên tổ]\``); return; }
    const { data: grp } = await supabase.from('org_groups').select('id').ilike('name', parts[0]).single();
    if (!grp) { await sendText(chatId, `❌ Không tìm thấy nhóm "${parts[0]}".`); return; }
    await supabase.from('teams').insert({ group_id: grp.id, name: parts[1], created_by: staffData.staff_code });
    await sendText(chatId, `✅ Đã tạo tổ *${parts[1]}* trong nhóm *${parts[0]}*.`);
    return;
  }

  // /support
  if (text.startsWith('/support')) {
    const supportMsg = text.replace('/support', '').trim();
    if (!supportMsg) { await sendText(chatId, "⚠️ `/support [nội dung]`"); return; }
    await supabase.from('support_messages').insert({
      from_staff_code: staffData.staff_code, from_telegram_id: telegramId, message: supportMsg, direction: 'to_admin'
    });
    const adminId = await getAdminTelegramId();
    if (adminId) {
      await sendText(adminId,
        `💬 *Hỗ trợ từ ${staffData.full_name}* (${staffData.staff_code}):\n\n${supportMsg}\n\n` +
        `_Trả lời: \`/reply ${staffData.staff_code} [nội dung]\`_`
      );
    }
    await sendText(chatId, "✅ Đã gửi đến Admin!");
    return;
  }

  // /reply (Admin only)
  if (pos === 'admin' && text.startsWith('/reply ')) {
    const parts = text.split(' ');
    const targetCode = parts[1]; const replyMsg = parts.slice(2).join(' ').trim();
    if (!targetCode || !replyMsg) { await sendText(chatId, "⚠️ `/reply [Mã_JD] [nội dung]`"); return; }
    const { data: ts } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!ts?.telegram_id) { await sendText(chatId, `❌ Không tìm thấy *${targetCode}*.`); return; }
    await sendText(ts.telegram_id, `📩 *Phản hồi từ Admin:*\n\n${replyMsg}`);
    await supabase.from('support_messages').insert({
      from_staff_code: ADMIN_STAFF_CODE, from_telegram_id: telegramId,
      to_staff_code: targetCode, message: replyMsg, direction: 'from_admin'
    });
    await sendText(chatId, `✅ Đã gửi đến *${ts.full_name}*.`);
    return;
  }

  // Media → forward to Admin
  const hasMedia = !text?.startsWith('/') &&
    (msg.photo || msg.document || msg.video || msg.voice || msg.audio || msg.sticker);
  if (hasMedia && messageId) {
    const adminId = await getAdminTelegramId();
    if (adminId) {
      await sendText(adminId, `📎 *Media từ ${staffData.full_name}* (${staffData.staff_code}):\n_Trả lời: \`/reply ${staffData.staff_code} [nội dung]\`_`);
      await forwardMessage(chatId, adminId, messageId);
    }
    await supabase.from('support_messages').insert({
      from_staff_code: staffData.staff_code, from_telegram_id: telegramId, message: '[media/file]', direction: 'to_admin'
    });
    await sendText(chatId, "✅ Đã gửi file/ảnh đến Admin!");
    return;
  }
}
