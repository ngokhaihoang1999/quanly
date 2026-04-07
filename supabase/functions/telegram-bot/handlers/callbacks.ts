import { supabase, ADMIN_STAFF_CODE, ROLE_LABELS, POSITION_LABELS, POSITION_LEVELS } from "../config.ts";
import { posLevel, canAssignRole, canLinkProfile, canChangeLevel, canApproveHapja, canAssignPosition, canDefineStructure } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, getChatAdmins, getStaffByTelegramId, exportChatInviteLink } from "../telegram.ts";

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

  // btn_assign_pos  EChềEđịnh chức vụ (pick staff first)
  if (cbData === 'btn_assign_pos') {
    if (!canAssignPosition(pos)) return sendText(chatId, `⛁EKhông có quyền chềEđịnh chức vụ.`);
    const { data: staffList } = await supabase.from('staff')
      .select('staff_code, full_name, position')
      .order('staff_code', { ascending: true })
      .limit(30);
    if (!staffList || staffList.length === 0) return sendText(chatId, `❁EChưa có TāEnào.`);
    const kb = staffList.map((s: any) => [{
      text: `${s.full_name} (${s.staff_code})  E${POSITION_LABELS[s.position] || s.position}`,
      callback_data: `assign_pos_pick_${s.staff_code}`
    }]);
    await sendKeyboard(chatId, `Chọn TāEđềEchềEđịnh chức vụ:`, kb);
    return;
  }

  // assign_pos_pick_{code}  EChọn chức vụ mới cho TāE  if (cbData.startsWith('assign_pos_pick_')) {
    if (!canAssignPosition(pos)) return sendText(chatId, `⛁EKhông có quyền.`);
    const targetCode = cbData.replace('assign_pos_pick_', '');
    const { data: target } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!target) return sendText(chatId, `❁EKhông tìm thấy mã *${targetCode}*.`);
    const assignable = Object.keys(POSITION_LEVELS).filter(p => posLevel(p) < posLevel(pos) && p !== 'admin');
    const kb = assignable.map(p => [{ text: POSITION_LABELS[p] || p, callback_data: `setpos_${targetCode}_${p}` }]);
    await sendKeyboard(chatId,
      `Chọn chức vụ mới cho *${target.full_name}* (${targetCode}):\n(Hiện tại: ${POSITION_LABELS[target.position || 'td']})`, kb);
    return;
  }

  // btn_structure  EXem cơ cấu tềEchức
  if (cbData === 'btn_structure') {
    if (!canDefineStructure(pos)) return sendText(chatId, `⛁EChềEAdmin/YJYN được xem cơ cấu.`);
    const { data: areas } = await supabase.from('areas').select('*, org_groups(*, teams(*))');
    if (!areas || areas.length === 0) return sendText(chatId, `📐 *Cơ cấu tềEchức*\n\nChưa có khu vực nào.\nTạo khu vực/nhóm/tềEtrong Mini App.`);
    let msg = `📐 *Cơ cấu tềEchức*\n\n`;
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

  // btn_support  ELiên hềEAdmin (prompt user to type message)
  if (cbData === 'btn_support') {
    await sendText(chatId,
      `💬 *Liên hềEAdmin*\n\nĐềEgửi tin nhắn đến Admin, hãy gõ:\n\`/support [nội dung]\`\n\nVD: \`/support Tôi không đăng nhập được\``);
    return;
  }

  // ============ GROUP MENU CALLBACKS ============


  // menu_info  EXem thông tin group
  if (cbData === 'menu_info') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❁EGroup này chưa được đăng ký.`);
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : 'BB';
    const { data: roles } = await supabase.from('fruit_roles').select('*, staff!fruit_roles_staff_code_fkey(full_name)').eq('fruit_group_id', fg.id);
    let rolesText = (roles && roles.length > 0) ? roles.map((r: any) => `  • ${ROLE_LABELS[r.role_type]}: ${r.staff_code}`).join('\n') : '  Chưa có vai trò nào.';
    await sendText(chatId, `📋 *Thông tin Group Trái quả*\n\n🍎 Trái: *${fg.profiles?.full_name || 'Chưa gắn'}*\n📊 Giai đoạn: *${levelLabel}*\n\n👥 Vai trò:\n${rolesText}`);
    return;
  }

  // menu_view_profile  EXem hềEsơ đầy đủ
  if (cbData === 'menu_view_profile') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(*)').eq('telegram_group_id', chatId).single();
    if (!fg || !fg.profiles) return sendText(chatId, `❁EGroup này chưa được gắn hềEsơ nào.`);
    
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
    const ktText = showKT ? (isKT ? '📖 Đã mềEKT' : '📕 Chưa mềEKT') : '';
    
    const { data: tvRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'tu_van');
    const { data: bbRecords } = await supabase.from('records').select('id').eq('profile_id', p.id).eq('record_type', 'bien_ban');
    
    const profileText =
      `🍎 *HềEsơ Trái quả*\n` +
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

  // menu_link_profile  EGắn hềEsơ
  if (cbData === 'menu_link_profile') {
    if (!canLinkProfile(pos)) return sendText(chatId, `⛁EQuyền truy cập bềEtừ chối.`);
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
    if (!profiles || profiles.length === 0) return sendText(chatId, `ℹ�E�EChưa có hềEsơ nào ềEgiai đoạn BB cần gắn group.`);
    const keyboard = profiles.map((p: any) => [{ text: `🎓 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hềEsơ BB đềEgắn cho group này:`, keyboard);
    return;
  }

  // menu_open_kt  EXác nhận mềEKT
  if (cbData === 'menu_open_kt') {
    // Check if group is registered and attached to a profile
    const { data: fg } = await supabase.from('fruit_groups')
      .select('profile_id, profiles(full_name, phase)').eq('telegram_group_id', chatId).single();
    if (!fg || !fg.profile_id) {
      return sendText(chatId, `❁EGroup chưa gắn hềEsơ nào.`);
    }
    const p = fg.profiles;
    if (!['bb', 'center', 'completed'].includes(p.phase)) {
      return sendText(chatId, `⚠�E�EHềEsơ *${p.full_name}* chưa đến giai đoạn BB. Bấm "Xem thông tin Group" đềEkiểm tra.`);
    }
    
    // Check permission logic: similar to what we did in mini-app toggles.
    // For simplicity, any admin/TVV/GVBB/NDD can toggle it if they can reach here.
    const keyboard = [
      [{ text: '✁EChắc chắn', callback_data: `action_confirm_kt_${fg.profile_id}` }],
      [{ text: '❁EHuỷ bềE, callback_data: 'action_cancel_kt' }]
    ];
    await sendKeyboard(chatId, `❁EBạn có chắc chắn muốn xác nhận đã MềEKT cho hềEsơ *${p.full_name}* không?`, keyboard);
    return;
  }

  // menu_assign_role  EXác nhận GVBB
  if (cbData === 'menu_assign_role') {
    if (!canAssignRole(pos)) return sendText(chatId, `⛁EQuyền truy cập bềEtừ chối. Chức vụ hiện tại không có quyền xác nhận GVBB.`);
    const admins = await getChatAdmins(chatId);
    if (!admins || !admins.length) return sendText(chatId, `❁EKhông thềElấy danh sách quản trềEviên của group.`);
    
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
    if (kb.length === 0) return sendText(chatId, `❁EKhông tìm thấy TāEnào đã đăng ký trong group này.`);
    await sendKeyboard(chatId, `Chọn TāEđảm nhận vai trò *GVBB*:`, kb);
    return;
  }

  // ============ ACTION CALLBACKS ============

  // link_fg_{profileId}  EGắn hềEsơ cho group
  if (cbData.startsWith('link_fg_')) {
    const profileId = cbData.replace('link_fg_', '');
    // Validate profile is at least at tu_van phase
    const { data: profile } = await supabase.from('profiles').select('full_name, phase').eq('id', profileId).single();
    if (!profile) return sendText(chatId, `❁EKhông tìm thấy hềEsơ.`);
    if (!['tu_van', 'bb', 'center', 'completed'].includes(profile.phase)) {
      await editMessageReplyMarkup(chatId, messageId, null);
      return sendText(chatId, `⚠�E�EHềEsơ *${profile.full_name}* chưa ềEgiai đoạn BB  Ekhông thềEgắn group BB.`);
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
      if (!newFg) return sendText(chatId, `❁EKhông thềEđăng ký group. Hãy thử gõ /start trước.`);
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

    let msg = `✁EĐã gắn hềEsơ *${profile.full_name}* cho group này.`;
    if (!finalLink) {
      msg += `\n\n⚠�E�EBot chưa phải là admin (hoặc thiếu quyền Mời người dùng) nên không thềETự Động lấy Link Group.\n\nHãy dùng lệnh sau đềEMini App có thềEmềEGroup:\n\`/setlink [Link_mời_vào_nhóm_này]\``;
    }
    await sendText(chatId, msg);
    return;
  }


  // action_cancel_kt
  if (cbData === 'action_cancel_kt') {
    await editMessageReplyMarkup(chatId, messageId, null);
    await sendText(chatId, `❁EĐã huỷ thao tác.`);
    return;
  }

  // action_confirm_kt_{profileId}
  if (cbData.startsWith('action_confirm_kt_')) {
    const profileId = cbData.replace('action_confirm_kt_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    
    const { data: p } = await supabase.from('profiles').select('full_name').eq('id', profileId).single();
    if (!p) return sendText(chatId, '❁EKhông tìm thấy hềEsơ.');

    await supabase.from('profiles')
      .update({ is_kt_opened: true })
      .eq('id', profileId);
      
    await sendText(chatId, `✁EĐã xác nhận **MềEKT** cho hềEsơ *${p.full_name}*.`);
    return;
  }

  // assign_gvbb_{staffCode}  EAssign GVBB role
  if (cbData.startsWith('assign_gvbb_')) {
    const targetCode = cbData.replace('assign_gvbb_', '');
    await editMessageReplyMarkup(chatId, messageId, null);
    const { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❁EGroup chưa đăng ký.`);
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: 'gvbb', assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    await sendText(chatId, `✁EĐã xác nhận *${targetCode}* đảm nhận vai trò *GVBB* trong group này.`);
    return;
  }

  // ============ PROFILE / HAPJA CALLBACKS ============

  // list_profiles
  if (cbData === "list_profiles") {
    const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, "Chưa có hềEsơ nào."); return;
    }
    const kb = profiles.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
    await sendKeyboard(chatId, "📋 Danh sách hềEsơ:", kb);
    return;
  }

  // view_p_{id}
  if (cbData.startsWith("view_p_")) {
    const profileId = cbData.replace("view_p_", "");
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (!profile) { await sendText(chatId, "❁EKhông tìm thấy."); return; }
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
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛁EKhông có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('approve_hapja_', '');
    const { data: hapja } = await supabase.from('check_hapja').select('*').eq('id', hapjaId).single();
    if (!hapja || hapja.status !== 'pending') { await sendText(chatId, `⚠�E�EPhiếu không tồn tại hoặc đã xử lý.`); return; }
    const { data: newProfile } = await supabase.from('profiles').insert({
      full_name: hapja.full_name, birth_year: hapja.birth_year, gender: hapja.gender,
      created_by: hapja.created_by, phase: 'chakki'
    }).select().single();
    await supabase.from('check_hapja').update({
      status: 'approved', approved_by: staffData.staff_code,
      approved_at: new Date().toISOString(), profile_id: newProfile?.id
    }).eq('id', hapjaId);
    await sendText(chatId, `✁EĐã duyệt phiếu Check Hapja cho *${hapja.full_name}*!\nHềEsơ Trái quả đã được tạo tự động.`);
    const { data: creator } = await supabase.from('staff').select('telegram_id').eq('staff_code', hapja.created_by).single();
    if (creator?.telegram_id) {
      await sendText(creator.telegram_id, `✁EPhiếu Check Hapja cho *${hapja.full_name}* đã được *duyệt*!`);
    }
    return;
  }

  // reject_hapja_{id}
  if (cbData.startsWith('reject_hapja_')) {
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛁EKhông có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('reject_hapja_', '');
    await supabase.from('check_hapja').update({
      status: 'rejected', approved_by: staffData.staff_code, approved_at: new Date().toISOString()
    }).eq('id', hapjaId);
    await sendText(chatId, `❁EĐã từ chối phiếu Check Hapja.`);
    return;
  }

  // ============ ADMIN CALLBACKS ============

  // approve_{staffCode}  EApprove TG change
  if (isAdmin && cbData.startsWith("approve_")) {
    const staffCode = cbData.replace("approve_", "");
    const { data: ps } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
    if (!ps?.pending_telegram_id) { await sendText(chatId, "⚠�E�EKhông có yêu cầu pending."); return; }
    await supabase.from('staff')
      .update({ telegram_id: ps.pending_telegram_id, pending_telegram_id: null, pending_requested_at: null })
      .eq('staff_code', staffCode);
    await sendText(chatId, `✁EĐã duyệt đổi Telegram cho *${ps.full_name}*.`);
    await sendText(ps.pending_telegram_id, `✁EYêu cầu đổi Telegram đã được *duyệt*! Dùng /start.`);
    return;
  }
  if (isAdmin && cbData.startsWith("deny_")) {
    const staffCode = cbData.replace("deny_", "");
    const { data: ps } = await supabase.from('staff').select('*').eq('staff_code', staffCode).single();
    if (!ps?.pending_telegram_id) { await sendText(chatId, "⚠�E�EKhông có yêu cầu pending."); return; }
    const pid = ps.pending_telegram_id;
    await supabase.from('staff').update({ pending_telegram_id: null, pending_requested_at: null }).eq('staff_code', staffCode);
    await sendText(chatId, `❁EĐã từ chối đổi Telegram cho *${ps.full_name}*.`);
    await sendText(pid, `❁EYêu cầu đổi Telegram bềE*từ chối*. Nhắn /support nếu cần hềEtrợ.`);
    return;
  }

  // setpos_{code}_{pos}  EAssign position
  if (cbData.startsWith('setpos_')) {
    // Parse: setpos_CODE_position (position may contain '_' like ggn_jondo)
    const payload = cbData.replace('setpos_', '');
    const sepIdx = payload.indexOf('_');
    const targetCode = payload.substring(0, sepIdx);
    const newPos = payload.substring(sepIdx + 1);
    if (!canAssignPosition(pos)) { await sendText(chatId, `⛁EKhông có quyền.`); return; }
    if (posLevel(newPos) >= posLevel(pos)) { await sendText(chatId, `⛁EKhông thềEgán chức vụ bằng/cao hơn mình.`); return; }
    await supabase.from('staff').update({ position: newPos }).eq('staff_code', targetCode);
    await sendText(chatId, `✁EĐã chềEđịnh *${POSITION_LABELS[newPos]}* cho *${targetCode}*.`);
    return;
  }
}
