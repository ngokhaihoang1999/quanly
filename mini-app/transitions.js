// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS.JS — Motion System for Mini App
// GPU-only (transform + opacity), interruptible, reduced-motion aware
// ═══════════════════════════════════════════════════════════════════════════════

// ============ 1. MOTION PREFERENCES ============
const MotionPrefs = (() => {
  const mqReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let _reduced = mqReduced?.matches || false;
  mqReduced?.addEventListener?.('change', e => { _reduced = e.matches; });

  let _fpsChecked = false;
  let _lowFps = false;

  function checkFps() {
    if (_fpsChecked) return;
    _fpsChecked = true;
    let frames = 0;
    const start = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - start < 500) {
        requestAnimationFrame(count);
      } else {
        _lowFps = (frames / ((performance.now() - start) / 1000)) < 30;
      }
    };
    requestAnimationFrame(count);
  }

  return {
    get reduced() { return _reduced; },
    get lowFps() { return _lowFps; },
    canAnimate() { return !_reduced && !_lowFps; },
    init() { checkFps(); }
  };
})();

// ============ 2. LIQUID TAB INDICATOR ============
// The indicator IS the active tab background — it slides between tabs.
// When active, the tab's own .active background becomes transparent so the indicator shows through.
const TabIndicator = (() => {
  const _indicators = new WeakMap();
  let _initialized = false;

  function _getOrCreate(container) {
    if (_indicators.has(container)) return _indicators.get(container);

    const ind = document.createElement('div');
    ind.className = 'tab-indicator';
    // MUST be first child or use proper positioning
    container.style.position = 'relative';
    container.appendChild(ind);
    _indicators.set(container, ind);

    // Position to current active tab immediately
    const activeTab = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active');
    if (activeTab) {
      _snapTo(ind, activeTab, container);
    } else {
      ind.style.opacity = '0';
    }

    return ind;
  }

  // Instantly position indicator to match a tab exactly
  function _snapTo(ind, tab, container) {
    const tRect = tab.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();

    const left = tRect.left - cRect.left + container.scrollLeft;
    const top = tRect.top - cRect.top;

    ind.style.transition = 'none';
    ind.style.left = left + 'px';
    ind.style.top = top + 'px';
    ind.style.width = tRect.width + 'px';
    ind.style.height = tRect.height + 'px';
    ind.style.borderRadius = getComputedStyle(tab).borderRadius;
    ind.style.opacity = '1';
  }

  // Animate indicator from current position to new tab
  function _slideTo(ind, tab, container) {
    const tRect = tab.getBoundingClientRect();
    const cRect = container.getBoundingClientRect();

    const left = tRect.left - cRect.left + container.scrollLeft;
    const top = tRect.top - cRect.top;
    const br = getComputedStyle(tab).borderRadius;

    // Phase 1: stretch (fast)
    ind.style.transition = 'left 0.32s cubic-bezier(0.4, 0, 0.2, 1), top 0.32s cubic-bezier(0.4, 0, 0.2, 1), width 0.32s cubic-bezier(0.4, 0, 0.2, 1), height 0.32s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.32s ease';
    ind.style.left = left + 'px';
    ind.style.top = top + 'px';
    ind.style.width = tRect.width + 'px';
    ind.style.height = tRect.height + 'px';
    ind.style.borderRadius = br;
    ind.style.opacity = '1';
  }

  function moveTo(tabEl) {
    if (!tabEl || !MotionPrefs.canAnimate()) return;
    const container = tabEl.closest('.tab-bar, .form-tabs, .dash-mode-toggle');
    if (!container) return;

    const ind = _getOrCreate(container);
    _slideTo(ind, tabEl, container);

    if (typeof haptic === 'function') haptic('selection');
  }

  function init() {
    if (_initialized) return;
    _initialized = true;

    // Add class to body so CSS knows indicator is active
    document.body.classList.add('has-tab-indicator');

    document.querySelectorAll('.tab-bar, .form-tabs').forEach(container => {
      _getOrCreate(container);
    });
  }

  function refresh() {
    document.querySelectorAll('.tab-bar, .form-tabs, .dash-mode-toggle').forEach(container => {
      if (!_indicators.has(container)) return;
      const ind = _indicators.get(container);
      const active = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active');
      if (active) _snapTo(ind, active, container);
    });
  }

  return { moveTo, init, refresh };
})();


