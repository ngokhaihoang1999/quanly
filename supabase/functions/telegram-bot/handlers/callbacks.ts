import { supabase, BOT_TOKEN, ADMIN_STAFF_CODE, ROLE_LABELS, POSITION_LABELS, POSITION_LEVELS } from "../config.ts";
import { posLevel, canAssignRole, canLinkProfile, canChangeLevel, canApproveHapja, canAssignPosition, canDefineStructure } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, editMessageText, getChatAdmins, getChatMember, getStaffByTelegramId, exportChatInviteLink, sendDocument } from "../telegram.ts";
import { sendBBFormTemplate } from "./group.ts";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "https://esm.sh/docx@9.6.1";

// Shin Calendar: 2026 = Shin 43
const SHIN_OFFSET = 1983;
function shinDate(dateInput: string | Date): string {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Shin ${d.getFullYear() - SHIN_OFFSET}.${pad(d.getMonth()+1)}.${pad(d.getDate())}`;
}

// ============ CALLBACK QUERY HANDLER ============

export async function handleCallback(update: any, staffData: any) {
  const cbQuery = update.callback_query;
  const cbData = cbQuery.data;
  const chatId = cbQuery.message.chat.id;
  const messageId = cbQuery.message.message_id;
  const telegramId = cbQuery.from.id;
  const pos = staffData.position || 'td';
  const isAdmin = pos === 'admin' || staffData.staff_code === ADMIN_STAFF_CODE;

  // ============ PRIVATE MENU BUTTON CALLBACKS ============

  // btn_assign_pos — Chỉ định chức vụ (pick staff first)
  if (cbData === 'btn_assign_pos') {
    if (!canAssignPosition(pos)) return sendText(chatId, `⛔ Không có quyền chỉ định chức vụ.`);
    const { data: staffList } = await supabase.from('staff')
      .select('staff_code, full_name, position')
      .order('staff_code', { ascending: true })
      .limit(30);
    if (!staffList || staffList.length === 0) return sendText(chatId, `❌ Chưa có TĐ nào.`);
    const kb = staffList.map((s: any) => [{
      text: `${s.full_name} (${s.staff_code}) — ${POSITION_LABELS[s.position] || s.position}`,
      callback_data: `assign_pos_pick_${s.staff_code}`
    }]);
    await sendKeyboard(chatId, `Chọn TĐ để chỉ định chức vụ:`, kb);
    return;
  }

  // assign_pos_pick_{code} — Chọn chức vụ mới cho TĐ
  if (cbData.startsWith('assign_pos_pick_')) {
    if (!canAssignPosition(pos)) return sendText(chatId, `⛔ Không có quyền.`);
    const targetCode = cbData.replace('assign_pos_pick_', '');
    const { data: target } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!target) return sendText(chatId, `❌ Không tìm thấy mã *${targetCode}*.`);
    const assignable = Object.keys(POSITION_LEVELS).filter(p => posLevel(p) < posLevel(pos) && p !== 'admin');
    const kb = assignable.map(p => [{ text: POSITION_LABELS[p] || p, callback_data: `setpos_${targetCode}_${p}` }]);
    await sendKeyboard(chatId,
      `Chọn chức vụ mới cho *${target.full_name}* (${targetCode}):\n(Hiện tại: ${POSITION_LABELS[target.position || 'td']})`, kb);
    return;
  }

  // btn_structure — Xem cơ cấu tổ chức
  if (cbData === 'btn_structure') {
    if (!canDefineStructure(pos)) return sendText(chatId, `⛔ Chỉ Admin/YJYN được xem cơ cấu.`);
    const { data: areas } = await supabase.from('areas').select('*, org_groups(*, teams(*))');
    if (!areas || areas.length === 0) return sendText(chatId, `📐 *Cơ cấu tổ chức*\n\nChưa có khu vực nào.\nTạo khu vực/nhóm/tổ trong Mini App.`);
    let msg = `📐 *Cơ cấu tổ chức*\n\n`;
    for (const area of areas) {
      msg += `🏢 *${area.name}*\n`;
      if (area.org_groups) {
        for (const g of area.org_groups) {
          msg += `  📁 ${g.name}\n`;
          if (g.teams) { for (const t of g.teams) msg += `    👥 ${t.name}\n`; }
        }
      }
    }
    await sendText(chatId, msg);
    return;
  }

  // btn_support — Liên hệ Admin (prompt user to type message)
  if (cbData === 'btn_support') {
    await sendText(chatId,
      `💬 *Liên hệ Admin*\n\nĐể gửi tin nhắn đến Admin, hãy gõ:\n\`/support [nội dung]\`\n\nVD: \`/support Tôi không đăng nhập được\``);
    return;
  }

  // btn_logout — Đăng xuất mã JD (unlink Telegram)
  if (cbData === 'btn_logout') {
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendKeyboard(chatId,
      `⚠️ *Đăng xuất mã JD*\n\nBạn chắc chắn muốn ngắt kết nối mã *${staffData.staff_code}* khỏi Telegram này?\n\n_Sau khi đăng xuất, bạn cần dùng \`/register\` để đăng nhập lại._`,
      [[{ text: "✅ Xác nhận đăng xuất", callback_data: `confirm_logout_${staffData.staff_code}` }, { text: "❌ Huỷ", callback_data: "cancel_logout" }]]
    );
    return;
  }

  // confirm_logout_{code}
  if (cbData.startsWith('confirm_logout_')) {
    const code = cbData.replace('confirm_logout_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    await supabase.from('staff').update({ telegram_id: null }).eq('staff_code', code);
    await sendText(chatId, `✅ Đã đăng xuất mã JD *${code}*.\n\nĐể đăng nhập lại: \`/register [Mã_JD]\``);
    return;
  }

  // cancel_logout
  if (cbData === 'cancel_logout') {
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendText(chatId, `❌ Đã huỷ đăng xuất.`);
    return;
  }

  // ============ GROUP MENU CALLBACKS ============

  // ── Helper: rebuild main menu inline ──
  async function editToMainMenu() {
    const { data: fgm } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    const keyboard: any[] = [
      [{ text: '👤 Xem hồ sơ Trái quả', callback_data: 'menu_view_profile' }],
      [{ text: '🍎 Gắn hồ sơ', callback_data: 'menu_link_profile' }],
      [{ text: '👥 Xác nhận GVBB', callback_data: 'menu_assign_role' }],
    ];
    if (fgm?.profile_id) {
      const { data: prof } = await supabase.from('profiles').select('phase, is_kt_opened').eq('id', fgm.profile_id).single();
      const ph = prof?.phase || 'chakki';
      const { count: tvC } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fgm.profile_id).eq('record_type', 'tu_van');
      const { count: bbC } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fgm.profile_id).eq('record_type', 'bien_ban');
      const showSk = ['bb', 'center', 'completed'].includes(ph);
      if ((tvC || 0) > 0 || (bbC || 0) > 0 || showSk) {
        keyboard.push([{ text: `📋 Xem BC TV/BB/Sinka`, callback_data: 'menu_view_report' }]);
      }
      if (['tu_van', 'bb', 'center'].includes(ph)) {
        keyboard.push([{ text: '✏️ Thêm báo cáo BB', callback_data: 'menu_add_report' }]);
      }
      // Xem mindmap
      keyboard.push([{ text: '🗺️ Xem Mindmap', callback_data: 'menu_mindmap' }]);
      if (!prof?.is_kt_opened) {
        keyboard.push([{ text: '📖 Xác nhận mở KT', callback_data: 'menu_open_kt' }]);
      }
    } else {
      keyboard.push([{ text: '📖 Xác nhận mở KT', callback_data: 'menu_open_kt' }]);
    }
    await editMessageText(chatId, messageId, `🛠 *Menu Quản lý Group*`, keyboard);
  }

  // ── Xem mindmap: sub-menu ──
  if (cbData === 'menu_mindmap') {
    const { data: fgMM } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    if (!fgMM?.profile_id) return editMessageText(chatId, messageId, '❌ Chưa gắn hồ sơ.', [[{ text: '⬅️ Quay lại', callback_data: 'menu_back' }]]);
    await editMessageText(chatId, messageId, '🗺️ *Xem Mindmap*\nChọn loại:', [
      [{ text: '📋 Thông tin cơ bản', callback_data: 'menu_mindmap_info' }],
      [{ text: '📚 Hỗ trợ BB', callback_data: 'menu_mindmap_bb' }],
      [{ text: '⬅️ Quay lại', callback_data: 'menu_back' }]
    ]);
    return;
  }

  // ── Mindmap: Thông tin cơ bản ──
  if (cbData === 'menu_mindmap_info') {
    try {
      const { data: fgI } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
      if (!fgI?.profile_id) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '❌ Chưa gắn hồ sơ.', reply_markup: { inline_keyboard: [[{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]] } })
        });
        return;
      }
      const { data: prof } = await supabase.from('profiles').select('full_name, phase, is_kt_opened').eq('id', fgI.profile_id).single();
      const { data: sheetRows } = await supabase.from('form_hanh_chinh').select('data').eq('profile_id', fgI.profile_id);
      const d: any = (sheetRows && sheetRows.length > 0 && sheetRows[0].data) ? sheetRows[0].data : {};
      const name = prof?.full_name || 'N/A';
      const phaseMap: Record<string,string> = { 'tu_van': 'Tư vấn', 'bb': 'BB', 'center': 'Center', 'chapel': 'Chapel', 'chakki': 'N/A' };
      const phaseVi = phaseMap[prof?.phase || ''] || (prof?.phase || 'N/A');
      
      // Build summary text
      const lines: string[] = [`📋 <b>${name}</b>`, `📍 ${phaseVi}${prof?.is_kt_opened ? ' · Đã mở KT' : ''}`, ''];
      const fields: [string,string,any][] = [['👤','Giới tính',d.t2_gioi_tinh],['🎂','Năm sinh',d.t2_nam_sinh],['💼','Nghề',d.t2_nghe_nghiep],['📍','Nơi ở',d.t2_dia_chi],['🧩','Tính cách',d.t2_tinh_cach],['🎨','Sở thích',d.t2_so_thich],['⚖️','Tôn giáo',d.t2_ton_giao],['⚠️','Lưu ý',d.t2_luu_y]];
      for (const [icon, label, val] of fields) {
        if (val) {
          const v = Array.isArray(val) ? val.join(', ') : String(val).substring(0, 60);
          lines.push(`${icon} <b>${label}:</b> ${v}`);
        }
      }
      if (lines.length <= 3) lines.push('📭 Chưa có dữ liệu.');
      
      // Short URL: profile_id + type=info
      const webUrl = 'https://ngokhaihoang1999.github.io/quanly/mini-app/mm-s.html?pid=' + fgI.profile_id + '&type=info';
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: '🔗 Xem Mindmap đầy đủ', url: webUrl }],
            [{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]
          ]}
        })
      });
    } catch (e) {
      console.error('menu_mindmap_info error:', e);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: 'Loi: ' + String(e).substring(0, 200) })
      });
    }
    return;
  }

  // ── Mindmap: Hỗ trợ BB ──
  if (cbData === 'menu_mindmap_bb') {
    try {
      const { data: fgBB } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
      if (!fgBB?.profile_id) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: '❌ Chưa gắn hồ sơ.', reply_markup: { inline_keyboard: [[{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]] } })
        });
        return;
      }
      const { data: profBB } = await supabase.from('profiles').select('full_name').eq('id', fgBB.profile_id).single();
      const nameBB = profBB?.full_name || 'N/A';
      const { data: mmRec } = await supabase.from('records').select('content').eq('profile_id', fgBB.profile_id).eq('record_type', 'ai_mindmap').order('created_at', { ascending: false }).limit(1);
      const hasMM = mmRec && mmRec.length > 0 && mmRec[0]?.content?.markdown;
      
      if (!hasMM) {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '📚 <b>Hỗ trợ BB</b>\n📭 Chưa có phân tích AI.\n\nMở Mini App > Tư duy > Hỗ trợ BB > Phân tích ngay', parse_mode: 'HTML', reply_markup: { inline_keyboard: [[{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]] } })
        });
        return;
      }
      
      // Short URL: profile_id + type=bb
      const webUrlBB = 'https://ngokhaihoang1999.github.io/quanly/mini-app/mm-s.html?pid=' + fgBB.profile_id + '&type=bb';
      
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `📚 <b>Hỗ trợ BB — ${nameBB}</b>\n✅ Đã có phân tích AI.\n\nBấm nút bên dưới để xem mindmap đầy đủ.`,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: [
            [{ text: '🔗 Xem Mindmap đầy đủ', url: webUrlBB }],
            [{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]
          ]}
        })
      });
    } catch (e) {
      console.error('menu_mindmap_bb error:', e);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: 'Loi: ' + String(e).substring(0, 200) })
      });
    }
    return;
  }


  // ── Quay lại menu chính ──
  if (cbData === 'menu_back') {
    await editToMainMenu();
    return;
  }

  // ── Xem báo cáo: show sub-menu with TV/BB/Sinka ──
  if (cbData === 'menu_view_report') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id, profiles(phase)').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { count: tvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fg.profile_id).eq('record_type', 'tu_van');
    const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fg.profile_id).eq('record_type', 'bien_ban');
    const phase = (fg as any).profiles?.phase || '';
    const showSinka = ['bb', 'center', 'completed'].includes(phase);
    const kb: any[] = [];
    if ((tvCount || 0) > 0) kb.push([{ text: `📝 Báo cáo TV (${tvCount} phiếu)`, callback_data: 'view_report_list_tv' }]);
    if ((bbCount || 0) > 0) kb.push([{ text: `📖 Báo cáo BB (${bbCount} phiếu)`, callback_data: 'view_report_list_bb' }]);
    if (showSinka) kb.push([{ text: `📜 Giấy Sinka`, callback_data: 'view_sinka' }]);
    kb.push([{ text: '← Quay lại', callback_data: 'menu_back' }]);
    await editMessageText(chatId, messageId, `📋 *Chọn loại báo cáo:*`, kb);
    return;
  }

  // ── List TV reports ──
  if (cbData === 'view_report_list_tv') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { data: records } = await supabase.from('records').select('id, content, created_at').eq('profile_id', fg.profile_id).eq('record_type', 'tu_van').order('created_at', { ascending: true });
    if (!records || records.length === 0) return sendText(chatId, `ℹ️ Chưa có báo cáo TV nào.`);
    const kb = records.map((r: any, i: number) => {
      const c = r.content || {};
      const title = c.lan_thu ? `Lần ${c.lan_thu}${c.ten_cong_cu ? ' — ' + c.ten_cong_cu : ''}` : `Phiếu #${i + 1}`;
      return [{ text: `📝 ${title}`, callback_data: `view_report_tv_${r.id}` }];
    });
    kb.push([{ text: '← Quay lại', callback_data: 'menu_view_report' }]);
    await editMessageText(chatId, messageId, `📝 *Báo cáo Tư vấn — ${fg.profiles?.full_name || ''}*\nChọn để xem chi tiết:`, kb);
    return;
  }

  // ── List BB reports ──
  if (cbData === 'view_report_list_bb') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { data: records } = await supabase.from('records').select('id, content, created_at').eq('profile_id', fg.profile_id).eq('record_type', 'bien_ban').order('created_at', { ascending: true });
    if (!records || records.length === 0) return sendText(chatId, `ℹ️ Chưa có báo cáo BB nào.`);
    const kb = records.map((r: any, i: number) => {
      const c = r.content || {};
      const title = c.buoi_thu ? `Buổi ${c.buoi_thu}` : `Phiếu #${i + 1}`;
      return [{ text: `📖 ${title}`, callback_data: `view_report_bb_${r.id}` }];
    });
    kb.push([{ text: '← Quay lại', callback_data: 'menu_view_report' }]);
    await editMessageText(chatId, messageId, `📖 *Báo cáo BB — ${fg.profiles?.full_name || ''}*\nChọn để xem chi tiết:`, kb);
    return;
  }

  // ── View a specific TV report detail ──
  if (cbData.startsWith('view_report_tv_')) {
    const recordId = cbData.replace('view_report_tv_', '');
    const { data: rec } = await supabase.from('records').select('content, created_at, profile_id').eq('id', recordId).single();
    if (!rec) return sendText(chatId, `❌ Không tìm thấy báo cáo.`);
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', rec.profile_id).single();
    const c = rec.content || {};
    const date = shinDate(rec.created_at);
    let msg = `📝 *BÁO CÁO TƯ VẤN — Lần ${c.lan_thu || '?'}*\n`;
    msg += `🍎 _${p?.full_name || ''}_\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 *Ngày:* ${date}\n`;
    if (c.ten_cong_cu) msg += `🔧 *Công cụ:* ${c.ten_cong_cu}\n`;
    msg += `\n`;
    if (c.ket_qua_test) msg += `📌 *Kết quả test:*\n${c.ket_qua_test}\n\n`;
    if (c.van_de) msg += `💬 *Vấn đề / Nhu cầu khai thác:*\n${c.van_de}\n\n`;
    if (c.phan_hoi) msg += `💭 *Phản hồi của trái:*\n${c.phan_hoi}\n\n`;
    if (c.diem_hai) msg += `🎯 *Điểm hái trái:*\n${c.diem_hai}\n\n`;
    if (c.de_xuat) msg += `📋 *Đề xuất TVV:*\n${c.de_xuat}\n`;
    const backKb = [[{ text: '← Quay lại danh sách', callback_data: 'view_report_list_tv' }]];
    await editMessageText(chatId, messageId, msg.trim(), backKb);
    return;
  }

  // ── View a specific BB report detail ──
  if (cbData.startsWith('view_report_bb_')) {
    const recordId = cbData.replace('view_report_bb_', '');
    const { data: rec } = await supabase.from('records').select('content, created_at, profile_id').eq('id', recordId).single();
    if (!rec) return sendText(chatId, `❌ Không tìm thấy báo cáo.`);
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', rec.profile_id).single();
    const c = rec.content || {};
    const date = shinDate(rec.created_at);
    let buoiTiepDisplay = '';
    if (c.buoi_tiep) {
      const d = new Date(c.buoi_tiep);
      if (!isNaN(d.getTime())) {
        const pad = (n: number) => String(n).padStart(2, '0');
        buoiTiepDisplay = `Shin ${d.getFullYear()-SHIN_OFFSET}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    let msg = `📖 *BÁO CÁO BB — Buổi ${c.buoi_thu || '?'}*\n`;
    msg += `🍎 _${p?.full_name || ''}_\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📅 *Ngày:* ${date}\n\n`;
    if (c.noi_dung) msg += `📚 *Nội dung buổi học:*\n${c.noi_dung}\n\n`;
    if (c.phan_ung) msg += `😊 *Phản ứng HS:*\n${c.phan_ung}\n\n`;
    if (c.khai_thac) msg += `🔍 *Khai thác mới:*\n${c.khai_thac}\n\n`;
    if (c.tuong_tac) msg += `💡 *Tương tác đáng chú ý:*\n${c.tuong_tac}\n\n`;
    if (c.de_xuat_cs) msg += `📋 *Đề xuất chăm sóc:*\n${c.de_xuat_cs}\n\n`;
    if (buoiTiepDisplay) msg += `📅 *Buổi tiếp:* ${buoiTiepDisplay}\n`;
    if (c.noi_dung_tiep) msg += `📝 *Nội dung tiếp:* ${c.noi_dung_tiep}\n`;
    const backKb = [[{ text: '← Quay lại danh sách', callback_data: 'view_report_list_bb' }]];
    await editMessageText(chatId, messageId, msg.trim(), backKb);
    return;
  }

  // ── Sinka: sub-menu with 2 options ──
  if (cbData === 'view_sinka') {
    await editMessageText(chatId, messageId, `📜 *Giấy Sinka*\nChọn cách xuất:`, [
      [{ text: '💬 Xuất tin nhắn', callback_data: 'view_sinka_text' }],
      [{ text: '📄 Xuất file Word (.docx)', callback_data: 'view_sinka_docx' }],
      [{ text: '← Quay lại', callback_data: 'menu_view_report' }]
    ]);
    return;
  }

  // ── Sinka: xuất tin nhắn (auto-fill from profiles + staff + form_hanh_chinh) ──
  if (cbData === 'view_sinka_text') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', fg.profile_id).single();
    const p: any = profile || {};
    const name = p.full_name || '';

    // Load form_hanh_chinh (saved sk_* + t2_* data)
    const { data: fhc } = await supabase.from('form_hanh_chinh').select('data').eq('profile_id', fg.profile_id).single();
    const d: any = fhc?.data || {};

    // Load NDD staff info
    let nddInfo = '', nddScj = '';
    if (p.ndd_staff_code) {
      const { data: ndd } = await supabase.from('staff').select('full_name, phone, scj_code').eq('staff_code', p.ndd_staff_code).single();
      if (ndd) { nddInfo = [ndd.full_name, ndd.phone].filter(Boolean).join(' / '); nddScj = ndd.scj_code || ''; }
    }
    // Load GVBB staff info
    let gvbbInfo = '', gvbbScj = '';
    if (p.gvbb_staff_code && !p.gvbb_staff_code.startsWith('tg:')) {
      const { data: gvbb } = await supabase.from('staff').select('full_name, phone, scj_code').eq('staff_code', p.gvbb_staff_code).single();
      if (gvbb) { gvbbInfo = [gvbb.full_name, gvbb.phone].filter(Boolean).join(' / '); gvbbScj = gvbb.scj_code || ''; }
    }
    // Load Lá staff info
    let laInfo = '';
    try {
      const { data: fgs } = await supabase.from('fruit_groups').select('fruit_roles(staff_code,role_type)').eq('profile_id', fg.profile_id);
      const laCode = (fgs || []).flatMap((f: any) => (f.fruit_roles || []).filter((r: any) => r.role_type === 'la').map((r: any) => r.staff_code))[0];
      if (laCode) {
        const { data: la } = await supabase.from('staff').select('full_name, phone').eq('staff_code', laCode).single();
        if (la) laInfo = [la.full_name, la.phone].filter(Boolean).join(' / ');
      }
    } catch {}
    // BB count
    const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fg.profile_id).eq('record_type', 'bien_ban');

    // Build auto-filled values (sk_* saved data overrides auto-fill)
    const v = (key: string, fallback?: string) => d[key] || fallback || '';
    const tenGtTuoi = v('sk_ten_gt_tuoi', [name, p.gender, p.birth_year].filter(Boolean).join(' / '));
    const soThichSdt = v('sk_so_thich_sdt', [d.t2_so_thich, p.phone_number].filter(Boolean).join(' / '));

    // Shin date
    const today = new Date();
    const shinYear = today.getFullYear() - 1983;
    const shinDate = `${shinYear}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

    // Helper: only show non-empty lines
    const ln = (label: string, val: string) => val && val !== '—' ? `${label}: ${val}\n` : '';

    const msg = `📜 *Giấy Sinka — ${name}*
━━━━━━━━━━━━━━━━━━
📅 ${v('sk_ngay_ghi_chep', shinDate)}

*1. NDD*
${ln('Tên/Bộ/SĐT', v('sk_ndd_ten_bo_kv_sdt', nddInfo))}${ln('Mã SCJ', v('sk_ndd_ma_dinh_danh', nddScj))}${ln('Hình thức', v('sk_hinh_thuc_truyen_dao', d.t2_hinh_thuc))}${ln('Quan hệ', v('sk_moi_quan_he', d.t2_ket_noi))}${ln('Concept thể', v('sk_concept_thuoc_the', d.t2_cong_cu))}${ln('Concept linh', v('sk_concept_thuoc_linh'))}
*2. Học viên*
${ln('Tên/GT/Tuổi', tenGtTuoi)}${ln('Quốc tịch', v('sk_quoc_tich', 'Việt Nam'))}${ln('Sở thích/SĐT', soThichSdt)}${ln('Ngày sinh', v('sk_ngay_sinh', p.birth_year))}${ln('Địa chỉ', v('sk_dia_chi', d.t2_dia_chi))}${ln('Nơi LV', v('sk_noi_lam_viec', d.t2_nghe_nghiep))}${ln('Lịch trình', v('sk_lich_trinh', d.t2_khung_ranh))}${ln('Hôn nhân', v('sk_hon_nhan'))}${ln('Bạn khác giới', v('sk_ban_khac_gioi'))}${ln('Học lại', v('sk_hoc_lai'))}
*3. Gia đình*
${ln('Thành viên', v('sk_thanh_vien_gd', d.t2_nguoi_than))}${ln('Trưởng thành', v('sk_qua_trinh_truong_thanh'))}${ln('GĐ can thiệp', v('sk_muc_do_gd_can_thiep'))}
*4. Tính cách*
${ln('Ennea/MBTI', v('sk_enneagram_mbti', d.t2_tinh_cach))}${ln('Phù hợp', v('sk_phu_hop_tinh_cach'))}${ln('Mua tấm lòng', v('sk_mua_tam_long'))}${ln('QT thể', v('sk_quan_tam_thuoc_the'))}${ln('QT linh', v('sk_quan_tam_thuoc_linh'))}
*5. Tâm hướng*
${ln('Tôn giáo', v('sk_ton_giao'))}${ln('Giáo phái', v('sk_giao_phai'))}${ln('Lý do', v('sk_ly_do_theo_dao'))}${ln('Tin thần linh', v('sk_tin_than_linh'))}${ln('Nhận thức', v('sk_nhan_thuc_tin_nguong'))}${ln('QT đến KT', v('sk_muc_do_quan_tam_kt'))}
🔸 *Bổ sung*
${ln('Người trao đổi', v('sk_nguoi_trao_doi'))}${ln('XN center', v('sk_xac_nhan_center'))}${ln('GVBB', v('sk_gvbb_ten', gvbbInfo))}${ln('GVBB Mã SCJ', v('sk_gvbb_ma_dinh_danh', gvbbScj))}${ln('Lá', v('sk_la_ten', laInfo))}${ln('Số lần BB', v('sk_so_lan_bb', String(bbCount || 0)))}${ln('Lý do center', v('sk_ly_do_center'))}${ln('Thứ/giờ', v('sk_thu_gio_hoc'))}${ln('Bảo an', v('sk_bao_an_ai_biet'))}${ln('Nguy hiểm', v('sk_moi_nguy_hiem'))}`.replace(/\n{3,}/g, '\n\n').trim();

    await sendText(chatId, msg);
    await editMessageText(chatId, messageId, `✅ Đã gửi báo cáo Sinka — ${name}`, [
      [{ text: '← Quay lại', callback_data: 'view_sinka' }]
    ]);
    return;
  }

  // ── Sinka: xuất file Word (.docx) — static import, no dynamic import issues ──
  if (cbData === 'view_sinka_docx') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { data: fhcDoc } = await supabase.from('form_hanh_chinh').select('data').eq('profile_id', fg.profile_id).single();
    const d: any = fhcDoc?.data || {};
    const v = (key: string) => d[key] || '—';
    const { data: profDoc } = await supabase.from('profiles').select('full_name').eq('id', fg.profile_id).single();
    const name = profDoc?.full_name || '';

    await editMessageText(chatId, messageId, `⏳ Đang tạo file Word...`, []);

    try {
      const field = (num: string, label: string, value: string) => new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${num}) `, bold: true, size: 24, font: 'Times New Roman' }),
          new TextRun({ text: `${label}: `, bold: true, size: 24, font: 'Times New Roman' }),
          new TextRun({ text: value || '—', size: 24, font: 'Times New Roman' }),
        ]
      });
      const secH = (text: string) => new Paragraph({
        spacing: { before: 300, after: 150 }, heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, bold: true, size: 28, font: 'Times New Roman' })]
      });
      const subH = (text: string) => new Paragraph({
        spacing: { before: 200, after: 100 }, heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text, bold: true, size: 26, font: 'Times New Roman' })]
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
              children: [new TextRun({ text: 'Giấy Sinka', bold: true, size: 36, font: 'Times New Roman' })] }),
            new Paragraph({ spacing: { after: 200 }, children: [
              new TextRun({ text: 'Ngày ghi chép: ', bold: true, size: 24, font: 'Times New Roman' }),
              new TextRun({ text: v('sk_ngay_ghi_chep'), size: 24, font: 'Times New Roman' }) ] }),
            secH('1. Người dẫn dắt'),
            field('1', 'Tên/Bộ/KV/SĐT', v('sk_ndd_ten_bo_kv_sdt')),
            field('2', 'Mã SCJ', v('sk_ndd_ma_dinh_danh')),
            field('3', 'Hình thức truyền đạo', v('sk_hinh_thuc_truyen_dao')),
            field('4', 'Mối quan hệ', v('sk_moi_quan_he')),
            field('5', 'Concept thể', v('sk_concept_thuoc_the')),
            field('6', 'Concept linh', v('sk_concept_thuoc_linh')),
            secH('2. Thông tin học viên'),
            field('1', 'Tên/GT/Tuổi', v('sk_ten_gt_tuoi')),
            field('2', 'Quốc tịch', v('sk_quoc_tich')),
            field('3', 'Sở thích/SĐT', v('sk_so_thich_sdt')),
            field('4', 'Ngày sinh', v('sk_ngay_sinh')),
            field('5', 'Địa chỉ', v('sk_dia_chi')),
            field('6', 'Nơi làm việc', v('sk_noi_lam_viec')),
            field('7', 'Lịch trình', v('sk_lich_trinh')),
            field('8', 'Hôn nhân', v('sk_hon_nhan')),
            field('9', 'Bạn khác giới', v('sk_ban_khac_gioi')),
            field('10', 'Học lại', v('sk_hoc_lai')),
            secH('3. Gia đình'),
            field('1', 'Thành viên GĐ', v('sk_thanh_vien_gd')),
            field('2', 'Trưởng thành', v('sk_qua_trinh_truong_thanh')),
            field('3', 'GĐ can thiệp', v('sk_muc_do_gd_can_thiep')),
            secH('4. Tính cách'),
            field('1', 'Ennea/MBTI', v('sk_enneagram_mbti')),
            field('2', 'Phù hợp', v('sk_phu_hop_tinh_cach')),
            field('3', 'Mua tấm lòng', v('sk_mua_tam_long')),
            field('4', 'QT thể', v('sk_quan_tam_thuoc_the')),
            field('5', 'QT linh', v('sk_quan_tam_thuoc_linh')),
            secH('5. Tâm hướng Thần'),
            field('1', 'Tôn giáo', v('sk_ton_giao')),
            field('2', 'Giáo phái', v('sk_giao_phai')),
            field('3', 'Lý do theo đạo', v('sk_ly_do_theo_dao')),
            field('4', 'Tin thần linh', v('sk_tin_than_linh')),
            field('5', 'Nhận thức tín ngưỡng', v('sk_nhan_thuc_tin_nguong')),
            field('6', 'QT Kiênh Thánh', v('sk_muc_do_quan_tam_kt')),
            secH('Bổ sung'),
            subH('1. Người trao đổi KG'),
            field('', 'Tên/Bộ/SĐT', v('sk_nguoi_trao_doi')),
            field('', 'Xác nhận center', v('sk_xac_nhan_center')),
            subH('2. GVBB'),
            field('1', 'Tên/Bộ/KV/SĐT', v('sk_gvbb_ten')),
            field('2', 'Concept thể', v('sk_gvbb_concept_the')),
            field('3', 'Concept linh', v('sk_gvbb_concept_linh')),
            field('4', 'Mã SCJ', v('sk_gvbb_ma_dinh_danh')),
            field('5', 'Kết nối', v('sk_gvbb_ket_noi')),
            field('6', 'Lần đầu', v('sk_gvbb_lan_dau')),
            subH('3. Lá'),
            field('1', 'Tên/Bộ/KV/SĐT', v('sk_la_ten')),
            field('2', 'Concept thể', v('sk_la_concept_the')),
            field('3', 'Concept linh', v('sk_la_concept_linh')),
            field('4', 'Kết nối', v('sk_la_ket_noi')),
            field('5', 'Lần đầu', v('sk_la_lan_dau')),
            subH('4. Lá khác'),
            new Paragraph({ children: [new TextRun({ text: v('sk_la_khac'), size: 24, font: 'Times New Roman' })] }),
            subH('5. Xác nhận'),
            field('1', 'Số lần BB', v('sk_so_lan_bb')),
            field('2', 'Lý do center', v('sk_ly_do_center')),
            field('3', '8~9 tháng', v('sk_8_9_thang')),
            field('4', 'Thứ/giờ học', v('sk_thu_gio_hoc')),
            field('5', 'Bảo an', v('sk_bao_an_ai_biet')),
            field('6', 'CL concept', v('sk_chien_luoc_concept')),
            field('7', 'Địa điểm Zoom', v('sk_dia_diem_zoom')),
            field('8', 'Đã học Zoom', v('sk_da_hoc_zoom')),
            field('9', 'Nhập ngũ', v('sk_du_kien_nhap_ngu')),
            field('10', 'Nguy hiểm', v('sk_moi_nguy_hiem')),
          ]
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      const fileName = `Sinka_${name.replace(/[^\w]/g, '_')}.docx`;

      // Send directly to Telegram (no storage needed)
      await sendDocument(chatId, buffer, fileName, `📜 Giấy Sinka — ${name}`);
      await editMessageText(chatId, messageId, `✅ Đã xuất file *Giấy Sinka — ${name}*`, [
        [{ text: '← Quay lại', callback_data: 'view_sinka' }]
      ]);
    } catch (e: any) {
      console.error('Sinka docx error:', e);
      await editMessageText(chatId, messageId, `❌ Lỗi xuất file: ${String(e.message || e).substring(0, 200)}`, [
        [{ text: '← Quay lại', callback_data: 'view_sinka' }]
      ]);
    }
    return;
  }

  // ── Thêm báo cáo BB: send form template in group ──
  if (cbData === 'menu_add_report') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    await sendBBFormTemplate(chatId, fg.profiles?.full_name || '');
    await editMessageText(chatId, messageId, `✏️ Đã gửi form *Báo cáo BB* bên dưới ⬇️\nHãy làm theo hướng dẫn trong form.`, [[{ text: '← Quay lại Menu', callback_data: 'menu_back' }]]);
    return;
  }

  // menu_view_profile — Xem hồ sơ đầy đủ
  if (cbData === 'menu_view_profile') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(*)').eq('telegram_group_id', chatId).single();
    if (!fg || !fg.profiles) return sendText(chatId, `❌ Group này chưa được gắn hồ sơ nào.`);
    
    const p = fg.profiles;
    const info = p.info_sheet || {};
    
    // Fetch ALL roles for this profile (across all fruit_group rows)
    const { data: roles } = await supabase.from('fruit_roles')
      .select('role_type, staff_code')
      .in('fruit_group_id',
        (await supabase.from('fruit_groups').select('id').eq('profile_id', p.id)).data?.map((g:any) => g.id) || [fg.id]
      );
    
    const getNddCode = () => p.ndd_staff_code || roles?.find((r: any) => r.role_type === 'ndd')?.staff_code || 'Chưa xác nhận';
    const getTvvCodes = () => {
      const tvvList = roles?.filter((r: any) => r.role_type === 'tvv').map((r: any) => r.staff_code) || [];
      return tvvList.length > 0 ? tvvList.join(', ') : 'Chưa xác nhận';
    };
    const getGvbbCode = () => roles?.find((r: any) => r.role_type === 'gvbb')?.staff_code || 'Chưa xác nhận';
    
    const genderLabel = p.gender || 'N/A';
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : fg.level === 'bb' ? 'BB' : fg.level || 'N/A';
    const isKT = p.is_kt_opened;
    const showKT = ['bb', 'center', 'completed'].includes(p.phase);
    const ktText = showKT ? (isKT ? '📖 Đã mở KT' : '📕 Chưa mở KT') : '';
    
    const { data: tvRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'tu_van');
    const { data: bbRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'bien_ban');
    
    const profileText =
      `🍎 *Hồ sơ Trái quả*\n` +
      `───────────────────\n` +
      `*Tên:* ${p.full_name}\n` +
      `*Sinh năm:* ${p.birth_year || 'N/A'}   *Giới tính:* ${genderLabel}\n` +
      `*Giai đoạn:* ${levelLabel}${ktText ? `   *Trạng thái:* ${ktText}` : ''}\n\n` +
      `👥 *Đội ngũ chăm sóc:*\n` +
      `  NDD: ${getNddCode()}\n` +
      `  TVV: ${getTvvCodes()}\n` +
      `  GVBB: ${getGvbbCode()}\n\n` +
      `📝 *Báo cáo:* ${tvRecords?.length || 0} Tư vấn | ${bbRecords?.length || 0} Biên bản BB\n`;
    
    await sendText(chatId, profileText);
    return;
  }

  // menu_link_profile — Gắn hồ sơ
  if (cbData === 'menu_link_profile') {
    if (!canLinkProfile(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối.`);
    // Lấy danh sách profile BB chưa gắn group (exclude -Date.now() placeholders)
    const { data: linkedGroups } = await supabase.from('fruit_groups')
      .select('profile_id').not('profile_id', 'is', null)
      .not('telegram_group_id', 'is', null)
      .gt('telegram_group_id', -1000000000000);
    const linkedIds = linkedGroups?.map((g: any) => g.profile_id).filter(Boolean) || [];
    let query = supabase.from('profiles')
      .select('id, full_name, phase')
      .in('phase', ['tu_van', 'bb', 'center'])
      .order('created_at', { ascending: false })
      .limit(20);
    if (linkedIds.length > 0) {
      query = query.not('id', 'in', `(${linkedIds.join(',')})`);
    }
    const { data: profiles } = await query;
    if (!profiles || profiles.length === 0) return sendText(chatId, `ℹ️ Chưa có hồ sơ nào ở giai đoạn BB cần gắn group.`);
    const keyboard = profiles.map((p: any) => [{ text: `🎓 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hồ sơ BB để gắn cho group này:`, keyboard);
    return;
  }

  // menu_open_kt — Xác nhận mở KT (session picker)
  if (cbData === 'menu_open_kt') {
    const { data: fg } = await supabase.from('fruit_groups')
      .select('profile_id, profiles(full_name, phase)').eq('telegram_group_id', chatId).single();
    if (!fg || !fg.profile_id) {
      return sendText(chatId, `❌ Group chưa gắn hồ sơ nào.`);
    }
    const p = fg.profiles;
    // Fetch BB reports
    const { data: bbRecs } = await supabase.from('records')
      .select('id, content').eq('profile_id', fg.profile_id).eq('record_type', 'bien_ban')
      .order('created_at', { ascending: true });
    if (!bbRecs || bbRecs.length === 0) {
      return sendText(chatId, `⚠️ Hồ sơ *${p.full_name}* chưa có báo cáo BB nào để xác nhận mở KT.`);
    }
    // Fetch existing mo_kt records
    const { data: ktRecs } = await supabase.from('records')
      .select('content').eq('profile_id', fg.profile_id).eq('record_type', 'mo_kt');
    const confirmedSessions = new Set((ktRecs || []).map((r: any) => Number(r.content?.buoi_thu)).filter(Boolean));
    const sessions = bbRecs.map((r: any) => Number(r.content?.buoi_thu || 0)).filter((n: number) => n > 0);
    const unconfirmed = sessions.filter((n: number) => !confirmedSessions.has(n));
    if (unconfirmed.length === 0) {
      return sendText(chatId, `✅ Tất cả ${sessions.length} buổi BB của *${p.full_name}* đã được xác nhận mở KT.`);
    }
    // Build session keyboard
    const keyboard: any[] = sessions.map((s: number) => {
      if (confirmedSessions.has(s)) {
        return [{ text: `✅ Buổi ${s} — Đã xác nhận`, callback_data: 'action_cancel_kt' }];
      }
      return [{ text: `📕 Buổi ${s} — Xác nhận mở KT`, callback_data: `action_confirm_kt_${fg.profile_id}_${s}` }];
    });
    keyboard.push([{ text: '❌ Huỷ', callback_data: 'action_cancel_kt' }]);
    await sendKeyboard(chatId, `📖 *Xác nhận mở KT — ${p.full_name}*\n\nChọn buổi BB đã mở Kinh Thánh:`, keyboard);
    return;
  }

  // menu_assign_role — Xác nhận GVBB (detects ALL group members by probing staff telegram_ids)
  if (cbData === 'menu_assign_role') {
    if (!canAssignRole(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền xác nhận GVBB.`);
    
    // 1) Get group admins (these are always visible)
    const admins = await getChatAdmins(chatId);
    const seenTids = new Set<number>();
    const memberList: { tid: number; staffCode: string | null; displayName: string }[] = [];
    
    // Process admins first
    for (const a of admins) {
      if (a.user.is_bot) continue;
      const tid = a.user.id;
      seenTids.add(tid);
      const { data: staff } = await supabase.from('staff').select('staff_code, full_name').eq('telegram_id', tid).single();
      memberList.push({
        tid,
        staffCode: staff?.staff_code || null,
        displayName: staff?.staff_code || [a.user.first_name, a.user.last_name].filter(Boolean).join(' ') || `User ${tid}`
      });
    }
    
    // 2) Probe all staff with known telegram_ids to see if they're in THIS group
    const { data: allStaff } = await supabase.from('staff').select('telegram_id, staff_code, full_name').not('telegram_id', 'is', null);
    if (allStaff) {
      for (const s of allStaff) {
        if (seenTids.has(s.telegram_id)) continue; // already processed as admin
        // Check if this staff member is in the group
        const member = await getChatMember(chatId, s.telegram_id);
        if (member && ['member', 'restricted', 'administrator', 'creator'].includes(member.status)) {
          seenTids.add(s.telegram_id);
          memberList.push({ tid: s.telegram_id, staffCode: s.staff_code, displayName: s.staff_code });
        }
      }
    }
    
    // 3) Build keyboard
    const kb: any[] = [];
    for (const m of memberList) {
      if (m.staffCode) {
        // Known staff → show staff_code
        kb.push([{ text: `🪪 ${m.staffCode}`, callback_data: `assign_gvbb_${m.staffCode}` }]);
      } else {
        // Unknown user → show telegram name, callback encodes telegram_id + name
        kb.push([{ text: `👤 ${m.displayName}`, callback_data: `assign_gvbb_tg_${m.tid}` }]);
      }
    }
    if (kb.length === 0) return sendText(chatId, `❌ Không tìm thấy thành viên nào trong group này.`);
    await sendKeyboard(chatId, `Chọn TĐ đảm nhận vai trò *GVBB*:`, kb);
    return;
  }

  // ============ ACTION CALLBACKS ============

  // link_fg_{profileId} — Gắn hồ sơ cho group
  if (cbData.startsWith('link_fg_')) {
    const profileId = cbData.replace('link_fg_', '');
    // Validate profile is at least at tu_van phase
    const { data: profile } = await supabase.from('profiles').select('full_name, phase').eq('id', profileId).single();
    if (!profile) return sendText(chatId, `❌ Không tìm thấy hồ sơ.`);
    if (!['tu_van', 'bb', 'center', 'completed'].includes(profile.phase)) {
      await editMessageReplyMarkup(chatId, messageId, null);
      return sendText(chatId, `⚠️ Hồ sơ *${profile.full_name}* chưa ở giai đoạn BB — không thể gắn group BB.`);
    }
    await editMessageReplyMarkup(chatId, messageId, null);

    // Find or auto-register the fruit_group row for THIS Telegram group
    let { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) {
      // Auto-register group (admin didn't use /menu first)
      const { data: newFg } = await supabase.from('fruit_groups').insert({
        telegram_group_id: chatId,
        telegram_group_title: cbQuery.message.chat.title || null,
        level: 'bb'
      }).select().single();
      if (!newFg) return sendText(chatId, `❌ Không thể đăng ký group. Hãy thử gõ /start trước.`);
      fg = newFg;
    }

    // Check if profile already has a placeholder fruit_group (telegram_group_id IS NULL)
    const { data: placeholders } = await supabase.from('fruit_groups')
      .select('id').eq('profile_id', profileId).is('telegram_group_id', null);

    if (placeholders && placeholders.length > 0) {
      // Transfer roles from placeholder rows to the real group row
      for (const ph of placeholders) {
        await supabase.from('fruit_roles')
          .update({ fruit_group_id: fg.id })
          .eq('fruit_group_id', ph.id);
        // Delete placeholder row
        await supabase.from('fruit_groups').delete().eq('id', ph.id);
      }
    }

    // Try to auto-fetch invite link if not present
    let finalLink = fg.invite_link;
    if (!finalLink) {
      finalLink = await exportChatInviteLink(chatId);
    }

    // Update the real group row with profile_id and potential link
    const updatePayload: any = {
      profile_id: profileId, level: 'bb', updated_at: new Date().toISOString()
    };
    if (finalLink && finalLink !== fg.invite_link) {
      updatePayload.invite_link = finalLink;
    }

    await supabase.from('fruit_groups').update(updatePayload).eq('id', fg.id);

    let msg = `✅ Đã gắn hồ sơ *${profile.full_name}* cho group này.`;
    if (!finalLink) {
      msg += `\n\n⚠️ Bot chưa phải là admin (hoặc thiếu quyền Mời người dùng) nên không thể Tự Động lấy Link Group.\n\nHãy dùng lệnh sau để Mini App có thể mở Group:\n\`/setlink [Link_mời_vào_nhóm_này]\``;
    }
    await sendText(chatId, msg);
    return;
  }


  // action_cancel_kt
  if (cbData === 'action_cancel_kt') {
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendText(chatId, `❌ Đã huỷ thao tác.`);
    return;
  }

  // action_confirm_kt_{profileId}_{session}
  if (cbData.startsWith('action_confirm_kt_')) {
    const payload = cbData.replace('action_confirm_kt_', '');
    const lastUnderscore = payload.lastIndexOf('_');
    const profileId = payload.substring(0, lastUnderscore);
    const session = Number(payload.substring(lastUnderscore + 1));
    await editMessageReplyMarkup(chatId, messageId, null);
    
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', profileId).single();
    if (!p) return sendText(chatId, '❌ Không tìm thấy hồ sơ.');

    // Create mo_kt record for this session
    await supabase.from('records').insert({
      profile_id: profileId,
      record_type: 'mo_kt',
      content: { label: `Mở KT buổi ${session}`, buoi_thu: session, phase: 'bb' }
    });
    // Update is_kt_opened flag
    await supabase.from('profiles')
      .update({ is_kt_opened: true })
      .eq('id', profileId);
      
    await sendText(chatId, `✅ Đã xác nhận *Mở KT buổi ${session}* cho hồ sơ *${p.full_name}*.`);
    return;
  }

  // assign_gvbb_{staffCode} — Assign GVBB role (by staff_code)
  if (cbData.startsWith('assign_gvbb_') && !cbData.startsWith('assign_gvbb_tg_')) {
    const targetCode = cbData.replace('assign_gvbb_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    const { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❌ Group chưa đăng ký.`);
    // Remove any existing GVBB roles for this group (prevent duplicates from different staff)
    await supabase.from('fruit_roles').delete().eq('fruit_group_id', fg.id).eq('role_type', 'gvbb');
    await supabase.from('fruit_roles').insert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: 'gvbb', assigned_by: staffData.staff_code
    });
    // Also update profiles.gvbb_staff_code for consistency
    if (fg.profile_id) {
      await supabase.from('profiles').update({ gvbb_staff_code: targetCode }).eq('id', fg.profile_id);
    }
    await sendText(chatId, `✅ Đã xác nhận *${targetCode}* đảm nhận vai trò *GVBB* trong group này.`);
    return;
  }

  // assign_gvbb_tg_{telegramId} — Assign GVBB by telegram_id (unregistered user)
  if (cbData.startsWith('assign_gvbb_tg_')) {
    const tgId = parseInt(cbData.replace('assign_gvbb_tg_', ''));
    await editMessageReplyMarkup(chatId, messageId, null);
    const { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❌ Group chưa đăng ký.`);
    // Get user name from Telegram
    const member = await getChatMember(chatId, tgId);
    const displayName = member ? [member.user.first_name, member.user.last_name].filter(Boolean).join(' ') : `User ${tgId}`;
    // Store with a temp identifier: tg:{telegram_id} as staff_code, so we can resolve later
    const tempCode = `tg:${tgId}`;
    // Remove any existing GVBB roles for this group (prevent duplicates from different staff)
    await supabase.from('fruit_roles').delete().eq('fruit_group_id', fg.id).eq('role_type', 'gvbb');
    await supabase.from('fruit_roles').insert({
      fruit_group_id: fg.id, staff_code: tempCode, role_type: 'gvbb',
      assigned_by: staffData.staff_code, display_name: displayName
    });
    // Also update profiles.gvbb_staff_code for consistency
    if (fg.profile_id) {
      await supabase.from('profiles').update({ gvbb_staff_code: tempCode }).eq('id', fg.profile_id);
    }
    await sendText(chatId, `✅ Đã xác nhận *${displayName}* (chưa có mã JD) đảm nhận vai trò *GVBB*.\n\n💡 _Khi user này kết nối với hệ thống bằng mã JD, tên sẽ được cập nhật tự động._`);
    return;
  }

  // ============ PROFILE / HAPJA CALLBACKS ============

  // list_profiles
  if (cbData === "list_profiles") {
    const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, "Chưa có hồ sơ nào."); return;
    }
    const kb = profiles.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
    await sendKeyboard(chatId, "📋 Danh sách hồ sơ:", kb);
    return;
  }

  // view_p_{id}
  if (cbData.startsWith("view_p_")) {
    const profileId = cbData.replace("view_p_", "");
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (!profile) { await sendText(chatId, "❌ Không tìm thấy."); return; }
    const { count: tvvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'tu_van');
    const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'bien_ban');
    let m = `👤 *${profile.full_name}*\n`;
    m += `📱 SĐT: ${profile.phone_number || 'Chưa có'}\n`;
    m += `🎂 Năm sinh: ${profile.birth_year || 'N/A'}\n`;
    m += `📊 TVV: ${tvvCount||0} | BB: ${bbCount||0}`;
    await sendText(chatId, m);
    return;
  }

  // approve_hapja_{id}
  if (cbData.startsWith('approve_hapja_')) {
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛔ Không có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('approve_hapja_', '');
    const { data: hapja } = await supabase.from('check_hapja').select('*').eq('id', hapjaId).single();
    if (!hapja || hapja.status !== 'pending') { await sendText(chatId, `⚠️ Phiếu không tồn tại hoặc đã xử lý.`); return; }
    const { data: newProfile } = await supabase.from('profiles').insert({
      full_name: hapja.full_name, birth_year: hapja.birth_year, gender: hapja.gender,
      created_by: hapja.created_by, phase: 'chakki'
    }).select().single();
    await supabase.from('check_hapja').update({
      status: 'approved', approved_by: staffData.staff_code,
      approved_at: new Date().toISOString(), profile_id: newProfile?.id
    }).eq('id', hapjaId);
    await sendText(chatId, `✅ Đã duyệt phiếu Check Hapja cho *${hapja.full_name}*!\nHồ sơ Trái quả đã được tạo tự động.`);
    const { data: creator } = await supabase.from('staff').select('telegram_id').eq('staff_code', hapja.created_by).single();
    if (creator?.telegram_id) {
      await sendText(creator.telegram_id, `✅ Phiếu Check Hapja cho *${hapja.full_name}* đã được *duyệt*!`);
    }
    return;
  }

  // reject_hapja_{id}
  if (cbData.startsWith('reject_hapja_')) {
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛔ Không có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('reject_hapja_', '');
    await supabase.from('check_hapja').update({
      status: 'rejected', approved_by: staffData.staff_code, approved_at: new Date().toISOString()
    }).eq('id', hapjaId);
    await sendText(chatId, `❌ Đã từ chối phiếu Check Hapja.`);
    return;
  }

  // ============ ADMIN CALLBACKS ============

  // approve_{staffCode} — Approve TG change
  if (isAdmin && cbData.startsWith("approve_")) {
    const staffCode = cbData.replace("approve_", "");
    const { data: ps } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
    if (!ps?.pending_telegram_id) { await sendText(chatId, "⚠️ Không có yêu cầu pending."); return; }
    await supabase.from('staff')
      .update({ telegram_id: ps.pending_telegram_id, pending_telegram_id: null, pending_requested_at: null })
      .eq('staff_code', staffCode);
    await sendText(chatId, `✅ Đã duyệt đổi Telegram cho *${ps.full_name}*.`);
    await sendText(ps.pending_telegram_id, `✅ Yêu cầu đổi Telegram đã được *duyệt*! Dùng /start.`);
    return;
  }
  if (isAdmin && cbData.startsWith("deny_")) {
    const staffCode = cbData.replace("deny_", "");
    const { data: ps } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
    if (!ps?.pending_telegram_id) { await sendText(chatId, "⚠️ Không có yêu cầu pending."); return; }
    const pid = ps.pending_telegram_id;
    await supabase.from('staff').update({ pending_telegram_id: null, pending_requested_at: null }).eq('staff_code', staffCode);
    await sendText(chatId, `❌ Đã từ chối đổi Telegram cho *${ps.full_name}*.`);
    await sendText(pid, `❌ Yêu cầu đổi Telegram bị *từ chối*. Nhắn /support nếu cần hỗ trợ.`);
    return;
  }

  // setpos_{code}_{pos} — Assign position
  if (cbData.startsWith('setpos_')) {
    // Parse: setpos_CODE_position (position may contain '_' like ggn_jondo)
    const payload = cbData.replace('setpos_', '');
    const sepIdx = payload.indexOf('_');
    const targetCode = payload.substring(0, sepIdx);
    const newPos = payload.substring(sepIdx + 1);
    if (!canAssignPosition(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return; }
    if (posLevel(newPos) >= posLevel(pos)) { await sendText(chatId, `⛔ Không thể gán chức vụ bằng/cao hơn mình.`); return; }
    await supabase.from('staff').update({ position: newPos }).eq('staff_code', targetCode);
    await sendText(chatId, `✅ Đã chỉ định *${POSITION_LABELS[newPos]}* cho *${targetCode}*.`);
    return;
  }
}
