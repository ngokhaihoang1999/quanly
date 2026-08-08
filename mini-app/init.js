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
// ── Init ──
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) {
    tg.ready();
    tg.expand();
    _injectWindowControls();
    try {
      const lastFullscreen = localStorage.getItem('cj_last_fullscreen') === '1';
      if (lastFullscreen) {
        const tgWA = window.Telegram?.WebApp;
        if (tgWA && typeof tgWA.requestFullscreen === 'function') {
          tgWA.requestFullscreen();
        } else if (tg && typeof tg.requestFullscreen === 'function') {
          tg.requestFullscreen();
        }
      }
    } catch(e) { console.warn('[WinCtrl] Fullscreen restore failed:', e); }
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
    if (typeof loadUnreadChats === 'function') await loadUnreadChats();
    await loadDashboard();
    if (typeof initFloatingChat === 'function') initFloatingChat();

    _handleDeepLink();
    applyDesktopLayout();
    if (typeof upgradeInputsToTextareas === 'function') upgradeInputsToTextareas();

    // Explicitly load data for pinned tabs on startup since resize events during fullscreen
    // transition might have triggered early layout initialization before staff credentials were loaded.
    if (typeof _isTabPinned === 'function') {
      if (_isTabPinned('notes') && typeof initNotesTab === 'function') {
        if (typeof invalidateCache === 'function') invalidateCache('notes');
        initNotesTab();
      }
      if (_isTabPinned('priority') && typeof loadPriority === 'function') {
        if (typeof invalidateCache === 'function') invalidateCache('priority');
        loadPriority();
      }
      if (_isTabPinned('calendar') && typeof loadCalendar === 'function') {
        loadCalendar(true);
      }
    }

    _updateTabBarMode();
    restoreAppState();
  } catch(e) {
    console.error('Init error:', e);
    _clearLoadingStates();
  }
});

// ── State Preservation Helpers (Bứt phá giới hạn Webview - Vô hiệu hoá theo yêu cầu) ──
function saveAppState() {}
function restoreAppState() {}

// ── Forms Draft Auto-Save System (Proposal 1) ──

function saveDraftForModal(type) {
  try {
    if (!type) return;
    const data = {};
    let container = null;
    if (type === 'hapja') {
      container = document.getElementById('createHapjaModal');
    } else {
      container = document.getElementById('addRecordModal');
    }
    if (!container) return;

    // Collect all inputs, textareas, selects
    const inputs = container.querySelectorAll('input:not([type="password"]):not([type="checkbox"]):not([type="radio"]), textarea, select');
    inputs.forEach(input => {
      if (input.id) {
        data[input.id] = { value: input.value, checked: false };
      }
    });

    const checkRadios = container.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    checkRadios.forEach(input => {
      if (input.id) {
        data[input.id] = { value: input.value, checked: input.checked };
      }
    });

    // Check if the draft is actually empty (to avoid saving empty drafts)
    let isEmpty = true;
    for (const key in data) {
      if (data[key].value && data[key].value.trim() !== '') {
        isEmpty = false;
        break;
      }
    }

    if (!isEmpty) {
      localStorage.setItem('cj_draft_' + type, JSON.stringify(data));
    } else {
      localStorage.removeItem('cj_draft_' + type);
    }
  } catch(e) {
    console.error('[Draft] Save draft error:', e);
  }
}

