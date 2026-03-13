import { POSITION_LEVELS } from "./config.ts";

export function posLevel(p: string): number { return POSITION_LEVELS[p] ?? 0; }
export function hasMinPosition(staffPos: string, minPos: string): boolean { return posLevel(staffPos) >= posLevel(minPos); }

// Permission checks
export function canDefineStructure(p: string) { return p === 'admin' || p === 'yjyn'; }
export function canAssignPosition(p: string) { return ['admin','yjyn','tjn','gyjn'].includes(p); }
export function canAssignRole(p: string) { return ['admin','yjyn','tjn','gyjn','ggn_jondo'].includes(p); }
export function canCreateHapja(p: string) { return ['yjyn','tjn','gyjn','bgyjn','ggn_jondo','ggn_chakki'].includes(p); }
export function canApproveHapja(p: string) { return ['yjyn','ggn_jondo'].includes(p); }
export function canLinkProfile(p: string) { return ['admin','yjyn','ggn_jondo','tjn','gyjn'].includes(p); }
export function canChangeLevel(p: string) { return ['ggn_jondo','tjn'].includes(p); }
