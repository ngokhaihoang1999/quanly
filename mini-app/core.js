const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY';
const tg = window.Telegram?.WebApp;
let currentProfileId = null, currentRecordType = null, currentRecordId = null;
let allProfiles = [], allStaff = [], myStaff = null, structureData = [];
let allPositions = [];
let _pendingPrefs = {}; // live personalization edits not yet saved
let _pinUnlocked = false; // session flag — once unlocked, stays unlocked until full reload
let _authChecked = false; // set true sau khi loadStaffInfo() xong — dùng bởi security guard

// ============ PIN LOCK SYSTEM ============
const PIN_HASH_KEY = 'cj_pin_hash';
const PIN_ENABLED_KEY = 'cj_pin_enabled';

async function _hashPin(pin) {
  const data = new TextEncoder().encode(pin + '_cj_salt_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _isPinEnabled() {
  return localStorage.getItem(PIN_ENABLED_KEY) === '1' && !!localStorage.getItem(PIN_HASH_KEY);
}

function _showPinLock() {
  if (_pinUnlocked || !_isPinEnabled()) return;
  // Create fullscreen PIN overlay
  const overlay = document.createElement('div');
  overlay.id = 'pinLockOverlay';
  overlay.innerHTML = `
    <div class="pin-lock-container">
      <div class="pin-lock-icon">🔒</div>
      <div class="pin-lock-title">Nhập mã PIN</div>
      <div class="pin-lock-subtitle">Vui lòng nhập mã PIN 6 số để mở khoá</div>
      <div class="pin-dots" id="pinDots">
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pinError"></div>
      <div class="pin-keypad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => 
          k === '' ? '<div class="pin-key empty"></div>' :
          k === '⌫' ? '<div class="pin-key del" onclick="_pinKeyPress(\'del\')">⌫</div>' :
          `<div class="pin-key" onclick="_pinKeyPress(${k})">${k}</div>`
        ).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

let _pinInput = '';
async function _pinKeyPress(key) {
  const errEl = document.getElementById('pinError');
  if (key === 'del') {
    _pinInput = _pinInput.slice(0, -1);
  } else {
    if (_pinInput.length >= 6) return;
    _pinInput += String(key);
  }
  // Telegram haptic feedback for native feel
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch(e) {}
  // Update dots
  const dots = document.querySelectorAll('#pinDots .pin-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('filled', i < _pinInput.length);
  });
  if (errEl) errEl.textContent = '';
  // Auto-verify on 6 digits
  if (_pinInput.length === 6) {
    const hash = await _hashPin(_pinInput);
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (hash === stored) {
      _pinUnlocked = true;
      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch(e) {}
      const overlay = document.getElementById('pinLockOverlay');
      if (overlay) {
        overlay.style.animation = 'pinUnlock 0.35s ease-out forwards';
        setTimeout(() => overlay.remove(), 350);
      }
    } else {
      // Wrong PIN — shake + clear
      const container = document.querySelector('.pin-dots');
      if (container) {
        container.style.animation = 'pinShake 0.4s';
        setTimeout(() => container.style.animation = '', 400);
      }
      if (errEl) errEl.textContent = 'Mã PIN không đúng';
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch(e) {}
      _pinInput = '';
      setTimeout(() => dots.forEach(d => d.classList.remove('filled')), 300);
    }
  }
}

// PIN setup/change dialog (used in settings)
async function _openPinSetup(mode) {
  // mode: 'new' (first time), 'change' (must verify old first), 'off' (verify to turn off)
  const existing = document.getElementById('pinSetupModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'pinSetupModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
  modal.innerHTML = `
    <div style="width:320px;background:var(--surface);border-radius:20px;padding:24px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.3);">
      <div style="font-size:28px;margin-bottom:8px;">${mode === 'off' ? '🔓' : '🔐'}</div>
      <div id="pinSetupTitle" style="font-weight:700;font-size:15px;margin-bottom:4px;">${mode === 'off' ? 'Xác nhận tắt PIN' : mode === 'change' ? 'Nhập mã PIN cũ' : 'Đặt mã PIN mới'}</div>
      <div id="pinSetupSubtitle" style="font-size:12px;color:var(--text3);margin-bottom:16px;">${mode === 'new' ? 'Nhập 6 chữ số' : 'Nhập mã PIN hiện tại'}</div>
      <div class="pin-dots" id="setupPinDots" style="margin-bottom:8px;">
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="setupPinError" style="min-height:18px;"></div>
      <div class="pin-keypad" style="max-width:260px;margin:0 auto;">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k =>
          k === '' ? '<div class="pin-key empty"></div>' :
          k === '⌫' ? '<div class="pin-key del" onclick="_setupPinKey(\'del\')">⌫</div>' :
          `<div class="pin-key" onclick="_setupPinKey(${k})">${k}</div>`
        ).join('')}
      </div>
      <button onclick="document.getElementById('pinSetupModal')?.remove();_refreshPinToggle()" style="margin-top:12px;padding:8px 24px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);font-size:13px;cursor:pointer;">Huỷ</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); _refreshPinToggle(); } });
  window._pinSetupMode = mode;
  window._pinSetupStep = (mode === 'new') ? 'enter' : 'verify';
  window._pinSetupInput = '';
  window._pinSetupNewPin = '';
}

