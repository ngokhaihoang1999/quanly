const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY';
const tg = window.Telegram?.WebApp;
let currentProfileId = null, currentRecordType = null, currentRecordId = null;
let allProfiles = [], allStaff = [], myStaff = null, structureData = [];
let allPositions = [];
let _pendingPrefs = {}; // live personalization edits not yet saved
let _pinUnlocked = false; // session flag — once unlocked, stays unlocked until full reload
let _authChecked = false; // set true sau khi loadStaffInfo() xong — dùng bởi security guard

// ============ PREMIUM UX ============
window.haptic = function(style = 'light') {
  try {
    if (!window.Telegram?.WebApp?.HapticFeedback) return;
    if (['light', 'medium', 'heavy', 'rigid', 'soft'].includes(style)) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred(style);
    } else if (['error', 'success', 'warning'].includes(style)) {
      window.Telegram.WebApp.HapticFeedback.notificationOccurred(style);
    } else if (style === 'selection') {
      window.Telegram.WebApp.HapticFeedback.selectionChanged();
    }
  } catch(e) {}
};

// ============ DATA CACHE (prevents redundant re-fetches on tab switch) ============
const _dataCache = { profiles: 0, dashboard: 0, staff: 0, structure: 0, calendar: 0, priority: 0 };
const CACHE_TTL = 90000; // 90s
function isFresh(key) { return Date.now() - (_dataCache[key] || 0) < CACHE_TTL; }
function markFresh(key) { _dataCache[key] = Date.now(); }
function invalidateCache(key) { if (key) _dataCache[key] = 0; else Object.keys(_dataCache).forEach(k => _dataCache[k] = 0); }

// ── Smart refresh: only reload the active tab's data ──
async function refreshCurrentTab() {
  const btn = document.getElementById('refreshTabBtn');
  if (btn) { btn.style.transform = 'rotate(360deg)'; btn.disabled = true; }
  const activeTab = document.querySelector('.tab-bar .tab.active')?.dataset?.tab;

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
const _inflight = new Map();
const _writeTimestamps = new Map();
const _getCache = new Map();

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
  const clickFn = opts.clickFn || `openProfileById('${resolvedId}', event)`;

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

  // ── Row 2: Phase + KT badges ──
  const hasBadges = phaseBadge || ktBadge || extraBadges;
  const row2 = hasBadges ? `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px;">${phaseBadge}${ktBadge}${extraBadges}</div>` : '';

  // ── Dropout note ──
  const dropoutNote = isInactive && p.dropout_reason ? `<div style="font-size:11px;color:${_fs==='pause'?'#9ca3af':'var(--red)'};margin-top:4px;">Lý do: ${p.dropout_reason}</div>` : '';

  // ── Row 3: Roles (NDD / TVV / GVBB) ──
  const roleParts = [];
  if (nddStr) roleParts.push(`<span><b style="opacity:0.5;">NDD</b> ${nddStr}</span>`);
  if (tvvStr) roleParts.push(`<span><b style="opacity:0.5;">TVV</b> ${tvvStr}</span>`);
  if (gvbbStr) roleParts.push(`<span><b style="opacity:0.5;">GVBB</b> ${gvbbStr}</span>`);
  const rolesRow = roleParts.length > 0
    ? `<div style="display:flex;gap:4px;font-size:11px;color:var(--text2);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${roleParts.join('<span style="opacity:0.3;"> · </span>')}</div>`
    : '';

  // ── Row 4: Latest activity ──
  const activityContent = opts.extraMeta || (latestStr ? `⏱ ${latestStr}` : '');
  const activityRow = activityContent
    ? `<div style="font-size:11px;color:var(--accent);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;">${activityContent}</div>`
    : '';

  // ── Bottom section ──
  const hasBottom = rolesRow || activityRow;
  const bottomHtml = hasBottom
    ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:3px;">${rolesRow}${activityRow}</div>`
    : '';

  return `<div class="profile-card" data-pid="${resolvedId}" onclick="${clickFn}" style="padding:12px 14px;">
    <div class="profile-info" style="width:100%;min-width:0;">
      ${row1}${row2}${dropoutNote}${bottomHtml}
    </div>
    <div class="profile-arrow" style="margin-left:6px;align-self:center;">›</div>
  </div>`;
}

