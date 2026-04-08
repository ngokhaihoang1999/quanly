import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Format a nice Telegram message per event type
function formatTgMessage(eventType: string, title: string, body: string | null): string {
  const icons: Record<string, string> = {
    hapja_created: '🍎', hapja_approved: '✅', hapja_rejected: '❌',
    chot_tv: '📅', bc_tv: '📝', chot_bb: '🎓', bc_bb: '📋',
    mo_kt: '📖', drop_out: '🔴', chot_center: '🏛️', reminder: '⏰',
    lap_group_tv_bb: '🎓',
  };
  const icon = icons[eventType] || '🔔';
  let msg = `${icon} *${title}*`;
  if (body) msg += `\n${body}`;
  msg += `\n\n_Mở Mini App để xem chi tiết_`;
  return msg;
}

// Send a Telegram message to a chat (private or group)
async function sendTelegramMessage(chatId: number, text: string): Promise<{ ok: boolean; description?: string }> {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { staff_codes, event_type, title, body, profile_id, group_chat_ids } = await req.json();

    if (!event_type) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing event_type' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const message = formatTgMessage(event_type, title || '', body || '');
    const results: any[] = [];

    // ── 1. Send to individual staff (private chat) ──
    if (staff_codes?.length) {
      const { data: staffRows, error: staffErr } = await supabase
        .from('staff')
        .select('staff_code, telegram_id')
        .in('staff_code', staff_codes);

      if (staffErr) throw staffErr;

      // Get chat notification preferences
      const { data: prefsRows } = await supabase
        .from('notification_preferences')
        .select('staff_code, chat_events')
        .in('staff_code', staff_codes);

      const prefsMap: Record<string, string[]> = {};
      (prefsRows || []).forEach((p: any) => {
        prefsMap[p.staff_code] = Array.isArray(p.chat_events) ? p.chat_events : [];
      });

      for (const staff of (staffRows || [])) {
        if (!staff.telegram_id) {
          results.push({ staff_code: staff.staff_code, skipped: 'no telegram_id' });
          continue;
        }

        // Reminders always send; other types respect preferences
        const isReminder = event_type === 'reminder';
        const chatEvents = prefsMap[staff.staff_code];
        const chatEnabled = isReminder || (chatEvents !== undefined
          ? chatEvents.includes(event_type)
          : false);

        if (!chatEnabled) {
          results.push({ staff_code: staff.staff_code, skipped: 'chat disabled' });
          continue;
        }

        const tgData = await sendTelegramMessage(staff.telegram_id, message);
        results.push({
          staff_code: staff.staff_code,
          sent: tgData.ok,
          tg_error: tgData.ok ? undefined : tgData.description
        });
      }
    }

    // ── 2. Send to Telegram group(s) for profile-linked reminders ──
    const groupIds = new Set<number>();

    // Explicit group_chat_ids
    if (group_chat_ids?.length) {
      group_chat_ids.forEach((gid: number) => groupIds.add(gid));
    }

    // Auto-detect group from profile_id
    if (profile_id) {
      const { data: fgs } = await supabase.from('fruit_groups')
        .select('telegram_group_id')
        .eq('profile_id', profile_id)
        .not('telegram_group_id', 'is', null)
        .gt('telegram_group_id', -1000000000000);
      (fgs || []).forEach((fg: any) => {
        if (fg.telegram_group_id) groupIds.add(fg.telegram_group_id);
      });
    }

    // Send to each group
    for (const gid of groupIds) {
      const groupMsg = `${message.replace('_Mở Mini App để xem chi tiết_', '_Nhắc nhở tự động_')}`;
      const tgData = await sendTelegramMessage(gid, groupMsg);
      results.push({
        group_chat_id: gid,
        sent: tgData.ok,
        tg_error: tgData.ok ? undefined : tgData.description
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('send-notification error:', e);
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
