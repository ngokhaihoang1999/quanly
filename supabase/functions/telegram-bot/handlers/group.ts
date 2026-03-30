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

  // Bot added to group ↁEregister group
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
        `🍎 *Bot Checking Jondo đã vào group!*\n\nGroup này đã được đăng ký làm Group Trái quả.\nĐềEquản lý, gõ lệnh: /start`
      );

      // Fetch profiles with REAL group (exclude NULL and -Date.now() placeholders)
      const { data: linkedGroups } = await supabase.from('fruit_groups')
        .select('profile_id').not('profile_id', 'is', null)
        .not('telegram_group_id', 'is', null)
        .gt('telegram_group_id', -1000000000000);
      const linkedProfileIds = linkedGroups?.map((g: any) => g.profile_id) || [];

      let query = supabase.from('profiles')
        .select('id, full_name, phase')
        .in('phase', ['tu_van', 'bb', 'center'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (linkedProfileIds.length > 0) {
        query = query.not('id', 'in', `(${linkedProfileIds.join(',')})`);
      }

      const { data: unlinkedProfiles } = await query;

      if (unlinkedProfiles && unlinkedProfiles.length > 0) {
        const keyboard = unlinkedProfiles.map((p: any) => [{ text: `🎓 Gắn: ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
        await sendKeyboard(chatId, `Danh sách hềEsơ BB chưa có group (Bấm đềEgắn ngay):`, keyboard);
      } else {
        await sendText(chatId, `ℹ�E�EChưa có hềEsơ nào ềEgiai đoạn BB cần gắn group.`);
      }
      return;
    }
  }

  // Only process commands from registered staff
  const { data: staffData } = await supabase.from('staff').select('*').eq('telegram_id', telegramId).single();
  if (!staffData) return;

  const pos = staffData.position || 'td';

  // /link_profile  EGắn hềEsơ cho group
  if (text.startsWith('/link_profile')) {
    if (!canLinkProfile(pos)) {
      await sendText(chatId, `⛁EQuyền truy cập bềEtừ chối.`);
      return;
    }
    const fruitName = text.replace('/link_profile', '').trim();
    if (!fruitName) {
      await sendText(chatId, `⚠�E�ECú pháp: \`/link_profile [tên trái]\``);
      return;
    }
    const { data: profiles } = await supabase.from('profiles')
      .select('id, full_name, phase')
      .ilike('full_name', `%${fruitName}%`)
      .in('phase', ['tu_van', 'bb', 'center'])
      .limit(5);
    if (!profiles || profiles.length === 0) {
      await sendText(chatId, `❁EKhông tìm thấy hềEsơ "${fruitName}" ềEgiai đoạn BB.`);
      return;
    }
    const keyboard = profiles.map((p: any) => [{ text: `🍎 ${p.full_name}`, callback_data: `link_fg_${p.id}` }]);
    await sendKeyboard(chatId, `Chọn hềEsơ đềEgắn cho group này:`, keyboard);
    return;
  }

  // /assign_role  EGắn vai trò trong group
  if (text.startsWith('/assign_role')) {
    if (!canAssignRole(pos)) {
      await sendText(chatId, `⛁EQuyền truy cập bềEtừ chối.`);
      return;
    }
    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await sendText(chatId, `⚠�E�ECú pháp: \`/assign_role [mã_TĐ] [ndd/tvv/gvbb/la]\``);
      return;
    }
    const targetCode = parts[1];
    const roleType = parts[2].toLowerCase();
    if (!['ndd','tvv','gvbb','la'].includes(roleType)) {
      await sendText(chatId, `❁EVai trò không hợp lềE Chọn: ndd, tvv, gvbb, la`);
      return;
    }
    const { data: targetStaff } = await supabase.from('staff').select('*').eq('staff_code', targetCode).single();
    if (!targetStaff) {
      await sendText(chatId, `❁EKhông tìm thấy TāEvới mã *${targetCode}*.`);
      return;
    }
    const { data: fg } = await supabase.from('fruit_groups')
      .select('*').eq('telegram_group_id', chatId).single();
    if (!fg) {
      await sendText(chatId, `❁EGroup này chưa được đăng ký.`);
      return;
    }
    await supabase.from('fruit_roles').upsert({
      fruit_group_id: fg.id, staff_code: targetCode, role_type: roleType, assigned_by: staffData.staff_code
    }, { onConflict: 'fruit_group_id,staff_code,role_type' });
    await sendText(chatId,
      `✁EĐã gắn vai trò *${ROLE_LABELS[roleType]}* cho *${targetCode}* trong group này.`
    );
    return;
  }


  // /group_info  EXem thông tin group
  if (text === '/group_info' || text.startsWith('/group_info@')) {
    const { data: fg } = await supabase.from('fruit_groups')
      .select('*, profiles(full_name)').eq('telegram_group_id', chatId).single();
    if (!fg) {
      await sendText(chatId, `❁EGroup này chưa được đăng ký.`);
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
      `👥 Vai trò:\n${rolesText}` +
      (fg.invite_link ? `\n\n🔗 Link: ${fg.invite_link}` : '\n\n⚠�E�EChưa có link mời. Gõ `/setlink [link]` đềEthêm.')
    );
    return;
  }

  // /setlink [url]  ECập nhật invite link thủ công (creator hoặc admin)
  if (text.startsWith('/setlink') || text.startsWith('/setlink@')) {
    const admins = await getChatAdmins(chatId);
    const isGroupAdmin = admins.some((a: any) => a.user.id === telegramId);
    if (!isGroupAdmin) {
      await sendText(chatId, `⛁EChềEadmin của group mới được cập nhật link.`);
      return;
    }
    const parts = text.split(' ');
    const link = parts[1]?.trim();
    if (!link || !link.startsWith('https://t.me/')) {
      await sendText(chatId, `❁ELink không hợp lềE\nCú pháp: \`/setlink https://t.me/+xxxxxxxx\``);
      return;
    }
    const { error } = await supabase.from('fruit_groups')
      .update({ invite_link: link, updated_at: new Date().toISOString() })
      .eq('telegram_group_id', chatId);
    if (error) {
      await sendText(chatId, `❁ELỗi lưu link: ${error.message}`);
    } else {
      await sendText(chatId, `✁EĐã cập nhật link mời:\n${link}\n\nGiềEnút "MềEGroup" trong Mini App sẽ hoạt động.`);
    }
    return;
  }

  // /start  EMenu lệnh cho group
  if (text === '/start' || text.startsWith('/start@')) {
    // Auto-register group if not yet registered
    const { data: existingFg } = await supabase.from('fruit_groups')
      .select('id').eq('telegram_group_id', chatId).single();
    if (!existingFg) {
      const inviteLink = await exportChatInviteLink(chatId);
      await supabase.from('fruit_groups').insert({
        telegram_group_id: chatId,
        telegram_group_title: chatTitle,
        invite_link: inviteLink,
        level: 'tu_van'
      });
    } else {
      // Try to refresh invite link in background
      exportChatInviteLink(chatId).then(link => {
        if (link) {
          supabase.from('fruit_groups')
            .update({ invite_link: link, telegram_group_title: chatTitle, updated_at: new Date().toISOString() })
            .eq('telegram_group_id', chatId).then(() => {});
        }
      }).catch(() => {});
    }

    const keyboard = [
      [{ text: '📋 Xem thông tin Group', callback_data: 'menu_info' }],
      [{ text: '👤 Xem hềEsơ Trái quả', callback_data: 'menu_view_profile' }],
      [{ text: '🍎 Gắn hềEsơ', callback_data: 'menu_link_profile' }],
      [{ text: '👥 Xác nhận GVBB', callback_data: 'menu_assign_role' }],
      [{ text: '📖 Xác nhận mềEKT', callback_data: 'menu_open_kt' }]
    ];
    await sendKeyboard(chatId, `🛠 *Menu Quản lý Group*`, keyboard);
    return;
  }
}