window.checkAndShowDraftBanner = function(type) {
  try {
    if (!type) return;
    const draftStr = localStorage.getItem('cj_draft_' + type);
    if (!draftStr) return;

    let modalBody = null;
    let bannerId = 'draftBanner_' + type;
    
    // Remove existing draft banner if any
    const existing = document.getElementById(bannerId);
    if (existing) existing.remove();

    if (type === 'hapja') {
      modalBody = document.querySelector('#createHapjaModal .modal-body') || document.querySelector('#createHapjaModal .modal');
    } else {
      modalBody = document.getElementById('recordModalBody');
    }
    
    if (!modalBody) return;

    // Create banner element
    const banner = document.createElement('div');
    banner.id = bannerId;
    banner.className = 'draft-banner';
    banner.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:10px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#d97706;animation:slideDown 0.3s ease;';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;flex:1;">
        <span style="font-size:16px;">💡</span>
        <span>Phát hiện bản nháp chưa lưu gần nhất của bạn.</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center;">
        <button type="button" onclick="restoreDraftData('${type}')" style="background:#d97706;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;transition:background 0.2s;">Khôi phục</button>
        <button type="button" onclick="clearDraftData('${type}')" style="background:transparent;color:var(--text3);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;cursor:pointer;">Xoá</button>
      </div>
    `;
    
    // Insert at the very beginning of the modalBody
    modalBody.insertBefore(banner, modalBody.firstChild);
  } catch(e) {
    console.error('[Draft] checkAndShowDraftBanner error:', e);
  }
};

window.restoreDraftData = function(type) {
  try {
    const draftStr = localStorage.getItem('cj_draft_' + type);
    if (!draftStr) return;
    const draftData = JSON.parse(draftStr);

    let container = null;
    if (type === 'hapja') {
      container = document.getElementById('createHapjaModal');
    } else {
      container = document.getElementById('addRecordModal');
    }
    if (!container) return;

    for (const id in draftData) {
      const el = container.querySelector('#' + id);
      if (el) {
        const saved = draftData[id];
        if (el.type === 'checkbox' || el.type === 'radio') {
          el.checked = saved.checked;
        } else {
          el.value = saved.value;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    
    // Hide the banner after restoring
    const banner = document.getElementById('draftBanner_' + type);
    if (banner) banner.remove();
    showToast('⚡ Đã khôi phục bản nháp!');
  } catch(e) {
    console.error('[Draft] restoreDraftData error:', e);
  }
};

window.clearDraftData = function(type) {
  try {
    localStorage.removeItem('cj_draft_' + type);
    const banner = document.getElementById('draftBanner_' + type);
    if (banner) banner.remove();
    showToast('🗑️ Đã xóa bản nháp.');
  } catch(e) {
    console.error('[Draft] clearDraftData error:', e);
  }
};

// Document-level savers for drafts
let _draftSaveDebounce = null;
document.addEventListener('input', e => {
  const target = e.target;
  if (target.id && (target.id.includes('pin') || target.id.includes('Pin'))) return;
  if (target.closest('#pinLockOverlay') || target.closest('#pinSetupModal')) return;

  const hapjaModal = target.closest('#createHapjaModal');
  const recordModal = target.closest('#addRecordModal');

  if (hapjaModal || recordModal) {
    clearTimeout(_draftSaveDebounce);
    _draftSaveDebounce = setTimeout(() => {
      saveDraftForModal(hapjaModal ? 'hapja' : (typeof currentRecordType !== 'undefined' ? currentRecordType : ''));
    }, 500);
  }
});

document.addEventListener('change', e => {
  const target = e.target;
  if (target.id && (target.id.includes('pin') || target.id.includes('Pin'))) return;
  if (target.closest('#pinLockOverlay') || target.closest('#pinSetupModal')) return;

  const hapjaModal = target.closest('#createHapjaModal');
  const recordModal = target.closest('#addRecordModal');

  if (hapjaModal || recordModal) {
    saveDraftForModal(hapjaModal ? 'hapja' : (typeof currentRecordType !== 'undefined' ? currentRecordType : ''));
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
  var param = _getDeepLinkProfileId();
  if (!param || _deepLinkHandled) return;
  _deepLinkHandled = true;
  
  let pid = param;
  let tabId = null;
  if (param.includes('_')) {
    const parts = param.split('_');
    pid = parts[0];
    tabId = parts[1];
  }
  
  if (typeof openProfileById === 'function' && allProfiles && allProfiles.length > 0) {
    openProfileById(pid, null, tabId);
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
      
      // Auto-update missing or changed telegram_username in DB for self-healing tag mapping
      const tgUsername = tg?.initDataUnsafe?.user?.username;
      if (tgUsername && myStaff.telegram_username !== tgUsername) {
        sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
          method: 'PATCH',
          body: JSON.stringify({ telegram_username: tgUsername })
        }).then(() => {
          myStaff.telegram_username = tgUsername;
          console.log('[Auto-update] Updated telegram_username in DB:', tgUsername);
        }).catch(err => console.warn('[Auto-update] Failed to update telegram_username:', err));
      }

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
            <div class="header-avatar-wrapper" style="padding:2px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.15));box-shadow:0 0 12px rgba(255,255,255,0.2);">
              ${avatarHtml}
            </div>
            <div style="display:flex;flex-direction:column;gap:1px;">
              <span style="font-size:13.5px;font-weight:700;color:rgba(255,255,255,0.97);text-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;" title="${displayName}">${displayName}</span>
              <span style="font-size:9.5px;font-weight:500;color:rgba(255,255,255,0.7);line-height:1.2;white-space:nowrap;">Hệ thống quản lý</span>
              <span style="font-size:9px;font-weight:600;color:rgba(255,255,255,0.5);line-height:1;white-space:nowrap;">v6.02.0049</span>
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
        const allRes = await sbFetch('/rest/v1/staff?select=full_name,staff_code,nickname,gender,birth_year,bio,avatar_emoji,motto,scj_code,sinka_info,position,specialist_position,telegram_id,staff_avatar_color');
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
  if (typeof unsubscribeProfileChat === 'function') {
    unsubscribeProfileChat();
  } else if (typeof _profileChatSubscription !== 'undefined' && _profileChatSubscription) {
    _profileChatSubscription.unsubscribe();
    _profileChatSubscription = null;
  }
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
  window.isDetailViewOpen = false;
  document.body.classList.remove('detail-view-open');
  document.documentElement.classList.remove('detail-view-open');
  document.getElementById('fabBtn').style.display = (activeTab==='unit'||activeTab==='personal')?'flex':'none';
  currentProfileId = null;
  window._lastLoadedProfileChatId = null;
}
function switchFormTab(el, cardId) {
  // Check for unsaved changes before switching
  if (typeof DirtyFormGuard !== 'undefined') {
    var blocked = DirtyFormGuard.guard(function() {
      _doSwitchFormTab(el, cardId);
    });
    if (blocked) return; // popup shown, wait for user choice
  }
  _doSwitchFormTab(el, cardId);
}

function _doSwitchFormTab(el, cardId) {
  if (typeof TabIndicator !== 'undefined') TabIndicator.moveTo(el);
  const dir = typeof navDirectionForFormTab === 'function' ? navDirectionForFormTab(cardId) : 1;
  
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.form-card').forEach(c=>c.classList.remove('active')); 
  const card = document.getElementById(cardId);
  card.classList.add('active');
  if (typeof adjustAllTextareaHeights === 'function') {
    setTimeout(adjustAllTextareaHeights, 100);
  }
  
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
  if (cardId === 'journeyTab' && typeof loadJourney === 'function' && currentProfileId) {
    const curP = window.allProfiles?.find(x => String(x.id) === String(currentProfileId)) || window.currentProfileObj;
    loadJourney(currentProfileId, curP?.phase || 'chakki');
  }
  if (cardId === 'tuVan' && typeof loadRecords === 'function' && currentProfileId) {
    loadRecords(currentProfileId, 'tu_van', 'tvList', 'tvCount');
  }
  if (cardId === 'bienBan' && typeof loadRecords === 'function' && currentProfileId) {
    loadRecords(currentProfileId, 'bien_ban', 'bbList', 'bbCount');
  }
  if (cardId === 'btvnTab' && typeof loadRecords === 'function' && currentProfileId) {
    loadRecords(currentProfileId, 'btvn', 'btvnList', 'btvnCount');
  }
  if (cardId === 'chatTab' && typeof loadProfileChat === 'function' && currentProfileId) {
    if (typeof markChatAsRead === 'function') markChatAsRead(currentProfileId);
    loadProfileChat(currentProfileId);
  }
  
  // Auto-save state on form tab switch
  if (typeof saveAppState === 'function') {
    saveAppState();
  }
}
function switchMainTab(el, tab) {
  haptic('light');
  if (typeof _isTabPinned === 'function' && _isTabPinned(tab) && window.innerWidth >= 1024) return;
  
  if (typeof TabIndicator !== 'undefined') TabIndicator.moveTo(el);
  const dir = typeof navDirectionForMainTab === 'function' ? navDirectionForMainTab(tab) : 1;
  
  // Short-circuit: only hide previously active tab (instead of all 8)
  const prevActive = document.querySelector('#mainTabBar .tab.active');
  const prevTabId = prevActive?.dataset?.tab;
  if (prevActive) prevActive.classList.remove('active');
  el.classList.add('active');
  
  if (prevTabId && prevTabId !== tab) {
    const prevEl = document.getElementById('tab-' + prevTabId);
    if (prevEl && (typeof _isTabPinned !== 'function' || !_isTabPinned(prevTabId))) {
      prevEl.style.display = 'none';
    }
  }
  
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
  window.isDetailViewOpen = false;
  document.body.classList.remove('detail-view-open');
  document.documentElement.classList.remove('detail-view-open');
  currentProfileId = null;
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
  
  // Auto-save state on main tab switch
  if (typeof saveAppState === 'function') {
    saveAppState();
  }
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

// ── Header Collapse Logic (Auto & Manual) ──
let _headerManualCollapsed = localStorage.getItem('cj_header_collapsed') === '1';

function toggleHeaderCollapse(isManual = true) {
  const header = document.querySelector('.header');
  const btn = document.getElementById('headerCollapseBtn');
  if (!header) return;

  // Bật class transitioning để kích hoạt CSS transitions mượt mà khi bấm nút thủ công
  header.classList.add('header-transitioning');

  // Xóa bỏ toàn bộ inline styles trước khi toggle class để CSS transition đảm nhận chuyển động mượt mà
  _resetHeaderStyle(header);

  const isCollapsed = header.classList.toggle('header-collapsed');
  
  if (btn) {
    btn.textContent = isCollapsed ? '🔽' : '🔼';
    btn.title = isCollapsed ? 'Mở rộng header' : 'Thu gọn header';
  }

  if (isManual) {
    _headerManualCollapsed = isCollapsed;
    localStorage.setItem('cj_header_collapsed', isCollapsed ? '1' : '0');
  }

  // Tự động gỡ class transitioning sau khi hoàn tất transition (350ms)
  setTimeout(() => {
    header.classList.remove('header-transitioning');
  }, 350);
}

// Khôi phục trạng thái thu gọn thủ công khi load trang
document.addEventListener('DOMContentLoaded', () => {
  if (_headerManualCollapsed) {
    const header = document.querySelector('.header');
    const btn = document.getElementById('headerCollapseBtn');
    if (header) header.classList.add('header-collapsed');
    if (btn) {
      btn.textContent = '🔽';
      btn.title = 'Mở rộng header';
    }
  }
});

// Hàm áp dụng tiến trình co giãn theo thời gian thực (1-1 bám theo ngón tay cuộn)
function _applyHeaderScrollProgress(header, pct) {
  const headerTop = header.querySelector('.header-top');
  const viewAsBar = header.querySelector('.view-as-bar');
  const semesterBar = header.querySelector('.semester-bar');
  const btn = document.getElementById('headerCollapseBtn');

  // transition mượt mà cho padding của header (từ 10px top, 6px bottom xuống 4px top, 4px bottom)
  const paddingTop = 10 - (pct * 6);
  const paddingBottom = 6 - (pct * 2);
  header.style.padding = `${paddingTop}px 12px ${paddingBottom}px`;

  // transition cho header-top (chiều cao tối đa 58px, margin-bottom 8px)
  if (headerTop) {
    headerTop.style.maxHeight = `${(1 - pct) * 58}px`;
    headerTop.style.minHeight = '0px';
    headerTop.style.opacity = 1 - pct;
    headerTop.style.marginBottom = `${(1 - pct) * 8}px`;
    headerTop.style.paddingTop = '0px';
    headerTop.style.paddingBottom = '0px';
    headerTop.style.overflow = 'hidden';
    headerTop.style.pointerEvents = pct > 0.8 ? 'none' : 'auto';
  }

  // transition cho view-as-bar (chiều cao tối đa 36px, margin-bottom 6px, padding-top/bottom 4px)
  if (viewAsBar) {
    viewAsBar.style.maxHeight = `${(1 - pct) * 36}px`;
    viewAsBar.style.minHeight = '0px';
    viewAsBar.style.opacity = 1 - pct;
    viewAsBar.style.marginBottom = `${(1 - pct) * 6}px`;
    
    // Co giãn mượt mà padding từ 4px về 0px để triệt tiêu cú giật 10-20% cuối hành trình
    const barPad = (1 - pct) * 4;
    viewAsBar.style.paddingTop = `${barPad}px`;
    viewAsBar.style.paddingBottom = `${barPad}px`;
    
    // Co giãn luôn viền từ 1px về 0px tránh cú giật viền ở 10-20% cuối
    viewAsBar.style.borderWidth = `${1 - pct}px`;
    
    viewAsBar.style.overflow = 'hidden';
    viewAsBar.style.pointerEvents = pct > 0.8 ? 'none' : 'auto';
  }

  // transition cho semester-bar (chiều cao tối đa 36px, margin-bottom 6px, padding-top/bottom 4px)
  if (semesterBar) {
    semesterBar.style.maxHeight = `${(1 - pct) * 36}px`;
    semesterBar.style.minHeight = '0px';
    semesterBar.style.opacity = 1 - pct;
    semesterBar.style.marginBottom = `${(1 - pct) * 6}px`;
    
    // Co giãn mượt mà padding từ 4px về 0px
    const barPad = (1 - pct) * 4;
    semesterBar.style.paddingTop = `${barPad}px`;
    semesterBar.style.paddingBottom = `${barPad}px`;
    
    // Co giãn luôn viền
    semesterBar.style.borderWidth = `${1 - pct}px`;
    
    semesterBar.style.overflow = 'hidden';
    semesterBar.style.pointerEvents = pct > 0.8 ? 'none' : 'auto';
  }

  // Cập nhật emoji nút toggle theo tiến trình cuộn
  if (btn) {
    btn.textContent = pct > 0.5 ? '🔽' : '🔼';
    btn.title = pct > 0.5 ? 'Mở rộng header' : 'Thu gọn header';
  }

  // Thêm/Xóa class để đồng bộ các style CSS khác (nút toggle, tab-bar)
  // Chỉ gán class collapsed ở mốc cực sát đáy (>= 0.99) khi mọi thứ đã thu gọn hoàn toàn về 0px, tránh giật hình
  if (pct >= 0.99) {
    header.classList.add('header-collapsed');
  } else {
    header.classList.remove('header-collapsed');
  }
}

function _resetHeaderStyle(header) {
  const headerTop = header.querySelector('.header-top');
  const viewAsBar = header.querySelector('.view-as-bar');
  const semesterBar = header.querySelector('.semester-bar');

  header.style.padding = '';

  if (headerTop) {
    headerTop.style.maxHeight = '';
    headerTop.style.minHeight = '';
    headerTop.style.opacity = '';
    headerTop.style.marginBottom = '';
    headerTop.style.paddingTop = '';
    headerTop.style.paddingBottom = '';
    headerTop.style.overflow = '';
    headerTop.style.pointerEvents = '';
  }
  if (viewAsBar) {
    viewAsBar.style.maxHeight = '';
    viewAsBar.style.minHeight = '';
    viewAsBar.style.opacity = '';
    viewAsBar.style.marginBottom = '';
    viewAsBar.style.paddingTop = '';
    viewAsBar.style.paddingBottom = '';
    viewAsBar.style.borderWidth = '';
    viewAsBar.style.overflow = '';
    viewAsBar.style.pointerEvents = '';
  }
  if (semesterBar) {
    semesterBar.style.maxHeight = '';
    semesterBar.style.minHeight = '';
    semesterBar.style.opacity = '';
    semesterBar.style.marginBottom = '';
    semesterBar.style.paddingTop = '';
    semesterBar.style.paddingBottom = '';
    semesterBar.style.borderWidth = '';
    semesterBar.style.overflow = '';
    semesterBar.style.pointerEvents = '';
  }
  // Đo và ghi lại chiều cao header khi mở to hết cỡ
  requestAnimationFrame(() => {
    window._expandedHeaderHeight = header.offsetHeight;
  });
}

// Scroll position saver for transition restore
(function() {
  const scrollContainer = document.getElementById('desktopPanelsWrapper');
  if (!scrollContainer) return;

  scrollContainer.addEventListener('scroll', () => {
    // Guards: bỏ qua khi đang restore scroll hoặc đang mở hồ sơ
    if (window._scrollRestoring) return;
    if (window.isDetailViewOpen) return;
    const detailView = document.getElementById('detailView');
    if (detailView && (detailView.style.display === 'block' || detailView.classList.contains('active') || detailView.offsetHeight > 0)) {
      window.isDetailViewOpen = true;
      return;
    }

    // Debounce scroll state save
    clearTimeout(window._scrollSaveTimeout);
    window._scrollSaveTimeout = setTimeout(() => {
      try { localStorage.setItem('cj_last_scroll_top', scrollContainer.scrollTop); } catch(e) {}
    }, 300);
  });
})();

function upgradeInputsToTextareas() {
  const containers = [
    document.getElementById('infoSheet'),
    document.getElementById('sinkaTab')
  ];
  
  containers.forEach(container => {
    if (!container) return;
    
    const inputs = container.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
      if (input.id === 't2_ngay_chakki' || input.id === 'sk_ngay_ghi_chep') return;
      if (input.classList.contains('no-upgrade')) return;

      const textarea = document.createElement('textarea');
      
      Array.from(input.attributes).forEach(attr => {
        if (attr.name !== 'type') {
          textarea.setAttribute(attr.name, attr.value);
        }
      });
      
      textarea.className = input.className;
      textarea.classList.add('auto-resize-textarea');
      
      textarea.style.cssText = input.style.cssText;
      textarea.style.resize = 'none';
      textarea.style.overflowY = 'hidden';
      textarea.style.minHeight = '38px';
      textarea.style.height = '38px';
      textarea.style.lineHeight = '1.4';
      textarea.style.boxSizing = 'border-box';
      textarea.style.fontFamily = 'inherit';
      textarea.style.padding = '9px 12px';

      textarea.value = input.value;
      
      const adjustHeight = () => {
        textarea.style.height = '38px';
        const newHeight = textarea.scrollHeight;
        if (newHeight > 38) {
          textarea.style.height = newHeight + 'px';
        }
      };
      
      textarea.addEventListener('input', adjustHeight);
      textarea.addEventListener('change', adjustHeight);
      textarea.addEventListener('focus', adjustHeight);
      
      textarea.adjustHeight = adjustHeight;
      
      input.parentNode.replaceChild(textarea, input);
    });
  });
}