async function _setupPinKey(key) {
  const errEl = document.getElementById('setupPinError');
  if (key === 'del') {
    window._pinSetupInput = window._pinSetupInput.slice(0, -1);
  } else {
    if (window._pinSetupInput.length >= 6) return;
    window._pinSetupInput += String(key);
  }
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch(e) {}
  const dots = document.querySelectorAll('#setupPinDots .pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < window._pinSetupInput.length));
  if (errEl) errEl.textContent = '';

  if (window._pinSetupInput.length === 6) {
    const pin = window._pinSetupInput;
    const mode = window._pinSetupMode;
    const step = window._pinSetupStep;

    if (step === 'verify') {
      // Verify old PIN
      const hash = await _hashPin(pin);
      const stored = localStorage.getItem(PIN_HASH_KEY);
      if (hash !== stored) {
        if (errEl) errEl.textContent = 'Mã PIN không đúng';
        window._pinSetupInput = '';
        const c = document.querySelector('#setupPinDots');
        if (c) { c.style.animation = 'pinShake 0.4s'; setTimeout(() => c.style.animation = '', 400); }
        setTimeout(() => dots.forEach(d => d.classList.remove('filled')), 300);
        return;
      }
      if (mode === 'off') {
        // Turn off PIN
        localStorage.removeItem(PIN_HASH_KEY);
        localStorage.removeItem(PIN_ENABLED_KEY);
        document.getElementById('pinSetupModal')?.remove();
        showToast('🔓 Đã tắt khoá PIN');
        _refreshPinToggle();
        return;
      }
      // mode === 'change' — proceed to enter new
      window._pinSetupStep = 'enter';
      window._pinSetupInput = '';
      dots.forEach(d => d.classList.remove('filled'));
      document.getElementById('pinSetupTitle').textContent = 'Đặt mã PIN mới';
      document.getElementById('pinSetupSubtitle').textContent = 'Nhập 6 chữ số';
      return;
    }

    if (step === 'enter') {
      window._pinSetupNewPin = pin;
      window._pinSetupStep = 'confirm';
      window._pinSetupInput = '';
      dots.forEach(d => d.classList.remove('filled'));
      document.getElementById('pinSetupTitle').textContent = 'Xác nhận mã PIN';
      document.getElementById('pinSetupSubtitle').textContent = 'Nhập lại mã PIN mới';
      return;
    }

    if (step === 'confirm') {
      if (pin !== window._pinSetupNewPin) {
        if (errEl) errEl.textContent = 'Mã PIN không khớp. Thử lại.';
        window._pinSetupStep = 'enter';
        window._pinSetupInput = '';
        window._pinSetupNewPin = '';
        const c = document.querySelector('#setupPinDots');
        if (c) { c.style.animation = 'pinShake 0.4s'; setTimeout(() => c.style.animation = '', 400); }
        setTimeout(() => {
          dots.forEach(d => d.classList.remove('filled'));
          document.getElementById('pinSetupTitle').textContent = 'Đặt mã PIN mới';
          document.getElementById('pinSetupSubtitle').textContent = 'Nhập 6 chữ số';
        }, 400);
        return;
      }
      // Save PIN
      const hash = await _hashPin(pin);
      localStorage.setItem(PIN_HASH_KEY, hash);
      localStorage.setItem(PIN_ENABLED_KEY, '1');
      _pinUnlocked = true;
      document.getElementById('pinSetupModal')?.remove();
      showToast('🔒 Đã đặt mã PIN');
      _refreshPinToggle();
    }
  }
}

function _refreshPinToggle() {
  const el = document.getElementById('pinToggleArea');
  if (!el) return;
  const on = _isPinEnabled();
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:13px;font-weight:600;">🔒 Khoá bằng mã PIN</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${on ? 'Đang bật — yêu cầu PIN khi mở app' : 'Chưa đặt mã PIN'}</div>
      </div>
      <label class="pin-switch">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="_onPinToggle(this.checked)">
        <span class="pin-slider"></span>
      </label>
    </div>
    ${on ? '<button onclick="_openPinSetup(\'change\')" style="margin-top:8px;padding:8px 16px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:12px;cursor:pointer;width:100%;">🔑 Đổi mã PIN</button>' : ''}
  `;
}

function _onPinToggle(checked) {
  if (checked) {
    _openPinSetup('new');
  } else {
    _openPinSetup('off');
  }
}

// ============ DATA CACHE (prevents redundant re-fetches on tab switch) ============
const _dataCache = { profiles: 0, dashboard: 0, staff: 0, structure: 0, calendar: 0, priority: 0 };
const CACHE_TTL = 90000; // 90s — tăng từ 30s để giảm áp lực Supabase Free tier
function isFresh(key) { return Date.now() - (_dataCache[key] || 0) < CACHE_TTL; }
function markFresh(key) { _dataCache[key] = Date.now(); }
function invalidateCache(key) { if (key) _dataCache[key] = 0; else Object.keys(_dataCache).forEach(k => _dataCache[k] = 0); }

// ── Smart refresh: only reload the active tab's data ──
async function refreshCurrentTab() {
  const btn = document.getElementById('refreshTabBtn');
  if (btn) { btn.style.transform = 'rotate(360deg)'; btn.disabled = true; }
  const activeTab = document.querySelector('.tab-bar .tab.active')?.dataset?.tab;

  // Map tab → cache keys to invalidate + loader function
  const tabMap = {
    unit:      { keys: ['profiles','dashboard'], load: async () => { await loadProfiles(); loadDashboard(); } },
    personal:  { keys: ['profiles','dashboard'], load: async () => { await loadProfiles(); loadDashboard(); } },
    staff:     { keys: ['staff'],     load: () => typeof loadStaff === 'function' && loadStaff() },
    structure: { keys: ['structure'], load: () => typeof loadStructure === 'function' && loadStructure() },
    calendar:  { keys: ['calendar'],  load: () => typeof loadCalendar === 'function' && loadCalendar() },
    priority:  { keys: ['priority'],  load: () => typeof loadPriority === 'function' && loadPriority() },
    reports:   { keys: ['profiles'],  load: async () => { _rptCache = null; await loadProfiles(); loadReports(); } },
    notes:     { keys: [],            load: () => typeof loadNotes === 'function' && loadNotes() },
  };

  const entry = tabMap[activeTab];
  showLoading();
  if (entry) {
    entry.keys.forEach(k => invalidateCache(k));
    try { await entry.load(); } catch(e) { console.warn('Refresh error:', e); showToast('⚠️ Tải lại bị lỗi'); }
  } else {
    invalidateCache();
    await loadProfiles();
    loadDashboard();
  }

  hideLoading();
  showToast('✅ Đã tải lại dữ liệu');
  if (btn) { setTimeout(() => { btn.style.transform = ''; btn.disabled = false; }, 400); }
}

// ============ IN-FLIGHT DEDUPLICATION ============
// Built into sbFetch() — if 2 identical GET requests fire simultaneously,
// only 1 actual network call is made; both callers receive the same result.
const _inflight = new Map();

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
  const _fs = p.fruit_status || 'alive';
  const isInactive = _fs === 'dropout' || _fs === 'pause';
  const statusColor = _fs === 'dropout' ? 'var(--red)' : _fs === 'pause' ? '#9ca3af' : 'var(--green)';
  const statusLabel = _fs === 'dropout' ? 'Drop-out' : _fs === 'pause' ? 'Pause' : 'Alive';
  const statusBg = _fs === 'dropout' ? 'rgba(248,113,113,0.15)' : _fs === 'pause' ? 'rgba(156,163,175,0.15)' : 'rgba(52,211,153,0.15)';
  const statusBorder = _fs === 'dropout' ? 'rgba(248,113,113,0.3)' : _fs === 'pause' ? 'rgba(156,163,175,0.3)' : 'rgba(52,211,153,0.3)';
  const statusBadge = `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${statusBg};color:${statusColor};border:1px solid ${statusBorder};white-space:nowrap;"><span style="background:${statusColor};width:6px;height:6px;border-radius:50%;margin-right:3px;display:inline-block;"></span>${statusLabel}</span>`;

  const ph = p.phase || 'chakki';
  const showPhase = opts.showPhase !== false && ph && ph !== 'new';
  const phaseBadge = showPhase
    ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${(typeof PHASE_COLORS!=='undefined'?PHASE_COLORS[ph]:{})||'#f59e0b'};color:white;white-space:nowrap;">${(typeof PHASE_LABELS!=='undefined'?PHASE_LABELS[ph]:ph)||ph}</span>`
    : '';

  const showKT = ['bb','center','completed'].includes(ph);
  const ktBadge = showKT
    ? `<span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:8px;background:${p.is_kt_opened?'var(--green)':'#f59e0b'};color:white;white-space:nowrap;">${p.is_kt_opened?'📖 KT':'📕 KT'}</span>`
    : '';

  const extraBadges = opts.extraBadges || '';
  const resolvedId = p.id || opts.profileId || '';
  const clickFn = opts.clickFn || `openProfileById('${resolvedId}')`;

  // Birth year
  const birthYear = !isInactive && p.birth_year ? p.birth_year : '';
  const yearTag = birthYear ? `<span style="font-size:12px;color:var(--text3);font-weight:400;"> · ${birthYear}</span>` : '';

  // Data fields
  const nddStr = opts.ndd || p.ndd_staff_code || '';
  const tvvStr = opts.tvv || '';
  const gvbbStr = opts.gvbb || '';
  const latestStr = opts.latestActivity || '';

  // ── Row 1: Name + year (left) — Status badge (right) ──
  const row1 = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <div style="font-size:14px;font-weight:600;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.full_name}${yearTag}</div>
    <div style="flex-shrink:0;">${statusBadge}</div>
  </div>`;

  // ── Row 2: Phase + KT badges (only if exists) ──
  const hasBadges = phaseBadge || ktBadge || extraBadges;
  const row2 = hasBadges ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${phaseBadge}${ktBadge}${extraBadges}</div>` : '';

  // ── Dropout note ──
  const dropoutNote = isInactive && p.dropout_reason ? `<div style="font-size:11px;color:${_fs==='pause'?'#9ca3af':'var(--red)'};margin-top:4px;">Lý do: ${p.dropout_reason}</div>` : '';

  // ── Row 3: Roles (NDD / TVV / GVBB) — compact single line ──
  const roleParts = [];
  if (nddStr) roleParts.push(`<span><b style="opacity:0.5;">NDD</b> ${nddStr}</span>`);
  if (tvvStr) roleParts.push(`<span><b style="opacity:0.5;">TVV</b> ${tvvStr}</span>`);
  if (gvbbStr) roleParts.push(`<span><b style="opacity:0.5;">GVBB</b> ${gvbbStr}</span>`);
  const rolesRow = roleParts.length > 0
    ? `<div style="display:flex;gap:4px;font-size:11px;color:var(--text2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${roleParts.join('<span style="opacity:0.3;"> · </span>')}</div>`
    : '';

  // ── Row 4: Latest activity — own dedicated row ──
  const activityContent = opts.extraMeta || (latestStr ? `⏱ ${latestStr}` : '');
  const activityRow = activityContent
    ? `<div style="font-size:11px;color:var(--accent);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${activityContent}</div>`
    : '';

  // ── Bottom section (roles + activity) with separator ──
  const hasBottom = rolesRow || activityRow;
  const bottomHtml = hasBottom
    ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:3px;">${rolesRow}${activityRow}</div>`
    : '';

  return `<div class="profile-card" onclick="${clickFn}" style="padding:12px 14px;">
    <div class="profile-info" style="width:100%;min-width:0;">
      ${row1}${row2}${dropoutNote}${bottomHtml}
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

// Promise-based prompt: await showPromptAsync('message', 'default') → string|null
function showPromptAsync(message, defaultValue = '') {
  return new Promise(resolve => {
    let modal = document.getElementById('customPromptModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'customPromptModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
      modal.innerHTML = `
        <div style="background:var(--surface,#fff);border-radius:14px;padding:20px 20px 14px;max-width:380px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
          <div id="customPromptMsg" style="font-size:14px;color:var(--text,#111);line-height:1.5;margin-bottom:12px;white-space:pre-line;"></div>
          <textarea id="customPromptInput" rows="3" style="width:100%;padding:10px;border:1px solid var(--border,#ddd);border-radius:8px;font-size:13px;font-family:inherit;resize:vertical;background:var(--surface2,#f9f9f9);color:var(--text,#111);box-sizing:border-box;"></textarea>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
            <button id="customPromptCancel" style="padding:8px 16px;border:1px solid var(--border,#ddd);border-radius:8px;background:transparent;color:var(--text2,#555);font-size:13px;cursor:pointer;">Huỷ</button>
            <button id="customPromptOk" style="padding:8px 16px;border:none;border-radius:8px;background:var(--accent,#6366f1);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Gửi</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
    }
    document.getElementById('customPromptMsg').textContent = message;
    const input = document.getElementById('customPromptInput');
    input.value = defaultValue;
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);

    const cleanup = () => { modal.style.display = 'none'; };
    document.getElementById('customPromptOk').onclick = () => { const v = input.value; cleanup(); resolve(v); };
    document.getElementById('customPromptCancel').onclick = () => { cleanup(); resolve(null); };
    modal.onclick = (e) => { if (e.target === modal) { cleanup(); resolve(null); } };
  });
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

