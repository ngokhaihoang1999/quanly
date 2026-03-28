const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY';
const tg = window.Telegram?.WebApp;
let currentProfileId = null, currentRecordType = null, currentRecordId = null;
let allProfiles = [], allStaff = [], myStaff = null, structureData = [];
let allPositions = [];
let _pendingPrefs = {}; // live personalization edits not yet saved

// ============ SEMESTER (KHAI GIẢNG) ============
let allSemesters = [];
let currentSemesterId = null; // null = show all (legacy compat)

// ============ STAFF UNIT MAP ============
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


// ============ SHARED PROFILE CARD RENDERER ============
// Use this everywhere a profile box appears — ensures consistent UI
// opts: { extraMeta, clickFn, showPhase, extraBadges, ndd, tvv, gvbb, latestActivity, profileId }
function renderProfileCard(p, opts = {}) {
  if (!p) return '';
  const isDropout = p.fruit_status === 'dropout';
  const statusColor = isDropout ? 'var(--red)' : 'var(--green)';
  const statusLabel = isDropout ? 'Drop-out' : 'Alive';
  const statusBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${isDropout?'rgba(248,113,113,0.15)':'rgba(52,211,153,0.15)'};color:${statusColor};border:1px solid ${isDropout?'rgba(248,113,113,0.3)':'rgba(52,211,153,0.3)'};margin-left:4px;white-space:nowrap;vertical-align:middle;"><span style="background:${statusColor};width:6px;height:6px;border-radius:50%;margin-right:4px;display:inline-block;"></span>${statusLabel}</span>`;

  const ph = p.phase || 'chakki';
  const showPhase = opts.showPhase !== false && ph && ph !== 'new';
  const phaseBadge = showPhase
    ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${(typeof PHASE_COLORS!=='undefined'?PHASE_COLORS[ph]:{})||'#f59e0b'};color:white;margin-left:4px;white-space:nowrap;vertical-align:middle;">${(typeof PHASE_LABELS!=='undefined'?PHASE_LABELS[ph]:ph)||ph}</span>`
    : '';

  const showKT = ['bb','center','completed'].includes(ph);
  const ktBadge = showKT
    ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${p.is_kt_opened?'var(--green)':'#f59e0b'};color:white;margin-left:4px;white-space:nowrap;vertical-align:middle;">${p.is_kt_opened?'📖 KT':'📕 KT'}</span>`
    : '';

  const extraBadges = opts.extraBadges || '';
  const resolvedId = p.id || opts.profileId || '';
  const clickFn = opts.clickFn || `openProfileById('${resolvedId}')`;

  // Birth year or dropout reason — shown inline on row 1 after name
  const birthYear = !isDropout && p.birth_year ? p.birth_year : '';
  const yearTag = birthYear ? `<span style="font-size:12px;color:var(--text2);margin-left:4px;vertical-align:middle;">(${birthYear})</span>` : '';

  // Data fields for rows below
  const nddStr = opts.ndd || p.ndd_staff_code || '';
  const tvvStr = opts.tvv || '';
  const gvbbStr = opts.gvbb || '';
  const latestStr = opts.latestActivity || '';

  // Build detail rows
  let detailsHtml = '';
  const hasRow2 = nddStr || tvvStr;
  const hasRow3 = gvbbStr || latestStr || opts.extraMeta;

  if (hasRow2 || hasRow3) {
    detailsHtml += '<div style="margin-top:6px;font-size:11.5px;color:var(--text2);line-height:1.6;">';
    if (hasRow2) {
      detailsHtml += `<div style="display:flex;gap:16px;"><span><b style="opacity:0.7;">NDD:</b> ${nddStr || '—'}</span>${tvvStr ? `<span><b style="opacity:0.7;">TVV:</b> ${tvvStr}</span>` : ''}</div>`;
    }
    if (hasRow3) {
      const rightText = opts.extraMeta || (latestStr ? `<span style="color:var(--accent2);">⏱ ${latestStr}</span>` : '');
      if (gvbbStr) {
        detailsHtml += `<div style="display:flex;justify-content:space-between;"><span><b style="opacity:0.7;">GVBB:</b> ${gvbbStr}</span>${rightText ? `<span>${rightText}</span>` : ''}</div>`;
      } else if (rightText) {
        detailsHtml += `<div style="display:flex;justify-content:${hasRow2?'flex-end':'flex-start'};"><span>${rightText}</span></div>`;
      }
    }
    detailsHtml += '</div>';
  }

  // Dropout reason as a small note under name
  const dropoutNote = isDropout && p.dropout_reason ? `<div style="font-size:11px;color:var(--red);margin-top:4px;">Lý do: ${p.dropout_reason}</div>` : '';

  return `<div class="profile-card" onclick="${clickFn}" style="padding:12px 14px;">
    <div class="profile-info" style="width:100%;">
      <div class="profile-name" style="margin-bottom:0;line-height:1.5;">
        <span style="font-size:14px;">${p.full_name}</span>${yearTag} ${statusBadge}${phaseBadge}${ktBadge}${extraBadges}
      </div>
      ${dropoutNote}${detailsHtml}
    </div>
    <div class="profile-arrow" style="margin-left:6px;align-self:center;">›</div>
  </div>`;
}

