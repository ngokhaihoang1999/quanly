// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS.JS v4 — Motion System for Mini App
// GPU-only (transform + opacity), interruptible, reduced-motion aware
// ═══════════════════════════════════════════════════════════════════════════════

// ============ 1. MOTION PREFERENCES ============
const MotionPrefs = (() => {
  const mqReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let _reduced = mqReduced?.matches || false;
  mqReduced?.addEventListener?.('change', e => { _reduced = e.matches; });

  let _fpsChecked = false, _lowFps = false;
  function checkFps() {
    if (_fpsChecked) return;
    _fpsChecked = true;
    let frames = 0;
    const start = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - start < 500) requestAnimationFrame(count);
      else _lowFps = (frames / ((performance.now() - start) / 1000)) < 30;
    };
    requestAnimationFrame(count);
  }

  return {
    get reduced() { return _reduced; },
    canAnimate() { return !_reduced && !_lowFps; },
    init() { checkFps(); }
  };
})();


// ============ 2. TAB INDICATOR (Ghost slide) ============
// A ghost element slides from old tab to new tab during switch,
// then fades out. Tab's own .active styling is NEVER touched.
const TabIndicator = (() => {
  const _ghosts = new WeakMap();
  let _initialized = false;

  function _getOrCreate(container) {
    if (_ghosts.has(container)) return _ghosts.get(container);
    const ghost = document.createElement('div');
    ghost.className = 'tab-ghost';
    container.style.position = 'relative';
    container.appendChild(ghost);
    _ghosts.set(container, ghost);
    ghost.style.opacity = '0';
    return ghost;
  }

  function moveTo(newTabEl) {
    if (!newTabEl || !MotionPrefs.canAnimate()) return;
    const container = newTabEl.closest('.tab-bar, .form-tabs, .dash-mode-toggle');
    if (!container) return;

    const ghost = _getOrCreate(container);
    // Old tab = currently active one (moveTo called BEFORE class switch)
    const oldTab = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active');

    if (!oldTab || oldTab === newTabEl) return;

    const cRect = container.getBoundingClientRect();
    const oldRect = oldTab.getBoundingClientRect();
    const newRect = newTabEl.getBoundingClientRect();
    const scrollL = container.scrollLeft || 0;
    const isMainTab = container.classList.contains('tab-bar');
    const br = isMainTab ? '20px' : '8px';

    // Snap to old position
    ghost.style.transition = 'none';
    ghost.style.left = (oldRect.left - cRect.left + scrollL) + 'px';
    ghost.style.top = (oldRect.top - cRect.top) + 'px';
    ghost.style.width = oldRect.width + 'px';
    ghost.style.height = oldRect.height + 'px';
    ghost.style.borderRadius = br;
    ghost.style.opacity = '1';
    void ghost.offsetWidth;

    // Slide to new position
    ghost.style.transition = 'left 0.35s cubic-bezier(0.4,0,0.2,1), top 0.35s cubic-bezier(0.4,0,0.2,1), width 0.35s cubic-bezier(0.4,0,0.2,1), height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.35s ease, border-radius 0.2s ease';
    ghost.style.left = (newRect.left - cRect.left + scrollL) + 'px';
    ghost.style.top = (newRect.top - cRect.top) + 'px';
    ghost.style.width = newRect.width + 'px';
    ghost.style.height = newRect.height + 'px';
    ghost.style.borderRadius = br;

    // Fade out after arriving
    setTimeout(() => {
      ghost.style.transition = 'opacity 0.2s ease';
      ghost.style.opacity = '0';
    }, 360);
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    document.querySelectorAll('.tab-bar, .form-tabs').forEach(c => _getOrCreate(c));
  }

  function refresh() { /* ghost only visible during transition */ }

  return { moveTo, init, refresh };
})();