// ============ 3. FLIP PROFILE TRANSITION ============
const FlipTransition = (() => {
  let _activeAnimation = null;
  let _lastCardRect = null;
  let _lastProfileId = null;

  function open(cardEl, profileId) {
    if (!cardEl || !MotionPrefs.canAnimate()) {
      // Fallback: simple fade
      _showDetailFade();
      return;
    }

    // Cancel previous
    if (_activeAnimation) { _activeAnimation.cancel(); _activeAnimation = null; }

    // FIRST — card position
    const cardRect = cardEl.getBoundingClientRect();
    _lastCardRect = { left: cardRect.left, top: cardRect.top, width: cardRect.width, height: cardRect.height };
    _lastProfileId = profileId;

    // Hide original card temporarily
    cardEl.style.visibility = 'hidden';

    // Create overlay + clone
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';

    // Clone the card visually  
    const clone = cardEl.cloneNode(true);
    clone.removeAttribute('onclick');
    clone.style.cssText = `
      position: fixed;
      left: ${cardRect.left}px;
      top: ${cardRect.top}px;
      width: ${cardRect.width}px;
      height: ${cardRect.height}px;
      margin: 0;
      z-index: 10001;
      pointer-events: none;
      will-change: transform;
      transform-origin: top left;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
      visibility: visible;
    `;

    overlay.appendChild(clone);
    document.body.appendChild(overlay);

    // LAST — target: full width of content area
    const content = document.querySelector('#mainContent .content') || document.getElementById('mainContent');
    const contentRect = content.getBoundingClientRect();

    // Calculate transform needed: from card position to content top-left, scaled to content width
    const scaleX = contentRect.width / cardRect.width;
    const scaleY = Math.min(scaleX * 0.6, 2); // Don't stretch height too much
    const dx = contentRect.left - cardRect.left;
    const dy = contentRect.top - cardRect.top;

    // PLAY
    _activeAnimation = clone.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, opacity: 0.3 }
    ], {
      duration: 300,
      easing: 'cubic-bezier(0.4, 0, 0, 1)',
      fill: 'forwards'
    });

    _activeAnimation.onfinish = () => {
      _showDetail();
      overlay.remove();
      cardEl.style.visibility = '';
      _activeAnimation = null;
    };

    _activeAnimation.oncancel = () => {
      overlay.remove();
      cardEl.style.visibility = '';
      _activeAnimation = null;
    };

    if (typeof haptic === 'function') haptic('medium');
  }

  function close() {
    if (!MotionPrefs.canAnimate()) {
      _hideDetailInstant();
      _finishClose();
      return;
    }

    if (_activeAnimation) { _activeAnimation.cancel(); _activeAnimation = null; }

    const detailView = document.getElementById('detailView');
    if (!detailView || detailView.style.display === 'none') {
      _finishClose();
      return;
    }

    // Find the original card
    let targetCard = null;
    let targetRect = _lastCardRect;

    if (_lastProfileId) {
      targetCard = document.querySelector(`.profile-card[data-pid="${_lastProfileId}"]`);
    }

    // If card is visible in viewport, animate towards it
    if (targetCard) {
      const tr = targetCard.getBoundingClientRect();
      // Check if card's container tab is visible (it might be display:none because we hid tabs)
      if (tr.width > 0 && tr.height > 0) {
        targetRect = { left: tr.left, top: tr.top, width: tr.width, height: tr.height };
      }
    }

    if (!targetRect) {
      // No target — just fade out
      _hideDetailFade(() => _finishClose());
      return;
    }

    // Get detail view position
    const detailRect = detailView.getBoundingClientRect();

    // Create a shrinking overlay from detail to card position
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';

    const phantom = document.createElement('div');
    phantom.style.cssText = `
      position: fixed;
      left: ${detailRect.left}px;
      top: ${detailRect.top}px;
      width: ${detailRect.width}px;
      height: ${Math.min(detailRect.height, 160)}px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      z-index: 10001;
      pointer-events: none;
      will-change: transform;
      transform-origin: top left;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      overflow: hidden;
    `;

    overlay.appendChild(phantom);
    document.body.appendChild(overlay);

    // Hide detail immediately
    detailView.style.display = 'none';

    // Show the tabs back first so card is potentially findable
    _restoreTabs();

    // Now re-find the card's actual position (tabs are visible again)
    if (targetCard) {
      const freshRect = targetCard.getBoundingClientRect();
      if (freshRect.width > 0 && freshRect.height > 0) {
        targetRect = { left: freshRect.left, top: freshRect.top, width: freshRect.width, height: freshRect.height };
      }
    }

    // Animate phantom shrinking to card position
    const phantomH = Math.min(detailRect.height, 160);
    const scaleX = targetRect.width / detailRect.width;
    const scaleY = targetRect.height / phantomH;
    const dx = targetRect.left - detailRect.left;
    const dy = targetRect.top - detailRect.top;

    _activeAnimation = phantom.animate([
      { transform: 'translate(0, 0) scale(1)', opacity: 0.7, borderRadius: 'var(--radius)' },
      { transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY})`, opacity: 0, borderRadius: 'var(--radius)' }
    ], {
      duration: 250,
      easing: 'cubic-bezier(0.4, 0, 0, 1)',
      fill: 'forwards'
    });

    _activeAnimation.onfinish = () => {
      overlay.remove();
      _finishCloseState();
      _activeAnimation = null;
    };

    _activeAnimation.oncancel = () => {
      overlay.remove();
      _finishCloseState();
      _activeAnimation = null;
    };

    if (typeof haptic === 'function') haptic('light');
  }

  // Show detail view with fade-in
  function _showDetail() {
    const dv = document.getElementById('detailView');
    dv.style.display = 'block';
    dv.style.opacity = '0';
    dv.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      dv.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      dv.style.opacity = '1';
      dv.style.transform = 'translateY(0)';
      setTimeout(() => {
        dv.style.transition = '';
        dv.style.opacity = '';
        dv.style.transform = '';
      }, 220);
    });
  }

  function _showDetailFade() {
    const dv = document.getElementById('detailView');
    dv.style.display = 'block';
    dv.style.opacity = '0';
    requestAnimationFrame(() => {
      dv.style.transition = 'opacity 0.15s ease';
      dv.style.opacity = '1';
      setTimeout(() => { dv.style.transition = ''; dv.style.opacity = ''; }, 170);
    });
  }

  function _hideDetailInstant() {
    document.getElementById('detailView').style.display = 'none';
  }

  function _hideDetailFade(cb) {
    const dv = document.getElementById('detailView');
    dv.style.transition = 'opacity 0.15s ease';
    dv.style.opacity = '0';
    setTimeout(() => {
      dv.style.display = 'none';
      dv.style.transition = '';
      dv.style.opacity = '';
      if (cb) cb();
    }, 160);
  }

  // Restore tabs WITHOUT clearing currentProfileId (that happens in _finishCloseState)
  function _restoreTabs() {
    const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
    ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure'].forEach(t => {
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

  // Called after animation completes
  function _finishCloseState() {
    currentProfileId = null;
    _lastCardRect = null;
    _lastProfileId = null;
  }

  // Full close without animation (tabs + state)
  function _finishClose() {
    _restoreTabs();
    _hideDetailInstant();
    _finishCloseState();
  }

  return { open, close };
})();


// ============ 4. SWIPE GESTURE HANDLER ============
const SwipeHandler = (() => {
  let _startX = 0, _startY = 0, _deltaX = 0, _deltaY = 0;
  let _isSwiping = false, _isTracking = false;
  let _ticking = false;
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
    _startX = e.clientX;
    _startY = e.clientY;
    _deltaX = 0;
    _deltaY = 0;
    _isTracking = true;
    _isSwiping = false;
  }

  function onMove(e) {
    if (!_isTracking) return;
    _deltaX = e.clientX - _startX;
    _deltaY = e.clientY - _startY;

    if (!_isSwiping) {
      if (Math.abs(_deltaX) > 15 && Math.abs(_deltaX) > Math.abs(_deltaY) * ANGLE_RATIO) {
        _isSwiping = true;
        _contentEl.style.willChange = 'transform, opacity';
      } else if (Math.abs(_deltaY) > 15) {
        _isTracking = false;
        return;
      }
      return;
    }

    e.preventDefault();

    if (!_ticking) {
      requestAnimationFrame(() => {
        if (_isSwiping) {
          const resistance = 0.35;
          const tx = _deltaX * resistance;
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

    // Spring back
    _contentEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease';
    _contentEl.style.transform = '';
    _contentEl.style.opacity = '';
    setTimeout(() => {
      _contentEl.style.transition = '';
      _contentEl.style.willChange = '';
    }, 260);

    if (Math.abs(_deltaX) < THRESHOLD) return;

    const direction = _deltaX > 0 ? -1 : 1;
    const detailView = document.getElementById('detailView');
    const isInDetail = detailView && detailView.style.display === 'block';

    if (isInDetail) {
      _swipeFormTab(direction);
    } else {
      _swipeMainTab(direction);
    }
  }

  function _swipeMainTab(dir) {
    const tabs = Array.from(document.querySelectorAll('#mainTabBar .tab'))
      .filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#mainTabBar .tab.active');
    const idx = tabs.indexOf(active);
    const next = idx + dir;
    if (next < 0 || next >= tabs.length) return;
    const nextTab = tabs[next];
    const tabId = nextTab.dataset.tab;
    if (tabId && typeof switchMainTab === 'function') {
      switchMainTab(nextTab, tabId);
    }
  }

  function _swipeFormTab(dir) {
    const tabs = Array.from(document.querySelectorAll('#profileTabs .form-tab'))
      .filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const active = document.querySelector('#profileTabs .form-tab.active');
    const idx = tabs.indexOf(active);
    const next = idx + dir;
    if (next < 0 || next >= tabs.length) return;
    const nextTab = tabs[next];
    const onclickStr = nextTab.getAttribute('onclick') || '';
    const match = onclickStr.match(/'([^']+)'/);
    if (match && typeof switchFormTab === 'function') {
      switchFormTab(nextTab, match[1]);
    }
  }

  return { init };
})();


// ============ 5. COUNT-UP ANIMATION ============
function countUp(el, target, duration = 500) {
  if (!el || !MotionPrefs.canAnimate()) {
    if (el) el.textContent = target;
    return;
  }

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
  const tabs = document.querySelectorAll('#mainTabBar .tab');
  tabs.forEach((t, i) => { _tabOrder[t.dataset.tab] = i; });
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
  const idx = tabs.findIndex(t => {
    const onclick = t.getAttribute('onclick') || '';
    return onclick.includes(cardId);
  });
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

  let _resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => TabIndicator.refresh(), 150);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTransitions);
} else {
  requestAnimationFrame(initTransitions);
}
