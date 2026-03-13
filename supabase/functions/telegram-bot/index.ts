import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const ADMIN_STAFF_CODE = '000142-NKH';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ POSITION HIERARCHY (5 levels, some same-level) ============
// Level 0: TĐ | Level 1: BGYJN | Level 2: GYJN
// Level 3: TJN, GGN Chakki, SGN Jondo, GGN Jondo (NGANG HÀNG)
// Level 4: YJYN | Level 5: Admin
const POSITION_LEVELS: Record<string,number> = {
  td: 0, bgyjn: 1, gyjn: 2,
  tjn: 3, ggn_chakki: 3, sgn_jondo: 3, ggn_jondo: 3,
  yjyn: 4, admin: 5
};
const POSITION_LABELS: Record<string,string> = {
  td:'TĐ', bgyjn:'BGYJN', gyjn:'GYJN', sgn_jondo:'SGN Jondo',
  ggn_chakki:'GGN Chakki', ggn_jondo:'GGN Jondo', tjn:'TJN', yjyn:'YJYN', admin:'Admin'
};
const ROLE_LABELS: Record<string,string> = { ndd:'NDD', tvv:'TVV', gvbb:'GVBB', la:'Lá' };

function posLevel(p: string): number { return POSITION_LEVELS[p] ?? 0; }
function hasMinPosition(staffPos: string, minPos: string): boolean { return posLevel(staffPos) >= posLevel(minPos); }

// Permission checks
function canDefineStructure(p: string) { return p === 'admin' || p === 'yjyn'; }
function canAssignPosition(p: string) { return ['admin','yjyn','tjn','gyjn'].includes(p); }
function canAssignRole(p: string) { return ['admin','yjyn','tjn','gyjn','ggn_jondo'].includes(p); }
function canCreateHapja(p: string) { return ['yjyn','tjn','gyjn','bgyjn','ggn_jondo','ggn_chakki'].includes(p); }
function canApproveHapja(p: string) { return ['yjyn','ggn_jondo'].includes(p); }
function canLinkProfile(p: string) { return ['admin','yjyn','ggn_jondo','tjn','gyjn'].includes(p); }
function canChangeLevel(p: string) { return ['ggn_jondo','tjn'].includes(p); }

// ============ HELPERS ============
async function sendText(chatId: number, text: string, extra: any = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
  });
}

async function sendKeyboard(chatId: number, text: string, keyboard: any[]) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard }, parse_mode: "Markdown" })
  });
}

async function forwardMessage(fromChatId: number, toChatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId })
  });
}

async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup: any = null) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup })
  });
}