// ============ 3. PROFILE TRANSITION (Morph Rectangle) ============
// Open: accent-colored rectangle at card position → expands to detail area → fades out → content shows
// Close: rectangle at detail position → shrinks to card position → fades out → list shows
// Works on ALL viewports. Falls back to simple fade if no card element.
const ProfileTransition = (() => {
  let _storedRect = null;
  let _profileId = null;
  let _activeAnim = null;

  function open(cardEl, profileId) {
    _profileId = profileId;

    if (!MotionPrefs.canAnimate() || !cardEl) {
      document.getElementById('detailView').style.display = 'block';
      return;
    }

    // Store the card rect for close animation
    const cr = cardEl.getBoundingClientRect();
    _storedRect = { left: cr.left, top: cr.top, width: cr.width, height: cr.height };

    // Create morph overlay
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';

    const morph = document.createElement('div');
    morph.className = 'flip-morph';
    morph.style.left = cr.left + 'px';
    morph.style.top = cr.top + 'px';
    morph.style.width = cr.width + 'px';
    morph.style.height = cr.height + 'px';
    morph.style.borderRadius = getComputedStyle(cardEl).borderRadius || '12px';
    overlay.appendChild(morph);
    document.body.appendChild(overlay);

    // Subtle card press
    cardEl.style.transition = 'transform 0.12s ease';
    cardEl.style.transform = 'scale(0.96)';

    // Target: content area
    const content = document.querySelector('#mainContent .content') || document.getElementById('mainContent');
    const tRect = content.getBoundingClientRect();

    // Animate morph expanding
    requestAnimationFrame(() => {
      morph.style.transition = 'left 0.3s cubic-bezier(0.4,0,0,1), top 0.3s cubic-bezier(0.4,0,0,1), width 0.3s cubic-bezier(0.4,0,0,1), height 0.3s cubic-bezier(0.4,0,0,1), border-radius 0.3s ease, opacity 0.1s ease 0.2s';
      morph.style.left = tRect.left + 'px';
      morph.style.top = tRect.top + 'px';
      morph.style.width = tRect.width + 'px';
      morph.style.height = Math.min(tRect.height, 300) + 'px';
      morph.style.borderRadius = '12px';
      morph.style.opacity = '0';
    });

    // After morph expands, show detail view
    setTimeout(() => {
      overlay.remove();
      cardEl.style.transition = '';
      cardEl.style.transform = '';

      const dv = document.getElementById('detailView');
      dv.style.display = 'block';
      dv.style.opacity = '0';
      dv.style.transform = 'translateY(12px)';
      void dv.offsetWidth;
      dv.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      dv.style.opacity = '1';
      dv.style.transform = 'translateY(0)';
      setTimeout(() => {
        dv.style.transition = '';
        dv.style.opacity = '';
        dv.style.transform = '';
      }, 210);
    }, 300);

    if (typeof haptic === 'function') haptic('medium');
  }

  function close() {
    if (_activeAnim) { _activeAnim.cancel(); _activeAnim = null; }

    const dv = document.getElementById('detailView');
    if (!dv || dv.style.display === 'none') {
      _finishClose();
      return;
    }

    if (!MotionPrefs.canAnimate()) {
      dv.style.display = 'none';
      _finishClose();
      return;
    }

    const dvRect = dv.getBoundingClientRect();

    // First hide detail + restore tabs so we can find the card
    dv.style.display = 'none';
    _restoreTabs();

    // Try to find the actual card position now that tabs are visible
    let targetRect = _storedRect;
    if (_profileId) {
      const card = document.querySelector(`.profile-card[data-pid="${_profileId}"]`);
      if (card) {
        const r = card.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          targetRect = { left: r.left, top: r.top, width: r.width, height: r.height };
        }
      }
    }

    if (!targetRect) {
      // No target at all — just finish
      _finishCloseState();
      return;
    }

    // Create morph rectangle at detail view position
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';

    const morph = document.createElement('div');
    morph.className = 'flip-morph';
    const morphH = Math.min(dvRect.height, 120);
    morph.style.left = dvRect.left + 'px';
    morph.style.top = dvRect.top + 'px';
    morph.style.width = dvRect.width + 'px';
    morph.style.height = morphH + 'px';
    morph.style.opacity = '0.7';
    overlay.appendChild(morph);
    document.body.appendChild(overlay);

    // Animate morph shrinking to card position
    requestAnimationFrame(() => {
      morph.style.transition = 'left 0.28s cubic-bezier(0.4,0,0,1), top 0.28s cubic-bezier(0.4,0,0,1), width 0.28s cubic-bezier(0.4,0,0,1), height 0.28s cubic-bezier(0.4,0,0,1), border-radius 0.28s ease, opacity 0.28s ease';
      morph.style.left = targetRect.left + 'px';
      morph.style.top = targetRect.top + 'px';
      morph.style.width = targetRect.width + 'px';
      morph.style.height = targetRect.height + 'px';
      morph.style.borderRadius = '12px';
      morph.style.opacity = '0';
    });

    setTimeout(() => {
      overlay.remove();
      _finishCloseState();
    }, 290);

    if (typeof haptic === 'function') haptic('light');
  }

  function _restoreTabs() {
    const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
    ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure','tab-reports','tab-notes'].forEach(t => {
      const elT = document.getElementById(t);
      if (elT && (typeof _isTabPinned !== 'function' || !_isTabPinned(t.replace('tab-','')))) {
        elT.style.display = 'none';
      }
    });
    const tTab = document.getElementById('tab-' + activeTab);
    if (tTab && (typeof _isTabPinned !== 'function' || !_isTabPinned(activeTab))) {
      tTab.style.display = 'block';
    }
    document.getElementById('fabBtn').style.display = (activeTab === 'unit' || activeTab === 'personal') ? 'flex' : 'none';
  }

  function _finishCloseState() {
    currentProfileId = null;
    _storedRect = null;
    _profileId = null;
  }

  function _finishClose() {
    _restoreTabs();
    document.getElementById('detailView').style.display = 'none';
    _finishCloseState();
  }

  return { open, close };
})();