// ── Top loading bar ──
function showLoading() {
  const bar = document.getElementById('topLoadBar');
  if (bar) { bar.className = 'top-loading-bar loading'; }
}
function hideLoading() {
  const bar = document.getElementById('topLoadBar');
  if (bar) { bar.className = 'top-loading-bar done'; setTimeout(() => { bar.className = 'top-loading-bar'; }, 600); }
}

// ── Copy text to clipboard with toast feedback ──
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Đã copy!');
  } catch(e) {
    // Fallback for older browsers / Telegram WebApp
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 Đã copy!');
  }
}

// ── Celebration: confetti + big toast for phase transitions ──
function showCelebration(emoji, message) {
  // 1. Big toast
  showToast(`${emoji} ${message}`);

  // 2. Confetti burst
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const colors = ['#f59e0b','#22c55e','#3b82f6','#ef4444','#8b5cf6','#ec4899','#f97316','#14b8a6'];
  const emojis = ['🎉','✨','🌟','🎊','💫','⭐'];
  const particles = [];
  const cx = canvas.width / 2, cy = canvas.height * 0.35;

  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 6;
    const isEmoji = Math.random() < 0.3;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed * (0.5 + Math.random()),
      vy: Math.sin(angle) * speed * (0.5 + Math.random()) - 3,
      size: isEmoji ? 16 + Math.random() * 10 : 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      emoji: isEmoji ? emojis[Math.floor(Math.random() * emojis.length)] : null,
      alpha: 1,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10
    });
  }

  let frame = 0;
  const maxFrames = 90;
  function animate() {
    frame++;
    if (frame > maxFrames) { canvas.remove(); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15; // gravity
      p.rot += p.rotSpeed;
      p.alpha = Math.max(0, 1 - frame / maxFrames);
      ctx.globalAlpha = p.alpha;
      if (p.emoji) {
        ctx.font = `${p.size}px serif`;
        ctx.fillText(p.emoji, p.x, p.y);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  animate();
}

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
  const isWrite = opts.method && opts.method !== 'GET';

  // ── Security guard: chặn write khi không có Telegram auth và không phải guest ──
  if (isWrite && !window.isGuestMode && myStaff === null && typeof _authChecked !== 'undefined' && _authChecked) {
    console.error('[Security] Write blocked — no authenticated staff');
    throw new Error('Not authenticated');
  }

  // ── In-flight dedup for GET: if same path is already loading, reuse it ──
  if (!isWrite && _inflight.has(path)) {
    return (await _inflight.get(path)).clone();
  }

  const timeoutMs = isWrite ? 60000 : 20000;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);

  const promise = (async () => {
    try {
      const res = await fetch(SUPABASE_URL + path, { ...opts, headers, signal: controller.signal });
      if (!res.ok && isWrite) {
        console.warn(`[sbFetch] ${opts.method} ${path} → ${res.status}`);
        if (typeof showToast === 'function') showToast(`⚠️ Lỗi lưu dữ liệu (${res.status})`);
      }
      return res;
    } finally {
      clearTimeout(tid);
      _inflight.delete(path);
    }
  })();

  if (!isWrite) _inflight.set(path, promise);
  const res = await promise;
  return !isWrite ? res.clone() : res;
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

let _semSwitching = false;
async function switchSemester(id) {
  if (id === currentSemesterId) return;
  if (_semSwitching) return; // Prevent double-fire from rapid clicks
  _semSwitching = true;
  currentSemesterId = id || null;
  localStorage.setItem('cj_semester_id', currentSemesterId || '');

  showLoading();

  // Invalidate ALL data caches so every tab reloads fresh
  invalidateCache();
  _rptCache = null;

  // Load core data first (profiles drives everything)
  await loadProfiles();

  // Reload whatever tab is currently active
  const activeTab = document.querySelector('.tab-bar .tab.active')?.dataset?.tab;
  const reloaders = {
    unit:      () => { loadDashboard(); },
    personal:  () => { loadDashboard(); },
    staff:     () => { if (typeof loadStaff === 'function') loadStaff(); },
    structure: () => { if (typeof loadStructure === 'function') loadStructure(); },
    calendar:  () => { if (typeof loadCalendar === 'function') loadCalendar(); },
    priority:  () => { if (typeof loadPriority === 'function') loadPriority(); },
    reports:   () => { if (typeof loadReports === 'function') loadReports(); },
    notes:     () => { if (typeof loadNotes === 'function') loadNotes(); },
  };
  if (reloaders[activeTab]) reloaders[activeTab]();
  else loadDashboard();

  hideLoading();
  showToast('📂 Đã chuyển Khai Giảng');
  _semSwitching = false;
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
// ============ DESKTOP WINDOW CONTROLS ============
let _isFullscreen = false;
function _injectWindowControls() {
  if (document.getElementById('winCtrlBar')) return;
  const bar = document.createElement('div');
  bar.id = 'winCtrlBar';
  // Vertical bar, middle-right edge, pill shape
  bar.style.cssText = 'position:fixed;top:50%;right:0;transform:translateY(-50%);z-index:99999;display:flex;flex-direction:column;gap:1px;padding:4px 3px;background:rgba(30,30,30,0.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:10px 0 0 10px;border:1px solid rgba(255,255,255,0.08);border-right:none;box-shadow:-2px 0 12px rgba(0,0,0,0.25);transition:opacity 0.3s;';
  const mkBtn = (id, icon, title, hoverBg) => {
    const b = document.createElement('button');
    b.id = id; b.title = title; b.textContent = icon;
    b.style.cssText = 'width:26px;height:28px;border:none;border-radius:5px;background:transparent;color:#bbb;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;font-family:system-ui;line-height:1;padding:0;';
    b.onmouseenter = () => { b.style.background = hoverBg || 'rgba(255,255,255,0.15)'; b.style.color = '#fff'; };
    b.onmouseleave = () => { b.style.background = 'transparent'; b.style.color = '#bbb'; };
    return b;
  };
  const btnMin = mkBtn('winBtnMin', '\u2500', 'Thu nho', 'rgba(255,255,255,0.15)');
  const btnMax = mkBtn('winBtnMax', '\u25A1', 'Phong to', 'rgba(255,255,255,0.15)');
  const btnClose = mkBtn('winBtnClose', '\u2715', 'Dong', '#e53e3e');
  bar.appendChild(btnMin);
  bar.appendChild(btnMax);
  bar.appendChild(btnClose);
  document.body.appendChild(bar);

  // Actions
  btnMin.onclick = () => {
    // tg.minimize() requires Bot API 8.0+; fallback: exit fullscreen as a "minimize" feel
    try {
      if (tg && typeof tg.minimize === 'function') { tg.minimize(); return; }
      if (_isFullscreen && tg && tg.exitFullscreen) { tg.exitFullscreen(); _isFullscreen = false; btnMax.textContent = '\u25A1'; }
    } catch(e){ console.log('[WinCtrl] minimize err:', e); }
  };
  btnMax.onclick = () => {
    try {
      if (_isFullscreen && tg && tg.exitFullscreen) { tg.exitFullscreen(); _isFullscreen = false; btnMax.textContent = '\u25A1'; }
      else if (tg && tg.requestFullscreen) { tg.requestFullscreen(); _isFullscreen = true; btnMax.textContent = '\u25A3'; }
    } catch(e){ console.log('[WinCtrl] fullscreen err:', e); }
  };
  btnClose.onclick = () => { try { if (tg && tg.close) tg.close(); else window.close(); } catch(e){} };

  // Auto-hide after 3s, show on hover
  let ht = setTimeout(() => { bar.style.opacity = '0.2'; }, 3000);
  bar.onmouseenter = () => { bar.style.opacity = '1'; clearTimeout(ht); };
  bar.onmouseleave = () => { ht = setTimeout(() => { bar.style.opacity = '0.2'; }, 2000); };
}

// ============ DESKTOP PANEL ENGINE (PHASE 3) ============
let desktopConfig = null;
try { desktopConfig = JSON.parse(localStorage.getItem('cj_desktop_config')); } catch(e) {}
if (!desktopConfig) {
  desktopConfig = { left: [], right: ['notes', 'priority'] };
}

let _isDesktopApplied = false;

function _isTabPinned(tabId) {
  if (!_isDesktopApplied) return false;
  return desktopConfig.left.includes(tabId) || desktopConfig.right.includes(tabId);
}

function _updatePanelVisibility(side) {
  const panelId = side === 'left' ? 'panelLeft' : 'panelRight';
  const dividerId = side === 'left' ? 'dividerLeft' : 'dividerRight';
  const panel = document.getElementById(panelId);
  const divider = document.getElementById(dividerId);
  if (!panel) return;
  const hasContent = panel.children.length > 0;
  panel.style.display = hasContent ? 'flex' : 'none';
  if (divider) divider.style.display = hasContent ? 'block' : 'none';
}

function applyDesktopLayout() {
  if (window.innerWidth >= 1024) {
    if (_isDesktopApplied) return;
    _isDesktopApplied = true;

    ['left', 'right'].forEach(side => {
      const panel = document.getElementById(side === 'left' ? 'panelLeft' : 'panelRight');
      if (!panel) return;
      const tabIds = desktopConfig[side].filter(tabId => document.getElementById('tab-' + tabId));
      tabIds.forEach((tabId, i) => {
        const el = document.getElementById('tab-' + tabId);
        if (el) {
          el.classList.add('desktop-pinned');
          panel.appendChild(el);
          const tabBtn = document.querySelector(`#mainTabBar .tab[data-tab="${tabId}"]`);
          if (tabBtn) tabBtn.style.display = 'none';
          // Insert vertical divider between tabs (not after the last one)
          if (i < tabIds.length - 1) {
            const vdiv = document.createElement('div');
            vdiv.className = 'panel-vdivider';
            vdiv.dataset.above = 'tab-' + tabId;
            vdiv.dataset.below = 'tab-' + tabIds[i + 1];
            panel.appendChild(vdiv);
          }
        }
      });
      _updatePanelVisibility(side);
    });

    // Setup vertical dividers
    _initVerticalDividers();

    // Move tab bar into center panel so it resizes with center
    const tabBar = document.getElementById('mainTabBar');
    const centerPanel = document.getElementById('panelCenter');
    if (tabBar && centerPanel) {
      centerPanel.insertBefore(tabBar, centerPanel.firstChild);
    }

    // Restore saved widths
    _restorePanelWidths();
    _updateTabBarMode();

    // Trigger data loading for pinned tabs that otherwise never get switchMainTab called
    if (_isTabPinned('notes') && typeof initNotesTab === 'function') initNotesTab();
    if (_isTabPinned('priority') && typeof loadPriority === 'function' && !isFresh('priority')) loadPriority();
    if (_isTabPinned('unit') && typeof loadDashboard === 'function' && !isFresh('dashboard')) { loadDashboard(); loadProfiles(); }
    if (_isTabPinned('calendar') && typeof loadCalendar === 'function' && !isFresh('calendar')) loadCalendar();

    // If active tab was pinned, switch to another available one
    const activeTabObj = document.querySelector('#mainTabBar .tab.active');
    const activeTab = activeTabObj ? activeTabObj.dataset.tab : null;
    if (activeTab && _isTabPinned(activeTab)) {
      const firstAvail = Array.from(document.querySelectorAll('#mainTabBar .tab')).find(t => t.style.display !== 'none');
      if (firstAvail) firstAvail.click();
    }

    // Init resize dividers
    _initPanelDividers();

    // Re-render notes in board mode (they may have been in list mode from mobile)
    if (_isTabPinned('notes') && typeof renderNotes === 'function') {
      setTimeout(() => renderNotes(), 100);
    }
  } else {
    // Mobile mode
    if (!_isDesktopApplied) return;
    _isDesktopApplied = false;

    const center = document.getElementById('mainContent');
    if (!center) return;

    // Move tab bar back to header
    const tabBar = document.getElementById('mainTabBar');
    const header = document.querySelector('.header');
    if (tabBar && header) {
      header.appendChild(tabBar);
    }

    ['left', 'right'].forEach(side => {
      const panel = document.getElementById(side === 'left' ? 'panelLeft' : 'panelRight');
      // Remove vertical dividers first
      if (panel) panel.querySelectorAll('.panel-vdivider').forEach(v => v.remove());
      
      desktopConfig[side].forEach(tabId => {
        const el = document.getElementById('tab-' + tabId);
        if (el) {
          el.classList.remove('desktop-pinned');
          el.style.flex = '';
          el.style.height = '';
          center.appendChild(el);
          const tabBtn = document.querySelector(`#mainTabBar .tab[data-tab="${tabId}"]`);
          if (tabBtn) tabBtn.style.display = '';
        }
      });
      if (panel) { panel.style.display = 'none'; panel.style.width = ''; }
      const divider = document.getElementById(side === 'left' ? 'dividerLeft' : 'dividerRight');
      if (divider) divider.style.display = 'none';
    });

    // Hide auto-arrange button
    const arrangeBtn = document.getElementById('btnAutoArrange');
    if (arrangeBtn) arrangeBtn.style.display = 'none';

    // Re-render notes in list mode
    if (typeof renderNotes === 'function') {
      setTimeout(() => renderNotes(), 100);
    }

    if (typeof applyPermissions === 'function') applyPermissions();
    // Re-evaluate tab bar mode after restoring to header
    setTimeout(() => _updateTabBarMode(), 50);
  }
}

// ── Drag-to-resize ──
const PANEL_MIN_W = 120;
const CENTER_MIN_W = 200;
const PANEL_COLLAPSE_W = 140; // snap-collapse threshold

function _initPanelDividers() {
  _setupDivider('dividerLeft', 'panelLeft', 'left');
  _setupDivider('dividerRight', 'panelRight', 'right');
}

function _setupDivider(dividerId, panelId, side) {
  const divider = document.getElementById(dividerId);
  const panel = document.getElementById(panelId);
  if (!divider || !panel) return;

  // Remove old listeners by cloning
  const fresh = divider.cloneNode(true);
  divider.parentNode.replaceChild(fresh, divider);

  let startX, startW, otherStartW;

  fresh.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    const otherPanel = document.getElementById(side === 'left' ? 'panelRight' : 'panelLeft');
    otherStartW = (otherPanel && otherPanel.style.display !== 'none') ? otherPanel.getBoundingClientRect().width : 0;
    fresh.classList.add('dragging');
    document.body.classList.add('panel-resizing');

    const onMove = ev => {
      const delta = side === 'left' ? (ev.clientX - startX) : (startX - ev.clientX);
      const dividerW = 10;
      const totalAvail = window.innerWidth - dividerW;

      // Desired width for dragged panel
      let newW = Math.max(PANEL_MIN_W, startW + delta);

      // Space for center + other panel
      let remain = totalAvail - newW;
      let otherW = otherStartW;
      let centerW = remain - otherW;

      if (centerW < CENTER_MIN_W) {
        // Center hit min → shrink other panel
        centerW = CENTER_MIN_W;
        otherW = remain - centerW;
        if (otherW < PANEL_MIN_W) {
          otherW = PANEL_MIN_W;
          // Cap dragged panel
          newW = totalAvail - CENTER_MIN_W - PANEL_MIN_W;
        }
      }

      panel.style.width = newW + 'px';
      const otherPanel = document.getElementById(side === 'left' ? 'panelRight' : 'panelLeft');
      if (otherPanel && otherPanel.style.display !== 'none') {
        otherPanel.style.width = otherW + 'px';
      }
      _updateTabBarMode();
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      fresh.classList.remove('dragging');
      document.body.classList.remove('panel-resizing');
      _savePanelWidths();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function _savePanelWidths() {
  try {
    const l = document.getElementById('panelLeft');
    const r = document.getElementById('panelRight');
    const w = {};
    if (l && l.style.width) w.left = parseInt(l.style.width);
    if (r && r.style.width) w.right = parseInt(r.style.width);
    localStorage.setItem('cj_panel_widths', JSON.stringify(w));
  } catch(e) {}
}

// Toggle tab labels based on tab bar container width vs actual tab count
function _updateTabBarMode() {
  const tabBar = document.getElementById('mainTabBar');
  if (!tabBar) return;
  const parent = tabBar.parentElement;
  if (!parent) return;
  const w = parent.getBoundingClientRect().width;
  const visibleTabs = Array.from(tabBar.querySelectorAll('.tab')).filter(t => t.style.display !== 'none');
  const count = visibleTabs.length;
  if (count === 0) return;

  // Remove old mode classes + dropdown
  tabBar.classList.remove('tab-bar--wide', 'tab-bar--dropdown', 'tab-bar--compact');
  const existingDropdown = tabBar.querySelector('.tab-dropdown');
  if (existingDropdown) existingDropdown.remove();

  // Thresholds
  const wideThreshold = count * 90;   // icon + full text label

  if (w > wideThreshold) {
    tabBar.classList.add('tab-bar--wide');
  } else {
    // Compact mode: icon + short label, flex-wrap to fit all tabs
    tabBar.classList.add('tab-bar--compact');
  }
}

function _restorePanelWidths() {
  try {
    const w = JSON.parse(localStorage.getItem('cj_panel_widths'));
    if (!w) return;
    const l = document.getElementById('panelLeft');
    const r = document.getElementById('panelRight');
    const divW = 10;
    const total = window.innerWidth;
    const lw = w.left || 320;
    const rw = w.right || 320;
    // Validate: both panels + center must fit
    if (lw + rw + CENTER_MIN_W + divW > total) return; // skip restore, use defaults
    if (w.left && l && l.style.display !== 'none') l.style.width = lw + 'px';
    if (w.right && r && r.style.display !== 'none') r.style.width = rw + 'px';
  } catch(e) {}
}

// ── Vertical resize between stacked tabs ──
function _initVerticalDividers() {
  document.querySelectorAll('.panel-vdivider').forEach(div => {
    const above = document.getElementById(div.dataset.above);
    const below = document.getElementById(div.dataset.below);
    if (!above || !below) return;

    div.addEventListener('mousedown', e => {
      e.preventDefault();
      const startY = e.clientY;
      const aboveH = above.getBoundingClientRect().height;
      const belowH = below.getBoundingClientRect().height;
      div.classList.add('dragging');
      document.body.classList.add('panel-resizing');

      // Switch from flex:1 to explicit heights for both
      above.style.flex = 'none';
      below.style.flex = 'none';
      above.style.height = aboveH + 'px';
      below.style.height = belowH + 'px';

      const onMove = ev => {
        const delta = ev.clientY - startY;
        const newAbove = Math.max(80, aboveH + delta);
        const newBelow = Math.max(80, belowH - delta);
        above.style.height = newAbove + 'px';
        below.style.height = newBelow + 'px';
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        div.classList.remove('dragging');
        document.body.classList.remove('panel-resizing');
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

window.addEventListener('resize', () => {
  applyDesktopLayout();
  _updateTabBarMode();
});

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) {
    tg.ready();
    tg.expand();
    // Do NOT auto-fullscreen — let user control via window buttons
    _injectWindowControls();
  }
  // PIN lock check — show overlay BEFORE any data loads
  _showPinLock();
  // Wait for PIN unlock before proceeding (poll every 200ms, max 5 min)
  if (_isPinEnabled() && !_pinUnlocked) {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (_pinUnlocked) { clearInterval(check); resolve(); }
      }, 200);
      // Safety: auto-resolve after 5 min to prevent infinite wait
      setTimeout(() => { clearInterval(check); resolve(); }, 300000);
    });
  }
  initCustomAutocomplete();
  try {
    // ── Bước 1: Song song — positions + staffInfo (không phụ thuộc nhau) ──
    const [, ok] = await Promise.all([loadPositions(), loadStaffInfo()]);
    if (!ok) return; // Access denied — stop here

    if (window.isGuestMode) {
      const header = document.querySelector('.header');
      if (header) header.style.display = 'none';
      const pid = _getDeepLinkProfileId();
      await openGuestProfile(pid);
      return; // Stop standard app loading
    }

    // ── Bước 2: Song song — semesters + structure ──
    // structure cần xong trước profiles/dashboard để tính unit scope
    await Promise.allSettled([loadSemesters(), loadStructure()]);

    // ── Bước 3: Song song — profiles + staff ──
    // profiles cần xong trước dashboard (dashboard đọc allProfiles)
    await Promise.allSettled([loadProfiles(), loadStaff()]);

    // ── Bước 4: Dashboard (đọc allProfiles đã load ở bước 3) ──
    await loadDashboard();

    // Deep link + layout
    _handleDeepLink();
    applyDesktopLayout();
    _updateTabBarMode();
  } catch(e) {
    console.error('Init error:', e);
    _clearLoadingStates();
  }
});

// ============ DEEP LINK HANDLER ============
function _getDeepLinkProfileId() {
  // 1. URL query param ?profile=UUID
  try { var p = new URLSearchParams(location.search).get('profile'); if (p) return p; } catch(e) {}
  // 2. Telegram hash: #tgWebAppStartParam=UUID&...
  try {
    var h = location.hash.substring(1);
    if (h) { var sp = new URLSearchParams(h).get('tgWebAppStartParam'); if (sp) return sp; }
  } catch(e) {}
  // 3. Telegram SDK parsed
  try {
    var s = window.Telegram && Telegram.WebApp && Telegram.WebApp.initDataUnsafe && Telegram.WebApp.initDataUnsafe.start_param;
    if (s) return s;
  } catch(e) {}
  return null;
}

let _deepLinkHandled = false;
function _handleDeepLink() {
  var pid = _getDeepLinkProfileId();
  if (!pid || _deepLinkHandled) return;
  _deepLinkHandled = true;
  // Deep link: opening profile
  if (typeof openProfileById === 'function' && allProfiles && allProfiles.length > 0) {
    openProfileById(pid);
  }
}

async function openGuestProfile(pid) {
  try {
    const res = await sbFetch(`/rest/v1/profiles?id=eq.${pid}&select=*,fruit_groups(fruit_roles(staff_code,role_type))`);
    const data = await res.json();
    if (!data.length) {
      document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:16px;color:#b45309;padding:24px;text-align:center;background:#fff;z-index:999999;position:fixed;top:0;left:0;width:100%;">⚠️ Không tìm thấy hồ sơ hoặc đã bị xoá.</div>';
      return;
    }
    allProfiles = data; // Set the single profile as the only one available
    
    if (typeof openProfileById === 'function') {
      openProfileById(pid);
      
      // Visual adjustments for guest
      const detailView = document.getElementById('detailView');
      if (detailView) detailView.style.paddingTop = '12px'; // No header present
      const mainTabBar = document.getElementById('mainTabBar');
      if (mainTabBar) mainTabBar.style.display = 'none';
      const fabBtn = document.getElementById('fabBtn');
      if (fabBtn) fabBtn.style.display = 'none';
      
      // Ensure back button is hidden (wait for render first)
      setTimeout(() => {
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) backBtn.style.display = 'none';
      }, 100);
    }
  } catch(e) {
    console.error('Guest load error:', e);
  }
}

// Case 2: App already open — Telegram may update hash when user clicks deep link again
window.addEventListener('hashchange', function() {
  _deepLinkHandled = false; // reset so new deep link can fire
  if (allProfiles && allProfiles.length > 0) _handleDeepLink();
});

async function loadStaffInfo() {
  const userId = tg?.initDataUnsafe?.user?.id;
  const deepLinkPid = _getDeepLinkProfileId();

  if (!userId) {
    if (deepLinkPid) {
      window.isGuestMode = true;
      document.body.classList.add('guest-mode');
      return true;
    }
    document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:18px;color:red;padding:20px;text-align:center;background:#fff;z-index:999999;position:fixed;top:0;left:0;width:100%;">⚠️ Truy cập bị từ chối.<br>Vui lòng mở ứng dụng qua Telegram để xác thực danh tính.</div>';
    return false; // Signal failure — caller will stop init chain
  }
  try {
    const res = await sbFetch(`/rest/v1/staff?telegram_id=eq.${userId}&select=*`);
    if (!res.ok) throw new Error('Network error: ' + res.status);
    const data = await res.json();
    if (data.length > 0) {
      myStaff = data[0];
      let badgeText = `${myStaff.staff_code} · ${getPositionName(myStaff.position)}`;
      if (myStaff.specialist_position) badgeText += ` + ${getPositionName(myStaff.specialist_position)}`;
      const badgeEl = document.getElementById('staffBadge');
      if (badgeEl) badgeEl.textContent = badgeText;
      // Populate header avatar + nickname
      const headerAv = document.getElementById('headerAvatar');
      if (headerAv) {
        const displayName = myStaff.nickname || myStaff.full_name || '?';
        const letter = displayName[0];
        const avatarHtml = typeof renderAnimatedAvatar === 'function'
          ? renderAnimatedAvatar(letter, myStaff.staff_avatar_color || '', 'md')
          : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${letter}</div>`;
        headerAv.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openPersonalizationPanel()" title="Cá nhân hoá">
            <div style="padding:2px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.15));box-shadow:0 0 12px rgba(255,255,255,0.2);">
              ${avatarHtml}
            </div>
            <div style="display:flex;flex-direction:column;gap:1px;">
              <span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.97);text-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1.2;">${displayName}</span>
              <span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.6);line-height:1;">Hệ thống quản lý</span>
            </div>
          </div>`;
        headerAv.style.display = 'block';
      }
      if (hasPermission('manage_positions')) {
        const bar = document.getElementById('viewAsBar');
        if (bar) bar.classList.add('active');
      }
      // Apply saved personalization
      if (myStaff.preferences && typeof applyUserPreferences === 'function') applyUserPreferences(myStaff.preferences);
      try {
        const allRes = await sbFetch('/rest/v1/staff?select=full_name,staff_code,nickname,gender,birth_year,bio,avatar_emoji,motto,position,specialist_position,telegram_id');
        const allS = await allRes.json();
        allStaff = allS;
        const dl = document.getElementById('staffSuggest');
        if (dl) dl.innerHTML = allS.map(s=>`<option value="${s.full_name} (${s.staff_code})">`).join('');
      } catch(e2) { console.warn('loadStaffInfo - allStaff fetch failed:', e2); }
    } else {
      if (deepLinkPid) {
        window.isGuestMode = true;
        document.body.classList.add('guest-mode');
        return true;
      }
      // Telegram user exists but not in staff table
      document.body.innerHTML = '<div style="display:flex;height:100vh;align-items:center;justify-content:center;font-size:16px;color:#b45309;padding:24px;text-align:center;background:#fff;z-index:999999;position:fixed;top:0;left:0;width:100%;">⚠️ Tài khoản của bạn chưa được đăng ký trong hệ thống.<br><br>Vui lòng liên hệ quản trị viên để được thêm vào.</div>';
      return false;
    }
  } catch(e) {
    console.error('loadStaffInfo error:', e);
    if (deepLinkPid) {
      window.isGuestMode = true;
      document.body.classList.add('guest-mode');
      return true;
    }
  }
  applyPermissions();
  _authChecked = true; // Security flag: cho phép security guard trong sbFetch hoạt động
  return true;
}

// Clear all "\u0110ang t\u1ea3i..." loading states when init fails or errors occur
function _clearLoadingStates() {
  const loadingIds = ['dashHapjaList','dashMyList','dashUnitList','dashSubUnits','dashPersonalMetrics','profileList','staffList'];
  loadingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">\u26a0\ufe0f Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u. Vui l\u00f2ng m\u1edf l\u1ea1i \u1ee9ng d\u1ee5ng.</div>';
  });
}

