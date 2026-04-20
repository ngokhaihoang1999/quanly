// ============ SETTINGS ============
// Extracted from core.js — View As, Theme, Personalization, Staff Profile, Staff Card
// Depends on: myStaff, allStaff, sbFetch, showToast, showConfirmAsync, permissions functions

// ── View As (Admin testing) ──
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
  getManagementPositions().forEach(p => {
    if (p.code === 'admin') return;
    html += `<option value="${p.code}">${p.name} (chung)</option>`;
  });
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
  const structTab = document.querySelector('[data-tab="structure"]');
  if (structTab) structTab.style.display = _isTabPinned('structure') ? 'none' : '';
  const btnAddArea = document.getElementById('btnAddArea');
  if (btnAddArea) btnAddArea.style.display = hasPermission('manage_structure') ? '' : 'none';
  const btnManagePos = document.getElementById('btnManagePositions');
  if (btnManagePos) btnManagePos.style.display = hasPermission('manage_positions') ? '' : 'none';
  const btnStaffWt = document.getElementById('btnStaffWithoutTeam');
  if (btnStaffWt) btnStaffWt.style.display = hasPermission('manage_positions') ? '' : 'none';
  const btnSyncSheet = document.getElementById('btnSyncSheet');
  if (btnSyncSheet) btnSyncSheet.style.display = hasPermission('manage_positions') ? '' : 'none';
  const fabBtn = document.getElementById('fabBtn');
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'dashboard';
  if (fabBtn) fabBtn.style.display = (hasPermission('create_hapja') && (activeTab==='unit'||activeTab==='personal')) ? 'flex' : 'none';
  const tabStaffBtn = document.getElementById('tabStaffBtn');
  if (tabStaffBtn) tabStaffBtn.style.display = hasPermission('manage_positions') && !_isTabPinned('staff') ? '' : 'none';
  const tabReportsBtn = document.getElementById('tabReportsBtn');
  if (tabReportsBtn) {
    const scope = getScope();
    const pos = getCurrentPosition();
    const showReports = ['team','group','area','system'].includes(scope) || ['gyjn','bgyjn','tjn','yjyn','admin'].includes(pos);
    tabReportsBtn.style.display = showReports && !_isTabPinned('reports') ? '' : 'none';
  }
  if (document.getElementById('tab-structure').style.display !== 'none') loadStructure();
  setTimeout(() => {
    if (typeof loadPriority === 'function') loadPriority();
    if (typeof loadNotifCount === 'function') loadNotifCount();
  }, 800);
}

// ── Theme Toggle ──
function toggleTheme() { /* dark mode tạm thời bị tắt */ }
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
  { key: 'notes',     label: '📝 Notes' },
  { key: 'reports',   label: '📊 Báo cáo' },
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
  const bar = document.getElementById('pref_preview_bar');
  if (bar) bar.style.background = hex;
}

function _applyTabOrder(order, hidden = []) {
  const bar = document.getElementById('mainTabBar');
  if (!bar) return;
  const hiddenSet = new Set(hidden);
  const allKeys = ALL_TABS_DEF.map(t => t.key);
  const mergedOrder = [...order];
  allKeys.forEach(k => {
    if (!mergedOrder.includes(k)) mergedOrder.push(k);
  });
  mergedOrder.forEach(key => {
    const tab = bar.querySelector(`[data-tab="${key}"]`);
    if (!tab) return;
    bar.appendChild(tab);
    if (key === 'staff') return;
    if (key === 'reports') return;
    tab.style.display = hiddenSet.has(key) ? 'none' : '';
  });
  _updateTabBarMode();
}

