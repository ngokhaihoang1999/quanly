import { supabase } from "../config.ts";
import { ROLE_LABELS } from "../config.ts";
import { canLinkProfile, canAssignRole, canChangeLevel } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, getChatAdmins, getBotId, exportChatInviteLink } from "../telegram.ts";

// ============ GROUP CHAT HANDLER ============

export async function handleGroupChat(update: any) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const chatTitle = msg.chat.title || '';
  const telegramId = msg.from.id;
  const text = msg.text || '';

  // Bot added to group → register group
  if (msg.new_chat_members) {
    const botId = await getBotId();
    const botAdded = msg.new_chat_members.some((m: any) => m.id === botId);
    if (botAdded) {
      // Try to get invite link (bot needs admin rights)
      const inviteLink = await exportChatInviteLink(chatId);

      const { data: existing } = await supabase.from('fruit_groups')
        .select('*').eq('telegram_group_id', chatId).single();
      if (!existing) {
        await supabase.from('fruit_groups').insert({
          telegram_group_id: chatId,
          telegram_group_title: chatTitle,
          invite_link: inviteLink,
          level: 'tu_van'
        });
      } else {
        // Update title and invite link
        await supabase.from('fruit_groups').update({
          telegram_group_title: chatTitle,
          invite_link: inviteLink,
          updated_at: new Date().toISOString()
        }).eq('id', existing.id);
      }

      // Send welcome message
      await sendText(chatId,
        `🍎 *Bot Checking Jondo đã vào group!*\n\nGroup này đã được đăng ký làm Group Trái quả.\nĐể quản lý, gõ lệnh: /menu`
      );

      // Fetch unlinked BB-phase profiles (exclude those with a REAL telegram group)
      const { data: linkedGroups } = await supabase.from('fruit_groups')
        .select('profile_id').not('profile_id', 'is', null)
        .not('telegram_group_id', 'is', null);
      const linkedProfileIds = linkedGroups?.map((g: any) => g.profile_id) || [];

      let query = supabase.from('profiles')
        .select('id, full_name, phase')
        .in('phase', ['bb', 'center'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (linkedProfileIds.length > 0) {
        query = query.not('id', 'in', `(${linkedProfileIds.join(',')})`);
      }

      const { data: unlinkedProfiles } = await query;

      if (unlinkedProfiles && unlinkedProfiles.length > 0) {
        const keyboard = unlinkedProfiles.map((p: any) => [{ text: `🎓 Gắn: ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
        await sendKeyboard(chatId, `Danh sách hồ sơ BB chưa có group (Bấm để gắn ngay):`, keyboard);
      } else {
        await sendText(chatId, `ℹ️ Chưa có hồ sơ nào ở giai đoạn BB cần gắn group.`);
      }
      return;
    }
  }

  // Only process commands from registered staff
  const { data: staffData } = await supabase.from('staff').select('*').eq('telegram_id', telegramId).single();
  if (!staffData) return;

  const pos = staffData.position || 'td';

  // /link_profile — Gắn hồ sơ cho group
  if (text.startsWith('/link_profile')) {
    if (!canLinkProfile(pos)) {
      await sendText(chatId, `⛔ Quyền truy cập bị từ chối.`);
      return;
    }
    const fruitName = text.replace('/link_profile', '').trim();
    if (!fruitName) {
      await sendText(chatId, `⚠️ Cú pháp: \`/link_profile [tên trái]\``);
      return;
    }
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, phase')
      .ilike('full_name', `%${fruitName}%`)
      .in('phase', ['bb', 'center'])
      .limit(5);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, `❌ Không tìm thấy hồ sơ "${fruitName}" ở giai đoạn BB.`);
      return;
    }
    const keyboard = profiles.map((p: any) => [{ text: `🍎 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hồ sơ để gắn cho group này:`, keyboard);
    return;
  }

  // /assign_role — Gắn vai trò trong group
  if (text.startsWith('/assign_role')) {
    if (!canAssignRole(pos)) {
      await sendText(chatId, `⛔ Quyền truy cập bị từ chối.`);
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
      await sendText(chatId, `❌ Group này chưa được đăng ký.`);
      return;
    }
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: roleType, assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    await sendText(chatId,
      `✅ Đã gắn vai trò *${ROLE_LABELS[roleType]}* cho *${targetCode}* trong group này.`
    );
    return;
  }

  // /set_level — Chuyển giai đoạn group
  if (text.startsWith('/set_level')) {
    if (!canChangeLevel(pos)) {
      await sendText(chatId, `⛔ Quyền truy cập bị từ chối.`);
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
    await sendText(chatId, `✅ Group đã chuyển sang giai đoạn *${label}*.`);
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
      rolesText = roles.map((r: any) => `  • ${ROLE_LABELS[r.role_type]}: ${r.staff_code}`).join('\n');
    } else {
      rolesText = '  Chưa có vai trò nào.';
    }
    await sendText(chatId,
      `📋 *Thông tin Group Trái quả*\n\n` +
      `🍎 Trái: *${profileName}*\n` +
      `📊 Giai đoạn: *${levelLabel}*\n\n` +
      `👥 Vai trò:\n${rolesText}`
    );
    return;
  }

  // /menu — Menu lệnh cho group
  if (text === '/menu' || text.startsWith('/menu@')) {
    const keyboard = [
      [{ text: '📋 Xem thông tin Group', callback_data: 'menu_info' }],
      [{ text: '👤 Xem hồ sơ Trái quả', callback_data: 'menu_view_profile' }],
      [{ text: '🍎 Gắn hồ sơ', callback_data: 'menu_link_profile' }],
      [{ text: '👥 Xác nhận GVBB', callback_data: 'menu_assign_role' }],
      [{ text: '🔄 Chuyển giai đoạn', callback_data: 'menu_set_level' }]
    ];
    await sendKeyboard(chatId, `🛠 *Menu Quản lý Group*`, keyboard);
    return;
  }
}
