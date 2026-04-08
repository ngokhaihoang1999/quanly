import { supabase, BOT_TOKEN, ADMIN_STAFF_CODE, ROLE_LABELS, POSITION_LABELS, POSITION_LEVELS } from "../config.ts";
import { posLevel, canAssignRole, canLinkProfile, canChangeLevel, canApproveHapja, canAssignPosition, canDefineStructure } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, editMessageText, getChatAdmins, getStaffByTelegramId, exportChatInviteLink } from "../telegram.ts";
import { sendBBFormTemplate } from "./group.ts";

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
      if ((tvC || 0) > 0 || (bbC || 0) > 0) {
        keyboard.push([{ text: `📋 Xem báo cáo (${tvC || 0} TV · ${bbC || 0} BB)`, callback_data: 'menu_view_report' }]);
      }
      if (['tu_van', 'bb', 'center'].includes(ph)) {
        keyboard.push([{ text: '✏️ Thêm báo cáo BB', callback_data: 'menu_add_report' }]);
      }
      // Xem mindmap
      keyboard.push([{ text: '🧠 Xem mindmap', callback_data: 'menu_mindmap' }]);
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
    await editMessageText(chatId, messageId, '🧠 *Xem Mindmap*\nChọn loại:', [
      [{ text: '👤 Thông tin cơ bản', callback_data: 'menu_mindmap_info' }],
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
          body: JSON.stringify({ chat_id: chatId, message_id: messageId, text: 'Chua gan ho so.', reply_markup: { inline_keyboard: [[{ text: 'Quay lai', callback_data: 'menu_mindmap' }]] } })
        });
        return;
      }
      // Get profile info for text summary
      const { data: prof } = await supabase.from('profiles').select('full_name, phase, is_kt_opened').eq('id', fgI.profile_id).single();
      const { data: sheetRows } = await supabase.from('form_hanh_chinh').select('data').eq('profile_id', fgI.profile_id);
      const d: any = (sheetRows && sheetRows.length > 0 && sheetRows[0].data) ? sheetRows[0].data : {};
      const lines: string[] = [];
      const name = prof?.full_name || 'N/A';
      const phase = (prof?.phase || 'N/A').replace(/_/g, ' ');
      lines.push('THONG TIN CO BAN: ' + name);
      lines.push('Giai doan: ' + phase + (prof?.is_kt_opened ? ' | Da mo KT' : ''));
      if (d.t2_gioi_tinh) lines.push('Gioi tinh: ' + String(d.t2_gioi_tinh));
      if (d.t2_nam_sinh) lines.push('Nam sinh: ' + String(d.t2_nam_sinh));
      if (d.t2_nghe_nghiep) lines.push('Nghe: ' + String(d.t2_nghe_nghiep));
      if (d.t2_dia_chi) lines.push('Noi o: ' + String(d.t2_dia_chi));
      if (d.t2_tinh_cach) lines.push('Tinh cach: ' + String(d.t2_tinh_cach));
      if (d.t2_so_thich) lines.push('So thich: ' + String(d.t2_so_thich));
      if (d.t2_luu_y) lines.push('Luu y: ' + String(d.t2_luu_y));
      if (lines.length <= 2) lines.push('Chua co du lieu phieu.');
      const mmUrl = 'https://ngokhaihoang1999.github.io/quanly/mini-app/mm.html?gid=' + chatId;
      // Send new message with text info + link to visual mindmap
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: lines.join('\n') + '\n\nBam link ben duoi de xem Mindmap visual:',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🧠 Xem Mindmap Visual', url: mmUrl }],
              [{ text: 'Quay lai', callback_data: 'menu_mindmap' }]
            ]
          }
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
    const { data: fgBB } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    if (!fgBB?.profile_id) return editMessageText(chatId, messageId, '❌ Chưa gắn hồ sơ.', [[{ text: '⬅️ Quay lại', callback_data: 'menu_back' }]]);
    const { data: mmRows } = await supabase.from('records').select('content').eq('profile_id', fgBB.profile_id).eq('record_type', 'ai_mindmap').order('created_at', { ascending: false }).limit(1);
    const mmRec = mmRows?.[0];
    let txt = '';
    if (mmRec?.content?.markdown) {
      let md = mmRec.content.markdown;
      // Strip markdown headings and truncate for Telegram
      md = md.replace(/^#{1,4}\s+/gm, '*').replace(/\n{3,}/g, '\n\n');
      if (md.length > 3800) md = md.substring(0, 3800) + '\n\n..._(xem đầy đủ trên Mini App)_';
      txt = `📚 *Hỗ trợ BB (AI Mindmap)*\n\n` + md;
    } else {
      txt = '📚 *Hỗ trợ BB*\n\n_Chưa có phân tích AI._\nMở Mini App → tab Tư Duy → Hỗ trợ BB để tạo.';
    }
    await editMessageText(chatId, messageId, txt, [
      [{ text: '⬅️ Quay lại', callback_data: 'menu_mindmap' }]
    ]);
    return;
  }

  // ── Quay lại menu chính ──
  if (cbData === 'menu_back') {
    await editToMainMenu();
    return;
  }

  // ── Xem báo cáo: show sub-menu with TV/BB counts ──
  if (cbData === 'menu_view_report') {
    const { data: fg } = await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single();
    if (!fg?.profile_id) return sendText(chatId, `❌ Group chưa gắn hồ sơ.`);
    const { count: tvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fg.profile_id).eq('record_type', 'tu_van');
    const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fg.profile_id).eq('record_type', 'bien_ban');
    const kb: any[] = [];
    if ((tvCount || 0) > 0) kb.push([{ text: `📝 Báo cáo TV (${tvCount} phiếu)`, callback_data: 'view_report_list_tv' }]);
    if ((bbCount || 0) > 0) kb.push([{ text: `📖 Báo cáo BB (${bbCount} phiếu)`, callback_data: 'view_report_list_bb' }]);
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
    const date = new Date(rec.created_at).toLocaleDateString('vi-VN');
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
    const date = new Date(rec.created_at).toLocaleDateString('vi-VN');
    let buoiTiepDisplay = '';
    if (c.buoi_tiep) {
      const isoMatch = String(c.buoi_tiep).match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (isoMatch) buoiTiepDisplay = `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]} ${isoMatch[4]}:${isoMatch[5]}`;
      else {
        const oldMatch = String(c.buoi_tiep).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/);
        if (oldMatch) buoiTiepDisplay = c.buoi_tiep;
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

  // menu_assign_role — Xác nhận GVBB
  if (cbData === 'menu_assign_role') {
    if (!canAssignRole(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền xác nhận GVBB.`);
    const admins = await getChatAdmins(chatId);
    if (!admins || !admins.length) return sendText(chatId, `❌ Không thể lấy danh sách quản trị viên của group.`);
    
    const adminIds = admins.filter((a: any) => !a.user.is_bot).map((a: any) => a.user.id);
    const { data: staffList } = await supabase.from('staff').select('telegram_id, staff_code, full_name').in('telegram_id', adminIds);
    const staffMap: any = {};
    staffList?.forEach((s: any) => staffMap[s.telegram_id] = s);
    
    const kb: any[] = [];
    for (const a of admins) {
      if (a.user.is_bot) continue;
      const tid = a.user.id;
      const staff = staffMap[tid];
      if (staff) {
        kb.push([{ text: staff.staff_code, callback_data: `assign_gvbb_${staff.staff_code}` }]);
      }
    }
    if (kb.length === 0) return sendText(chatId, `❌ Không tìm thấy TĐ nào đã đăng ký trong group này.`);
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

  // assign_gvbb_{staffCode} — Assign GVBB role
  if (cbData.startsWith('assign_gvbb_')) {
    const targetCode = cbData.replace('assign_gvbb_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    const { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❌ Group chưa đăng ký.`);
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: 'gvbb', assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    await sendText(chatId, `✅ Đã xác nhận *${targetCode}* đảm nhận vai trò *GVBB* trong group này.`);
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