// ============ CUSTOM CONFIRM ============
function showConfirm(message, onOk, onCancel) {
  let modal = document.getElementById('customConfirmModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'customConfirmModal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.45);';
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

function showConfirmAsync(message) {
  return new Promise(resolve => showConfirm(message, () => resolve(true), () => resolve(false)));
}

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

// Helpers
function getChipValues(id) { const el=document.getElementById(id); if(!el) return []; return Array.from(el.querySelectorAll('.chip.selected')).map(c=>c.textContent.trim()); }
function setChipValues(id, vals) { const el=document.getElementById(id); if(!el||!vals) return; el.querySelectorAll('.chip').forEach(c=>{ vals.includes(c.textContent.trim()) ? c.classList.add('selected') : c.classList.remove('selected'); }); }
function clearChips(id) { const el=document.getElementById(id); if(el) el.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); }
function toggleChip(el) { el.classList.toggle('selected'); }
function closeModal(id) { haptic('selection'); document.getElementById(id).classList.remove('open'); }
function showToast(msg) { 
  if (msg.includes('✅') || msg.includes('✨')) haptic('success');
  else if (msg.includes('❌') || msg.includes('⚠️')) haptic('error');
  else haptic('light');
  const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); 
}

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
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;';
    document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); document.body.removeChild(ta);
    showToast('📋 Đã copy!');
  }
}

// ── Celebration: confetti + big toast for phase transitions ──
function showCelebration(emoji, message) {
  showToast(`${emoji} ${message}`);

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
      p.vy += 0.15;
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
  if (val.includes(' - ')) return val.split(' - ')[0].trim();
  const match = val.match(/\(([^)]+)\)$/);
  if (match) return match[1].trim();
  return val;
}

// Check if a staff code from input is registered in the system
function isStaffRegistered(code) {
  if (!code) return false;
  return (allStaff || []).some(s => s.staff_code === code);
}

// Show/hide unregistered staff warning badge next to input
function _showStaffWarning(inputId) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const code = getStaffCodeFromInput(inputId);
  const warnId = inputId + '_warn';
  let warn = document.getElementById(warnId);
  if (!code) {
    if (warn) warn.remove();
    return;
  }
  if (isStaffRegistered(code)) {
    if (warn) warn.remove();
    return;
  }
  // Show warning
  if (!warn) {
    warn = document.createElement('div');
    warn.id = warnId;
    warn.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:4px;padding:6px 10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);border-radius:6px;font-size:11px;color:#f59e0b;font-weight:600;cursor:pointer;';
    warn.innerHTML = '⚠️ <span>TVV/GVBB này chưa được đăng ký trong hệ thống</span>';
    warn.title = 'Mã JD này chưa có trong danh sách TĐ. Vẫn có thể sử dụng nhưng một số tính năng sẽ bị hạn chế.';
    el.closest('.field-group')?.appendChild(warn);
  }
}

// Auto-attach warning listener to staff inputs when they lose focus
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.tagName === 'INPUT' && el.getAttribute('data-list') === 'staffSuggest') {
    setTimeout(() => _showStaffWarning(el.id), 300);
  }
}, true);

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
      setTimeout(() => input.blur(), 50);
    }
  });
}

async function sbFetch(path, opts={}) {
  const headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', ...opts.headers };
  if (opts.method === 'POST' && !headers['Prefer']) headers['Prefer'] = 'return=representation';
  const isWrite = opts.method && opts.method !== 'GET';

  // ── Security guard ──
  if (isWrite && !window.isGuestMode && myStaff === null && typeof _authChecked !== 'undefined' && _authChecked) {
    console.error('[Security] Write blocked — no authenticated staff');
    throw new Error('Not authenticated');
  }

  // ── Rate limiting ──
  if (isWrite) {
    const rateKey = (opts.method || '') + ':' + path;
    const now = Date.now();
    if (_writeTimestamps.has(rateKey) && now - _writeTimestamps.get(rateKey) < 1000) {
      console.warn('[sbFetch] Rate limited:', rateKey);
      throw new Error('Rate limited — vui lòng chờ giây lát');
    }
    _writeTimestamps.set(rateKey, now);
  }

  // ── GET cache (5s TTL) ──
  if (!isWrite && _getCache.has(path)) {
    const cached = _getCache.get(path);
    if (Date.now() - cached.ts < 5000) return cached.res.clone();
    _getCache.delete(path);
  }

  // ── In-flight dedup for GET ──
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
  if (!isWrite) {
    try { _getCache.set(path, { ts: Date.now(), res: res.clone() }); } catch(e) {}
    return res.clone();
  }
  const table = path.split('?')[0];
  for (const [k] of _getCache) { if (k.startsWith(table)) _getCache.delete(k); }
  return res;
}