// ============ CUSTOM CONFIRM (replaces browser confirm() which shows domain) ============
function showConfirm(message, onOk, onCancel) {
  let modal = document.getElementById('customConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
    modal.innerHTML = `
      <div style="background:var(--surface,#fff);border-radius:14px;padding:20px 20px 14px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
        <div id="customConfirmMsg" style="font-size:14px;color:var(--text,#111);line-height:1.5;margin-bottom:16px;white-space:pre-line;"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="customConfirmCancel" style="padding:8px 16px;border:1px solid var(--border,#ddd);border-radius:8px;background:transparent;color:var(--text2,#555);font-size:13px;cursor:pointer;">Huỷ</button>
          <button id="customConfirmOk" style="padding:8px 16px;border:none;border-radius:8px;background:var(--red,#ef4444);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Xác nhận</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
  }
  const msgEl = document.getElementById('customConfirmMsg');
  // If message contains HTML tags, use innerHTML; otherwise use textContent for safety
  if (/<[a-z][\s\S]*>/i.test(message)) {
    msgEl.innerHTML = message;
  } else {
    msgEl.textContent = message;
  }
  modal.style.display = 'flex';

  const cleanup = () => { modal.style.display = 'none'; };
  document.getElementById('customConfirmOk').onclick   = () => { cleanup(); if (onOk) onOk(); };
  document.getElementById('customConfirmCancel').onclick = () => { cleanup(); if (onCancel) onCancel(); };
  modal.onclick = (e) => { if (e.target === modal) { cleanup(); if (onCancel) onCancel(); } };
}

// Promise-based version: await showConfirmAsync('message') → true/false
function showConfirmAsync(message) {
  return new Promise(resolve => showConfirm(message, () => resolve(true), () => resolve(false)));
}


// ============ POSITIONS (DB-driven) ============
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

// ============ PERMISSION SYSTEM ============
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

// Dashboard collapse toggle
function toggleDashMetrics() {
  const el = document.getElementById('dashUnitMetrics');
  const icon = document.getElementById('dashToggleIcon');
  if (!el) return;
  el.classList.toggle('collapsed');
  if (icon) icon.textContent = el.classList.contains('collapsed') ? '▼' : '▲';
}

// Helpers
function getChipValues(id) { const el=document.getElementById(id); if(!el) return []; return Array.from(el.querySelectorAll('.chip.selected')).map(c=>c.textContent.trim()); }
function setChipValues(id, vals) { const el=document.getElementById(id); if(!el||!vals) return; el.querySelectorAll('.chip').forEach(c=>{ vals.includes(c.textContent.trim()) ? c.classList.add('selected') : c.classList.remove('selected'); }); }
function clearChips(id) { const el=document.getElementById(id); if(el) el.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); }
function toggleChip(el) { el.classList.toggle('selected'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

function getStaffCodeFromInput(id) {
  const el = document.getElementById(id);
  if (!el) return '';
  let val = el.value.trim();
  if (!val) return '';
  // Handle "CODE - NAME"
  if (val.includes(' - ')) return val.split(' - ')[0].trim();
  // Handle "NAME (CODE)"
  const match = val.match(/\(([^)]+)\)$/);
  if (match) return match[1].trim();
  return val;
}

function setStaffInputValue(id, code) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!code) { el.value = ''; return; }
  const s = allStaff.find(x => x.staff_code === code);
  if (s) {
    el.value = `${s.full_name} (${s.staff_code})`;
  } else {
    el.value = code;
  }
}

function initCustomAutocomplete() {
  document.addEventListener('focusin', e => {
    if (e.target.tagName === 'INPUT' && (e.target.hasAttribute('data-list') || e.target.dataset.acWrap)) {
      const listA = e.target.getAttribute('data-list');
      if (listA === 'staffSuggest' || listA === 'teamAddDatalist' || e.target.dataset.acWrap) {
        attachAutocomplete(e.target);
      }
    }
  });
}

function attachAutocomplete(input) {
  if (input.dataset.acWrap) return;
  input.dataset.acWrap = '1';
  
  const wrapper = document.createElement('div');
  wrapper.className = 'ac-wrap';
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);
  
  const listAttr = input.getAttribute('data-list') || 'staffSuggest';
  input.setAttribute('autocomplete', 'off');
  
  const listEl = document.createElement('div');
  listEl.className = 'ac-list';
  wrapper.appendChild(listEl);
  
  let blurTimeout;
  const renderList = (filter = '') => {
    const term = filter.toLowerCase().trim();
    let data = allStaff;
    if (listAttr === 'teamAddDatalist') {
      const dl = document.getElementById('teamAddDatalist');
      if (dl) {
         data = Array.from(dl.options).map(o => {
             const val = o.value || '';
             const m = val.match(/\(([^)]+)\)$/);
             const code = m ? m[1] : '';
             const name = val.replace(` (${code})`, '');
             return { staff_code: code, full_name: name };
         });
      }
    }
    
    const filtered = data.filter(s => 
      !term || 
      (s.staff_code && s.staff_code.toLowerCase().includes(term)) || 
      (s.full_name && s.full_name.toLowerCase().includes(term))
    ).slice(0, 50);
    
    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="ac-item" style="color:var(--text3);text-align:center;">Không tìm thấy</div>';
    } else {
      listEl.innerHTML = filtered.map(s => `<div class="ac-item" data-val="${s.full_name} (${s.staff_code})">${s.full_name} <span style="color:var(--text3);font-size:11px;margin-left:4px;font-weight:600;">${s.staff_code}</span></div>`).join('');
    }
    listEl.classList.add('show');
  };
  
  input.addEventListener('focus', () => {
    if (input.value.trim().length > 0) renderList(input.value);
  });
  input.addEventListener('input', () => {
    if (input.value.trim().length === 0) listEl.classList.remove('show');
    else renderList(input.value);
  });
  
  input.addEventListener('blur', () => {
    blurTimeout = setTimeout(() => listEl.classList.remove('show'), 200);
  });
  
  listEl.addEventListener('mousedown', e => {
    const item = e.target.closest('.ac-item');
    if (item && item.dataset.val) {
      clearTimeout(blurTimeout);
      input.value = item.dataset.val;
      listEl.classList.remove('show');
      input.dispatchEvent(new Event('change', {bubbles:true}));
      // On mobile, blur the input to close keyboard after selection
      setTimeout(() => input.blur(), 50);
    }
  });
}

async function sbFetch(path, opts={}) {
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', ...opts.headers };
  if (opts.method === 'POST' && !headers['Prefer']) headers['Prefer'] = 'return=representation';
  return fetch(SUPABASE_URL + path, { ...opts, headers });
}

// ============ SEMESTER LOGIC ============
async function loadSemesters() {
  try {
    const res = await sbFetch('/rest/v1/semesters?select=*&order=created_at.desc');
    allSemesters = await res.json();
  } catch(e) { console.warn('loadSemesters:', e); allSemesters = []; }

  // Auto-select: saved preference > active semester > first > null
  const saved = localStorage.getItem('cj_semester_id');
  if (saved && allSemesters.find(s => s.id === saved)) {
    currentSemesterId = saved;
  } else {
    const active = allSemesters.find(s => s.is_active);
    currentSemesterId = active ? active.id : (allSemesters[0]?.id || null);
  }
  renderSemesterSelector();
}

function renderSemesterSelector() {
  const sel = document.getElementById('semesterSelect');
  if (!sel) return;
  let opts = allSemesters.map(s => {
    const selected = s.id === currentSemesterId ? 'selected' : '';
    const label = s.name + (s.is_active ? ' 🟢' : '');
    return `<option value="${s.id}" ${selected}>${label}</option>`;
  }).join('');
  if (!allSemesters.length) opts = '<option value="">Chưa có kỳ</option>';
  sel.innerHTML = opts;
  // Show manage button if permitted
  const mgr = document.getElementById('semesterManageBtn');
  if (mgr) mgr.style.display = hasPermission('manage_semester') ? '' : 'none';
}

async function switchSemester(id) {
  if (id === currentSemesterId) return;
  currentSemesterId = id || null;
  localStorage.setItem('cj_semester_id', currentSemesterId || '');
  // Load profiles first so allProfiles is ready for dashboard semester filtering
  await loadProfiles();
  await loadDashboard();
  showToast('📂 Đã chuyển Khai Giảng');
}

async function createSemester() {
  const name = document.getElementById('newSemName')?.value?.trim();
  if (!name) { showToast('⚠️ Nhập tên Khai Giảng'); return; }
  const desc = document.getElementById('newSemDesc')?.value?.trim() || '';
  const setActive = document.getElementById('newSemActive')?.checked || false;
  const btn = document.querySelector('#semesterManagerModal .save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang tạo...'; }
  try {
    // If setting as active, deactivate all others first
    if (setActive) {
      await sbFetch('/rest/v1/semesters?is_active=eq.true', { method:'PATCH', body: JSON.stringify({ is_active: false }) });
    }
    const res = await sbFetch('/rest/v1/semesters', { method:'POST', body: JSON.stringify({
      name, description: desc || null, is_active: setActive, created_by: getEffectiveStaffCode()
    })});
    const created = await res.json();
    await loadSemesters();
    if (setActive && created[0]) {
      await switchSemester(created[0].id);
    }
    showToast('✅ Đã tạo Khai Giảng: ' + name);
    if (document.getElementById('newSemName')) document.getElementById('newSemName').value = '';
    if (document.getElementById('newSemDesc')) document.getElementById('newSemDesc').value = '';
    renderSemesterList();
  } catch(e) { showToast('❌ Lỗi: ' + e.message); }
  if (btn) { btn.disabled = false; btn.textContent = '➕ Tạo Khai Giảng'; }
}

async function setActiveSemester(id) {
  try {
    await sbFetch('/rest/v1/semesters?is_active=eq.true', { method:'PATCH', body: JSON.stringify({ is_active: false }) });
    await sbFetch(`/rest/v1/semesters?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ is_active: true }) });
    await loadSemesters();
    renderSemesterList();
    showToast('✅ Đã đặt Khai Giảng hoạt động');
  } catch(e) { showToast('❌ Lỗi: ' + e.message); }
}

