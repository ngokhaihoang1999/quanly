// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS.JS — Motion System for Mini App
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


// ============ 2. LIQUID TAB INDICATOR ============
// Strategy: DON'T suppress active tab styling, DON'T replace it.
// Instead, add a subtle "traveling glow" that slides from old tab to new tab
// during transition, then fades out. The tab's own .active styling is always intact.
const TabIndicator = (() => {
  const _ghosts = new WeakMap(); // container → ghost element
  let _initialized = false;

  function _getOrCreate(container) {
    if (_ghosts.has(container)) return _ghosts.get(container);

    const ghost = document.createElement('div');
    ghost.className = 'tab-ghost';
    container.style.position = 'relative';
    container.appendChild(ghost);
    _ghosts.set(container, ghost);
    ghost.style.opacity = '0'; // hidden initially

    return ghost;
  }

  // Animate ghost sliding from oldTab position to newTab position
  function moveTo(newTabEl) {
    if (!newTabEl || !MotionPrefs.canAnimate()) return;

    const container = newTabEl.closest('.tab-bar, .form-tabs, .dash-mode-toggle');
    if (!container) return;

    const ghost = _getOrCreate(container);

    // Find the previously active tab (before the class switch happens)
    // Since moveTo is called BEFORE classList change, the old active is still .active
    const oldTab = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active');

    if (!oldTab || oldTab === newTabEl) {
      // No animation needed - same tab or first load
      return;
    }

    const cRect = container.getBoundingClientRect();
    const oldRect = oldTab.getBoundingClientRect();
    const newRect = newTabEl.getBoundingClientRect();
    const scrollL = container.scrollLeft || 0;

    // Determine if this is main tab bar or form tabs
    const isMainTab = container.classList.contains('tab-bar');
    const br = isMainTab ? '20px' : '8px';

    // Position ghost at OLD tab position
    ghost.style.transition = 'none';
    ghost.style.left = (oldRect.left - cRect.left + scrollL) + 'px';
    ghost.style.top = (oldRect.top - cRect.top) + 'px';
    ghost.style.width = oldRect.width + 'px';
    ghost.style.height = oldRect.height + 'px';
    ghost.style.borderRadius = br;
    ghost.style.opacity = '1';

    // Force reflow
    void ghost.offsetWidth;

    // Animate to NEW tab position
    ghost.style.transition = 'left 0.35s cubic-bezier(0.4, 0, 0.2, 1), top 0.35s cubic-bezier(0.4, 0, 0.2, 1), width 0.35s cubic-bezier(0.4, 0, 0.2, 1), height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease, border-radius 0.35s ease';
    ghost.style.left = (newRect.left - cRect.left + scrollL) + 'px';
    ghost.style.top = (newRect.top - cRect.top) + 'px';
    ghost.style.width = newRect.width + 'px';
    ghost.style.height = newRect.height + 'px';
    ghost.style.borderRadius = br;

    // Fade out ghost after arriving (the real .active style takes over)
    setTimeout(() => {
      ghost.style.transition = 'opacity 0.2s ease';
      ghost.style.opacity = '0';
    }, 350);
  }

  function init() {
    if (_initialized) return;
    _initialized = true;
    // Pre-create ghosts for existing containers
    document.querySelectorAll('.tab-bar, .form-tabs').forEach(c => _getOrCreate(c));
  }

  function refresh() { /* No-op: ghost is only visible during transitions */ }

  return { moveTo, init, refresh };
})();


