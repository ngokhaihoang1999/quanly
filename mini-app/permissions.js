// ============ PERMISSIONS & POSITIONS ============
// Extracted from core.js — Position system, permissions, staff unit mapping
// Depends on: allStaff, structureData, allPositions, myStaff, sbFetch (from core.js)

// ── Semester vars ──
let allSemesters = [];
let currentSemesterId = null; // null = show all (legacy compat)

// ── Staff Unit Map ──
// Builds a lookup: staffCode → "Area · Group · Team"
let staffUnitMap = {};

function buildStaffUnitMap() {
  staffUnitMap = {};
  (structureData || []).forEach(a => {
    (a.org_groups || []).forEach(g => {
      (g.teams || []).forEach(t => {
        (t.staff || []).forEach(m => {
          staffUnitMap[m.staff_code] = `${a.name} · ${g.name} · ${t.name}`;
        });
      });
    });
  });
}

// Returns unit label for a staff code, e.g. "HCM2 · Nhóm 1 · Tổ 3"
function getStaffUnit(code) {
  return staffUnitMap[code] || '';
}

// Returns display label: "code (unit)" or just "code" if no unit
function getStaffLabel(code) {
  if (!code) return '';
  const s = allStaff.find(x => x.staff_code === code);
  const displayName = s?.nickname || code;
  const unit = getStaffUnit(code);
  return unit ? `${displayName} (${unit})` : displayName;
}

// ── Positions (DB-driven) ──
const ALL_PERMISSION_KEYS = [
  'manage_positions', 'manage_structure', 'assign_position', 'manage_staff',
  'create_hapja', 'approve_hapja',
  'edit_profile',
  'view_dashboard',
  'manage_semester'
];
const PERMISSION_LABELS = {
  manage_positions: 'Quản lý Chức vụ',
  manage_structure: 'Quản lý Cơ cấu',
  assign_position:  'Gán Chức vụ',
  manage_staff:     'Quản lý TĐ',
  create_hapja:     'Tạo Hapja',
  approve_hapja:    'Duyệt Hapja',
  edit_profile:     'Sửa Hồ sơ (toàn quyền với hồ sơ trong scope)',
  view_dashboard:   'Xem Dashboard',
  manage_semester:  'Quản lý Khai Giảng'
};
const SCOPE_LABELS = { system:'Toàn hệ thống', area:'Khu vực', group:'Nhóm', team:'Tổ' };
const SCOPE_LEVELS = { system:4, area:3, group:2, team:1 };

async function loadPositions() {
  try {
    const res = await sbFetch('/rest/v1/positions?select=*&order=level.desc');
    allPositions = await res.json();
  } catch(e) { console.error('loadPositions error:', e); allPositions = []; }
}

function getPositionObj(code) {
  if (!code) return null;
  return allPositions.find(p => p.code === code) || null;
}
function getPositionName(p) {
  const obj = getPositionObj(p);
  if (obj) return obj.name;
  const fallback = {td:'TĐ', gyjn:'GYJN', bgyjn:'BGYJN', tjn:'TJN', yjyn:'YJYN', admin:'Admin', ndd:'NĐD', tvv:'TVV', gvbb:'GVBB'};
  return fallback[p] || p || 'TĐ';
}
function getPosLevel(p) {
  const obj = getPositionObj(p);
  return obj ? obj.level : 0;
}
function getBadgeClass(p) {
  // Structural positions get their own vivid badge
  const structBadges = { yjyn: 'role-yjyn', tjn: 'role-tjn', gyjn: 'role-gyjn', bgyjn: 'role-bgyjn' };
  if (structBadges[p]) return structBadges[p];
  const obj = getPositionObj(p);
  if (!obj) return 'role-default';
  if (obj.level >= 80) return 'role-admin';
  if (obj.level >= 40) return 'role-ndd';
  if (obj.category === 'specialist') return 'role-tvv';
  return 'role-default';
}
function getPositionColor(p) {
  const obj = getPositionObj(p);
  return obj?.color || '#6b7280';
}
function getManagementPositions() { return allPositions.filter(p => p.category === 'management'); }
function getSpecialistPositions() { return allPositions.filter(p => p.category === 'specialist'); }

// ── Permission System ──
function getCurrentSpecialistPosition() {
  if (viewAsSpecialist !== undefined && viewAsSpecialist !== null) return viewAsSpecialist;
  return myStaff?.specialist_position || null;
}
function getEffectivePermissions() {
  const pos = getCurrentPosition();
  const spec = getCurrentSpecialistPosition();
  const posObj = getPositionObj(pos);
  const specObj = getPositionObj(spec);
  const perms = new Set();
  if (posObj?.permissions) posObj.permissions.forEach(p => perms.add(p));
  if (specObj?.permissions) specObj.permissions.forEach(p => perms.add(p));
  return perms;
}
function hasPermission(permKey) {
  return getEffectivePermissions().has(permKey);
}
function getScope() {
  const pos = getCurrentPosition();
  const spec = getCurrentSpecialistPosition();
  const posObj = getPositionObj(pos);
  const specObj = getPositionObj(spec);
  const posScope = posObj?.scope_level || 'team';
  const specScope = specObj?.scope_level || 'team';
  // Return highest scope
  return (SCOPE_LEVELS[posScope] || 1) >= (SCOPE_LEVELS[specScope] || 1) ? posScope : specScope;
}
