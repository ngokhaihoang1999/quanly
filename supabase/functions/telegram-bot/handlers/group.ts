import { supabase } from "../config.ts";
import { ROLE_LABELS } from "../config.ts";
import { canLinkProfile, canAssignRole, canChangeLevel } from "../permissions.ts";
import { sendText, sendKeyboard, editMessageReplyMarkup, getChatAdmins, getBotId, exportChatInviteLink } from "../telegram.ts";

// ============ FORM TEMPLATE HELPERS (used by callbacks.ts) ============

const TV_TAG = '#TAG_BC_TV';
const BB_TAG = '#TAG_BC_BB';

export async function sendTVFormTemplate(chatId: number, profileName: string) {
  const template =
`📝 *FORM BÁO CÁO TƯ VẤN*
🍎 _${profileName}_
━━━━━━━━━━━━━━━━━━━━━

📌 Lần thứ: 
🔧 Công cụ: 
📊 Kết quả test: 
💬 Vấn đề/Nhu cầu: 
💭 Phản hồi trái: 
🎯 Điểm hái: 
📋 Đề xuất: 

━━━━━━━━━━━━━━━━━━━━━
📎 *Hướng dẫn:*
1️⃣ *Copy* toàn bộ mẫu bên trên
2️⃣ *Điền* thông tin sau mỗi dấu ":"
3️⃣ *Reply* (trả lời) tin nhắn này rồi *gửi*
🏷 ${TV_TAG}`;
  await sendText(chatId, template);
}

export async function sendBBFormTemplate(chatId: number, profileName: string) {
  const template =
`📖 *FORM BÁO CÁO BB*
🍎 _${profileName}_
━━━━━━━━━━━━━━━━━━━━━

📌 Buổi thứ: 
📚 Nội dung buổi học: 
😊 Phản ứng HS: 
🔍 Khai thác mới: 
💡 Tương tác đáng chú ý: 
📋 Đề xuất chăm sóc: 
📅 Buổi tiếp (ngày giờ): 
📝 Nội dung buổi tiếp: 

━━━━━━━━━━━━━━━━━━━━━
📎 *Hướng dẫn:*
1️⃣ *Copy* toàn bộ mẫu bên trên
2️⃣ *Điền* thông tin sau mỗi dấu ":"
3️⃣ *Reply* (trả lời) tin nhắn này rồi *gửi*
🏷 ${BB_TAG}`;
  await sendText(chatId, template);
}

