import { createClient } from "npm:@supabase/supabase-js@2";

export const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
export const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
export const ADMIN_STAFF_CODE = '000142-NKH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ POSITION HIERARCHY ============
// Level 0: TĐ | Level 1: BGYJN | Level 2: GYJN
// Level 3: TJN, GGN Chakki, SGN Jondo, GGN Jondo (NGANG HÀNG)
// Level 4: YJYN | Level 5: Admin
export const POSITION_LEVELS: Record<string,number> = {
  td: 0, bgyjn: 1, gyjn: 2,
  tjn: 3, ggn_chakki: 3, sgn_jondo: 3, ggn_jondo: 3,
  yjyn: 4, admin: 5
};

export const POSITION_LABELS: Record<string,string> = {
  td:'TĐ', bgyjn:'BGYJN', gyjn:'GYJN', sgn_jondo:'SGN Jondo',
  ggn_chakki:'GGN Chakki', ggn_jondo:'GGN Jondo', tjn:'TJN', yjyn:'YJYN', admin:'Admin'
};

export const ROLE_LABELS: Record<string,string> = { ndd:'NDD', tvv:'TVV', gvbb:'GVBB', la:'Lá' };
