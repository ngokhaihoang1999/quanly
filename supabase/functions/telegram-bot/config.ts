import { createClient } from "npm:@supabase/supabase-js@2";

export const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
export const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
export const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';
export const ADMIN_STAFF_CODE = '000142-NKH';

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ============ POSITION SYSTEM (DB-driven with fallback) ============
// Fallback constants (used until DB loads, also updated by loadPositionConfig)
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

// DB-driven position config
export interface PositionConfig {
  code: string;
  name: string;
  category: string;
  scope_level: string;
  level: number;
  permissions: string[];
  is_system: boolean;
  color: string | null;
}

let _cachedPositions: PositionConfig[] | null = null;

export async function loadPositionConfig(): Promise<PositionConfig[]> {
  if (_cachedPositions) return _cachedPositions;
  try {
    const { data, error } = await supabase.from('positions').select('*').order('level', { ascending: false });
    if (error) throw error;
    _cachedPositions = (data || []) as PositionConfig[];
    // Update fallback maps
    for (const p of _cachedPositions) {
      POSITION_LEVELS[p.code] = p.level;
      POSITION_LABELS[p.code] = p.name;
    }
    return _cachedPositions;
  } catch (e) {
    console.error('loadPositionConfig error:', e);
    return [];
  }
}

export function getPositionConfig(code: string, positions: PositionConfig[]): PositionConfig | undefined {
  return positions.find(p => p.code === code);
}

export function hasPermissionFromConfig(posCode: string, specCode: string | null, permKey: string, positions: PositionConfig[]): boolean {
  const posObj = getPositionConfig(posCode, positions);
  const specObj = specCode ? getPositionConfig(specCode, positions) : null;
  if (posObj?.permissions?.includes(permKey)) return true;
  if (specObj?.permissions?.includes(permKey)) return true;
  return false;
}