// ╔══════════════════════════════════════════════════════════════════╗
// ║              OPEN PERSONALIZATION PANEL                         ║
// ╚══════════════════════════════════════════════════════════════════╝
function openPersonalizationPanel() {
  const prefs = myStaff?.preferences || {};
  const currentAccent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c6af7';
  const hex0 = /^#[0-9a-fA-F]{6}$/.test(currentAccent) ? currentAccent : '#7c6af7';
  const [h0,s0,l0] = _hexToHsl(hex0);
  const [r0,g0,b0] = _hexToRgb(hex0);
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
          <div style="font-weight:700;font-size:16px;">⚙️ Cài đặt</div>
          <button onclick="document.getElementById('personalizationModal').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text2);">✕</button>
        </div>
        <div id="pref_preview_bar" style="height:5px;border-radius:3px;background:${hex0};transition:background 0.25s;"></div>
      </div>
      <div style="padding:0 16px 36px;">
        <!-- ═══ TAB BAR ═══ -->
        <div id="settingsTabBar" style="display:flex;gap:0;margin:10px 0 16px;border-radius:10px;overflow:hidden;border:1px solid var(--border);">
          <button onclick="_switchSettingsTab('appearance')" class="settings-tab active" id="stab_appearance" style="flex:1;padding:10px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;background:var(--accent);color:white;transition:all 0.2s;">🎨 Giao diện</button>
          <button onclick="_switchSettingsTab('profile')" class="settings-tab" id="stab_profile" style="flex:1;padding:10px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;background:var(--surface2);color:var(--text2);transition:all 0.2s;">👤 Hồ sơ</button>
          <button onclick="_switchSettingsTab('security')" class="settings-tab" id="stab_security" style="flex:1;padding:10px 0;font-size:12px;font-weight:600;border:none;cursor:pointer;background:var(--surface2);color:var(--text2);transition:all 0.2s;">🔐 Bảo mật</button>
        </div>
        <!-- ═══ TAB: GIAO DIỆN ═══ -->
        <div id="settingsPane_appearance">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin:0 0 8px;">🎨 MÀU CHỦ ĐẠO</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;">${presetHtml}</div>
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
        <div style="height:1px;background:var(--border);margin:16px 0;"></div>
        <!-- ═══ DESKTOP LAYOUT ═══ -->
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">🖥️ BỐ CỤC DESKTOP <span style="font-weight:400;color:var(--text3);">(chỉ hiện khi mở rộng)</span></div>
        <div style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:14px;margin-bottom:16px;">
          <div id="desktopLayoutPreview" style="display:flex;gap:4px;height:60px;margin-bottom:14px;border-radius:8px;overflow:hidden;border:1px solid var(--border);font-size:10px;font-weight:600;color:var(--text2);">
            <div id="dlpLeft" style="flex:0 0 28%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-right:2px solid var(--accent);"></div>
            <div style="flex:1;background:var(--bg);display:flex;align-items:center;justify-content:center;color:var(--text3);font-size:9px;">CENTER</div>
            <div id="dlpRight" style="flex:0 0 28%;background:var(--surface);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border-left:2px solid var(--accent);"></div>
          </div>
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
        <button onclick="_savePrefs()" style="width:100%;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;margin-bottom:8px;">✅ Lưu giao diện</button>
        <button onclick="_resetPrefs()" style="width:100%;padding:10px;background:none;color:var(--text3);border:1px solid var(--border);border-radius:12px;font-size:12px;cursor:pointer;">↩ Về mặc định hệ thống</button>
        </div>
        <!-- ═══ TAB: HỒ SƠ CÁ NHÂN ═══ -->
        <div id="settingsPane_profile" style="display:none;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">👤 HỒ SƠ CÁ NHÂN TĐ</div>
        <div style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:16px;display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:1px solid var(--border);">
            <div>
              <div style="font-weight:700;font-size:14px;">${myStaff?.full_name||myStaff?.staff_code||'---'}</div>
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
                ${typeof renderAnimatedAvatar==='function' ? renderAnimatedAvatar(getNameInitial(myStaff?.nickname||myStaff?.full_name), myStaff?.staff_avatar_color||'', 'md') : '<div style="width:56px;height:56px;border-radius:16px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:white;">'+getNameInitial(myStaff?.full_name)+'</div>'}
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
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">🆔 Mã TĐ SCJ</label>
            <input type="text" id="prof_scj_code" value="${(myStaff?.scj_code||'').replace(/"/g,'&quot;')}" placeholder="Mã định danh trong SCJ (nếu có)..." maxlength="50"
              style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;" />
          </div>
          <div>
            <label style="font-size:11px;font-weight:600;color:var(--text2);display:block;margin-bottom:4px;">📋 Tên/Bộ/KV/SĐT (Thẻ HV)</label>
            <input type="text" id="prof_sinka_info" value="${(myStaff?.sinka_info||'').replace(/"/g,'&quot;')}" placeholder="VD: Nguyễn Văn A / Bộ 1 / Q.1 / 0901234567" maxlength="150"
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
        </div>
        <!-- ═══ TAB: BẢO MẬT ═══ -->
        <div id="settingsPane_security" style="display:none;">
        <div style="font-size:11px;font-weight:700;color:var(--text3);letter-spacing:.5px;margin-bottom:10px;">🔐 BẢO MẬT</div>
        <div id="pinToggleArea" style="background:var(--surface2);border-radius:12px;border:1px solid var(--border);padding:12px;margin-bottom:16px;"></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  _pendingPrefs = { accent: hex0 };
  _prefTabOrder = [...currentOrder];
  _prefTabHidden = new Set(hiddenSet);
  const gSel = document.getElementById('prof_gender');
  if (gSel) {
    const gVal = gSel.dataset.val || '';
    const gMap = { 'Nam':'Nam', 'Nữ':'Nu', 'Nu':'Nu' };
    gSel.value = gMap[gVal] || '';
  }
  _refreshPinToggle();

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