// ============ 3. PROFILE TRANSITION (Crossfade + Scale) ============
// Instead of FLIP (unreliable with dynamic layouts), use a polished
// crossfade with subtle scale — like Telegram/iOS detail transitions.
const ProfileTransition = (() => {
  let _lastProfileId = null;

  function open(cardEl, profileId) {
    _lastProfileId = profileId;

    if (!MotionPrefs.canAnimate()) {
      _showDetailInstant();
      return;
    }

    // Subtle press animation on the card
    if (cardEl) {
      cardEl.style.transition = 'transform 0.15s ease, opacity 0.15s ease';
      cardEl.style.transform = 'scale(0.97)';
      cardEl.style.opacity = '0.7';
      // Reset card after animation starts
      setTimeout(() => {
        cardEl.style.transition = '';
        cardEl.style.transform = '';
        cardEl.style.opacity = '';
      }, 200);
    }

    // Show detail view with entering animation
    const dv = document.getElementById('detailView');
    dv.style.display = 'block';
    dv.style.opacity = '0';
    dv.style.transform = 'translateY(20px) scale(0.98)';

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dv.style.transition = 'opacity 0.28s ease-out, transform 0.28s cubic-bezier(0.2, 0, 0, 1)';
        dv.style.opacity = '1';
        dv.style.transform = 'translateY(0) scale(1)';
        setTimeout(() => {
          dv.style.transition = '';
          dv.style.opacity = '';
          dv.style.transform = '';
        }, 300);
      });
    });

    if (typeof haptic === 'function') haptic('medium');
  }

  function close() {
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

    // Exit animation: slide down + fade
    dv.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    dv.style.opacity = '0';
    dv.style.transform = 'translateY(16px) scale(0.98)';

    setTimeout(() => {
      dv.style.display = 'none';
      dv.style.transition = '';
      dv.style.opacity = '';
      dv.style.transform = '';
      _finishClose();
    }, 210);

    if (typeof haptic === 'function') haptic('light');
  }

  function _showDetailInstant() {
    document.getElementById('detailView').style.display = 'block';
  }

  function _finishClose() {
    // Restore tabs + FAB
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
    currentProfileId = null;
    _lastProfileId = null;
  }

  return { open, close };
})();


// ============ 4. SWIPE GESTURE HANDLER ============
const SwipeHandler = (() => {
  let _startX = 0, _startY = 0, _deltaX = 0, _deltaY = 0;
  let _isSwiping = false, _isTracking = false, _ticking = false;
  let _contentEl = null;

  const THRESHOLD = 50;
  const ANGLE_RATIO = 2;

  function init() {
    _contentEl = document.getElementById('mainContent');
    if (!_contentEl) return;
    _contentEl.addEventListener('pointerdown', onDown, { passive: true });
    _contentEl.addEventListener('pointermove', onMove, { passive: false });
    _contentEl.addEventListener('pointerup', onUp, { passive: true });
    _contentEl.addEventListener('pointercancel', onUp, { passive: true });
  }

  function _isInputElement(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.contentEditable === 'true') return true;
    if (el.closest('.ac-list, .modal, .modal-overlay, .pin-keypad, .markmap, .ai-chat-msgs')) return true;
    if (el.closest('.tab-bar, .form-tabs, .tl-container')) return true;
    return false;
  }

  function onDown(e) {
    if (_isInputElement(e.target)) return;
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
      if (Math.abs(_deltaX) > 15 && Math.abs(_deltaX) > Math.abs(_deltaY) * ANGLE_RATIO) {
        _isSwiping = true;
      } else if (Math.abs(_deltaY) > 15) {
        _isTracking = false;
        return;
      }
      return;
    }

    e.preventDefault();
    if (!_ticking) {
      requestAnimationFrame(() => {
        if (_isSwiping && _contentEl) {
          const tx = _deltaX * 0.35;
          const opacity = Math.max(0.6, 1 - Math.abs(tx) / 300);
          _contentEl.style.transform = `translateX(${tx}px)`;
          _contentEl.style.opacity = opacity;
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

    _contentEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease';
    _contentEl.style.transform = '';
    _contentEl.style.opacity = '';
    setTimeout(() => { _contentEl.style.transition = ''; }, 260);

    if (Math.abs(_deltaX) < THRESHOLD) return;

    const dir = _deltaX > 0 ? -1 : 1;
    const dv = document.getElementById('detailView');
    if (dv && dv.style.display === 'block') _swipeFormTab(dir);
    else _swipeMainTab(dir);
  }

  function _swipeMainTab(dir) {
    const tabs = Array.from(document.querySelectorAll('#mainTabBar .tab'))
      .filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#mainTabBar .tab.active');
    const idx = tabs.indexOf(active);
    const next = idx + dir;
    if (next < 0 || next >= tabs.length) return;
    const tabId = tabs[next].dataset.tab;
    if (tabId && typeof switchMainTab === 'function') switchMainTab(tabs[next], tabId);
  }

  function _swipeFormTab(dir) {
    const tabs = Array.from(document.querySelectorAll('#profileTabs .form-tab'))
      .filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#profileTabs .form-tab.active');
    const idx = tabs.indexOf(active);
    const next = idx + dir;
    if (next < 0 || next >= tabs.length) return;
    const match = (tabs[next].getAttribute('onclick') || '').match(/'([^']+)'/);
    if (match && typeof switchFormTab === 'function') switchFormTab(tabs[next], match[1]);
  }

  return { init };
})();


// ============ 5. COUNT-UP ANIMATION ============
function countUp(el, target, duration = 500) {
  if (!el || !MotionPrefs.canAnimate()) { if (el) el.textContent = target; return; }
  const start = performance.now();
  const startVal = parseInt(el.textContent) || 0;
  const diff = target - startVal;
  if (diff === 0) return;

  function update(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.round(startVal + diff * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}


// ============ 6. SKELETON → CONTENT CROSSFADE ============
function crossfadeContent(container) {
  if (!container || !MotionPrefs.canAnimate()) return;
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    child.style.opacity = '0';
    child.style.transform = 'translateY(8px)';
    child.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    child.style.transitionDelay = (i * 0.04) + 's';
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        child.style.opacity = '1';
        child.style.transform = 'translateY(0)';
        setTimeout(() => {
          child.style.transition = '';
          child.style.transitionDelay = '';
          child.style.transform = '';
        }, 350 + i * 40);
      });
    });
  }
}