// ============ NAVIGATION ============
function backToList() {
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
  ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure'].forEach(t=>{
    const elT = document.getElementById(t);
    if (elT && (typeof _isTabPinned !== 'function' || !_isTabPinned(t.replace('tab-','')))) {
      elT.style.display='none';
    }
  });
  const tTab = document.getElementById('tab-'+activeTab);
  if (tTab && (typeof _isTabPinned !== 'function' || !_isTabPinned(activeTab))) {
    tTab.style.display = 'block';
  }
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
  if (typeof _isTabPinned === 'function' && _isTabPinned(tab) && window.innerWidth >= 1024) return;
  
  document.querySelectorAll('#mainTabBar .tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure','tab-reports','tab-notes'].forEach(t=>{
    const elT = document.getElementById(t);
    if (elT && (typeof _isTabPinned !== 'function' || !_isTabPinned(t.replace('tab-','')))) {
      elT.style.display='none';
    }
  });
  const tTab = document.getElementById('tab-'+tab);
  if (tTab && (typeof _isTabPinned !== 'function' || !_isTabPinned(tab))) {
    tTab.style.display = 'block';
  }
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (tab==='unit'||tab==='personal') ? 'flex' : 'none';
  // Only re-fetch if data is stale (>30s old). Writes invalidate cache automatically.
  if (tab==='unit') { if (!isFresh('dashboard')) loadDashboard(); if (!isFresh('profiles')) loadProfiles(); }
  if (tab==='personal') { if (!isFresh('dashboard')) loadDashboard(); }
  if (tab==='staff') { if (!isFresh('staff')) loadStaff(); }
  if (tab==='structure') { if (!isFresh('structure')) loadStructure(); }
  if (tab==='calendar' && typeof loadCalendar === 'function') { if (!isFresh('calendar')) loadCalendar(); }
  if (tab==='priority' && typeof loadPriority === 'function') { if (!isFresh('priority')) loadPriority(); }
  if (tab==='reports' && typeof loadReports === 'function') { if (!isFresh('reports')) loadReports(); }
  if (tab==='notes' && typeof initNotesTab === 'function') { initNotesTab(); }
  // Stop notes poll when leaving notes tab
  if (tab !== 'notes' && typeof stopNotesPoll === 'function') stopNotesPoll();

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
  if (structTab) structTab.style.display = _isTabPinned('structure') ? 'none' : '';
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
  if (tabStaffBtn) tabStaffBtn.style.display = hasPermission('manage_positions') && !_isTabPinned('staff') ? '' : 'none';
  
  // Tab Báo cáo: visible for GYJN+ (anyone with team scope or higher)
  const tabReportsBtn = document.getElementById('tabReportsBtn');
  if (tabReportsBtn) {
    const scope = getScope();
    const pos = getCurrentPosition();
    const showReports = ['team','group','area','system'].includes(scope) || ['gyjn','bgyjn','tjn','yjyn','admin'].includes(pos);
    tabReportsBtn.style.display = showReports && !_isTabPinned('reports') ? '' : 'none';
  }
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
  const d = window._unitPopupData || {};
  let title = '', items = [];

  function makeProfileItem(x, extraMeta) {
    const p = x.profile;
    const pid = x.role?.fruit_groups?.profile_id;
    if (!p || !pid) return '';
    const ph = p.phase || 'chakki';
    const phLabel = PHASE_LABELS[ph] || ph;
    const phColor = PHASE_COLORS[ph] || '#888';
    return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;"
      onclick="openProfileById('${pid}');closeModal('unitPopupModal')">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="font-weight:700;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.full_name || '---'}</div>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${phColor};color:white;white-space:nowrap;">${phLabel}</span>
      </div>
      ${extraMeta ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;">${extraMeta}</div>` : ''}
    </div>`;
  }

  function makeHapjaItem(h) {
    return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;"
      onclick="${h.profile_id ? `openProfileById('${h.profile_id}');closeModal('unitPopupModal')` : ''}">
      <div style="font-weight:700;font-size:13px;">${h.full_name || '???'}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${h.data?.ndd_staff_code || h.created_by} · ${shinDate(h.created_at)}</div>
    </div>`;
  }

  if (type === 'hapja') {
    title = '🍎 Trái Hapja (đã duyệt)';
    // Fallback to window._approvedHapjaList in case closure data lost
    const hapjaSource = (d.cumHapja?.length ? d.cumHapja : null)
      || window._approvedHapjaList || [];
    items = hapjaSource.map(makeHapjaItem);

  } else if (type === 'chakki') {
    title = '🟡 Chakki (đang ở giai đoạn Chakki)';
    items = (d.phChakki || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'tvhinh') {
    title = '🖼️ TV Hình (tích luỹ — đã lên TV Hình trở lên)';
    items = (d.cumTVHinh || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'tvhinh_phase') {
    title = '🖼️ TV Hình (đang ở giai đoạn TV Hình)';
    items = (d.phTVHinh || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'grouptv') {
    title = '💬 Group TV (tích luỹ — đã lên Group TV trở lên)';
    items = (d.cumGroupTV || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'grouptv_phase') {
    title = '💬 Group TV (đang ở giai đoạn Tư Vấn)';
    items = (d.phGroupTV || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'groupbb') {
    title = '🎓 Group BB (tích luỹ — đã lên BB trở lên)';
    items = (d.cumGroupBB || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'groupbb_phase') {
    title = '🎓 Group BB (đang ở giai đoạn BB)';
    items = (d.phGroupBB || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else if (type === 'center') {
    const isCum = window._dashMode === 'cumulative';
    title = isCum ? '🏛️ Center (tích luỹ)' : '🏛️ Center (đang ở giai đoạn Center)';
    items = (isCum ? d.cumCenter : d.phCenter || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));

  } else {
    // Legacy fallback types (wait_tv, tvv, gvbb, bbgroup, etc.)
    const legacyMap = {
      wait_tv: window._unitWaitTV,
      tvv: window._unitTvvFruits,
      gvbb: window._unitGvbbFruits,
    };
    title = type;
    const list = legacyMap[type] || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard ? renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      }) : '';
    });
  }

  document.getElementById('unitPopupTitle').textContent = title;
  document.getElementById('unitPopupBody').innerHTML = items.length
    ? items.join('')
    : '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có dữ liệu</div>';
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

// ============ FRUIT STATUS TOGGLE (3-way: alive / pause / dropout) ============
async function toggleFruitStatus(profileId, current) {
  // Show 3-option picker
  const newStatus = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border-radius:16px;padding:20px;min-width:260px;max-width:320px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    box.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:16px;color:var(--text1);">Chuyển trạng thái</div>`;
    const options = [
      { val: 'alive',   label: '🟢 Alive',    color: 'var(--green)', bg: 'rgba(52,211,153,0.12)' },
      { val: 'pause',   label: '⏸️ Pause',    color: '#9ca3af',       bg: 'rgba(156,163,175,0.12)' },
      { val: 'dropout', label: '🔴 Drop-out', color: 'var(--red)',    bg: 'rgba(248,113,113,0.12)' }
    ];
    options.forEach(o => {
      const isCurrent = o.val === current;
      const btn = document.createElement('button');
      btn.textContent = isCurrent ? `${o.label} (hiện tại)` : o.label;
      btn.disabled = isCurrent;
      btn.style.cssText = `display:block;width:100%;padding:10px;margin-bottom:8px;border-radius:10px;border:1.5px solid ${isCurrent ? o.color : 'var(--border)'};background:${isCurrent ? o.bg : 'var(--bg2)'};color:${o.color};font-size:13px;font-weight:700;cursor:${isCurrent ? 'default' : 'pointer'};opacity:${isCurrent ? '0.5' : '1'};`;
      if (!isCurrent) btn.onclick = () => { overlay.remove(); resolve(o.val); };
      box.appendChild(btn);
    });
    const cancel = document.createElement('button');
    cancel.textContent = 'Huỷ';
    cancel.style.cssText = 'display:block;width:100%;padding:8px;border:none;background:transparent;color:var(--text3);font-size:12px;cursor:pointer;margin-top:4px;';
    cancel.onclick = () => { overlay.remove(); resolve(null); };
    box.appendChild(cancel);
    overlay.appendChild(box);
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
    document.body.appendChild(overlay);
  });
  if (!newStatus || newStatus === current) return;

  const label = newStatus === 'dropout' ? 'Drop-out' : newStatus === 'pause' ? 'Pause' : 'Alive';

  // Ask reason for pause/dropout
  let reason = '';
  if (newStatus === 'dropout' || newStatus === 'pause') {
    const prompt_label = newStatus === 'dropout' ? 'Nhập lý do Drop-out (có thể để trống):' : 'Nhập lý do Pause (có thể để trống):';
    reason = prompt(prompt_label);
    if (reason === null) return;
    reason = reason.trim();
  }

  if (!await showConfirmAsync(`Chuyển trạng thái trái quả thành "${label}"?`)) return;
  try {
    const patchBody = { fruit_status: newStatus };
    if (newStatus === 'dropout' || newStatus === 'pause') patchBody.dropout_reason = reason;
    else patchBody.dropout_reason = null;

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

    let updatedProfile = null;
    try {
      const patchData = await patchRes.json();
      if (Array.isArray(patchData) && patchData[0]) updatedProfile = patchData[0];
    } catch(e) {}

    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) {
      if (updatedProfile) {
        allProfiles[idx] = updatedProfile;
      } else {
        allProfiles[idx].fruit_status = newStatus;
        allProfiles[idx].dropout_reason = patchBody.dropout_reason;
      }
      if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(profileId);
      openProfile(allProfiles[idx]);
    }

    // Add timeline record
    try {
      const recType = newStatus === 'dropout' ? 'drop_out' : newStatus === 'pause' ? 'pause' : 'alive';
      const _cn = newStatus === 'dropout' ? { reason: reason || 'Không có lý do' }
               : newStatus === 'pause'   ? { reason: reason || 'Tạm dừng' }
               : { note: 'Chuyển lại trạng thái Alive' };
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
      // mo_kt record created
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
      // profile is_kt_opened updated
      
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
  // Update preview bar if open
  const bar = document.getElementById('pref_preview_bar');
  if (bar) bar.style.background = hex;
}

function _applyTabOrder(order, hidden = []) {
  const bar = document.getElementById('mainTabBar');
  if (!bar) return;
  const hiddenSet = new Set(hidden);

  // Merge: if saved order is missing some ALL_TABS_DEF keys, append them
  const allKeys = ALL_TABS_DEF.map(t => t.key);
  const mergedOrder = [...order];
  allKeys.forEach(k => {
    if (!mergedOrder.includes(k)) mergedOrder.push(k);
  });

  mergedOrder.forEach(key => {
    const tab = bar.querySelector(`[data-tab="${key}"]`);
    if (!tab) return;
    bar.appendChild(tab);  // reorder
    if (key === 'staff') return; // staff tab visibility controlled by applyPermissions
    if (key === 'reports') return; // reports visibility controlled by applyPermissions
    tab.style.display = hiddenSet.has(key) ? 'none' : '';
  });
  // Refresh compact styling after reorder
  _updateTabBarMode();
}

// ── Open Panel ──
function openPersonalizationPanel() {
  const prefs = myStaff?.preferences || {};
  const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6af7';
  const hex0 = /^#[0-9a-fA-F]{6}$/.test(currentAccent) ? currentAccent : '#7c6af7';
  const [h0,s0,l0] = _hexToHsl(hex0);
  const [r0,g0,b0] = _hexToRgb(hex0);
  // Build currentOrder: merge saved preferences with ALL_TABS_DEF (append new tabs)
  const savedOrder = prefs.tab_order || [];
  const allKeys = ALL_TABS_DEF.map(t => t.key);
  const currentOrder = [...savedOrder];
  allKeys.forEach(k => { if (!currentOrder.includes(k)) currentOrder.push(k); });
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
        <!-- ═══ DESKTOP LAYOUT ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">🖥️ BỐ CỤC DESKTOP <span style="font-weight:400;color:var(--text3);">(chỉ hiện khi mở rộng)</span></div>
        <div style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:14px;margin-bottom:16px;">
          <!-- Visual preview -->
          <div id="desktopLayoutPreview" style="display:flex;gap:4px;height:60px;margin-bottom:14px;border-radius:8px;overflow:hidden;border:1px solid var(--border);font-size:10px;font-weight:600;color:var(--text2);">
            <div id="dlpLeft" style="flex:0 0 28%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-right:2px solid var(--accent);"></div>
            <div style="flex:1;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:9px;">CENTER</div>
            <div id="dlpRight" style="flex:0 0 28%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-left:2px solid var(--accent);"></div>
          </div>
          <!-- Left panel config -->
          <div style="margin-bottom:10px;">
            <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px;">◀ Panel Trái</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div>
                <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Trên</div>
                <select id="dl_left_top" onchange="_updateDesktopLayoutPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
                  ${_renderPanelTabOptions('left_top')}
                </select>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Dưới</div>
                <select id="dl_left_bottom" onchange="_updateDesktopLayoutPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
                  ${_renderPanelTabOptions('left_bottom')}
                </select>
              </div>
            </div>
          </div>
          <!-- Right panel config -->
          <div style="margin-bottom:12px;">
            <div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px;">▶ Panel Phải</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
              <div>
                <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Trên</div>
                <select id="dl_right_top" onchange="_updateDesktopLayoutPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
                  ${_renderPanelTabOptions('right_top')}
                </select>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text3);margin-bottom:3px;">Dưới</div>
                <select id="dl_right_bottom" onchange="_updateDesktopLayoutPreview()" style="width:100%;padding:8px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:12px;">
                  ${_renderPanelTabOptions('right_bottom')}
                </select>
              </div>
            </div>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="_applyDesktopConfig()" style="flex:1;padding:10px;background:var(--accent);color:white;border:none;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">✅ Áp dụng</button>
            <button onclick="_resetDesktopConfig()" style="padding:10px 14px;background:none;color:var(--text3);border:1px solid var(--border);border-radius:10px;font-size:12px;cursor:pointer;">↩ Reset</button>
          </div>
          <div style="font-size:10px;color:var(--text3);margin-top:8px;text-align:center;">💡 Bố cục chỉ hiện khi dùng màn hình rộng (≥1024px)</div>
        </div>
        <div style="height:1px;background:var(--border);margin:16px 0;"></div>
        <!-- ═══ HỒ SƠ TĐ ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">👤 HỒ SƠ CÁ NHÂN TĐ</div>
        <div style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border);">
            <div style="width:46px;height:46px;border-radius:14px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;flex-shrink:0;">${(myStaff?.full_name||'?')[0]}</div>
            <div>
              <div style="font-weight:700;font-size:14px;">${myStaff?.full_name||'---'}</div>
              <div style="font-size:11px;color:var(--text3);">${myStaff?.staff_code||''} · ${getPositionName(myStaff?.position)}${getStaffUnit(myStaff?.staff_code) ? ' · <span style="color:var(--accent);">' + getStaffUnit(myStaff.staff_code) + '</span>' : ''}</div>
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Nickname <span style="color:var(--text3);font-weight:400;">(tên tự đặt, khác với mã JD)</span></label>
            <input type="text" id="prof_nickname" value="${(myStaff?.nickname||'').replace(/"/g,'&quot;')}" placeholder="Ví dụ: Khải, Phi, Hoa..."
              oninput="const v=this.value.trim();document.getElementById('nickname_preview').textContent=v||'(chưa đặt)';"
              style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" maxlength="40" />
            <div style="font-size:10px;color:var(--text3);margin-top:3px;">Tên viết tắt: <b>${myStaff?.staff_code?.split('-')[1] || myStaff?.staff_code||''}</b> &nbsp;·&nbsp; Nickname: <b id="nickname_preview">${myStaff?.nickname||'(chưa đặt)'}</b></div>
          </div>
          <!-- AVATAR ANIMATED STYLE -->
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:6px;">🎨 Avatar (nhấn để chọn phong cách)</label>
            <div style="display:flex;align-items:center;gap:14px;">
              <div id="staffAvatarPreviewBox" onclick="_openStaffAvatarPicker()" style="cursor:pointer;">
                ${typeof renderAnimatedAvatar==='function' ? renderAnimatedAvatar(((myStaff?.nickname||myStaff?.full_name||'?')[0]), myStaff?.staff_avatar_color||'', 'md') : '<div style="width:56px;height:56px;border-radius:16px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:white;">'+((myStaff?.full_name||'?')[0])+'</div>'}
              </div>
              <div style="flex:1;">
                <div style="font-size:12px;color:var(--text2);margin-bottom:6px;">Nhấn avatar để chọn 11 phong cách animated + emoji tuỳ chỉnh</div>
                <button onclick="_openStaffAvatarPicker()" style="padding:8px 16px;border-radius:8px;border:1px solid var(--accent);background:rgba(99,102,241,0.08);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer;">🎨 Đổi phong cách Avatar</button>
              </div>
            </div>
            <input type="hidden" id="prof_staff_avatar_color" value="${myStaff?.staff_avatar_color||''}" />
            <input type="hidden" id="prof_avatar_emoji" value="" />
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:end;">
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Giới tính</label>
              <select id="prof_gender" data-val="${myStaff?.gender||''}"
                style="width:100%;padding:9px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;">
                <option value="">Chưa chọn</option>
                <option value="Nam">Nam</option>
                <option value="Nu">Nữ</option>
              </select>
            </div>
            <div>
              <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">Năm sinh</label>
              <input type="text" id="prof_birth_year" value="${myStaff?.birth_year||''}" placeholder="YYYY" maxlength="4"
                style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" />
            </div>
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">💪 Sở trường Jondo</label>
            <input type="text" id="prof_motto" value="${(myStaff?.motto||'').replace(/"/g,'&quot;')}" placeholder="VD: Tư vấn, Giáo viên BB, Kết nối..." maxlength="80"
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
        <div style="height:1px;background:var(--border);margin:16px 0;"></div>
        <!-- ═══ KHOÁ PIN ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">🔐 BẢO MẬT</div>
        <div id="pinToggleArea" style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:16px;"></div>
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
    const gMap = { 'Nam':'Nam', 'Nữ':'Nu', 'Nu':'Nu' };

    gSel.value = gMap[gVal] || '';

  }
  // Initialize PIN toggle after DOM is ready
  _refreshPinToggle();

  // Set initial values for desktop layout dropdowns
  setTimeout(() => {
    const lt = document.getElementById('dl_left_top');
    const lb = document.getElementById('dl_left_bottom');
    const rt = document.getElementById('dl_right_top');
    const rb = document.getElementById('dl_right_bottom');
    if (lt) lt.value = desktopConfig.left[0] || '';
    if (lb) lb.value = desktopConfig.left[1] || '';
    if (rt) rt.value = desktopConfig.right[0] || '';
    if (rb) rb.value = desktopConfig.right[1] || '';
    _updateDesktopLayoutPreview();
  }, 50);
}