// ══════════════════════════════════════════════════════════════════════════════
// OFFLINE DETECTION
// ══════════════════════════════════════════════════════════════════════════════
(function() {
  const banner = document.createElement('div');
  banner.className = 'offline-banner';
  banner.textContent = '⚠️ Mất kết nối mạng — một số chức năng có thể không hoạt động';
  document.body.appendChild(banner);
  function update() {
    if (navigator.onLine) { banner.classList.remove('show'); }
    else { banner.classList.add('show'); }
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
})();

// ══════════════════════════════════════════════════════════════════════════════
// SKELETON LOADING HELPERS
// ══════════════════════════════════════════════════════════════════════════════
function showSkeleton(container, count = 3) {
  if (!container) return;
  let html = '';
  for (let i = 0; i < count; i++) {
    html += '<div class="skeleton-card skeleton"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></div>';
  }
  container.innerHTML = html;
}

function clearSkeleton(container) {
  if (!container) return;
  container.querySelectorAll('.skeleton-card').forEach(el => el.remove());
}

// ══════════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY — wrap module entry points
// ══════════════════════════════════════════════════════════════════════════════
function safeBind(fnName) {
  const orig = window[fnName];
  if (typeof orig !== 'function') return;
  window[fnName] = async function(...args) {
    try {
      return await orig.apply(this, args);
    } catch(e) {
      console.error(`[ErrorBoundary] ${fnName}:`, e);
      if (typeof showToast === 'function') showToast(`⚠️ Lỗi tại ${fnName}`);
    }
  };
}
// Wrap critical entry points after all scripts load
window.addEventListener('load', () => {
  ['loadDashboard', 'loadProfiles', 'filterProfiles', 'openProfile',
   'loadCalendar', 'loadStructure', 'loadReportsTab', 'openNotifPanel',
   'loadPriorityTab', 'loadStrategy'].forEach(safeBind);
});