// ============ 7. DIRECTIONAL TAB NAVIGATION ============
function navSlide(contentEl, direction) {
  if (!contentEl || !MotionPrefs.canAnimate()) return;
  const fromX = direction > 0 ? '30px' : '-30px';
  contentEl.style.transition = 'none';
  contentEl.style.transform = `translateX(${fromX})`;
  contentEl.style.opacity = '0';
  void contentEl.offsetWidth;
  contentEl.style.transition = 'transform 0.32s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease';
  contentEl.style.transform = 'translateX(0)';
  contentEl.style.opacity = '1';
  setTimeout(() => {
    contentEl.style.transition = '';
    contentEl.style.transform = '';
    contentEl.style.opacity = '';
  }, 340);
}

const _tabOrder = {};
function getTabIndex(tabName) {
  document.querySelectorAll('#mainTabBar .tab').forEach((t, i) => { _tabOrder[t.dataset.tab] = i; });
  return _tabOrder[tabName] ?? -1;
}

let _lastMainTabIndex = 0;
function navDirectionForMainTab(newTabName) {
  const newIdx = getTabIndex(newTabName);
  const dir = newIdx >= _lastMainTabIndex ? 1 : -1;
  _lastMainTabIndex = newIdx;
  return dir;
}

let _lastFormTabIndex = 0;
function navDirectionForFormTab(cardId) {
  const tabs = Array.from(document.querySelectorAll('#profileTabs .form-tab'))
    .filter(t => t.style.display !== 'none');
  const idx = tabs.findIndex(t => (t.getAttribute('onclick') || '').includes(cardId));
  const dir = idx >= _lastFormTabIndex ? 1 : -1;
  _lastFormTabIndex = idx >= 0 ? idx : _lastFormTabIndex;
  return dir;
}


// ============ INIT ============
function initTransitions() {
  MotionPrefs.init();
  setTimeout(() => {
    TabIndicator.init();
    SwipeHandler.init();
  }, 800);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTransitions);
} else {
  requestAnimationFrame(initTransitions);
}