// ============ DESKTOP LAYOUT CONFIG HELPERS ============
const _DL_TAB_MAP = {
  unit: '🏢 Đơn vị',
  personal: '👤 Cá nhân',
  priority: '⚡ Ưu tiên',
  calendar: '📅 Lịch',
  notes: '📝 Notes',
  staff: '👥 TĐ',
  structure: '🏗️ Cơ cấu',
  reports: '📊 Báo cáo'
};
const _DL_ASSIGNABLE = ['personal','priority','calendar','notes','staff'];

function _renderPanelTabOptions(slot) {
  let html = '<option value="">— Không —</option>';
  _DL_ASSIGNABLE.forEach(key => {
    html += `<option value="${key}">${_DL_TAB_MAP[key]}</option>`;
  });
  return html;
}

function _updateDesktopLayoutPreview() {
  const lt = document.getElementById('dl_left_top')?.value || '';
  const lb = document.getElementById('dl_left_bottom')?.value || '';
  const rt = document.getElementById('dl_right_top')?.value || '';
  const rb = document.getElementById('dl_right_bottom')?.value || '';

  const leftEl = document.getElementById('dlpLeft');
  const rightEl = document.getElementById('dlpRight');
  if (!leftEl || !rightEl) return;

  const renderPanel = (top, bot) => {
    if (!top && !bot) return '<span style="font-size:9px;color:var(--text3);">Ẩn</span>';
    let h = '';
    if (top) h += `<div style="font-size:10px;">${_DL_TAB_MAP[top]?.split(' ')[0] || ''} ${_DL_TAB_MAP[top]?.split(' ').slice(1).join(' ') || ''}</div>`;
    if (top && bot) h += '<div style="width:80%;height:1px;background:var(--border);"></div>';
    if (bot) h += `<div style="font-size:10px;">${_DL_TAB_MAP[bot]?.split(' ')[0] || ''} ${_DL_TAB_MAP[bot]?.split(' ').slice(1).join(' ') || ''}</div>`;
    return h;
  };

  leftEl.innerHTML = renderPanel(lt, lb);
  rightEl.innerHTML = renderPanel(rt, rb);

  // Gray out panel if no tabs
  leftEl.style.opacity = (!lt && !lb) ? '0.4' : '1';
  rightEl.style.opacity = (!rt && !rb) ? '0.4' : '1';
}

