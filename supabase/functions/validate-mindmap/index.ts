import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
const EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });
  }

  try {
    const { gid, ts, sig } = await req.json();
    if (!gid || !ts || !sig) return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });

    // Check expiry
    const age = Date.now() - Number(ts);
    if (age > EXPIRY_MS || age < 0) {
      return new Response(JSON.stringify({ error: 'Link het han. Bam lai nut Thong tin co ban trong bot.' }), { status: 403, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
    }

    // Verify signature
    const raw = `${gid}:${ts}:${BOT_TOKEN}`;
    const encoder = new TextEncoder();
    const hashBuf = await crypto.subtle.digest('SHA-256', encoder.encode(raw));
    const expectedSig = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2,'0')).join('').substring(0,16);
    if (sig !== expectedSig) {
      return new Response(JSON.stringify({ error: 'Chu ky khong hop le.' }), { status: 403, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
    }

    // Valid! Fetch profile data
    const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
    
    // Get profile_id from fruit_groups
    const fgRes = await fetch(`${SUPABASE_URL}/rest/v1/fruit_groups?telegram_group_id=eq.${gid}&select=profile_id`, { headers });
    const fgArr = await fgRes.json();
    if (!fgArr || fgArr.length === 0) {
      return new Response(JSON.stringify({ error: 'Group chua gan ho so.' }), { status: 404, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
    }
    const profileId = fgArr[0].profile_id;

    // Fetch profile + form data
    const [profRes, sheetRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${profileId}&select=full_name,phase,is_kt_opened`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data`, { headers })
    ]);
    const profiles = await profRes.json();
    const sheets = await sheetRes.json();

    return new Response(JSON.stringify({
      profile: profiles[0] || {},
      sheet: (sheets && sheets.length > 0) ? sheets[0].data : {}
    }), { 
      status: 200, 
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } 
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' } });
  }
});