// ============ 4. SWIPE GESTURE HANDLER ============
const SwipeHandler = (() => {
  let _startX = 0, _startY = 0, _deltaX = 0, _deltaY = 0;
  let _isSwiping = false, _isTracking = false, _ticking = false;
  let _contentEl = null;
  const THRESHOLD = 50;

  function init() {
    _contentEl = document.getElementById('mainContent');
    if (!_contentEl) return;
    _contentEl.addEventListener('pointerdown', onDown, { passive: true });
    _contentEl.addEventListener('pointermove', onMove, { passive: false });
    _contentEl.addEventListener('pointerup', onUp, { passive: true });
    _contentEl.addEventListener('pointercancel', onUp, { passive: true });
  }

  function _isInputEl(el) {
    if (!el) return false;
    const t = el.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT') return true;
    if (el.contentEditable === 'true') return true;
    if (el.closest('.ac-list,.modal,.modal-overlay,.pin-keypad,.markmap,.ai-chat-msgs,.tab-bar,.form-tabs,.tl-container')) return true;
    return false;
  }

  function onDown(e) {
    if (_isInputEl(e.target)) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    _startX = e.clientX; _startY = e.clientY;
    _deltaX = 0; _deltaY = 0;
    _isTracking = true; _isSwiping = false;
  }

  function onMove(e) {
    if (!_isTracking) return;
    _deltaX = e.clientX - _startX;
    _deltaY = e.clientY - _startY;
    if (!_isSwiping) {
      if (Math.abs(_deltaX) > 15 && Math.abs(_deltaX) > Math.abs(_deltaY) * 2) _isSwiping = true;
      else if (Math.abs(_deltaY) > 15) { _isTracking = false; return; }
      return;
    }
    e.preventDefault();
    if (!_ticking) {
      requestAnimationFrame(() => {
        if (_isSwiping && _contentEl) {
          const tx = _deltaX * 0.35;
          _contentEl.style.transform = `translateX(${tx}px)`;
          _contentEl.style.opacity = Math.max(0.6, 1 - Math.abs(tx) / 300);
        }
        _ticking = false;
      });
      _ticking = true;
    }
  }

  function onUp() {
    if (!_isTracking) return;
    _isTracking = false;
    if (!_isSwiping) return;
    _isSwiping = false;
    _contentEl.style.transition = 'transform 0.25s cubic-bezier(0.2,0,0,1), opacity 0.25s ease';
    _contentEl.style.transform = '';
    _contentEl.style.opacity = '';
    setTimeout(() => { _contentEl.style.transition = ''; }, 260);
    if (Math.abs(_deltaX) < THRESHOLD) return;
    const dir = _deltaX > 0 ? -1 : 1;
    const dv = document.getElementById('detailView');
    if (dv && dv.style.display === 'block') _swipeForm(dir);
    else _swipeMain(dir);
  }

  function _swipeMain(dir) {
    const tabs = [...document.querySelectorAll('#mainTabBar .tab')].filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#mainTabBar .tab.active');
    const i = tabs.indexOf(active), n = i + dir;
    if (n < 0 || n >= tabs.length) return;
    if (tabs[n].dataset.tab && typeof switchMainTab === 'function') switchMainTab(tabs[n], tabs[n].dataset.tab);
  }

  function _swipeForm(dir) {
    const tabs = [...document.querySelectorAll('#profileTabs .form-tab')].filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#profileTabs .form-tab.active');
    const i = tabs.indexOf(active), n = i + dir;
    if (n < 0 || n >= tabs.length) return;
    const m = (tabs[n].getAttribute('onclick') || '').match(/'([^']+)'/);
    if (m && typeof switchFormTab === 'function') switchFormTab(tabs[n], m[1]);
  }

  return { init };
})();