// ── Parse filled TV form from reply text ──
function parseTVForm(text: string): Record<string, string> | null {
  const get = (emoji: string) => {
    const re = new RegExp(emoji + '\\s*[^:]*:\\s*(.+)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const lan_thu = get('📌');
  if (!lan_thu) return null; // at least this field is required
  return {
    lan_thu: lan_thu,
    ten_cong_cu: get('🔧'),
    ket_qua_test: get('📊'),
    van_de: get('💬'),
    phan_hoi: get('💭'),
    diem_hai: get('🎯'),
    de_xuat: get('📋'),
  };
}

// ── Parse filled BB form from reply text ──
function parseBBForm(text: string): Record<string, string> | null {
  const get = (emoji: string) => {
    const re = new RegExp(emoji + '\\s*[^:]*:\\s*(.+)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const buoi_thu = get('📌');
  if (!buoi_thu) return null;

  // Parse buoi_tiep date/time: accept DD/MM/YYYY HH:mm or YYYY-MM-DD HH:mm
  let buoi_tiep: string | null = null;
  const rawBuoiTiep = get('📅');
  if (rawBuoiTiep) {
    const isoMatch = rawBuoiTiep.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s*(\d{1,2}):(\d{2})/);
    if (isoMatch) {
      buoi_tiep = `${isoMatch[1]}-${isoMatch[2].padStart(2,'0')}-${isoMatch[3].padStart(2,'0')}T${isoMatch[4].padStart(2,'0')}:${isoMatch[5]}:00`;
    } else {
      const vnMatch = rawBuoiTiep.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/);
      if (vnMatch) {
        buoi_tiep = `${vnMatch[3]}-${vnMatch[2].padStart(2,'0')}-${vnMatch[1].padStart(2,'0')}T${vnMatch[4].padStart(2,'0')}:${vnMatch[5]}:00`;
      }
    }
  }

  return {
    buoi_thu: buoi_thu,
    noi_dung: get('📚'),
    phan_ung: get('😊'),
    khai_thac: get('🔍'),
    tuong_tac: get('💡'),
    de_xuat_cs: get('📋'),
    buoi_tiep: buoi_tiep || '',
    noi_dung_tiep: get('📝'),
  };
}

// ============ GROUP CHAT HANDLER ============

export async function handleGroupChat(update: any) {
  const msg = update.message;
  if (!msg) return;

  const chatId = msg.chat.id;
  const chatTitle = msg.chat.title || '';
  const telegramId = msg.from.id;
  const text = msg.text || '';

  // ── Reply to form template → parse and create record ──
  if (msg.reply_to_message && msg.reply_to_message.from?.is_bot && text) {
    const originalText = msg.reply_to_message.text || '';
    const isTV = originalText.includes(TV_TAG);
    const isBB = originalText.includes(BB_TAG);

    if (isTV || isBB) {
      // Get linked profile
      const { data: fg } = await supabase.from('fruit_groups')
        .select('profile_id, profiles(full_name)')
        .eq('telegram_group_id', chatId).single();
      if (!fg?.profile_id) {
        await sendText(chatId, `❌ Group chưa gắn hồ sơ. Không thể tạo báo cáo.`);
        return;
      }

      if (isTV) {
        const parsed = parseTVForm(text);
        if (!parsed) {
          await sendText(chatId, `⚠️ Không thể đọc form báo cáo TV.\n\nHãy đảm bảo giữ nguyên emoji 📌 và điền thông tin sau dấu ":"\nVí dụ: 📌 Lần thứ: 2`);
          return;
        }
        try {
          await supabase.from('records').insert({
            profile_id: fg.profile_id,
            record_type: 'tu_van',
            content: parsed,
          });
          const pName = fg.profiles?.full_name || '';
          await sendText(chatId,
            `✅ *Đã tạo Báo cáo TV — Lần ${parsed.lan_thu}* thành công!\n` +
            `🍎 ${pName}\n` +
            (parsed.ten_cong_cu ? `🔧 Công cụ: ${parsed.ten_cong_cu}\n` : '') +
            `\n💡 _Báo cáo đã được lưu vào hệ thống._`
          );
        } catch (e: any) {
          await sendText(chatId, `❌ Lỗi khi tạo báo cáo: ${e.message || 'Unknown'}`);
        }
      } else {
        const parsed = parseBBForm(text);
        if (!parsed) {
          await sendText(chatId, `⚠️ Không thể đọc form báo cáo BB.\n\nHãy đảm bảo giữ nguyên emoji 📌 và điền thông tin sau dấu ":"\nVí dụ: 📌 Buổi thứ: 1`);
          return;
        }
        try {
          await supabase.from('records').insert({
            profile_id: fg.profile_id,
            record_type: 'bien_ban',
            content: parsed,
          });
          const pName = fg.profiles?.full_name || '';
          await sendText(chatId,
            `✅ *Đã tạo Báo cáo BB — Buổi ${parsed.buoi_thu}* thành công!\n` +
            `🍎 ${pName}\n` +
            (parsed.buoi_tiep ? `📅 Buổi tiếp: ${parsed.buoi_tiep}\n` : '') +
            `\n💡 _Báo cáo đã được lưu vào hệ thống._`
          );
        } catch (e: any) {
          await sendText(chatId, `❌ Lỗi khi tạo báo cáo: ${e.message || 'Unknown'}`);
        }
      }
      return;
    }
  }

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
        `🍎 *Bot Checking Jondo đã vào group!*\n\nGroup này đã được đăng ký làm Group Trái quả.\nĐể quản lý, gõ lệnh: /start`
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
      .in('phase', ['tu_van', 'bb', 'center'])
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
  // /setlink [url] — Cập nhật invite link thủ công (creator hoặc admin)
  if (text.startsWith('/setlink') || text.startsWith('/setlink@')) {
    const admins = await getChatAdmins(chatId);
    const isGroupAdmin = admins.some((a: any) => a.user.id === telegramId);
    if (!isGroupAdmin) {
      await sendText(chatId, `⛔ Chỉ admin của group mới được cập nhật link.`);
      return;
    }
    const parts = text.split(' ');
    const link = parts[1]?.trim();
    if (!link || !link.startsWith('https://t.me/')) {
      await sendText(chatId, `❌ Link không hợp lệ.\nCú pháp: \`/setlink https://t.me/+xxxxxxxx\``);
      return;
    }
    const { error } = await supabase.from('fruit_groups')
      .update({ invite_link: link, updated_at: new Date().toISOString() })
      .eq('telegram_group_id', chatId);
    if (error) {
      await sendText(chatId, `❌ Lỗi lưu link: ${error.message}`);
    } else {
      await sendText(chatId, `✅ Đã cập nhật link mời:\n${link}\n\nGiờ nút "Mở Group" trong Mini App sẽ hoạt động.`);
    }
    return;
  }

  // /start — Menu lệnh cho group
  if (text === '/start' || text.startsWith('/start@')) {
    // Auto-register group if not yet registered
    const { data: existingFg } = await supabase.from('fruit_groups')
      .select('id, profile_id').eq('telegram_group_id', chatId).single();
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

    // Build dynamic menu — hide buttons based on profile state
    const keyboard: any[] = [
      [{ text: '👤 Xem hồ sơ Trái quả', callback_data: 'menu_view_profile' }],
      [{ text: '🍎 Gắn hồ sơ', callback_data: 'menu_link_profile' }],
      [{ text: '👥 Xác nhận GVBB', callback_data: 'menu_assign_role' }],
    ];

    // Check linked profile for dynamic buttons
    const fgForMenu = existingFg || (await supabase.from('fruit_groups').select('profile_id').eq('telegram_group_id', chatId).single()).data;
    if (fgForMenu?.profile_id) {
      const { data: profile } = await supabase.from('profiles').select('phase, is_kt_opened').eq('id', fgForMenu.profile_id).single();
      const phase = profile?.phase || 'chakki';

      // 📋 Xem báo cáo — show with report counts
      const { count: tvCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fgForMenu.profile_id).eq('record_type', 'tu_van');
      const { count: bbCount } = await supabase.from('records').select('*', { count: 'exact', head: true }).eq('profile_id', fgForMenu.profile_id).eq('record_type', 'bien_ban');
      if ((tvCount || 0) > 0 || (bbCount || 0) > 0) {
        const countLabel = `${tvCount || 0} TV · ${bbCount || 0} BB`;
        keyboard.push([{ text: `📋 Xem báo cáo (${countLabel})`, callback_data: 'menu_view_report' }]);
      }

      // ✏️ Thêm báo cáo — available if profile is past chakki
      if (['tu_van_hinh', 'tu_van', 'bb', 'center'].includes(phase)) {
        keyboard.push([{ text: '✏️ Thêm báo cáo', callback_data: 'menu_add_report' }]);
      }

      // 📖 Mở KT — hide when already opened
      if (!profile?.is_kt_opened) {
        keyboard.push([{ text: '📖 Xác nhận mở KT', callback_data: 'menu_open_kt' }]);
      }
    } else {
      keyboard.push([{ text: '📖 Xác nhận mở KT', callback_data: 'menu_open_kt' }]);
    }
    await sendKeyboard(chatId, `🛠 *Menu Quản lý Group*`, keyboard);
    return;
  }
}