function _applyDesktopConfig() {
  const lt = document.getElementById('dl_left_top')?.value || '';
  const lb = document.getElementById('dl_left_bottom')?.value || '';
  const rt = document.getElementById('dl_right_top')?.value || '';
  const rb = document.getElementById('dl_right_bottom')?.value || '';

  const left = [lt, lb].filter(Boolean);
  const right = [rt, rb].filter(Boolean);

  // Check for duplicates
  const all = [...left, ...right];
  const unique = new Set(all);
  if (all.length !== unique.size) {
    showToast('⚠️ Không thể gán cùng 1 tab cho nhiều vị trí!');
    return;
  }

  // First: restore all currently pinned tabs back to center
  const center = document.getElementById('mainContent');
  if (center) {
    ['left', 'right'].forEach(side => {
      const panel = document.getElementById(side === 'left' ? 'panelLeft' : 'panelRight');
      if (panel) panel.querySelectorAll('.panel-vdivider').forEach(v => v.remove());
      desktopConfig[side].forEach(tabId => {
        const el = document.getElementById('tab-' + tabId);
        if (el) {
          el.classList.remove('desktop-pinned');
          el.style.flex = '';
          el.style.height = '';
          center.appendChild(el);
          const tabBtn = document.querySelector(`#mainTabBar .tab[data-tab="${tabId}"]`);
          if (tabBtn) tabBtn.style.display = '';
        }
      });
    });
  }

  // Update config
  desktopConfig = { left, right };
  try { localStorage.setItem('cj_desktop_config', JSON.stringify(desktopConfig)); } catch(e) {}

  // Force re-apply desktop layout
  _isDesktopApplied = false;
  applyDesktopLayout();
  
  showToast('✅ Đã cập nhật bố cục desktop!');
  const modal = document.getElementById('personalizationModal');
  if (modal) modal.remove();
}

