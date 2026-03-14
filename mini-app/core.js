const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY';
const tg = window.Telegram?.WebApp;

let currentProfileId = null, currentRecordType = null, currentRecordId = null;
let allProfiles = [], allStaff = [], myStaff = null, structureData = [];

const POS_LABELS = { td:'TĐ', bgyjn:'BGYJN (Tổ phó)', gyjn:'GYJN (Tổ trưởng)', sgn_jondo:'SGN Jondo', ggn_chakki:'GGN Chakki', ggn_jondo:'GGN Jondo', tjn:'TJN', yjyn:'YJYN', admin:'Admin' };
function getPositionName(p) { return POS_LABELS[p] || p || 'TĐ'; }
function getBadgeClass(p) {
  if (!p) return 'role-default';
  if (p==='admin'||p==='yjyn') return 'role-admin';
  if (p==='tjn'||p==='gyjn') return 'role-ndd';
  if (['ggn_jondo','ggn_chakki','sgn_jondo'].includes(p)) return 'role-tvv';
  return 'role-default';
}

// Helpers
function getChipValues(id) { const el=document.getElementById(id); if(!el) return []; return Array.from(el.querySelectorAll('.chip.selected')).map(c=>c.textContent.trim()); }
function setChipValues(id, vals) { const el=document.getElementById(id); if(!el||!vals) return; el.querySelectorAll('.chip').forEach(c=>{ vals.includes(c.textContent.trim()) ? c.classList.add('selected') : c.classList.remove('selected'); }); }
function clearChips(id) { const el=document.getElementById(id); if(el) el.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); }
function toggleChip(el) { el.classList.toggle('selected'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

async function sbFetch(path, opts={}) {
  return fetch(SUPABASE_URL + path, { ...opts, headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': opts.method==='POST'?'return=representation':undefined, ...opts.headers } });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) { tg.ready(); tg.expand(); }
  await loadStaffInfo();
  await Promise.all([loadProfiles(), loadDashboard(), loadStaff()]);
});

async function loadStaffInfo() {
  const userId = tg?.initDataUnsafe?.user?.id;
  if (!userId) {
    document.getElementById('staffBadge').textContent = 'Demo';
    myStaff = { staff_code: 'DEMO', position: 'admin', full_name: 'Demo Admin' };
    document.getElementById('viewAsBar').classList.add('active');
    applyPermissions();
    return;
  }
  try {
    const res = await sbFetch(`/rest/v1/staff?telegram_id=eq.${userId}&select=*`);
    const data = await res.json();
    if (data.length > 0) {
      myStaff = data[0];
      document.getElementById('staffBadge').textContent = `${myStaff.staff_code} \u00b7 ${getPositionName(myStaff.position)}`;
      if (myStaff.position === 'admin') {
        document.getElementById('viewAsBar').classList.add('active');
      }
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
  ['tab-unit','tab-personal','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+activeTab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (activeTab==='unit'||activeTab==='personal')?'flex':'none';
  currentProfileId = null;
}
function switchFormTab(el, cardId) {
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.form-card').forEach(c=>c.classList.remove('active')); document.getElementById(cardId).classList.add('active');
}
function switchMainTab(el, tab) {
  document.querySelectorAll('#mainTabBar .tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  ['tab-unit','tab-personal','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+tab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (tab==='unit'||tab==='personal') ? 'flex' : 'none';
  if (tab==='unit') { loadDashboard(); loadProfiles(); }
  if (tab==='personal') loadDashboard();
  if (tab==='staff') loadStaff();
  if (tab==='structure') loadStructure();
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
function getCurrentPosition() { return viewAsPosition || myStaff?.position || 'td'; }
function getCurrentRole() { return viewAsRole; }
function getEffectiveStaffCode() { return viewAsStaffCode || myStaff?.staff_code; }
function getPosLevel(p) { return {td:0,bgyjn:1,gyjn:2,tjn:3,ggn_chakki:3,sgn_jondo:3,ggn_jondo:3,yjyn:4,admin:5}[p]||0; }

function populateViewAsDropdown() {
  const sel = document.getElementById('viewAsPos');
  if (!sel) return;
  let html = '<option value="">Ch\u1ee9c v\u1ee5: Ch\u00ednh m\u00ecnh</option>';
  html += '<option value="td">T\u0110 (chung)</option>';
  html += '<option value="sgn_jondo">SGN Jondo</option>';
  html += '<option value="ggn_chakki">GGN Chakki</option>';
  html += '<option value="ggn_jondo">GGN Jondo</option>';
  // From structure data
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
}

function applyViewAs() {
  const raw = document.getElementById('viewAsPos').value;
  const selRole = document.getElementById('viewAsRole').value;
  if (raw && raw.includes('|')) {
    const [p, code] = raw.split('|');
    viewAsPosition = p;
    viewAsStaffCode = code;
  } else {
    viewAsPosition = raw || null;
    viewAsStaffCode = null;
  }
  viewAsRole = selRole || null;
  const pos = getCurrentPosition();
  const posLabel = getPositionName(pos);
  const roleLabel = selRole ? {ndd:'NDD',tvv:'TVV',gvbb:'GVBB',la:'L\u00e1'}[selRole] : '';
  const badge = document.getElementById('staffBadge');
  if (raw || selRole) {
    let txt = '\uD83D\uDC41 ' + posLabel;
    if (viewAsStaffCode) {
      const s = allStaff.find(x => x.staff_code === viewAsStaffCode);
      if (s) txt += ' (' + s.full_name + ')';
    }
    if (roleLabel) txt += ' + ' + roleLabel;
    badge.textContent = txt;
  } else {
    badge.textContent = `${myStaff?.staff_code||'---'} \u00b7 ${getPositionName(myStaff?.position)}`;
  }
  applyPermissions();
  if (raw || selRole) {
    let msg = '\uD83D\uDC41 ';
    if (raw) msg += posLabel;
    if (selRole) msg += (raw ? ' + ' : '') + roleLabel;
    showToast(msg);
  }
}
function resetViewAs() {
  document.getElementById('viewAsPos').value = '';
  document.getElementById('viewAsRole').value = '';
  applyViewAs();
  showToast('\u2705 Reset v\u1ec1 Admin');
}
function applyPermissions() {
  const pos = getCurrentPosition();
  const lvl = getPosLevel(pos);
  const role = getCurrentRole();
  // Tab Cơ cấu: visible for all
  const structTab = document.querySelector('[data-tab="structure"]');
  if (structTab) structTab.style.display = '';
  // "+ Khu vực" button: Admin only
  const btnAddArea = document.getElementById('btnAddArea');
  if (btnAddArea) btnAddArea.style.display = pos==='admin' ? '' : 'none';
  // FAB: only for those who can create Hapja
  const fabBtn = document.getElementById('fabBtn');
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'dashboard';
  if (fabBtn) fabBtn.style.display = (canCreateHapja(pos) && (activeTab==='dashboard'||activeTab==='profiles')) ? 'flex' : 'none';
  // Reload structure tree to update inline add buttons
  if (document.getElementById('tab-structure').style.display !== 'none') loadStructure();
}

// ============ UNIT POPUP ============
function showUnitPopup(type) {
  const phMap = {new:'🟡 Chakki',chakki:'🟡 Chakki',tu_van:'💬 TV',bb:'🎓 BB',center:'🏛️ Center',completed:'✅'};
  const phColor = {new:'#f59e0b',chakki:'#f59e0b',tu_van:'var(--accent)',bb:'var(--green)',center:'#8b5cf6',completed:'var(--green)'};
  let title = '', items = [];
  if (type === 'hapja') {
    title = '🍎 Trái Hapja (đã duyệt)';
    const list = window._unitApprovedHapja || [];
    items = list.map(h => `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;" onclick="${h.profile_id ? `openProfileById('${h.profile_id}');closeModal('unitPopupModal')` : ''}">
      <div style="font-weight:700;font-size:13px;">${h.full_name}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${h.data?.ndd_staff_code||h.created_by} · ${new Date(h.created_at).toLocaleDateString('vi-VN')}</div>
    </div>`);
  } else if (type === 'tvv') {
    title = '💬 Trái TV';
    const list = window._unitTvvFruits || [];
    items = list.map(r => {
      const p = r.fruit_groups?.profiles;
      const ph = p?.phase || 'chakki';
      return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;" onclick="openProfileById('${r.fruit_groups?.profile_id}');closeModal('unitPopupModal')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:13px;">${p?.full_name||'N/A'}</div>
          <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;background:${phColor[ph]};color:white;">${phMap[ph]||ph}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">TVV: ${r.staff_code}</div>
      </div>`;
    });
  } else if (type === 'gvbb') {
    title = '🎓 Trái BB';
    const list = window._unitGvbbFruits || [];
    items = list.map(r => {
      const p = r.fruit_groups?.profiles;
      const ph = p?.phase || 'bb';
      return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;" onclick="openProfileById('${r.fruit_groups?.profile_id}');closeModal('unitPopupModal')">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;font-size:13px;">${p?.full_name||'N/A'}</div>
          <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;background:${phColor[ph]};color:white;">${phMap[ph]||ph}</span>
        </div>
        <div style="font-size:11px;color:var(--text2);">GVBB: ${r.staff_code}</div>
      </div>`;
    });
  } else if (type === 'bbgroup') {
    title = '💬 Group BB';
    const list = window._unitBbGroups || [];
    items = list.map(r => `<div style="padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;">
      <div style="font-weight:700;font-size:13px;">${r.fruit_groups?.telegram_group_title || 'Group'}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${r.staff_code} · ${r.fruit_groups?.profiles?.full_name || ''}</div>
    </div>`);
  }
  document.getElementById('unitPopupTitle').textContent = title;
  document.getElementById('unitPopupBody').innerHTML = items.length ? items.join('') : '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có dữ liệu</div>';
  document.getElementById('unitPopupModal').classList.add('open');
}

// ============ FRUIT STATUS TOGGLE ============
async function toggleFruitStatus(profileId, current) {
  const newStatus = current === 'alive' ? 'dropout' : 'alive';
  const label = newStatus === 'dropout' ? 'Drop-out' : 'Alive';
  if (!confirm(`Chuyển trạng thái trái quả thành "${label}"?`)) return;
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, { method: 'PATCH', body: JSON.stringify({ fruit_status: newStatus }) });
    showToast(`✅ Đã chuyển sang ${label}`);
    // Update local cache
    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) {
      allProfiles[idx].fruit_status = newStatus;
      openProfile(allProfiles[idx]);
    }
    filterProfiles();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ============ THEME TOGGLE ============
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  document.getElementById('themeToggle').textContent = isLight ? '\uD83C\uDF19' : '\u2600\uFE0F';
  localStorage.setItem('cj_theme', isLight ? 'dark' : 'light');
}
// Restore saved theme
(function() {
  const saved = localStorage.getItem('cj_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '\u2600\uFE0F';
  }
})();