// ============ INIT + DEEP LINK + NAVIGATION + SEMESTER LOGIC ============
// Extracted from core.js — App initialization and navigation
// Depends on: All other modules must be loaded before this file
// Load order: core.js → pin.js → permissions.js → settings.js → fruit-actions.js → desktop.js → ... → init.js (LAST)

// ── Semester Logic ──
async function loadSemesters() {
  try {
    const res = await sbFetch('/rest/v1/semesters?select=*&order=created_at.desc');
    allSemesters = await res.json();
  } catch(e) { console.warn('loadSemesters:', e); allSemesters = []; }

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
  const mgr = document.getElementById('semesterManageBtn');
  if (mgr) mgr.style.display = hasPermission('manage_semester') ? '' : 'none';
}

let _semSwitching = false;
async function switchSemester(id) {
  if (id === currentSemesterId) return;
  if (_semSwitching) return;
  _semSwitching = true;
  currentSemesterId = id || null;
  localStorage.setItem('cj_semester_id', currentSemesterId || '');

  showLoading();

  invalidateCache();
  _rptCache = null;

  await loadProfiles();

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
  const now = new Date();
  const suggested = `Tháng ${now.getMonth()+1}/${now.getFullYear()}`;
  const nameInput = document.getElementById('newSemName');
  if (nameInput && !nameInput.value) nameInput.value = suggested;
  document.getElementById('semesterManagerModal').classList.add('open');
}

function getSemesterFilter() {
  return currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';
}

// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) {
    tg.ready();
    tg.expand();
    _injectWindowControls();
  }
  _showPinLock();
  if (_isPinEnabled() && !_pinUnlocked) {
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (_pinUnlocked) { clearInterval(check); resolve(); }
      }, 200);
      setTimeout(() => { clearInterval(check); resolve(); }, 300000);
    });
  }
  initCustomAutocomplete();
  try {
    const [, ok] = await Promise.all([loadPositions(), loadStaffInfo()]);
    if (!ok) return;

    if (window.isGuestMode) {
      const header = document.querySelector('.header');
      if (header) header.style.display = 'none';
      const pid = _getDeepLinkProfileId();
      await openGuestProfile(pid);
      return;
    }

    await Promise.allSettled([loadSemesters(), loadStructure()]);
    await Promise.allSettled([loadProfiles(), loadStaff()]);
    await loadDashboard();

    _handleDeepLink();
    applyDesktopLayout();
    _updateTabBarMode();
  } catch(e) {
    console.error('Init error:', e);
    _clearLoadingStates();
  }
});

// ── Deep Link Handler ──
function _getDeepLinkProfileId() {
  try { var p = new URLSearchParams(location.search).get('profile'); if (p) return p; } catch(e) {}
  try {
    var h = location.hash.substring(1);
    if (h) { var sp = new URLSearchParams(h).get('tgWebAppStartParam'); if (sp) return sp; }
  } catch(e) {}
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
    allProfiles = data;
    
    if (typeof openProfileById === 'function') {
      openProfileById(pid);
      
      const detailView = document.getElementById('detailView');
      if (detailView) detailView.style.paddingTop = '12px';
      const mainTabBar = document.getElementById('mainTabBar');
      if (mainTabBar) mainTabBar.style.display = 'none';
      const fabBtn = document.getElementById('fabBtn');
      if (fabBtn) fabBtn.style.display = 'none';
      
      setTimeout(() => {
        const backBtn = document.querySelector('.back-btn');
        if (backBtn) backBtn.style.display = 'none';
      }, 100);
    }
  } catch(e) {
    console.error('Guest load error:', e);
  }
}