function renderSemesterList() {
  const el = document.getElementById('semesterListBody');
  if (!el) return;
  if (!allSemesters.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);">Chưa có kỳ nào</div>';
    return;
  }
  el.innerHTML = allSemesters.map(s => {
    const active = s.is_active ? '<span style="color:var(--green);font-weight:700;">🟢 Đang hoạt động</span>' : `<button onclick="setActiveSemester('${s.id}')" style="font-size:11px;padding:2px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);background:none;color:var(--text2);cursor:pointer;">Đặt làm kỳ chính</button>`;
    const count = allProfiles.filter(p => p.semester_id === s.id).length;
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <div><div style="font-weight:600;font-size:13px;">${s.name}</div><div style="font-size:11px;color:var(--text3);">${s.description||''} · ${count} hồ sơ</div></div>
      <div>${active}</div>
    </div>`;
  }).join('');
}

function openSemesterManager() {
  renderSemesterList();
  // Suggest default name
  const now = new Date();
  const suggested = `Tháng ${now.getMonth()+1}/${now.getFullYear()}`;
  const nameInput = document.getElementById('newSemName');
  if (nameInput && !nameInput.value) nameInput.value = suggested;
  document.getElementById('semesterManagerModal').classList.add('open');
}

function getSemesterFilter() {
  return currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) { tg.ready(); tg.expand(); }
  initCustomAutocomplete();
  await loadPositions();
  await loadStaffInfo();
  await loadSemesters();
  await Promise.all([loadProfiles(), loadDashboard(), loadStaff()]);
});

async function loadStaffInfo() {
  const userId = tg?.initDataUnsafe?.user?.id;
  if (!userId) {
    document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:18px;color:red;padding:20px;text-align:center;background:#fff;z-index:999999;position:fixed;top:0;left:0;width:100%;">\u26a0\ufe0f Truy c\u1eadp b\u1ecb t\u1eeb ch\u1ed1i.<br>Vui l\u00f2ng m\u1edf \u1ee9ng d\u1ee5ng qua Telegram \u0111\u1ec3 x\u00e1c th\u1ef1c danh t\u00ednh.</div>';
    throw new Error('Unauthorized Access - Telegram required');
  }
  try {
    const res = await sbFetch(`/rest/v1/staff?telegram_id=eq.${userId}&select=*`);
    const data = await res.json();
    if (data.length > 0) {
      myStaff = data[0];
      let badgeText = `${myStaff.staff_code} \u00b7 ${getPositionName(myStaff.position)}`;
      if (myStaff.specialist_position) badgeText += ` + ${getPositionName(myStaff.specialist_position)}`;
      document.getElementById('staffBadge').textContent = badgeText;
      if (hasPermission('manage_positions')) {
        document.getElementById('viewAsBar').classList.add('active');
      }
      // Apply saved personalization
      if (myStaff.preferences) applyUserPreferences(myStaff.preferences);
      const allRes = await sbFetch('/rest/v1/staff?select=full_name,staff_code');
      const allS = await allRes.json();
      const dl = document.getElementById('staffSuggest');
      if (dl) dl.innerHTML = allS.map(s=>`<option value="${s.full_name} (${s.staff_code})">`).join('');
    }
  } catch {}
  applyPermissions();
}

// ============ NAVIGATION ============
function backToList() {
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
  ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+activeTab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (activeTab==='unit'||activeTab==='personal')?'flex':'none';
  currentProfileId = null;
}
function switchFormTab(el, cardId) {
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.form-card').forEach(c=>c.classList.remove('active')); document.getElementById(cardId).classList.add('active');
  // Trigger mindmap render when Tư Duy tab is opened
  if (cardId === 'mindmapTab' && typeof renderMindmap === 'function') {
    setTimeout(renderMindmap, 50);
  }
}
function switchMainTab(el, tab) {
  document.querySelectorAll('#mainTabBar .tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+tab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (tab==='unit'||tab==='personal') ? 'flex' : 'none';
  if (tab==='unit') { loadDashboard(); loadProfiles(); }
  if (tab==='personal') loadDashboard();
  if (tab==='staff') loadStaff();
  if (tab==='structure') loadStructure();
  if (tab==='calendar' && typeof loadCalendar === 'function') loadCalendar();
  if (tab==='priority' && typeof loadPriority === 'function') loadPriority();
}

// ============ MODAL CLOSE ON OVERLAY CLICK ============
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ============ VIEW AS (Admin testing) ============
let viewAsPosition = null;
let viewAsRole = null;
let viewAsStaffCode = null;
let viewAsSpecialist = undefined; // undefined = not overridden, null = no specialist
function getCurrentPosition() { return viewAsPosition || myStaff?.position || 'td'; }
function getCurrentRole() { return viewAsRole; }
function getEffectiveStaffCode() { return viewAsStaffCode || myStaff?.staff_code; }

function populateViewAsDropdown() {
  const sel = document.getElementById('viewAsPos');
  if (!sel) return;
  let html = '<option value="">Chức vụ: Chính mình</option>';
  // Add all management positions
  getManagementPositions().forEach(p => {
    if (p.code === 'admin') return;
    html += `<option value="${p.code}">${p.name} (chung)</option>`;
  });
  // From structure data — specific units
  (structureData||[]).forEach(a => {
    if (a.yjyn_staff_code) html += `<option value="yjyn|${a.yjyn_staff_code}">YJYN \u00b7 ${a.name}</option>`;
    (a.org_groups||[]).forEach(g => {
      if (g.tjn_staff_code) html += `<option value="tjn|${g.tjn_staff_code}">TJN \u00b7 ${a.name} > ${g.name}</option>`;
      (g.teams||[]).forEach(t => {
        if (t.gyjn_staff_code) html += `<option value="gyjn|${t.gyjn_staff_code}">GYJN \u00b7 ${a.name} > ${g.name} > ${t.name}</option>`;
        if (t.bgyjn_staff_code) html += `<option value="bgyjn|${t.bgyjn_staff_code}">BGYJN \u00b7 ${a.name} > ${g.name} > ${t.name}</option>`;
      });
    });
  });
  sel.innerHTML = html;
  // Specialist dropdown
  const specSel = document.getElementById('viewAsSpec');
  if (specSel) {
    let specHtml = '<option value="">Chuyên môn: Không</option>';
    getSpecialistPositions().forEach(p => {
      specHtml += `<option value="${p.code}">${p.name}</option>`;
    });
    specSel.innerHTML = specHtml;
  }
}

function applyViewAs() {
  const raw = document.getElementById('viewAsPos').value;
  const selRole = document.getElementById('viewAsRole').value;
  const selSpec = document.getElementById('viewAsSpec')?.value || '';
  if (raw && raw.includes('|')) {
    const [p, code] = raw.split('|');
    viewAsPosition = p;
    viewAsStaffCode = code;
  } else {
    viewAsPosition = raw || null;
    viewAsStaffCode = null;
  }
  viewAsRole = selRole || null;
  viewAsSpecialist = selSpec || undefined;
  if (selSpec === '' && !raw) viewAsSpecialist = undefined;
  else if (selSpec === '') viewAsSpecialist = null;
  const pos = getCurrentPosition();
  const posLabel = getPositionName(pos);
  const specLabel = getCurrentSpecialistPosition() ? getPositionName(getCurrentSpecialistPosition()) : '';
  const roleLabel = selRole ? {ndd:'NDD',tvv:'TVV',gvbb:'GVBB',la:'Lá'}[selRole] : '';
  const badge = document.getElementById('staffBadge');
  if (raw || selRole || selSpec) {
    let txt = '\uD83D\uDC41 ' + posLabel;
    if (viewAsStaffCode) {
      const s = allStaff.find(x => x.staff_code === viewAsStaffCode);
      if (s) txt += ' (' + s.full_name + ')';
    }
    if (specLabel) txt += ' + ' + specLabel;
    if (roleLabel) txt += ' + ' + roleLabel;
    badge.textContent = txt;
  } else {
    let txt = `${myStaff?.staff_code||'---'} \u00b7 ${getPositionName(myStaff?.position)}`;
    if (myStaff?.specialist_position) txt += ` + ${getPositionName(myStaff.specialist_position)}`;
    badge.textContent = txt;
  }
  applyPermissions();
  if (raw || selRole || selSpec) {
    let msg = '\uD83D\uDC41 ';
    if (raw) msg += posLabel;
    if (specLabel) msg += (raw ? ' + ' : '') + specLabel;
    if (selRole) msg += ' + ' + roleLabel;
    showToast(msg);
  }
}
function resetViewAs() {
  document.getElementById('viewAsPos').value = '';
  document.getElementById('viewAsRole').value = '';
  const specSel = document.getElementById('viewAsSpec');
  if (specSel) specSel.value = '';
  viewAsSpecialist = undefined;
  applyViewAs();
  showToast('\u2705 Reset về Admin');
}
function applyPermissions() {
  // Tab Cơ cấu: visible for all
  const structTab = document.querySelector('[data-tab="structure"]');
  if (structTab) structTab.style.display = '';
  // "+ Khu vực" button: only manage_structure permission
  const btnAddArea = document.getElementById('btnAddArea');
  if (btnAddArea) btnAddArea.style.display = hasPermission('manage_structure') ? '' : 'none';
  // "Điều chỉnh Chức vụ" button: only manage_positions permission
  const btnManagePos = document.getElementById('btnManagePositions');
  if (btnManagePos) btnManagePos.style.display = hasPermission('manage_positions') ? '' : 'none';
  const btnStaffWt = document.getElementById('btnStaffWithoutTeam');
  if (btnStaffWt) btnStaffWt.style.display = hasPermission('manage_positions') ? '' : 'none';
  
  const btnSyncSheet = document.getElementById('btnSyncSheet');
  if (btnSyncSheet) btnSyncSheet.style.display = hasPermission('manage_positions') ? '' : 'none';

  // FAB: only for those who can create Hapja
  const fabBtn = document.getElementById('fabBtn');
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'dashboard';
  if (fabBtn) fabBtn.style.display = (hasPermission('create_hapja') && (activeTab==='unit'||activeTab==='personal')) ? 'flex' : 'none';
  // Tab TĐ: only visible for admin (manage_positions permission)
  const tabStaffBtn = document.getElementById('tabStaffBtn');
  if (tabStaffBtn) tabStaffBtn.style.display = hasPermission('manage_positions') ? '' : 'none';
  // Reload structure tree to update inline add buttons
  if (document.getElementById('tab-structure').style.display !== 'none') loadStructure();
  // Init priority badge + notification count (deferred to let DOM/data settle)
  setTimeout(() => {
    if (typeof loadPriority === 'function') loadPriority();
    if (typeof loadNotifCount === 'function') loadNotifCount();
  }, 800);
}

// ============ UNIT POPUP ============
function showUnitPopup(type) {
  const phMap = PHASE_LABELS;
  const phColor = PHASE_COLORS;
  let title = '', items = [];
  if (type === 'hapja') {
    title = '🍎 Trái Hapja (đã duyệt)';
    const list = window._unitApprovedHapja || [];
    items = list.map(h => `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;" onclick="${h.profile_id ? `openProfileById('${h.profile_id}');closeModal('unitPopupModal')` : ''}">
      <div style="font-weight:700;font-size:13px;">${h.full_name}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${h.data?.ndd_staff_code||h.created_by} · ${new Date(h.created_at).toLocaleDateString('vi-VN')}</div>
    </div>`);
  } else if (type === 'wait_tv') {
    title = '⏳ Chờ TV (Đã duyệt Hapja nhưng chưa qua TV)';
    const list = window._unitWaitTV || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  } else if (type === 'tvv') {
    title = '💬 Trái TV';
    const list = window._unitTvvFruits || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code + ' (' + (r.role_type||'').toUpperCase() + ')',
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  } else if (type === 'gvbb') {
    title = '🎓 Trái BB';
    const list = window._unitGvbbFruits || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code + ' (' + (r.role_type||'').toUpperCase() + ')',
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  } else if (type === 'bbgroup' || type === 'bbgroup_phase') {
    title = type === 'bbgroup_phase' ? '👥 Group BB (giai đoạn BB)' : '👥 Group BB (tích luỹ)';
    const list = type === 'bbgroup_phase' ? (window._unitPhaseBBGroups || []) : (window._unitBbGroups || []);
    items = list.map(r => `<div style="padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;">
      <div style="font-weight:700;font-size:13px;">${r.fruit_groups?.telegram_group_title || 'Group'}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${r.staff_code} · ${r.fruit_groups?.profiles?.full_name || ''}</div>
    </div>`);
  } else if (type === 'tvv_phase') {
    title = '💬 Trái TV (đang ở giai đoạn TV)';
    const list = window._unitPhaseTVFruits || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  } else if (type === 'gvbb_phase') {
    title = '🎓 Trái BB (đang ở giai đoạn BB)';
    const list = window._unitPhaseBBFruits || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  } else if (type === 'center') {
    title = '🏛️ Trái Center';
    const list = window._unitCenterFruits || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      });
    });
  }
  document.getElementById('unitPopupTitle').textContent = title;
  document.getElementById('unitPopupBody').innerHTML = items.length ? items.join('') : '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có dữ liệu</div>';
  document.getElementById('unitPopupModal').classList.add('open');
}
// ============ AVATAR COLOR ============
const AVATAR_GRADIENT_PRESETS = [
  { label: 'Tím Hồng',   val: 'linear-gradient(135deg,#6366f1,#ec4899)' },
  { label: 'Xanh Cyan',  val: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
  { label: 'Xanh Lá',    val: 'linear-gradient(135deg,#10b981,#3b82f6)' },
  { label: 'Cam Đỏ',     val: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { label: 'Tím Xanh',   val: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' },
  { label: 'Hồng Cam',   val: 'linear-gradient(135deg,#ec4899,#f59e0b)' },
  { label: 'Xanh Vàng',  val: 'linear-gradient(135deg,#10b981,#84cc16)' },
  { label: 'Hoàng Hôn',  val: 'linear-gradient(135deg,#f97316,#eab308)' },
  { label: 'Đại Dương',  val: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' },
  { label: 'Hoa Đào',    val: 'linear-gradient(135deg,#ef4444,#ec4899)' },
  { label: 'Bầu Trời',   val: 'linear-gradient(135deg,#38bdf8,#818cf8)' },
  { label: 'Rừng Xanh',  val: 'linear-gradient(135deg,#166534,#15803d)' },
];

function openAvatarGradientPicker(profileId, encodedCurrent) {
  const current = decodeURIComponent(encodedCurrent);
  // Parse current gradient to pre-fill custom pickers
  const colorMatch = current.match(/#([0-9a-fA-F]{6})/g) || [];
  const c1 = colorMatch[0] || '#6366f1';
  const c2 = colorMatch[1] || '#ec4899';
  const angleMatch = current.match(/(\d+)deg/);
  const angle = angleMatch ? angleMatch[1] : '135';

  // Build modal HTML
  const presetHtml = AVATAR_GRADIENT_PRESETS.map(g =>
    `<div onclick="previewAvatarGradient('${g.val}')" title="${g.label}"
       style="width:36px;height:36px;border-radius:10px;cursor:pointer;background:${g.val};
              border:2px solid transparent;transition:transform 0.15s,border-color 0.15s;flex-shrink:0;"
       onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform=''"></div>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'avatarColorModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:20px 16px 32px;box-shadow:0 -8px 40px rgba(0,0,0,0.25);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="font-weight:700;font-size:15px;">🎨 Chọn màu Avatar</div>
        <button onclick="document.getElementById('avatarColorModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);">✕</button>
      </div>

      <!-- Preview -->
      <div style="display:flex;justify-content:center;margin-bottom:18px;">
        <div id="avatarColorPreview" style="width:72px;height:72px;border-radius:20px;background:${current};
          display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:700;color:white;
          box-shadow:0 4px 20px rgba(0,0,0,0.25);transition:background 0.4s ease;">
          ${(document.querySelector('#profileSummaryCard .profile-name')?.textContent||'A')[0]}
        </div>
      </div>

      <!-- Presets -->
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px;font-weight:600;">⚡ BỘ MÀU SẴN</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">${presetHtml}</div>

      <!-- Custom -->
      <div style="font-size:11px;color:var(--text3);margin-bottom:8px;font-weight:600;">🖌 TÙY CHỈNH</div>
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <div style="flex:1;text-align:center;">
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Màu 1</div>
          <input type="color" id="avatarC1" value="${c1}" oninput="updateCustomAvatarGradient()" style="width:100%;height:36px;border:none;border-radius:8px;cursor:pointer;">
        </div>
        <div style="font-size:20px;color:var(--text3);">→</div>
        <div style="flex:1;text-align:center;">
          <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Màu 2</div>
          <input type="color" id="avatarC2" value="${c2}" oninput="updateCustomAvatarGradient()" style="width:100%;height:36px;border:none;border-radius:8px;cursor:pointer;">
        </div>
      </div>
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;color:var(--text2);margin-bottom:4px;">Góc chuyển màu: <b id="avatarAngleLabel">${angle}°</b></div>
        <input type="range" id="avatarAngle" min="0" max="360" value="${angle}" oninput="document.getElementById('avatarAngleLabel').textContent=this.value+'°';updateCustomAvatarGradient()" style="width:100%;accent-color:var(--accent);">
      </div>

      <!-- Save -->
      <button onclick="saveAvatarGradient('${profileId}')" style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">✅ Lưu màu nền</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

let _pendingAvatarGradient = null;
function previewAvatarGradient(gradient) {
  _pendingAvatarGradient = gradient;
  const prev = document.getElementById('avatarColorPreview');
  if (prev) prev.style.background = gradient;
}
function updateCustomAvatarGradient() {
  const c1 = document.getElementById('avatarC1')?.value || '#6366f1';
  const c2 = document.getElementById('avatarC2')?.value || '#ec4899';
  const angle = document.getElementById('avatarAngle')?.value || '135';
  const gradient = `linear-gradient(${angle}deg,${c1},${c2})`;
  previewAvatarGradient(gradient);
}
async function saveAvatarGradient(profileId) {
  const gradient = _pendingAvatarGradient || document.getElementById('avatarColorPreview')?.style.background;
  if (!gradient) return;
  await changeAvatarColor(profileId, gradient);
  document.getElementById('avatarColorModal')?.remove();
  _pendingAvatarGradient = null;
}

async function changeAvatarColor(profileId, gradient) {
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatar_color: gradient })
    });
    const p = allProfiles.find(x => x.id === profileId);
    if (p) p.avatar_color = gradient;
    if (typeof _refreshCurrentProfile === 'function') _refreshCurrentProfile();
    else if (typeof loadDashboard === 'function') loadDashboard();
    showToast('✅ Đã đổi màu avatar');
  } catch(e) { console.error('changeAvatarColor:', e); showToast('❌ Lỗi đổi màu'); }
}