async function getChatAdmins(chatId: number) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatAdministrators?chat_id=${chatId}`).then(r => r.json());
  return res.ok ? res.result : [];
}

async function getAdminTelegramId(): Promise<number | null> {
  const { data } = await supabase.from('staff').select('telegram_id').eq('staff_code', ADMIN_STAFF_CODE).single();
  return data?.telegram_id || null;
}

async function getStaffByTelegramId(tid: number) {
  const { data } = await supabase.from('staff').select('*').eq('telegram_id', tid).single();
  return data;
}

// ============ GROUP CHAT HANDLERS ============

async function handleGroupChat(update: any) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const chatTitle = msg.chat.title || '';
  const telegramId = msg.from.id;
  const text = msg.text || '';

  // Bot added to group → register group
  if (msg.new_chat_members) {
    const botInfo = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
    const botId = botInfo.result?.id;
    const botAdded = msg.new_chat_members.some((m: any) => m.id === botId);
    if (botAdded) {
      // Register this group chat
      const { data: existing } = await supabase.from('fruit_groups')
        .select('*').eq('telegram_group_id', chatId).single();
      if (!existing) {
        await supabase.from('fruit_groups').insert({
          telegram_group_id: chatId,
          telegram_group_title: chatTitle,
          level: 'tu_van'
        });
      }
      
      // Send welcome message
      await sendText(chatId,
        `🍎 *Bot Checking Jondo đã vào group!*\n\nGroup này đã được đăng ký làm Group Trái quả.\nĐể quản lý, gõ lệnh: /menu`
      );

      // Fetch unlinked profiles (approved check_hapja/profiles without a group)
      const { data: linkedGroups } = await supabase.from('fruit_groups').select('profile_id').not('profile_id', 'is', null);
      const linkedProfileIds = linkedGroups?.map((g: any) => g.profile_id) || [];
      
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(10);
      if (linkedProfileIds.length > 0) {
        query = query.not('id', 'in', `(${linkedProfileIds.join(',')})`);
      }
      
      const { data: unlinkedProfiles } = await query;
      
      if (unlinkedProfiles && unlinkedProfiles.length > 0) {
        const keyboard = unlinkedProfiles.map((p: any) => [{ text: `🍎 Gắn: ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
        await sendKeyboard(chatId, `Danh sách hồ sơ chưa có group (Bấm để gắn ngay):`, keyboard);
      }
      
      return;
    }
  }

  // Get staff data for commands
  const staffData = await getStaffByTelegramId(telegramId);
  if (!staffData) return; // Ignore non-registered users in group

  const pos = staffData.position || 'td';

  // /link_profile — Gắn hồ sơ cho group
  if (text.startsWith('/link_profile')) {
    if (!canLinkProfile(pos)) {
      await sendText(chatId, `⛔ Bạn cần chức vụ YJYN/GGN Jondo/TJN/GYJN để gắn hồ sơ.`);
      return;
    }
    const query = text.replace('/link_profile', '').trim();
    if (!query) {
      await sendText(chatId, `⚠️ Cú pháp: \`/link_profile [tên trái]\`\nVD: \`/link_profile Nguyễn Văn A\``);
      return;
    }
    const { data: profiles } = await supabase.from('profiles')
      .select('*').ilike('full_name', `%${query}%`).limit(5);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, `❌ Không tìm thấy hồ sơ nào khớp "${query}".`);
      return;
    }
    const keyboard = profiles.map((p: any) => [{ text: `🍎 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hồ sơ để gắn cho group này:`, keyboard);
    return;
  }

  // /assign_role — Gắn vai trò trong group
  if (text.startsWith('/assign_role')) {
    if (!canAssignRole(pos)) {
      await sendText(chatId, `⛔ Bạn không có quyền gắn vai trò.`);
      return;
    }
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendText(chatId, `⚠️ Cú pháp: \`/assign_role [mã_TĐ] [ndd/tvv/gvbb/la]\``);
      return;
    }
    const targetCode = parts[1];
    const roleType = parts[2].toLowerCase();
    if (!['ndd','tvv','gvbb','la'].includes(roleType)) {
      await sendText(chatId, `❌ Vai trò không hợp lệ. Chọn: ndd, tvv, gvbb, la`);
      return;
    }
    const { data: targetStaff } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!targetStaff) {
      await sendText(chatId, `❌ Không tìm thấy TĐ với mã *${targetCode}*.`);
      return;
    }
    const { data: fg } = await supabase.from('fruit_groups')
      .select('*').eq('telegram_group_id', chatId).single();
    if (!fg) {
      await sendText(chatId, `❌ Group này chưa được đăng ký. Hãy thêm lại bot vào group.`);
      return;
    }
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: roleType, assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    await sendText(chatId,
      `✅ Đã gắn vai trò *${ROLE_LABELS[roleType]}* cho *${targetStaff.full_name}* (${targetCode}) trong group này.`
    );
    return;
  }

  // /set_level — Chuyển cấp độ group
  if (text.startsWith('/set_level')) {
    if (!canChangeLevel(pos)) {
      await sendText(chatId, `⛔ Bạn cần chức vụ GGN Jondo hoặc TJN để chuyển cấp.`);
      return;
    }
    const newLevel = text.split(/\s+/)[1]?.toLowerCase();
    if (!newLevel || !['tu_van','bb'].includes(newLevel)) {
      await sendText(chatId, `⚠️ Cú pháp: \`/set_level [tu_van/bb]\``);
      return;
    }
    await supabase.from('fruit_groups')
      .update({ level: newLevel, updated_at: new Date().toISOString() })
      .eq('telegram_group_id', chatId);
    const label = newLevel === 'tu_van' ? 'Tư vấn' : 'BB';
    await sendText(chatId, `✅ Đã chuyển cấp độ group sang *${label}*.`);
    return;
  }

  // /group_info — Xem thông tin group
  if (text === '/group_info' || text.startsWith('/group_info@')) {
    const { data: fg } = await supabase.from('fruit_groups')
      .select('*, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg) {
      await sendText(chatId, `❌ Group này chưa được đăng ký.`);
      return;
    }
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : 'BB';
    const profileName = fg.profiles?.full_name || 'Chưa gắn';
    const { data: roles } = await supabase.from('fruit_roles')
      .select('*, staff!fruit_roles_staff_code_fkey(full_name)').eq('fruit_group_id', fg.id);
    let rolesText = '';
    if (roles && roles.length > 0) {
      rolesText = roles.map((r: any) => `  • ${ROLE_LABELS[r.role_type]}: ${r.staff?.full_name || r.staff_code}`).join('\n');
    } else {
      rolesText = '  Chưa có vai trò nào.';
    }
    await sendText(chatId,
      `📋 *Thông tin Group Trái quả*\n\n` +
      `🍎 Trái: *${profileName}*\n` +
      `📊 Cấp độ: *${levelLabel}*\n\n` +
      `👥 Vai trò:\n${rolesText}`
    );
    return;
  }

  // /menu — Menu lệnh cho group
  if (text === '/menu' || text.startsWith('/menu@')) {
    const keyboard = [
      [{ text: '📋 Xem thông tin Group', callback_data: 'menu_info' }],
      [{ text: '🍎 Gắn hồ sơ', callback_data: 'menu_link_profile' }],
      [{ text: '👥 Xác nhận GVBB', callback_data: 'menu_assign_role' }],
      [{ text: '🔄 Chuyển giai đoạn', callback_data: 'menu_set_level' }]
    ];
    await sendKeyboard(chatId, `🛠 *Menu Quản lý Group*`, keyboard);
    return;
  }
}

