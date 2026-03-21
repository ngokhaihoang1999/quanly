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
  };
  const icon = icons[eventType] || '🔔';
  let msg = `${icon} *${title}*`;
  if (body) msg += `\n${body}`;
  msg += `\n\n_Mở Mini App để xem chi tiết_`;
  return msg;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { staff_codes, event_type, title, body } = await req.json();

    if (!staff_codes?.length || !event_type) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing params' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 1. Get telegram_id for each staff_code
    const { data: staffRows, error: staffErr } = await supabase
      .from('staff')
      .select('staff_code, telegram_id')
      .in('staff_code', staff_codes);

    if (staffErr) throw staffErr;

    // 2. Get chat notification preferences
    const { data: prefsRows } = await supabase
      .from('notification_preferences')
      .select('staff_code, chat_events')
      .in('staff_code', staff_codes);

    const prefsMap: Record<string, string[]> = {};
    (prefsRows || []).forEach((p: any) => {
      prefsMap[p.staff_code] = Array.isArray(p.chat_events) ? p.chat_events : [];
    });

    const message = formatTgMessage(event_type, title, body || '');
    const results: any[] = [];

    // 3. Send to each staff with chat enabled for this event_type
    for (const staff of (staffRows || [])) {
      if (!staff.telegram_id) {
        results.push({ staff_code: staff.staff_code, skipped: 'no telegram_id' });
        continue;
      }

      // Check chat prefs: default = OFF unless user explicitly enabled
      const chatEvents = prefsMap[staff.staff_code];
      const chatEnabled = chatEvents !== undefined
        ? chatEvents.includes(event_type)
        : false; // default: chat OFF

      if (!chatEnabled) {
        results.push({ staff_code: staff.staff_code, skipped: 'chat disabled' });
        continue;
      }

      // Send Telegram message
      const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: staff.telegram_id,
          text: message,
          parse_mode: 'Markdown',
        })
      });

      const tgData = await tgRes.json();
      results.push({
        staff_code: staff.staff_code,
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