// ============ KỲ KHAI GIẢNG (SEMESTER) ============
async function promptChangeSemester(profileId, currentSemId) {
  if (!allSemesters || allSemesters.length === 0) return;
  const opts = '<option value="">(Không có kỳ / Gỡ kỳ)</option>' + allSemesters.map(s => `<option value="${s.id}" ${s.id === currentSemId ? 'selected' : ''}>${s.name}</option>`).join('');
  const msg = `<div style="text-align:left;">
      <b>Chuyển Khai Giảng cho trái quả này?</b><br><br>
      Dữ liệu trên dashboard tích luỹ/giai đoạn của kỳ cũ sẽ giảm, và kỳ mới sẽ tăng.<br><br>
      <select id="moveSemSelect" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);">${opts}</select>
    </div>`;
  const confirm = await showConfirmAsync(msg);
  if (!confirm) return;
  
  const moveSel = document.getElementById('moveSemSelect');
  if (!moveSel) return;
  const newSem = moveSel.value || null;
  if (newSem === currentSemId) return;

  try {
    const semVal = newSem ? newSem : null;
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, { method: 'PATCH', body: JSON.stringify({ semester_id: semVal }) });
    await sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}`, { method: 'PATCH', body: JSON.stringify({ semester_id: semVal }) });
    showToast('✅ Đã chuyển Khai Giảng');
    
    // Nếu vẫn ở kỳ hiện tại, tải lại dữ liệu in-place
    if (typeof loadProfiles === 'function') await loadProfiles();
    if (typeof loadDashboard === 'function') await loadDashboard();
    
    if (currentProfileId === profileId) {
      if (typeof refreshProfileInPlace === 'function') refreshProfileInPlace();
    }
  } catch(e) {
    showToast('❌ Lỗi đổi Khai Giảng');
    console.error(e);
  }
}

// ============ FRUIT STATUS TOGGLE ============
async function toggleFruitStatus(profileId, current) {
  const newStatus = current === 'alive' ? 'dropout' : 'alive';
  const label = newStatus === 'dropout' ? 'Drop-out' : 'Alive';
  
  let reason = '';
  if (newStatus === 'dropout') {
    reason = prompt('Nhập lý do Drop-out (có thể để trống):');
    if (reason === null) return; // Chỉ huỷ khi bấm Cancel
    reason = reason.trim();
  }

  if (!await showConfirmAsync(`Chuyển trạng thái trái quả thành "${label}"?`)) return;
  try {
    const patchBody = { fruit_status: newStatus };
    if (newStatus === 'dropout') patchBody.dropout_reason = reason;
    else patchBody.dropout_reason = null;

    // PATCH with return=representation to verify the change
    const patchRes = await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(patchBody)
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('PATCH failed:', patchRes.status, errText);
      showToast('❌ Lỗi cập nhật: ' + (errText || patchRes.status));
      return;
    }

    // Try to use the representation response
    let updatedProfile = null;
    try {
      const patchData = await patchRes.json();
      if (Array.isArray(patchData) && patchData[0]) updatedProfile = patchData[0];
    } catch(e) {}

    // If no representation, update local cache directly
    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) {
      if (updatedProfile) {
        allProfiles[idx] = updatedProfile;
      } else {
        allProfiles[idx].fruit_status = newStatus;
        allProfiles[idx].dropout_reason = patchBody.dropout_reason;
      }
      
      // Auto-sync status change to Google Sheets
      if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(profileId);
      
      openProfile(allProfiles[idx]);
    }

    // Add timeline record for status change
    try {
      const recType = newStatus === 'dropout' ? 'drop_out' : 'alive';
      const _cn = newStatus === 'dropout' ? { reason: reason || 'Không có lý do' } : { note: 'Chuyển lại trạng thái Alive' };
      await sbFetch('/rest/v1/records', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ profile_id: profileId, record_type: recType, content: _cn })
      });
    } catch(err) { console.warn('Fail to record status change', err); }

    showToast(`✅ Đã chuyển sang ${label}`);
    filterProfiles();
    loadDashboard();
  } catch(e) { showToast('❌ Lỗi: ' + e.message); console.error('toggleFruitStatus:', e); }
}

window._currentKTProfileId = null;

async function toggleKTStatus(profileId, newState) {
  const p = allProfiles.find(x => x.id === profileId);
  if (!p) return;
  const myCode = getEffectiveStaffCode();
  const pos = getCurrentPosition();
  
  // Permission Check
  let hasPerm = false;
  if (hasPermission('toggle_kt')) hasPerm = true;
  if (!hasPerm && p.ndd_staff_code === myCode) hasPerm = true;
  if (!hasPerm) {
    try {
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
      const fgData = await fgRes.json();
      if (fgData && fgData[0]) {
        if (fgData[0].fruit_roles.some(r => r.role_type === 'gvbb' && r.staff_code === myCode)) {
          hasPerm = true;
        }
      }
    } catch(e) {}
  }
  
  if (!hasPerm) {
    showToast('⚠️ Không có quyền thay đổi trạng thái KT.');
    return;
  }
  
  if (!newState) {
    if (!await showConfirmAsync('Hủy trạng thái Đã mở KT? Sự kiện Mở KT trên Dòng thời gian cũng sẽ bị xóa.')) return;
    executeKTToggle(profileId, false, null);
  } else {
    window._currentKTProfileId = profileId;
    try {
      const bRes = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.bien_ban&select=content`);
      const bbs = await bRes.json();
      const buois = bbs.map(b => b.content?.buoi_thu).filter(Boolean).map(x => parseInt(x)).sort((a,b) => a-b);
      
      let opts = buois.map(b => `<option value="${b}">Báo cáo BB buổi ${b}</option>`).join('');
      if (!opts) opts = `<option value="">Chưa có Báo cáo BB nào</option>`;
      
      const html = `
        <div class="field-group">
          <label>Mở KT ở buổi BB thứ mấy?</label>
          <select id="kt_buoi_select" style="padding:10px; width:100%; border-radius:6px; border:1px solid var(--border);">${opts}</select>
          <div style="font-size:11px; color:var(--text3); margin-top:8px;">* Nếu không thấy thứ tự buổi bạn cần, xin hãy cập nhật thêm Báo Cáo BB.</div>
        </div>
      `;
      document.getElementById('ktModalBody').innerHTML = html;
      document.getElementById('ktModal').classList.add('open');
      document.getElementById('ktConfirmBtn').onclick = () => {
         const val = document.getElementById('kt_buoi_select').value;
         if (!val) return showToast('Vui lòng chọn hoặc tạo báo cáo BB trước.');
         closeModal('ktModal');
         executeKTToggle(profileId, true, val);
      };
    } catch(e) {
      console.error(e); showToast('❌ Lỗi tải danh sách Báo cáo BB.');
    }
  }
}

