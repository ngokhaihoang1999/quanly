import { supabase, ADMIN_STAFF_CODE, ROLE_LABELS, POSITION_LABELS, POSITION_LEVELS } from "../config.ts";
import { posLevel, canAssignRole, canLinkProfile, canChangeLevel, canApproveHapja, canAssignPosition, canDefineStructure } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, getChatAdmins, getStaffByTelegramId } from "../telegram.ts";

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


  // menu_info — Xem thông tin group
  if (cbData === 'menu_info') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❌ Group này chưa được đăng ký.`);
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : 'BB';
    const { data: roles } = await supabase.from('fruit_roles').select('*, staff!fruit_roles_staff_code_fkey(full_name)').eq('fruit_group_id', fg.id);
    let rolesText = (roles && roles.length > 0) ? roles.map((r: any) => `  • ${ROLE_LABELS[r.role_type]}: ${r.staff_code}`).join('\n') : '  Chưa có vai trò nào.';
    await sendText(chatId, `📋 *Thông tin Group Trái quả*\n\n🍎 Trái: *${fg.profiles?.full_name || 'Chưa gắn'}*\n📊 Giai đoạn: *${levelLabel}*\n\n👥 Vai trò:\n${rolesText}`);
    return;
  }

  // menu_view_profile — Xem hồ sơ đầy đủ
  if (cbData === 'menu_view_profile') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(*)').eq('telegram_group_id', chatId).single();
    if (!fg || !fg.profiles) return sendText(chatId, `❌ Group này chưa được gắn hồ sơ nào.`);
    
    const p = fg.profiles;
    const info = p.info_sheet || {};
    
    const { data: roles } = await supabase.from('fruit_roles')
      .select('role_type, staff_code').eq('fruit_group_id', fg.id);
    
    const getRoleCode = (rt: string) => roles?.find((r: any) => r.role_type === rt)?.staff_code || info[`${rt}_name`] || 'Chưa xác nhận';
    
    const genderMap: Record<string,string> = { nam: 'Nam', nu: 'Nữ' };
    const genderLabel = genderMap[p.gender] || p.gender || 'N/A';
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : 'BB';
    
    const { data: tvRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'tu_van');
    const { data: bbRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'bien_ban');
    
    const profileText =
      `🍎 *Hồ sơ Trái quả*\n` +
      `───────────────────\n` +
      `*Tên:* ${p.full_name}\n` +
      `*Sinh năm:* ${p.birth_year || 'N/A'}   *Giới tính:* ${genderLabel}\n` +
      `*Giai đoạn:* ${levelLabel}\n\n` +
      `👥 *Đội ngũ chăm sóc:*\n` +
      `  NDD: ${p.ndd_staff_code || getRoleCode('ndd')}\n` +
      `  TVV: ${getRoleCode('tvv')}\n` +
      `  GVBB: ${getRoleCode('gvbb')}\n\n` +
      `📝 *Báo cáo:* ${tvRecords?.length || 0} Tư vấn | ${bbRecords?.length || 0} Biên bản BB\n` +
      (info.tinh_cach ? `\n🔍 *Tính cách:* ${info.tinh_cach}` : '') +
      (info.nghe_nghiep ? `\n💼 *Nghề nghiệp:* ${info.nghe_nghiep}` : '');
    
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
      .in('phase', ['bb', 'center'])
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

  // menu_set_level — Chuyển giai đoạn
  if (cbData === 'menu_set_level') {
    if (!canChangeLevel(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền chuyển giai đoạn.`);
    const keyboard = [
      [{ text: '💬 Tư vấn', callback_data: 'action_set_level_tu_van' }],
      [{ text: '📋 BB', callback_data: 'action_set_level_bb' }]
    ];
    await sendKeyboard(chatId, `Chọn giai đoạn mới cho group:`, keyboard);
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
    // Validate profile is BB phase
    const { data: profile } = await supabase.from('profiles').select('full_name, phase').eq('id', profileId).single();
    if (!profile) return sendText(chatId, `❌ Không tìm thấy hồ sơ.`);
    if (!['bb', 'center', 'completed'].includes(profile.phase)) {
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
      if (!newFg) return sendText(chatId, `❌ Không thể đăng ký group. Hãy thử gõ /menu trước.`);
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

    // Update the real group row with profile_id
    await supabase.from('fruit_groups').update({
      profile_id: profileId, level: 'bb', updated_at: new Date().toISOString()
    }).eq('id', fg.id);

    await sendText(chatId, `✅ Đã gắn hồ sơ *${profile.full_name}* cho group này.`);
    return;
  }


  // action_set_level_{level} — Set group level
  if (cbData.startsWith('action_set_level_')) {
    const newLevel = cbData.replace('action_set_level_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    await supabase.from('fruit_groups')
      .update({ level: newLevel, updated_at: new Date().toISOString() })
      .eq('telegram_group_id', chatId);
    const label = newLevel === 'tu_van' ? 'Tư vấn' : 'BB';
    await sendText(chatId, `✅ Đã chuyển group sang giai đoạn *${label}*.`);
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
    await sendText(ps.pending_telegram_id, `✅ Yêu cầu đổi Telegram đã được *duyệt*! Dùng /menu.`);
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