function _resetDesktopConfig() {
  // First: restore all currently pinned tabs back to center
  const center = document.getElementById('mainContent');
  if (center) {
    ['left', 'right'].forEach(side => {
      const panel = document.getElementById(side === 'left' ? 'panelLeft' : 'panelRight');
      if (panel) panel.querySelectorAll('.panel-vdivider').forEach(v => v.remove());
      desktopConfig[side].forEach(tabId => {
        const el = document.getElementById('tab-' + tabId);
        if (el) {
          el.classList.remove('desktop-pinned');
          el.style.flex = '';
          el.style.height = '';
          center.appendChild(el);
          const tabBtn = document.querySelector(`#mainTabBar .tab[data-tab="${tabId}"]`);
          if (tabBtn) tabBtn.style.display = '';
        }
      });
    });
  }

  desktopConfig = { left: [], right: ['notes', 'priority'] };
  try { localStorage.setItem('cj_desktop_config', JSON.stringify(desktopConfig)); } catch(e) {}

  // Update UI
  const lt = document.getElementById('dl_left_top');
  const lb = document.getElementById('dl_left_bottom');
  const rt = document.getElementById('dl_right_top');
  const rb = document.getElementById('dl_right_bottom');
  if (lt) lt.value = '';
  if (lb) lb.value = '';
  if (rt) rt.value = 'notes';
  if (rb) rb.value = 'priority';
  _updateDesktopLayoutPreview();

  // Force re-apply
  _isDesktopApplied = false;
  applyDesktopLayout();
  
  showToast('↩ Đã reset bố cục về mặc định!');
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
  const gMap       = { 'Nam':'Nam', 'Nu':'Nữ' };
  const gender     = gMap[gRaw] || null;

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
    const staff_avatar_color = document.getElementById('prof_staff_avatar_color')?.value || null;
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH',
      body: JSON.stringify({ nickname, gender, birth_year, bio, avatar_emoji, motto, staff_avatar_color })
    });
    // Update local cache
    Object.assign(myStaff, { nickname, gender, birth_year, bio, avatar_emoji, motto, staff_avatar_color });
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
    // Refresh header avatar
    const headerAv = document.getElementById('headerAvatar');
    if (headerAv) {
      const dn = myStaff.nickname || myStaff.full_name || '?';
      const lt = dn[0];
      const avH = typeof renderAnimatedAvatar === 'function'
        ? renderAnimatedAvatar(lt, myStaff.staff_avatar_color || '', 'md')
        : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${lt}</div>`;
      headerAv.innerHTML = `<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openPersonalizationPanel()" title="Cá nhân hoá"><div style="padding:2px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.15));box-shadow:0 0 12px rgba(255,255,255,0.2);">${avH}</div><div style="display:flex;flex-direction:column;gap:1px;"><span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.97);text-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1.2;">${dn}</span><span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.6);line-height:1;">Hệ thống quản lý</span></div></div>`;
      headerAv.style.display = 'block';
    }
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  } catch(e) {
    showToast('❌ Lỗi lưu hồ sơ'); console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '💾 Lưu hồ sơ TĐ'; }
  }
}