async function executeKTToggle(profileId, newState, buoiThu) {
  try {
    const myCode = getEffectiveStaffCode();
    
    if (newState) {
      // STEP 1: Create mo_kt record FIRST
      const postRes = await sbFetch('/rest/v1/records', {
         method: 'POST',
         headers: { 'Prefer': 'return=representation' },
         body: JSON.stringify({
            profile_id: profileId,
            record_type: 'mo_kt',
            content: { buoi_thu: parseInt(buoiThu) }
         })
      });
      const postData = await postRes.text();
      console.log('[KT TOGGLE] POST mo_kt response:', postRes.status, postData);
      if (!postRes.ok) {
        showToast('❌ Lỗi tạo sự kiện Mở KT: ' + postData);
        return;
      }
      
      // STEP 2: Only update profile AFTER record is created successfully
      const patchRes = await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_kt_opened: true })
      });
      console.log('[KT TOGGLE] PATCH profile response:', patchRes.status);
      
      showToast('✅ Đã xác nhận Mở KT!');
    } else {
      // Delete mo_kt record and update profile
      await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.mo_kt`, { method: 'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_kt_opened: false })
      });
      showToast('✅ Đã hủy Mở KT!');
    }
    
    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) allProfiles[idx].is_kt_opened = newState;
    
    if (typeof _refreshCurrentProfile === 'function' && window.currentProfileId === profileId) {
       _refreshCurrentProfile();
    } else {
       filterProfiles(); loadDashboard();
    }
  } catch(e) { showToast('❌ Lỗi: ' + e.message); console.error('executeKTToggle:', e); }
}

// ============ THEME TOGGLE (tạm thời bỏ dark mode) ============
function toggleTheme() { /* dark mode tạm thời bị tắt */ }
// Force light mode, clear any saved dark preference
(function() {
  document.documentElement.setAttribute('data-theme', 'light');
  localStorage.removeItem('cj_theme');
})();

// ╔══════════════════════════════════════════════════════════════════╗
// ║              PERSONALIZATION SYSTEM                             ║
// ╚══════════════════════════════════════════════════════════════════╝

const ACCENT_PRESETS = [
  { name: 'Tím Mặc Định',  hex: '#7c6af7' },
  { name: 'Xanh Blue',     hex: '#3b82f6' },
  { name: 'Xanh Google',   hex: '#1a73e8' },
  { name: 'Tím Violet',    hex: '#8b5cf6' },
  { name: 'Hồng Pink',     hex: '#ec4899' },
  { name: 'Cam Orange',    hex: '#f97316' },
  { name: 'Xanh Lá',       hex: '#10b981' },
  { name: 'Đỏ',            hex: '#ef4444' },
  { name: 'Vàng',          hex: '#eab308' },
  { name: 'Cyan',          hex: '#06b6d4' },
];

const ALL_TABS_DEF = [
  { key: 'unit',      label: '🏢 Đơn vị' },
  { key: 'personal',  label: '👤 Cá nhân' },
  { key: 'priority',  label: '⚡ Ưu tiên' },
  { key: 'calendar',  label: '📅 Lịch' },
  { key: 'structure', label: '🏗️ Cơ cấu' },
  { key: 'staff',     label: '👥 TĐ' },
];

// ── Color helpers ──
function _hexToRgb(hex) {
  const h = hex.replace('#','');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}
function _rgbToHex(r,g,b) { return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function _hexToRgba(hex, a) { const [r,g,b] = _hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function _hexToHsl(hex) {
  let [r,g,b] = _hexToRgb(hex).map(v=>v/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b);
  let h,s,l=(max+min)/2;
  if (max===min) { h=s=0; } else {
    const d=max-min; s=l>0.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;}
    h/=6;
  }
  return [Math.round(h*360), Math.round(s*100), Math.round(l*100)];
}
function _hslToHex(h,s,l) {
  s/=100; l/=100;
  const a=s*Math.min(l,1-l);
  const f=n => { const k=(n+h/30)%12; return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1))).toString(16).padStart(2,'0'); };
  return '#'+f(0)+f(8)+f(4);
}
function _lighten(hex, pct) { const [h,s,l]=_hexToHsl(hex); return _hslToHex(h,s,Math.min(95,l+pct)); }
function _darken(hex, pct)  { const [h,s,l]=_hexToHsl(hex); return _hslToHex(h,s,Math.max(5,l-pct)); }

// ── Apply saved prefs ──
function applyUserPreferences(prefs = {}) {
  if (!prefs) return;
  if (prefs.accent) _applyAccentLive(prefs.accent);
  if (prefs.tab_order) _applyTabOrder(prefs.tab_order, prefs.tab_hidden || []);
}

function _applyAccentLive(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const root = document.documentElement;
  root.style.setProperty('--accent', hex);
  root.style.setProperty('--accent2', _lighten(hex, 20));
  root.style.setProperty('--header-bg', `linear-gradient(135deg, ${_darken(hex, 30)} 0%, ${hex} 100%)`);
  root.style.setProperty('--header-border', _hexToRgba(hex, 0.3));
  root.style.setProperty('--badge-bg', _hexToRgba(hex, 0.2));
  root.style.setProperty('--badge-border', _hexToRgba(hex, 0.4));
  root.style.setProperty('--badge-text', _lighten(hex, 25));
  root.style.setProperty('--chip-bg', _hexToRgba(hex, 0.1));
  root.style.setProperty('--chip-border', _hexToRgba(hex, 0.3));
  root.style.setProperty('--chip-sel-bg', hex);
  root.style.setProperty('--fab-shadow', _hexToRgba(hex, 0.5));
  // Update preview bar if open
  const bar = document.getElementById('pref_preview_bar');
  if (bar) bar.style.background = hex;
}

function _applyTabOrder(order, hidden = []) {
  const bar = document.getElementById('mainTabBar');
  if (!bar) return;
  const hiddenSet = new Set(hidden);
  order.forEach(key => {
    const tab = bar.querySelector(`[data-tab="${key}"]`);
    if (!tab) return;
    bar.appendChild(tab);  // reorder
    if (key === 'staff') return; // staff tab visibility controlled by applyPermissions
    tab.style.display = hiddenSet.has(key) ? 'none' : '';
  });
}

// ── Open Panel ──
function openPersonalizationPanel() {
  const prefs = myStaff?.preferences || {};
  const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6af7';
  const hex0 = /^#[0-9a-fA-F]{6}$/.test(currentAccent) ? currentAccent : '#7c6af7';
  const [h0,s0,l0] = _hexToHsl(hex0);
  const [r0,g0,b0] = _hexToRgb(hex0);
  const currentOrder = prefs.tab_order || ALL_TABS_DEF.map(t=>t.key);
  const hiddenSet = new Set(prefs.tab_hidden || []);

  const presetHtml = ACCENT_PRESETS.map(p =>
    `<div onclick="_liveAccent('${p.hex}')" title="${p.name}"
       style="width:34px;height:34px;border-radius:50%;background:${p.hex};cursor:pointer;
              border:3px solid transparent;transition:transform 0.15s;flex-shrink:0;"
       onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform=''"></div>`
  ).join('');

  const sortedTabs = [...ALL_TABS_DEF].sort((a,b) => {
    const ai=currentOrder.indexOf(a.key), bi=currentOrder.indexOf(b.key);
    return (ai<0?99:ai)-(bi<0?99:bi);
  });

  const existing = document.getElementById('personalizationModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'personalizationModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.55);';
  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;max-height:90vh;overflow-y:auto;box-shadow:0 -8px 40px rgba(0,0,0,0.3);">
      <div style="position:sticky;top:0;background:var(--surface);padding:16px 16px 12px;border-radius:20px 20px 0 0;z-index:2;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div style="font-weight:700;font-size:16px;">⚙️ Cá nhân hoá</div>
          <button onclick="document.getElementById('personalizationModal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text2);">✕</button>
        </div>
        <div id="pref_preview_bar" style="height:5px;border-radius:3px;background:${hex0};transition:background 0.25s;"></div>
      </div>
      <div style="padding:0 16px 36px;">
        <!-- ═══ MÀU SẮC ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin:14px 0 8px;">🎨 MÀU CHỦ ĐẠO</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">${presetHtml}</div>
        <!-- System tabs -->
        <div style="display:flex;gap:6px;margin-bottom:12px;">
          ${['HEX','HSL','RGB'].map((s,i) => `<button id="pref_sys_${s}" onclick="_switchSys('${s}')"
            style="flex:1;padding:6px 0;font-size:11px;font-weight:600;border-radius:8px;border:1px solid var(--border);
            background:${i===0?'var(--accent)':'var(--surface2)'};color:${i===0?'#fff':'var(--text2)'};cursor:pointer;">${s}</button>`).join('')}
        </div>
        <!-- HEX -->
        <div id="sys_HEX" style="margin-bottom:14px;">
          <div style="display:flex;gap:8px;align-items:center;">
            <input type="color" id="pref_wheel" value="${hex0}" oninput="_liveAccent(this.value);_syncInputs(this.value)" style="width:46px;height:46px;border:none;border-radius:10px;cursor:pointer;flex-shrink:0;">
            <input type="text" id="pref_hex" value="${hex0}" maxlength="7" placeholder="#7c6af7" oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value)){_liveAccent(this.value);_syncInputs(this.value,true)}"
              style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface2);color:var(--text);font-size:14px;font-family:monospace;">
          </div>
        </div>
        <!-- HSL -->
        <div id="sys_HSL" style="display:none;margin-bottom:14px;">
          ${[['Hue (H)','pref_h',0,360,h0,'deg'],['Saturation (S)','pref_s',0,100,s0,'%'],['Lightness (L)','pref_l',10,90,l0,'%']].map(([name,id,min,max,val,unit])=>`
          <div style="margin-bottom:8px;">
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text2);margin-bottom:3px;">
              <span>${name}</span><b id="${id}_v">${val}${unit}</b>
            </div>
            <input type="range" id="${id}" min="${min}" max="${max}" value="${val}"
              oninput="document.getElementById('${id}_v').textContent=this.value+'${unit}';_fromHsl()"
              style="width:100%;accent-color:var(--accent);">
          </div>`).join('')}
        </div>
        <!-- RGB -->
        <div id="sys_RGB" style="display:none;margin-bottom:14px;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            ${[['R','pref_r',r0],['G','pref_g',g0],['B','pref_b',b0]].map(([lbl,id,val])=>`
            <div>
              <div style="font-size:11px;color:var(--text2);text-align:center;margin-bottom:4px;">${lbl}</div>
              <input type="number" id="${id}" min="0" max="255" value="${val}" oninput="_fromRgb()"
                style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);
                background:var(--surface2);color:var(--text);text-align:center;font-size:13px;">
            </div>`).join('')}
          </div>
        </div>
        <div style="height:1px;background:var(--border);margin:16px 0;"></div>
        <!-- ═══ TABS ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">📌 VỊ TRÍ & HIỂN THỊ TAB</div>
        <div id="pref_tab_list" style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          ${_renderTabRows(sortedTabs, hiddenSet)}
        </div>
        <!-- Buttons -->
        <div style="height:1px;background:var(--border);margin:16px 0;"></div>
        <!-- ═══ HỒ SƠ TĐ ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">👤 HỒ SƠ CÁ NHÂN TĐ</div>
        <div style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border);">
            <div style="width:46px;height:46px;border-radius:14px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;flex-shrink:0;">${(myStaff?.full_name||'?')[0]}</div>
            <div>
              <div style="font-weight:700;font-size:14px;">${myStaff?.full_name||'---'}</div>
              <div style="font-size:11px;color:var(--text3);">${myStaff?.staff_code||''} · ${getPositionName(myStaff?.position)}</div>
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nickname <span style="color:var(--text3);font-weight:400;">(thay thế tên viết tắt hiện tại)</span></label>
            <input type="text" id="prof_nickname" value="${(myStaff?.nickname||'').replace(/"/g,'&quot;')}" placeholder="VD: NKH, Tuấn Anh, Khải..."
              oninput="const v=this.value.trim();document.getElementById('nickname_preview').textContent=v||(myStaff?.staff_code||'');"
              style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" maxlength="40" />
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">Hiện tại: <b>${myStaff?.staff_code||''}</b> → sẽ hiện là <b id="nickname_preview">${myStaff?.nickname||myStaff?.staff_code||''}</b></div>
          </div>
          <div style="display:grid;grid-template-columns:52px 1fr 1fr;gap:8px;align-items:end;">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Avatar</label>
              <div id="prof_emoji_display" onclick="toggleEmojiPicker()" title="Chọn emoji"
                style="width:46px;height:46px;border-radius:14px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;border:2px dashed var(--border);position:relative;">
                ${myStaff?.avatar_emoji || (myStaff?.nickname||myStaff?.full_name||'?')[0]}
              </div>
              <input type="hidden" id="prof_avatar_emoji" value="${myStaff?.avatar_emoji||''}" />
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Giới tính</label>
              <select id="prof_gender" data-val="${myStaff?.gender||''}"
                style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;">
                <option value="">Không rõ</option>
                <option value="Nam">Nam</option>
                <option value="Nu">Nữ</option>
                <option value="Khac">Khác</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Năm sinh</label>
              <input type="text" id="prof_birth_year" value="${myStaff?.birth_year||''}" placeholder="YYYY" maxlength="4"
                style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" />
            </div>
          </div>
          <!-- Emoji picker popup -->
          <div id="emojiPickerBox" style="display:none;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:8px;box-shadow:0 8px 24px rgba(0,0,0,0.2);flex-wrap:wrap;gap:6px;">
            ${['😎','🔥','⚡','🌟','🎯','💎','🦁','🐯','🦊','🐺','🌈','🌙','☀️','❄️','🎸','🎮','⚽','🏆','🎩','✨','🙏','💪','🧠','❤️','🤝','🕊️','🌸','🍀','🦋','🎵'].map(e=>`<span onclick="selectEmoji('${e}')" style="font-size:24px;cursor:pointer;padding:4px;border-radius:8px;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${e}</span>`).join('')}
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">💬 Motto</label>
            <input type="text" id="prof_motto" value="${(myStaff?.motto||'').replace(/"/g,'&quot;')}" placeholder="Câu khẩu hiệu cá nhân..." maxlength="80"
              style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">📝 Bio</label>
            <textarea id="prof_bio" placeholder="Giới thiệu bản thân ngắn gọn..." maxlength="200"
              oninput="document.getElementById('bio_char').textContent=this.value.length"
              style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;resize:vertical;min-height:60px;box-sizing:border-box;">${myStaff?.bio||''}</textarea>
            <div style="font-size:10px;color:var(--text3);text-align:right;margin-top:2px;"><span id="bio_char">${(myStaff?.bio||'').length}</span>/200</div>
          </div>
          <button onclick="saveMyStaffProfile()" style="padding:11px;background:var(--accent);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;width:100%;">💾 Lưu hồ sơ TĐ</button>
        </div>
        <button onclick="_savePrefs()" style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">✅ Lưu cá nhân hoá</button>
        <button onclick="_resetPrefs()" style="width:100%;padding:10px;background:none;color:var(--text3);border:1px solid var(--border);border-radius:12px;font-size:12px;cursor:pointer;">↩ Về mặc định hệ thống</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  _pendingPrefs = { accent: hex0 };
  _prefTabOrder = [...currentOrder];
  _prefTabHidden = new Set(hiddenSet);
  // Fix gender select: set value via JS after DOM is ready (avoids encoding issues with selected attr)
  const gSel = document.getElementById('prof_gender');
  if (gSel) {
    const gVal = gSel.dataset.val || '';
    // Map stored Vietnamese values to option values
    const gMap = { 'Nam':'Nam', 'Nữ':'Nu', 'N\u1eef':'Nu', 'Khác':'Khac', 'Kh\u00e1c':'Khac' };
    gSel.value = gMap[gVal] || gVal;
  }
}

