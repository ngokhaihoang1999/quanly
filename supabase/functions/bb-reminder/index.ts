import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sendTelegramMessage(chatId: number, text: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' })
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: String(e) };
  }
}

// Varied message templates (avoid monotonous "Nhắc nhở tự động")
const PRE_MESSAGES = [
  (name: string, time: string, content: string) =>
    `📚 *Sắp đến giờ học!*\n🍎 ${name}\n⏰ ${time} hôm nay${content ? `\n📖 Nội dung: ${content}` : ''}\n\n_⏰ Lịch học hôm nay_`,
  (name: string, time: string, content: string) =>
    `🔔 *Buổi học sắp bắt đầu*\n🍎 ${name}\n⏰ Còn ~1 tiếng — ${time}${content ? `\n📖 ${content}` : ''}\n\n_⏰ Lịch học hôm nay_`,
  (name: string, time: string, content: string) =>
    `📖 *Chuẩn bị buổi học nhé!*\n🍎 ${name}\n⏰ Bắt đầu lúc ${time}${content ? `\n📚 Nội dung: ${content}` : ''}\n\n_⏰ Lịch học hôm nay_`,
];

const POST_MESSAGES = [
  (name: string) =>
    `📝 *Buổi học đã xong!*\n🍎 ${name}\n👉 Nhớ viết báo cáo BB nha~\n\n_📝 Nhắc ghi báo cáo_`,
  (name: string) =>
    `✍️ *Ghi BC BB thôi!*\n🍎 ${name}\n📋 Buổi học vừa kết thúc — viết báo cáo ngay để không quên chi tiết nhé!\n\n_📝 Nhắc ghi báo cáo_`,
  (name: string) =>
    `📋 *Đã hết giờ học*\n🍎 ${name}\n👉 Viết BC BB để lưu lại nội dung buổi hôm nay~\n\n_📝 Nhắc ghi báo cáo_`,
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7

    // Window: check for buoi_tiep within +/- 15 min of the target (to handle cron drift)
    // Pre-reminder: 1 hour before → buoi_tiep is ~1h from now
    const preTarget = new Date(vnNow.getTime() + 60 * 60 * 1000); // 1h from now VN time
    const preMin = new Date(preTarget.getTime() - 15 * 60 * 1000).toISOString();
    const preMax = new Date(preTarget.getTime() + 15 * 60 * 1000).toISOString();

    // Post-reminder: 1 hour after → buoi_tiep is ~1h ago
    const postTarget = new Date(vnNow.getTime() - 60 * 60 * 1000); // 1h ago VN time
    const postMin = new Date(postTarget.getTime() - 15 * 60 * 1000).toISOString();
    const postMax = new Date(postTarget.getTime() + 15 * 60 * 1000).toISOString();

    const results: any[] = [];

    // ── 1. PRE-REMINDER: buổi học sắp đến (1h trước) ──
    // Find BB records where buoi_tiep falls in the pre window
    const { data: preRecords, error: preErr } = await supabase
      .from('records')
      .select('id, profile_id, content')
      .eq('record_type', 'bien_ban')
      .not('content->>buoi_tiep', 'is', null)
      .gte('content->>buoi_tiep', preMin)
      .lte('content->>buoi_tiep', preMax);

    if (preErr) console.error('Pre query error:', preErr);

    // Deduplicate by profile_id (only latest record matters)
    const preByProfile = new Map<string, any>();
    for (const r of (preRecords || [])) {
      if (!r.content?.buoi_tiep) continue;
      const existing = preByProfile.get(r.profile_id);
      if (!existing) preByProfile.set(r.profile_id, r);
    }

    for (const [profileId, record] of preByProfile) {
      // Check not already reminded (use a flag in content or separate check)
      const { data: alreadySent } = await supabase
        .from('notifications')
        .select('id')
        .eq('profile_id', profileId)
        .eq('event_type', 'bb_reminder')
        .gte('created_at', new Date(vnNow.getTime() - 4 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue; // Already reminded today

      // Get profile name + group
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', profileId).single();
      const { data: fgs } = await supabase
        .from('fruit_groups').select('telegram_group_id')
        .eq('profile_id', profileId)
        .not('telegram_group_id', 'is', null)
        .gt('telegram_group_id', -1000000000000);

      const name = profile?.full_name || 'Trái quả';
      const time = formatTime(record.content.buoi_tiep);
      const content = record.content.noi_dung_tiep || '';

      // Send to group
      for (const fg of (fgs || [])) {
        const msg = pickRandom(PRE_MESSAGES)(name, time, content);
        const tgRes = await sendTelegramMessage(fg.telegram_group_id, msg);
        results.push({ type: 'pre', profileId, group: fg.telegram_group_id, sent: tgRes.ok });
      }

      // Create in-app notification to prevent double-send
      await supabase.from('notifications').insert({
        recipient_staff_code: 'SYSTEM',
        event_type: 'bb_reminder',
        title: `📚 Sắp đến giờ học — ${name}`,
        profile_id: profileId,
        channel: 'system',
        is_read: true
      });
    }

    // ── 2. POST-REMINDER: nhắc viết BC BB (1h sau buổi học) ──
    const { data: postRecords, error: postErr } = await supabase
      .from('records')
      .select('id, profile_id, content, created_at')
      .eq('record_type', 'bien_ban')
      .not('content->>buoi_tiep', 'is', null)
      .gte('content->>buoi_tiep', postMin)
      .lte('content->>buoi_tiep', postMax);

    if (postErr) console.error('Post query error:', postErr);

    const postByProfile = new Map<string, any>();
    for (const r of (postRecords || [])) {
      if (!r.content?.buoi_tiep) continue;
      const existing = postByProfile.get(r.profile_id);
      if (!existing) postByProfile.set(r.profile_id, r);
    }

    for (const [profileId, record] of postByProfile) {
      // Check if a new BB report was created AFTER this buoi_tiep (meaning they already wrote it)
      const buoiTiepDate = new Date(record.content.buoi_tiep);
      const { data: newReports } = await supabase
        .from('records')
        .select('id')
        .eq('profile_id', profileId)
        .eq('record_type', 'bien_ban')
        .gt('created_at', buoiTiepDate.toISOString())
        .limit(1);

      if (newReports && newReports.length > 0) continue; // Already wrote BC BB

      // Check not already reminded
      const { data: alreadySent } = await supabase
        .from('notifications')
        .select('id')
        .eq('profile_id', profileId)
        .eq('event_type', 'bb_report_reminder')
        .gte('created_at', new Date(vnNow.getTime() - 4 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (alreadySent && alreadySent.length > 0) continue;

      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', profileId).single();
      const { data: fgs } = await supabase
        .from('fruit_groups').select('telegram_group_id')
        .eq('profile_id', profileId)
        .not('telegram_group_id', 'is', null)
        .gt('telegram_group_id', -1000000000000);

      const name = profile?.full_name || 'Trái quả';

      for (const fg of (fgs || [])) {
        const msg = pickRandom(POST_MESSAGES)(name);
        const tgRes = await sendTelegramMessage(fg.telegram_group_id, msg);
        results.push({ type: 'post', profileId, group: fg.telegram_group_id, sent: tgRes.ok });
      }

      await supabase.from('notifications').insert({
        recipient_staff_code: 'SYSTEM',
        event_type: 'bb_report_reminder',
        title: `📝 Nhắc viết BC BB — ${name}`,
        profile_id: profileId,
        channel: 'system',
        is_read: true
      });
    }

    return new Response(JSON.stringify({ ok: true, checked_at: vnNow.toISOString(), results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('bb-reminder error:', e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