window.addEventListener('hashchange', function() {
  _deepLinkHandled = false;
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
    return false;
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
      const headerAv = document.getElementById('headerAvatar');
      if (headerAv) {
        const displayName = myStaff.nickname || myStaff.full_name || myStaff.staff_code || '?';
        const letter = getNameInitial(displayName);
        const avatarHtml = typeof renderAnimatedAvatar === 'function'
          ? renderAnimatedAvatar(letter, myStaff.staff_avatar_color || '', 'md')
          : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${letter}</div>`;
        headerAv.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openPersonalizationPanel()" title="Cài đặt">
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
      if (myStaff.preferences && typeof applyUserPreferences === 'function') applyUserPreferences(myStaff.preferences);
      try {
        const allRes = await sbFetch('/rest/v1/staff?select=full_name,staff_code,nickname,gender,birth_year,bio,avatar_emoji,motto,scj_code,sinka_info,position,specialist_position,telegram_id');
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
  _authChecked = true;
  return true;
}

// Clear all loading states when init fails
function _clearLoadingStates() {
  const loadingIds = ['dashHapjaList','dashMyList','dashUnitList','dashSubUnits','dashPersonalMetrics','profileList','staffList'];
  loadingIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">\u26a0\ufe0f Kh\u00f4ng t\u1ea3i \u0111\u01b0\u1ee3c d\u1eef li\u1ec7u. Vui l\u00f2ng m\u1edf l\u1ea1i \u1ee9ng d\u1ee5ng.</div>';
  });
}

// ── Navigation ──
function backToList() {
  if (typeof ProfileTransition !== 'undefined') {
    ProfileTransition.close();
    return;
  }
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
  if (typeof TabIndicator !== 'undefined') TabIndicator.moveTo(el);
  const dir = typeof navDirectionForFormTab === 'function' ? navDirectionForFormTab(cardId) : 1;
  
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.form-card').forEach(c=>c.classList.remove('active')); 
  const card = document.getElementById(cardId);
  card.classList.add('active');
  
  if (typeof navSlide === 'function') navSlide(card, dir);
  
  if (cardId === 'mindmapTab') {
    if (_mmCurrentType === 'strategy' && typeof loadStrategy === 'function') {
      if (!_strategyLoaded) setTimeout(loadStrategy, 50);
    } else if (typeof renderMindmap === 'function') {
      setTimeout(renderMindmap, 50);
    }
  }
  if (cardId === 'sinkaTab' && typeof loadSinka === 'function' && currentProfileId) {
    if (!_sinkaLoaded) loadSinka(currentProfileId);
    const hocLaiEl = document.getElementById('sk_hoc_lai');
    if (hocLaiEl && !hocLaiEl.dataset.listenerAdded) {
      hocLaiEl.dataset.listenerAdded = '1';
      hocLaiEl.addEventListener('change', () => {
        const wrap = document.getElementById('sk_hoc_lai_lydo_wrap');
        if (wrap) wrap.style.display = (hocLaiEl.value && hocLaiEl.value !== 'Nhập học mới') ? '' : 'none';
      });
    }
  }
}
function switchMainTab(el, tab) {
  haptic('light');
  if (typeof _isTabPinned === 'function' && _isTabPinned(tab) && window.innerWidth >= 1024) return;
  
  if (typeof TabIndicator !== 'undefined') TabIndicator.moveTo(el);
  const dir = typeof navDirectionForMainTab === 'function' ? navDirectionForMainTab(tab) : 1;
  
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
  
  if (typeof navSlide === 'function' && tTab) {
    navSlide(tTab, dir);
  } else {
    const mainContent = document.getElementById('mainContent');
    if (mainContent) {
      mainContent.classList.remove('tab-content-enter');
      void mainContent.offsetWidth;
      mainContent.classList.add('tab-content-enter');
    }
  }

  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (tab==='unit'||tab==='personal') ? 'flex' : 'none';
  if (tab==='unit') { if (!isFresh('dashboard')) loadDashboard(); if (!isFresh('profiles')) loadProfiles(); }
  if (tab==='personal') { if (!isFresh('dashboard')) loadDashboard(); }
  if (tab==='staff') { if (!isFresh('staff')) loadStaff(); }
  if (tab==='structure') { if (!isFresh('structure')) loadStructure(); }
  if (tab==='calendar' && typeof loadCalendar === 'function') { if (!isFresh('calendar')) loadCalendar(); }
  if (tab==='priority' && typeof loadPriority === 'function') { if (!isFresh('priority')) loadPriority(); }
  if (tab==='reports' && typeof loadReports === 'function') { if (!isFresh('reports')) loadReports(); }
  if (tab==='notes' && typeof initNotesTab === 'function') { initNotesTab(); }
  if (tab !== 'notes' && typeof stopNotesPoll === 'function') stopNotesPoll();
}

// ── Modal Close on Overlay Click ──
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// Dashboard collapse toggle
function toggleDashMetrics() {
  const el = document.getElementById('dashUnitMetrics');
  const icon = document.getElementById('dashToggleIcon');
  if (!el) return;
  el.classList.toggle('collapsed');
  if (icon) icon.textContent = el.classList.contains('collapsed') ? '▼' : '▲';
}