function toggleEmojiPicker() {
  const box = document.getElementById('emojiPickerBox');
  if (!box) return;
  box.style.display = box.style.display === 'none' ? 'flex' : 'none';
}

function selectEmoji(emoji) {
  const display = document.getElementById('prof_emoji_display');
  const input   = document.getElementById('prof_avatar_emoji');
  if (display) display.textContent = emoji;
  if (input)   input.value = emoji;
  const box = document.getElementById('emojiPickerBox');
  if (box) box.style.display = 'none';
}

let _prefTabOrder = null;
let _prefTabHidden = null;

function _renderTabRows(tabs, hiddenSet) {
  return tabs.map((t, i) => `
    <div id="pref_tr_${t.key}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:8px;border:1px solid var(--border);">
      <span style="font-size:14px;flex:1;">${t.label}</span>
      <button onclick="_moveTab('${t.key}',-1)" ${i===0?'disabled':''}
        style="width:28px;height:28px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;font-size:12px;${i===0?'opacity:.35':''}">↑</button>
      <button onclick="_moveTab('${t.key}',1)" ${i===tabs.length-1?'disabled':''}
        style="width:28px;height:28px;border:1px solid var(--border);background:var(--surface);border-radius:6px;cursor:pointer;font-size:12px;${i===tabs.length-1?'opacity:.35':''}">↓</button>
      <label style="display:flex;align-items:center;gap:4px;font-size:11px;cursor:pointer;white-space:nowrap;">
        <input type="checkbox" ${!hiddenSet.has(t.key)?'checked':''} onchange="_toggleTabHide('${t.key}',this.checked)" style="accent-color:var(--accent);"> Hiện
      </label>
    </div>`).join('');
}