// ── Settings tab switching ──
function _switchSettingsTab(tab) {
  ['appearance','profile','security'].forEach(t => {
    const pane = document.getElementById('settingsPane_' + t);
    const btn = document.getElementById('stab_' + t);
    if (pane) pane.style.display = t === tab ? '' : 'none';
    if (btn) {
      btn.style.background = t === tab ? 'var(--accent)' : 'var(--surface2)';
      btn.style.color = t === tab ? 'white' : 'var(--text2)';
    }
  });
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
    showToast('✅ Đã lưu cài đặt');
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
    ['--accent','--accent2','--header-bg','--header-border','--badge-bg','--badge-border',
     '--badge-text','--chip-bg','--chip-border','--chip-sel-bg','--fab-shadow'
    ].forEach(v => document.documentElement.style.removeProperty(v));
    _applyTabOrder(ALL_TABS_DEF.map(t=>t.key), []);
    showToast('✅ Đã về mặc định');
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// NOTE: openPersonalizationPanel() is very large (~230 lines of template HTML).
// It remains in core.js to avoid exceeding safe file creation limits.
// It will be moved in a follow-up after verifying this split works.

// ── Lưu hồ sơ TĐ cá nhân ──
async function saveMyStaffProfile() {
  if (!myStaff?.staff_code) { showToast('⚠️ Chưa đăng nhập'); return; }
  const nickname   = document.getElementById('prof_nickname')?.value?.trim() || null;
  const gRaw       = document.getElementById('prof_gender')?.value || '';
  const gMap       = { 'Nam':'Nam', 'Nu':'Nữ' };
  const gender     = gMap[gRaw] || null;
  const birth_year_raw = document.getElementById('prof_birth_year')?.value?.trim();
  const birth_year = birth_year_raw ? parseInt(birth_year_raw) : null;
  const bio        = document.getElementById('prof_bio')?.value?.trim() || null;
  const avatar_emoji = document.getElementById('prof_avatar_emoji')?.value || null;
  const motto      = document.getElementById('prof_motto')?.value?.trim() || null;
  const scj_code   = document.getElementById('prof_scj_code')?.value?.trim() || null;
  const sinka_info = document.getElementById('prof_sinka_info')?.value?.trim() || null;

  if (birth_year && (birth_year < 1900 || birth_year > 2030)) {
    showToast('⚠️ Năm sinh không hợp lệ'); return;
  }
  const btn = document.querySelector('#personalizationModal button[onclick="saveMyStaffProfile()"]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang lưu...'; }
  try {
    const staff_avatar_color = document.getElementById('prof_staff_avatar_color')?.value || null;
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname, gender, birth_year, bio, avatar_emoji, motto, scj_code, sinka_info, staff_avatar_color })
    });
    Object.assign(myStaff, { nickname, gender, birth_year, bio, avatar_emoji, motto, scj_code, sinka_info, staff_avatar_color });
    const badge = document.getElementById('myStaffBadge');
    if (badge && nickname) {
      const code = myStaff.staff_code;
      const pos  = getPositionName(myStaff.position);
      let txt = `${nickname} (${code}) · ${pos}`;
      if (myStaff.specialist_position) txt += ` + ${getPositionName(myStaff.specialist_position)}`;
      badge.textContent = txt;
    }
    showToast('✅ Đã lưu hồ sơ TĐ!');
    const headerAv = document.getElementById('headerAvatar');
    if (headerAv) {
      const dn = myStaff.nickname || myStaff.full_name || myStaff.staff_code || '?';
      const lt = getNameInitial(dn);
      const avH = typeof renderAnimatedAvatar === 'function'
        ? renderAnimatedAvatar(lt, myStaff.staff_avatar_color || '', 'md')
        : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${lt}</div>`;
      headerAv.innerHTML = `<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openPersonalizationPanel()" title="Cài đặt"><div style="padding:2px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.15));box-shadow:0 0 12px rgba(255,255,255,0.2);">${avH}</div><div style="display:flex;flex-direction:column;gap:1px;"><span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.97);text-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1.2;">${dn}</span><span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.6);line-height:1;">Hệ thống quản lý</span></div></div>`;
      headerAv.style.display = 'block';
    }
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  } catch(e) {
    showToast('❌ Lỗi lưu hồ sơ'); console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  }
}

// ── Staff Card Popup ──
function showStaffCard(code) {
  var s = allStaff.find(function(x){ return x.staff_code === code; });
  if (!s) { showToast('Khong tim thay: ' + code); return; }
  var existing = document.getElementById('staffCardModal');
  if (existing) existing.remove();
  var avatar = getNameInitial(s.nickname || s.full_name || s.staff_code);
  var isEmoji = false;
  var unit    = getStaffUnit(code) || '';
  var gStr = s.gender ? ' · ' + s.gender : '';
  var bStr = s.birth_year ? (gStr ? '' : '') + ' · ' + s.birth_year : '';
  var posStr = s.staff_code + ' · ' + getPositionName(s.position) + (s.specialist_position ? ' + ' + getPositionName(s.specialist_position) : '');
  var modal = document.createElement('div');
  modal.id = 'staffCardModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML =
    '<div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -8px 40px rgba(0,0,0,0.3);">' +
      '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
        (typeof renderAnimatedAvatar === 'function' ? renderAnimatedAvatar(avatar, s.staff_avatar_color || '', 'md') : '<div style="width:56px;height:56px;border-radius:16px;background:' + (s.staff_avatar_color || 'var(--accent)') + ';display:flex;align-items:center;justify-content:center;font-size:' + (isEmoji?'28px':'22px') + ';font-weight:700;color:white;flex-shrink:0;">' + avatar + '</div>') +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;font-size:16px;">' + (s.nickname || s.full_name || s.staff_code) + '</div>' +
          (s.nickname ? '<div style="font-size:12px;color:var(--text3);">' + s.full_name + ' (' + s.staff_code + ')</div>' : '<div style="font-size:12px;color:var(--text3);">' + s.staff_code + '</div>') +
          '<div style="margin-top:4px;">' +
            '<span class="staff-role-badge ' + getBadgeClass(s.position) + '" style="font-size:10px;padding:3px 10px;">' + getPositionName(s.position) + '</span>' +
            (s.specialist_position ? ' <span class="staff-role-badge" style="font-size:10px;padding:3px 10px;background:rgba(139,92,246,0.15);color:#7c3aed;border:1px solid rgba(139,92,246,0.3);">' + getPositionName(s.specialist_position) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (unit ? '<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:10px;">&\\#127962; ' + unit + '</div>' : '') +
      ((s.gender||s.birth_year) ? '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">' + (s.gender||'') + bStr + '</div>' : '') +
      (s.motto ? '<div style="font-size:13px;font-style:italic;color:var(--accent);border-left:3px solid var(--accent);padding-left:10px;margin-bottom:10px;">💪 ' + s.motto + '</div>' : '') +
      (s.bio ? '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:12px;">' + s.bio + '</div>' : '') +
      '<button onclick="document.getElementById(\'staffCardModal\').remove()" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;">Đóng</button>' +
    '</div>';
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}
