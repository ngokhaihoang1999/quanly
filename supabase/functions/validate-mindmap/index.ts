const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Content-Type': 'application/json' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { gid, ts, sig, type } = await req.json();
    const mmType = type || 'info';
    if (!gid || !ts || !sig) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: corsHeaders });

    // Check expiry
    const age = Date.now() - Number(ts);
    if (age > EXPIRY_MS || age < 0) {
      return new Response(JSON.stringify({ error: 'Link đã hết hạn. Bấm lại nút trong bot để tạo link mới.' }), { status: 403, headers: corsHeaders });
    }

    // Verify signature (includes type in hash)
    const raw = `${gid}:${ts}:${mmType}:${BOT_TOKEN}`;
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    const expectedSig = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').substring(0,16);
    if (sig !== expectedSig) {
      return new Response(JSON.stringify({ error: 'Chữ ký không hợp lệ.' }), { status: 403, headers: corsHeaders });
    }

    // Valid! Fetch profile data
    const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
    
    const fgRes = await fetch(`${SUPABASE_URL}/rest/v1/fruit_groups?telegram_group_id=eq.${gid}&select=profile_id`, { headers });
    const fgArr = await fgRes.json();
    if (!fgArr || fgArr.length === 0) {
      return new Response(JSON.stringify({ error: 'Group chưa gắn hồ sơ.' }), { status: 404, headers: corsHeaders });
    }
    const profileId = fgArr[0].profile_id;

    if (mmType === 'bb') {
      // Fetch saved AI mindmap markdown
      const mmRes = await fetch(`${SUPABASE_URL}/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.ai_mindmap&select=content&order=created_at.desc&limit=1`, { headers });
      const mmArr = await mmRes.json();
      const markdown = (mmArr && mmArr.length > 0 && mmArr[0].content?.markdown) ? mmArr[0].content.markdown : null;
      return new Response(JSON.stringify({ type: 'bb', markdown }), { status: 200, headers: corsHeaders });
    }

    // type === 'info': Fetch profile + form data
    const [profRes, sheetRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}&select=full_name,phase,is_kt_opened`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data`, { headers })
    ]);
    const profiles = await profRes.json();
    const sheets = await sheetRes.json();

    return new Response(JSON.stringify({
      type: 'info',
      profile: profiles[0] || {},
      sheet: (sheets && sheets.length > 0) ? sheets[0].data : {}
    }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