function _switchSys(sys) {
  ['HEX','HSL','RGB'].forEach(s => {
    const el = document.getElementById(`sys_${s}`);
    const btn = document.getElementById(`pref_sys_${s}`);
    if (el) el.style.display = s===sys ? '' : 'none';
    if (btn) { btn.style.background = s===sys ? 'var(--accent)' : 'var(--surface2)'; btn.style.color = s===sys ? '#fff' : 'var(--text2)'; }
  });
}

function _liveAccent(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  _pendingPrefs.accent = hex;
  _applyAccentLive(hex);
}

function _syncInputs(hex, skipHex = false) {
  if (!skipHex) { const h = document.getElementById('pref_hex'); if(h) h.value = hex; }
  const w = document.getElementById('pref_wheel'); if(w) w.value = hex;
  const [h,s,l] = _hexToHsl(hex);
  const [r,g,b] = _hexToRgb(hex);
  [['pref_h',h,'deg'],['pref_s',s,'%'],['pref_l',l,'%']].forEach(([id,val,u]) => {
    const el=document.getElementById(id); if(el) el.value=val;
    const vl=document.getElementById(id+'_v'); if(vl) vl.textContent=val+u;
  });
  [['pref_r',r],['pref_g',g],['pref_b',b]].forEach(([id,val]) => { const el=document.getElementById(id); if(el) el.value=val; });
}