// -- Hien thi ho so TD khi bam ma TD trong ho so trai qua --
function showStaffCard(code) {
  var s = allStaff.find(function(x){ return x.staff_code === code; });
  if (!s) { showToast('Khong tim thay: ' + code); return; }
  var existing = document.getElementById('staffCardModal');
  if (existing) existing.remove();
  var avatar = (s.nickname || s.full_name || '?')[0];
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
          '<div style="font-weight:700;font-size:16px;">' + (s.nickname || s.full_name) + '</div>' +
          (s.nickname ? '<div style="font-size:12px;color:var(--text3);">' + s.full_name + ' (' + s.staff_code + ')</div>' : '<div style="font-size:12px;color:var(--text3);">' + s.staff_code + '</div>') +
          '<div style="margin-top:4px;">' +
            '<span class="staff-role-badge ' + getBadgeClass(s.position) + '" style="font-size:10px;padding:3px 10px;">' + getPositionName(s.position) + '</span>' +
            (s.specialist_position ? ' <span class="staff-role-badge" style="font-size:10px;padding:3px 10px;background:rgba(139,92,246,0.15);color:#7c3aed;border:1px solid rgba(139,92,246,0.3);">' + getPositionName(s.specialist_position) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +
      (unit ? '<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:10px;">&\#127962; ' + unit + '</div>' : '') +
      ((s.gender||s.birth_year) ? '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">' + (s.gender||'') + bStr + '</div>' : '') +
      (s.motto ? '<div style="font-size:13px;font-style:italic;color:var(--accent);border-left:3px solid var(--accent);padding-left:10px;margin-bottom:10px;">💪 ' + s.motto + '</div>' : '') +
      (s.bio ? '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:12px;">' + s.bio + '</div>' : '') +
      '<button onclick="document.getElementById(\'staffCardModal\').remove()" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;">Đóng</button>' +
    '</div>';
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}