// ============ CALLBACK HANDLERS ============

async function handleCallback(update: any, staffData: any) {
  const cbData = update.callback_query.data;
  const chatId = update.callback_query.message.chat.id;
  const isGroup = update.callback_query.message.chat.type !== 'private';
  const pos = staffData.position || 'td';
  const isAdmin = staffData.staff_code === ADMIN_STAFF_CODE || pos === 'admin';

  // Link profile to fruit group
  if (cbData.startsWith('link_fg_') && isGroup) {
    const profileId = cbData.replace('link_fg_', '');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (!profile) { await sendText(chatId, `❌ Hồ sơ không tồn tại.`); return; }
    await supabase.from('fruit_groups')
      .update({ profile_id: profileId, updated_at: new Date().toISOString() })
      .eq('telegram_group_id', chatId);
      
  // Remove the keyboard to prevent multiple clicks
    const msgId = update.callback_query.message.message_id;
    await editMessageReplyMarkup(chatId, msgId, null);
    
    await sendText(chatId, `✅ Đã gắn hồ sơ *${profile.full_name}* cho group này!`);
    return;
  }

  // --- MENU INTERACTIONS ---
  if (cbData === 'menu_info') {
    const { data: fg } = await supabase.from('fruit_groups').select('*, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg) return sendText(chatId, `❌ Group này chưa được đăng ký.`);
    const levelLabel = fg.level === 'tu_van' ? 'Tư vấn' : 'BB';
    const { data: roles } = await supabase.from('fruit_roles').select('*, staff!fruit_roles_staff_code_fkey(full_name)').eq('fruit_group_id', fg.id);
    let rolesText = (roles && roles.length > 0) ? roles.map((r: any) => `  • ${ROLE_LABELS[r.role_type]}: ${r.staff?.full_name || r.staff_code}`).join('\n') : '  Chưa có vai trò nào.';
    await sendText(chatId, `📋 *Thông tin Group Trái quả*\n\n🍎 Trái: *${fg.profiles?.full_name || 'Chưa gắn'}*\n📊 Cấp độ: *${levelLabel}*\n\n👥 Vai trò:\n${rolesText}`);
    return;
  }

  if (cbData === 'menu_link_profile') {
    if (!canLinkProfile(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền gắn hồ sơ.`);
    // Show ALL profiles including already-linked ones to allow re-assignment
    const { data: allProfiles } = await supabase.from('profiles').select('id, full_name').order('created_at', { ascending: false }).limit(15);
    if (!allProfiles || allProfiles.length === 0) return sendText(chatId, `❌ Không có hồ sơ nào trong hệ thống.`);
    const keyboard = allProfiles.map((p: any) => [{ text: `🍎 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hồ sơ để gắn vào group này (có thể chọn lại nếu bấm nhầm):`, keyboard);
    return;
  }

  if (cbData === 'menu_set_level') {
    if (!canChangeLevel(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền chuyển giai đoạn.`);
    await sendKeyboard(chatId, `Chọn giai đoạn:`, [
      [{ text: 'Tư vấn', callback_data: `action_set_level_tu_van` }, { text: 'BB', callback_data: `action_set_level_bb` }]
    ]);
    return;
  }

  if (cbData.startsWith('action_set_level_')) {
    if (!canChangeLevel(pos)) return;
    const newLevel = cbData.replace('action_set_level_', '');
    await supabase.from('fruit_groups').update({ level: newLevel, updated_at: new Date().toISOString() }).eq('telegram_group_id', chatId);
    await editMessageReplyMarkup(chatId, update.callback_query.message.message_id, null);
    await sendText(chatId, `✅ Group đã chuyển sang giai đoạn *${newLevel === 'tu_van' ? 'Tư vấn' : 'BB'}*.`);
    return;
  }

  if (cbData === 'menu_assign_role') {
    if (!canAssignRole(pos)) return sendText(chatId, `⛔ Quyền truy cập bị từ chối. Chức vụ hiện tại không có quyền xác nhận GVBB.`);
    // Only ask for GVBB — NDD and TVV were established before the group was created
    const admins = await getChatAdmins(chatId);
    if (!admins || !admins.length) return sendText(chatId, `❌ Không thể lấy danh sách quản trị viên của group.`);
    
    const adminIds = admins.filter((a: any) => !a.user.is_bot).map((a: any) => a.user.id);
    const { data: staffList } = await supabase.from('staff').select('telegram_id, staff_code, full_name').in('telegram_id', adminIds);
    const staffMap: any = {};
    staffList?.forEach((s: any) => staffMap[s.telegram_id] = s);
    
    const kb = [];
    for (const a of admins) {
      if (a.user.is_bot) continue;
      const tid = a.user.id;
      const staff = staffMap[tid];
      if (staff) {
        kb.push([{ text: `${staff.staff_code} — ${staff.full_name}`, callback_data: `assign_gvbb_${staff.staff_code}` }]);
      }
      // Non-registered users are excluded silently
    }
    if (kb.length === 0) return sendText(chatId, `❌ Không tìm thấy TĐ nào đã đăng ký trong group này.`);
    await sendKeyboard(chatId, `Chọn TĐ đảm nhận vai trò *GVBB*:`, kb);
    return;
  }

  // GVBB direct assignment (from menu_assign_role)
  if (cbData.startsWith('assign_gvbb_')) {
    if (!canAssignRole(pos)) return;
    const targetCode = cbData.replace('assign_gvbb_', '');
    const { data: targetStaff } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!targetStaff) return;
    const { data: fg } = await supabase.from('fruit_groups').select('*').eq('telegram_group_id', chatId).single();
    if (!fg) return;
    
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: 'gvbb', assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    
    await editMessageReplyMarkup(chatId, update.callback_query.message.message_id, null);
    await sendText(chatId, `✅ Đã xác nhận *${targetCode}* đảm nhận vai trò *GVBB* trong group này.`);
    return;
  }

  // List profiles
  if (cbData === "list_profiles") {
    const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, "Chưa có hồ sơ nào."); return;
    }
    const kb = profiles.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
    await sendKeyboard(chatId, "📋 Danh sách hồ sơ:", kb);
    return;
  }

  // View profile
  if (cbData.startsWith("view_p_")) {
    const profileId = cbData.replace("view_p_", "");
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', profileId).single();
    if (!profile) { await sendText(chatId, "❌ Không tìm thấy."); return; }
    const { count: tvvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'to_3');
    const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', profileId).eq('record_type', 'to_4');
    let m = `👤 *${profile.full_name}*\n`;
    m += `📱 SĐT: ${profile.phone_number || 'Chưa có'}\n`;
    m += `🎂 Năm sinh: ${profile.birth_year || 'N/A'}\n`;
    m += `📊 TVV: ${tvvCount||0} | BB: ${bbCount||0}`;
    await sendText(chatId, m);
    return;
  }

  // Approve Hapja
  if (cbData.startsWith('approve_hapja_')) {
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛔ Không có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('approve_hapja_', '');
    const { data: hapja } = await supabase.from('check_hapja').select('*').eq('id', hapjaId).single();
    if (!hapja || hapja.status !== 'pending') { await sendText(chatId, `⚠️ Phiếu không tồn tại hoặc đã xử lý.`); return; }
    // Create profile from Hapja
    const { data: newProfile } = await supabase.from('profiles').insert({
      full_name: hapja.full_name, birth_year: hapja.birth_year, gender: hapja.gender,
      created_by: hapja.created_by
    }).select().single();
    await supabase.from('check_hapja').update({
      status: 'approved', approved_by: staffData.staff_code,
      approved_at: new Date().toISOString(), profile_id: newProfile?.id
    }).eq('id', hapjaId);
    await sendText(chatId, `✅ Đã duyệt phiếu Check Hapja cho *${hapja.full_name}*!\nHồ sơ Trái quả đã được tạo tự động.`);
    // Notify creator
    const { data: creator } = await supabase.from('staff').select('telegram_id').eq('staff_code', hapja.created_by).single();
    if (creator?.telegram_id) {
      await sendText(creator.telegram_id, `✅ Phiếu Check Hapja cho *${hapja.full_name}* đã được *duyệt*!`);
    }
    return;
  }

  // Reject Hapja
  if (cbData.startsWith('reject_hapja_')) {
    if (!canApproveHapja(pos)) { await sendText(chatId, `⛔ Không có quyền duyệt.`); return; }
    const hapjaId = cbData.replace('reject_hapja_', '');
    await supabase.from('check_hapja').update({
      status: 'rejected', approved_by: staffData.staff_code, approved_at: new Date().toISOString()
    }).eq('id', hapjaId);
    await sendText(chatId, `❌ Đã từ chối phiếu Check Hapja.`);
    return;
  }

  // Admin: Approve telegram_id change
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

  // Select position for assign
  if (cbData.startsWith('setpos_')) {
    const [_, targetCode, newPos] = cbData.split('_');
    // Verify hierarchy
    if (!canAssignPosition(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return; }
    if (posLevel(newPos) >= posLevel(pos)) { await sendText(chatId, `⛔ Không thể gán chức vụ bằng/cao hơn mình.`); return; }
    await supabase.from('staff').update({ position: newPos }).eq('staff_code', targetCode);
    await sendText(chatId, `✅ Đã chỉ định *${POSITION_LABELS[newPos]}* cho *${targetCode}*.`);
    return;
  }
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    // Detect group chat
    const chatType = update.message?.chat?.type || update.callback_query?.message?.chat?.type || 'private';
    const isGroup = chatType === 'group' || chatType === 'supergroup';

    // Group chat: delegate to group handler
    if (isGroup && update.message) {
      await handleGroupChat(update);
      return new Response("OK");
    }

    const msg = update.message || update.callback_query?.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;
    const telegramId = update.message ? update.message.from.id : update.callback_query.from.id;
    const text = update.message?.text || null;
    const messageId = update.message?.message_id;

    // 1. Nhận diện TĐ
    const staffData = await getStaffByTelegramId(telegramId);

    // 2. Chưa đăng ký
    if (!staffData) {
      if (text && text.startsWith('/register')) {
        const code = text.split(" ")[1];
        if (!code) { await sendText(chatId, "⚠️ Cú pháp: `/register [Mã_TĐ]`\nVD: `/register 012345-ABC`"); return new Response("OK"); }
        const { data: existing } = await supabase.from('staff').select('*').eq('staff_code', code).single();
        if (!existing) { await sendText(chatId, "❌ Mã TĐ không tồn tại."); return new Response("OK"); }
        if (existing.telegram_id && existing.telegram_id !== telegramId) {
          await supabase.from('staff')
            .update({ pending_telegram_id: telegramId, pending_requested_at: new Date().toISOString() })
            .eq('staff_code', code);
          await sendText(chatId, `⏳ Mã *${code}* đang liên kết TG khác. Yêu cầu đã gửi Admin.`);
          const adminId = await getAdminTelegramId();
          if (adminId) {
            await sendText(adminId, `🔔 *Yêu cầu đổi TG*\nTĐ: *${existing.full_name}* (${code})\nID mới: \`${telegramId}\``, {
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

    const pos = staffData.position || 'td';

    // 3. Callback query
    if (update.callback_query) {
      // Group callback
      if (isGroup) {
        await handleCallback(update, staffData);
        return new Response("OK");
      }
      await handleCallback(update, staffData);
      return new Response("OK");
    }

    // 4. /menu
    if (text === '/start' || text === '/menu') {
      const miniAppUrl = `https://ngokhaihoang1999.github.io/quanly/mini-app/index.html`;
      const posLabel = POSITION_LABELS[pos] || pos;
      const keyboard = [
        [{ text: "📋 Danh bạ & Hồ sơ", callback_data: "list_profiles" }],
        [{ text: "🖥 Mở Quản Lý (Mini App)", web_app: { url: miniAppUrl } }]
      ];
      await sendKeyboard(chatId,
        `Xin chào, *${staffData.full_name}* (${staffData.staff_code})\n` +
        `Chức vụ: *${posLabel}*\n\n` +
        `🔹 Bot: Tra cứu, Check Hapja, phân quyền\n` +
        `🔹 Mini App: Quản lý hồ sơ đầy đủ\n` +
        `🔹 /support [nội dung] để liên hệ Admin\n\n` +
        `📌 Lệnh:\n` +
        `• /search [tên] — Tìm hồ sơ\n` +
        `• /check\\_hapja — Tạo phiếu sàng lọc\n` +
        `• /assign\\_pos [mã] — Chỉ định chức vụ\n` +
        `• /structure — Quản lý cấu trúc`, keyboard);
      return new Response("OK");
    }

    // 5. /search
    if (text && text.startsWith('/search ')) {
      const q = text.replace('/search ', '').trim();
      const { data: res } = await supabase.from('profiles').select('*').ilike('full_name', `%${q}%`).limit(5);
      if (!res || res.length === 0) { await sendText(chatId, `🔍 Không tìm thấy "${q}"`); }
      else {
        const kb = res.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
        await sendKeyboard(chatId, `🔍 Kết quả cho "${q}":`, kb);
      }
      return new Response("OK");
    }

    // 6. /check_hapja — Tạo phiếu Check Hapja
    if (text && text.startsWith('/check_hapja')) {
      if (!canCreateHapja(pos)) {
        await sendText(chatId, `⛔ Chức vụ *${POSITION_LABELS[pos]}* không có quyền tạo phiếu Check Hapja.`);
        return new Response("OK");
      }
      const parts = text.replace('/check_hapja', '').trim();
      if (!parts) {
        await sendText(chatId,
          `📝 *Tạo phiếu Check Hapja*\n\n` +
          `Cú pháp: \`/check_hapja [Họ tên]\`\n` +
          `VD: \`/check_hapja Nguyễn Văn A\`\n\n` +
          `Sau khi tạo, phiếu sẽ được gửi lên YJYN/GGN Jondo để duyệt.`);
        return new Response("OK");
      }
      const { data: hapja } = await supabase.from('check_hapja').insert({
        full_name: parts, created_by: staffData.staff_code, data: {}, status: 'pending'
      }).select().single();
      // Notify approvers (YJYN, GGN Jondo)
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
      return new Response("OK");
    }

    // 7. /assign_pos — Chỉ định chức vụ
    if (text && text.startsWith('/assign_pos')) {
      if (!canAssignPosition(pos)) {
        await sendText(chatId, `⛔ Không có quyền chỉ định chức vụ.`); return new Response("OK");
      }
      const parts = text.split(/\s+/);
      if (parts.length < 2) {
        await sendText(chatId, `⚠️ Cú pháp: \`/assign_pos [mã_TĐ]\`\nVD: \`/assign_pos 000707-TNHA\``);
        return new Response("OK");
      }
      const targetCode = parts[1];
      const { data: target } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
      if (!target) { await sendText(chatId, `❌ Không tìm thấy mã *${targetCode}*.`); return new Response("OK"); }
      // Show assignable positions (lower than caller)
      const assignable = Object.keys(POSITION_LEVELS).filter(p => posLevel(p) < posLevel(pos) && p !== 'admin');
      const kb = assignable.map(p => [{ text: POSITION_LABELS[p], callback_data: `setpos_${targetCode}_${p}` }]);
      await sendKeyboard(chatId,
        `Chọn chức vụ mới cho *${target.full_name}* (${targetCode}):\n(Hiện tại: ${POSITION_LABELS[target.position || 'td']})`, kb);
      return new Response("OK");
    }

    // 8. /structure — Quản lý cấu trúc
    if (text && text.startsWith('/structure')) {
      if (!canDefineStructure(pos)) {
        await sendText(chatId, `⛔ Chỉ Admin/YJYN được quản lý cấu trúc.`); return new Response("OK");
      }
      const { data: areas } = await supabase.from('areas').select('*, org_groups(*, teams(*))');
      if (!areas || areas.length === 0) {
        await sendText(chatId,
          `📐 *Cấu trúc tổ chức*\n\nChưa có khu vực nào.\n\n` +
          `Tạo mới: \`/create_area [tên]\`\n` +
          `Tạo nhóm: \`/create_group [tên khu vực] [tên nhóm]\`\n` +
          `Tạo tổ: \`/create_team [tên nhóm] [tên tổ]\``);
        return new Response("OK");
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
      return new Response("OK");
    }

    // 9. /create_area, /create_group, /create_team
    if (text && text.startsWith('/create_area')) {
      if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return new Response("OK"); }
      const name = text.replace('/create_area', '').trim();
      if (!name) { await sendText(chatId, `⚠️ \`/create_area [tên]\``); return new Response("OK"); }
      await supabase.from('areas').insert({ name, created_by: staffData.staff_code });
      await sendText(chatId, `✅ Đã tạo khu vực *${name}*.`);
      return new Response("OK");
    }
    if (text && text.startsWith('/create_group')) {
      if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return new Response("OK"); }
      const parts = text.replace('/create_group', '').trim().split('|').map(s => s.trim());
      if (parts.length < 2) { await sendText(chatId, `⚠️ \`/create_group [tên khu vực] | [tên nhóm]\``); return new Response("OK"); }
      const { data: area } = await supabase.from('areas').select('id').ilike('name', parts[0]).single();
      if (!area) { await sendText(chatId, `❌ Không tìm thấy khu vực "${parts[0]}".`); return new Response("OK"); }
      await supabase.from('org_groups').insert({ area_id: area.id, name: parts[1], created_by: staffData.staff_code });
      await sendText(chatId, `✅ Đã tạo nhóm *${parts[1]}* trong khu vực *${parts[0]}*.`);
      return new Response("OK");
    }
    if (text && text.startsWith('/create_team')) {
      if (!canDefineStructure(pos)) { await sendText(chatId, `⛔ Không có quyền.`); return new Response("OK"); }
      const parts = text.replace('/create_team', '').trim().split('|').map(s => s.trim());
      if (parts.length < 2) { await sendText(chatId, `⚠️ \`/create_team [tên nhóm] | [tên tổ]\``); return new Response("OK"); }
      const { data: grp } = await supabase.from('org_groups').select('id').ilike('name', parts[0]).single();
      if (!grp) { await sendText(chatId, `❌ Không tìm thấy nhóm "${parts[0]}".`); return new Response("OK"); }
      await supabase.from('teams').insert({ group_id: grp.id, name: parts[1], created_by: staffData.staff_code });
      await sendText(chatId, `✅ Đã tạo tổ *${parts[1]}* trong nhóm *${parts[0]}*.`);
      return new Response("OK");
    }

    // 10. /support
    if (text && text.startsWith('/support')) {
      const supportMsg = text.replace('/support', '').trim();
      if (!supportMsg) { await sendText(chatId, "⚠️ `/support [nội dung]`"); return new Response("OK"); }
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
      return new Response("OK");
    }

    // 11. /reply (Admin)
    if (pos === 'admin' && text && text.startsWith('/reply ')) {
      const parts = text.split(' ');
      const targetCode = parts[1]; const replyMsg = parts.slice(2).join(' ').trim();
      if (!targetCode || !replyMsg) { await sendText(chatId, "⚠️ `/reply [Mã_TĐ] [nội dung]`"); return new Response("OK"); }
      const { data: ts } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
      if (!ts?.telegram_id) { await sendText(chatId, `❌ Không tìm thấy *${targetCode}*.`); return new Response("OK"); }
      await sendText(ts.telegram_id, `📩 *Phản hồi từ Admin:*\n\n${replyMsg}`);
      await supabase.from('support_messages').insert({
        from_staff_code: ADMIN_STAFF_CODE, from_telegram_id: telegramId,
        to_staff_code: targetCode, message: replyMsg, direction: 'from_admin'
      });
      await sendText(chatId, `✅ Đã gửi đến *${ts.full_name}*.`);
      return new Response("OK");
    }

    // 12. Media → forward to Admin
    const hasMedia = update.message && !text?.startsWith('/') &&
      (update.message.photo || update.message.document || update.message.video ||
       update.message.voice || update.message.audio || update.message.sticker);
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
      return new Response("OK");
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Hệ thống gặp lỗi.", { status: 500 });
  }
});