function _fromHsl() {
  const h=parseInt(document.getElementById('pref_h')?.value||0);
  const s=parseInt(document.getElementById('pref_s')?.value||70);
  const l=parseInt(document.getElementById('pref_l')?.value||60);
  const hex = _hslToHex(h,s,l);
  _syncInputs(hex); _liveAccent(hex);
}
function _fromRgb() {
  const r=parseInt(document.getElementById('pref_r')?.value||0);
  const g=parseInt(document.getElementById('pref_g')?.value||0);
  const b=parseInt(document.getElementById('pref_b')?.value||0);
  if([r,g,b].every(v=>v>=0&&v<=255)) { const hex=_rgbToHex(r,g,b); _syncInputs(hex); _liveAccent(hex); }
}

function _moveTab(key, dir) {
  const order = _prefTabOrder || ALL_TABS_DEF.map(t=>t.key);
  const i = order.indexOf(key);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  _prefTabOrder = order;
  const hidden = _prefTabHidden || new Set();
  const sortedTabs = order.map(k => ALL_TABS_DEF.find(t=>t.key===k)).filter(Boolean);
  const list = document.getElementById('pref_tab_list');
  if (list) list.innerHTML = _renderTabRows(sortedTabs, hidden);
  _applyTabOrder(order, [...hidden]);
}
function _toggleTabHide(key, show) {
  if (!_prefTabHidden) _prefTabHidden = new Set(myStaff?.preferences?.tab_hidden || []);
  show ? _prefTabHidden.delete(key) : _prefTabHidden.add(key);
  _applyTabOrder(_prefTabOrder || ALL_TABS_DEF.map(t=>t.key), [..._prefTabHidden]);
}

async function _savePrefs() {
  const prefs = {
    ...(myStaff?.preferences || {}),
    accent: _pendingPrefs.accent || '#7c6af7',
    tab_order: _prefTabOrder || ALL_TABS_DEF.map(t=>t.key),
    tab_hidden: [...(_prefTabHidden || new Set())],
  };
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH', body: JSON.stringify({ preferences: prefs })
    });
    if (myStaff) myStaff.preferences = prefs;
    document.getElementById('personalizationModal')?.remove();
    _pendingPrefs = {}; _prefTabOrder = null; _prefTabHidden = null;
    showToast('✅ Đã lưu cá nhân hoá');
  } catch(e) { showToast('❌ Lỗi lưu'); console.error(e); }
}

async function _resetPrefs() {
  if (!await showConfirmAsync('Đặt lại về mặc định hệ thống?')) return;
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH', body: JSON.stringify({ preferences: {} })
    });
    if (myStaff) myStaff.preferences = {};
    document.getElementById('personalizationModal')?.remove();
    _pendingPrefs = {}; _prefTabOrder = null; _prefTabHidden = null;
    // Remove all runtime CSS overrides
    ['--accent','--accent2','--header-bg','--header-border','--badge-bg','--badge-border',
     '--badge-text','--chip-bg','--chip-border','--chip-sel-bg','--fab-shadow'
    ].forEach(v => document.documentElement.style.removeProperty(v));
    // Restore default tab order & visibility
    _applyTabOrder(ALL_TABS_DEF.map(t=>t.key), []);
    showToast('✅ Đã về mặc định');
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ── Lưu hồ sơ TĐ cá nhân ──────────────────────────────────────────────────
async function saveMyStaffProfile() {
  if (!myStaff?.staff_code) { showToast('⚠️ Chưa đăng nhập'); return; }
  const nickname   = document.getElementById('prof_nickname')?.value?.trim() || null;
  // Gender: option values use ASCII keys; map back to Vietnamese for storage
  const gRaw       = document.getElementById('prof_gender')?.value || '';
  const gMap       = { 'Nam':'Nam', 'Nu':'Nữ', 'Khac':'Khác' };
  const gender     = gMap[gRaw] || gRaw || null;
  const birth_year_raw = document.getElementById('prof_birth_year')?.value?.trim();
  const birth_year = birth_year_raw ? parseInt(birth_year_raw) : null;
  const bio        = document.getElementById('prof_bio')?.value?.trim() || null;
  const avatar_emoji = document.getElementById('prof_avatar_emoji')?.value || null;
  const motto      = document.getElementById('prof_motto')?.value?.trim() || null;

  if (birth_year && (birth_year < 1900 || birth_year > 2030)) {
    showToast('⚠️ Năm sinh không hợp lệ'); return;
  }
  const btn = document.querySelector('#personalizationModal button[onclick="saveMyStaffProfile()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang lưu...'; }
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname, gender, birth_year, bio, avatar_emoji, motto })
    });
    // Update local cache
    Object.assign(myStaff, { nickname, gender, birth_year, bio, avatar_emoji, motto });
    // Update header badge if nickname set
    const badge = document.getElementById('myStaffBadge');
    if (badge && nickname) {
      const code = myStaff.staff_code;
      const pos  = getPositionName(myStaff.position);
      let txt = `${nickname} (${code}) · ${pos}`;
      if (myStaff.specialist_position) txt += ` + ${getPositionName(myStaff.specialist_position)}`;
      badge.textContent = txt;
    }
    showToast('✅ Đã lưu hồ sơ TĐ!');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  } catch(e) {
    showToast('❌ Lỗi lưu hồ sơ'); console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  }
}