// ============ 5. COUNT-UP ANIMATION ============
function countUp(el, target, duration = 500) {
  if (!el || !MotionPrefs.canAnimate()) { if (el) el.textContent = target; return; }
  const start = performance.now(), startVal = parseInt(el.textContent) || 0, diff = target - startVal;
  if (diff === 0) return;
  function tick(now) {
    const p = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(startVal + diff * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============ 6. CROSSFADE CONTENT ============
function crossfadeContent(container) {
  if (!container || !MotionPrefs.canAnimate()) return;
  for (let i = 0; i < container.children.length; i++) {
    const c = container.children[i];
    c.style.opacity = '0'; c.style.transform = 'translateY(8px)';
    c.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    c.style.transitionDelay = (i * 0.04) + 's';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      c.style.opacity = '1'; c.style.transform = 'translateY(0)';
      setTimeout(() => { c.style.transition = ''; c.style.transitionDelay = ''; c.style.transform = ''; }, 350 + i * 40);
    }));
  }
}

// ============ 7. DIRECTIONAL NAV SLIDE ============
function navSlide(el, dir) {
  if (!el || !MotionPrefs.canAnimate()) return;
  el.style.transition = 'none';
  el.style.transform = `translateX(${dir > 0 ? '30px' : '-30px'})`;
  el.style.opacity = '0';
  void el.offsetWidth;
  el.style.transition = 'transform 0.32s cubic-bezier(0.2,0,0,1), opacity 0.25s ease';
  el.style.transform = 'translateX(0)';
  el.style.opacity = '1';
  setTimeout(() => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; }, 340);
}

const _tabOrder = {};
function getTabIndex(name) {
  document.querySelectorAll('#mainTabBar .tab').forEach((t, i) => { _tabOrder[t.dataset.tab] = i; });
  return _tabOrder[name] ?? -1;
}
let _lastMainIdx = 0;
function navDirectionForMainTab(name) {
  const i = getTabIndex(name), d = i >= _lastMainIdx ? 1 : -1;
  _lastMainIdx = i; return d;
}
let _lastFormIdx = 0;
function navDirectionForFormTab(id) {
  const tabs = [...document.querySelectorAll('#profileTabs .form-tab')].filter(t => t.style.display !== 'none');
  const i = tabs.findIndex(t => (t.getAttribute('onclick') || '').includes(id));
  const d = i >= _lastFormIdx ? 1 : -1;
  _lastFormIdx = i >= 0 ? i : _lastFormIdx; return d;
}

// ============ INIT ============
function initTransitions() {
  MotionPrefs.init();
  setTimeout(() => { TabIndicator.init(); SwipeHandler.init(); }, 800);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTransitions);
else requestAnimationFrame(initTransitions);
