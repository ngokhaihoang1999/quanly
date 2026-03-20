import { POSITION_LEVELS, loadPositionConfig, hasPermissionFromConfig } from "./config.ts";

export function posLevel(p: string): number { return POSITION_LEVELS[p] ?? 0; }
export function hasMinPosition(staffPos: string, minPos: string): boolean { return posLevel(staffPos) >= posLevel(minPos); }

// DB-driven permission checks (with fallback to legacy behavior)
export async function checkPermission(staffPos: string, specPos: string | null, permKey: string): Promise<boolean> {
  const positions = await loadPositionConfig();
  if (positions.length > 0) {
    return hasPermissionFromConfig(staffPos, specPos, permKey, positions);
  }
  // Fallback to legacy hard-coded checks
  return legacyPermCheck(staffPos, permKey);
}

// Legacy fallback (kept for backward compatibility if DB is unavailable)
function legacyPermCheck(p: string, permKey: string): boolean {
  switch (permKey) {
    case 'manage_structure': return p === 'admin' || p === 'yjyn';
    case 'assign_position': return ['admin','yjyn','tjn','gyjn'].includes(p);
    case 'assign_role': return ['admin','yjyn','tjn','gyjn','ggn_jondo'].includes(p);
    case 'create_hapja': return ['yjyn','tjn','gyjn','bgyjn','ggn_jondo','ggn_chakki'].includes(p);
    case 'approve_hapja': return ['yjyn','ggn_jondo'].includes(p);
    case 'link_profile': return ['admin','yjyn','ggn_jondo','tjn','gyjn'].includes(p);
    case 'change_phase': return ['ggn_jondo','tjn'].includes(p);
    default: return false;
  }
}

// Synchronous wrappers — kept for existing handler code that expects sync functions
// These use the fallback constants which are updated after loadPositionConfig() runs
export function canDefineStructure(p: string) { return p === 'admin' || p === 'yjyn'; }
export function canAssignPosition(p: string) { return ['admin','yjyn','tjn','gyjn'].includes(p); }
export function canAssignRole(p: string) { return ['admin','yjyn','tjn','gyjn','ggn_jondo'].includes(p); }
export function canCreateHapja(p: string) { return ['yjyn','tjn','gyjn','bgyjn','ggn_jondo','ggn_chakki'].includes(p); }
export function canApproveHapja(p: string) { return ['yjyn','ggn_jondo'].includes(p); }
export function canLinkProfile(p: string) { return ['admin','yjyn','ggn_jondo','tjn','gyjn'].includes(p); }
export function canChangeLevel(p: string) { return ['ggn_jondo','tjn'].includes(p); }
