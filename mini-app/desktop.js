// ============ DESKTOP PANEL ENGINE ============
// Extracted from core.js — Desktop window controls, 3-panel layout, resize dividers
// Depends on: tg, switchTab, isFresh, desktopConfig globals

// ── Window Controls ──
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

// ── Desktop Panel Engine (Phase 3) ──
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

    _initVerticalDividers();

    const tabBar = document.getElementById('mainTabBar');
    const centerPanel = document.getElementById('panelCenter');
    if (tabBar && centerPanel) {
      centerPanel.insertBefore(tabBar, centerPanel.firstChild);
    }

    _restorePanelWidths();
    _updateTabBarMode();

    if (_isTabPinned('notes') && typeof initNotesTab === 'function') initNotesTab();
    if (_isTabPinned('priority') && typeof loadPriority === 'function' && !isFresh('priority')) loadPriority();
    if (_isTabPinned('unit') && typeof loadDashboard === 'function' && !isFresh('dashboard')) { loadDashboard(); loadProfiles(); }
    if (_isTabPinned('calendar') && typeof loadCalendar === 'function' && !isFresh('calendar')) loadCalendar();

    const activeTabObj = document.querySelector('#mainTabBar .tab.active');
    const activeTab = activeTabObj ? activeTabObj.dataset.tab : null;
    if (activeTab && _isTabPinned(activeTab)) {
      const firstAvail = Array.from(document.querySelectorAll('#mainTabBar .tab')).find(t => t.style.display !== 'none');
      if (firstAvail) firstAvail.click();
    }

    _initPanelDividers();

    if (_isTabPinned('notes') && typeof renderNotes === 'function') {
      setTimeout(() => renderNotes(), 100);
    }
  } else {
    if (!_isDesktopApplied) return;
    _isDesktopApplied = false;

    const center = document.getElementById('mainContent');
    if (!center) return;

    const tabBar = document.getElementById('mainTabBar');
    const header = document.querySelector('.header');
    if (tabBar && header) {
      header.appendChild(tabBar);
    }

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
      if (panel) { panel.style.display = 'none'; panel.style.width = ''; }
      const divider = document.getElementById(side === 'left' ? 'dividerLeft' : 'dividerRight');
      if (divider) divider.style.display = 'none';
    });

    const arrangeBtn = document.getElementById('btnAutoArrange');
    if (arrangeBtn) arrangeBtn.style.display = 'none';

    if (typeof renderNotes === 'function') {
      setTimeout(() => renderNotes(), 100);
    }

    if (typeof applyPermissions === 'function') applyPermissions();
    setTimeout(() => _updateTabBarMode(), 50);
  }
}

// ── Drag-to-resize ──
const PANEL_MIN_W = 120;
const CENTER_MIN_W = 200;
const PANEL_COLLAPSE_W = 140;

function _initPanelDividers() {
  _setupDivider('dividerLeft', 'panelLeft', 'left');
  _setupDivider('dividerRight', 'panelRight', 'right');
}

function _setupDivider(dividerId, panelId, side) {
  const divider = document.getElementById(dividerId);
  const panel = document.getElementById(panelId);
  if (!divider || !panel) return;

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
      let newW = Math.max(PANEL_MIN_W, startW + delta);
      let remain = totalAvail - newW;
      let otherW = otherStartW;
      let centerW = remain - otherW;

      if (centerW < CENTER_MIN_W) {
        centerW = CENTER_MIN_W;
        otherW = remain - centerW;
        if (otherW < PANEL_MIN_W) {
          otherW = PANEL_MIN_W;
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

  tabBar.classList.remove('tab-bar--wide', 'tab-bar--dropdown', 'tab-bar--compact');
  const existingDropdown = tabBar.querySelector('.tab-dropdown');
  if (existingDropdown) existingDropdown.remove();

  const wideThreshold = count * 90;

  if (w > wideThreshold) {
    tabBar.classList.add('tab-bar--wide');
  } else {
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
    if (lw + rw + CENTER_MIN_W + divW > total) return;
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

  const all = [...left, ...right];
  const unique = new Set(all);
  if (all.length !== unique.size) {
    showToast('⚠️ Không thể gán cùng 1 tab cho nhiều vị trí!');
    return;
  }

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

  desktopConfig = { left, right };
  try { localStorage.setItem('cj_desktop_config', JSON.stringify(desktopConfig)); } catch(e) {}

  _isDesktopApplied = false;
  applyDesktopLayout();
  
  showToast('✅ Đã cập nhật bố cục desktop!');
  const modal = document.getElementById('personalizationModal');
  if (modal) modal.remove();
}

function _resetDesktopConfig() {
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

  const lt2 = document.getElementById('dl_left_top');
  const lb2 = document.getElementById('dl_left_bottom');
  const rt2 = document.getElementById('dl_right_top');
  const rb2 = document.getElementById('dl_right_bottom');
  if (lt2) lt2.value = '';
  if (lb2) lb2.value = '';
  if (rt2) rt2.value = 'notes';
  if (rb2) rb2.value = 'priority';
  _updateDesktopLayoutPreview();

  _isDesktopApplied = false;
  applyDesktopLayout();
  
  showToast('↩ Đã reset bố cục về mặc định!');
}
