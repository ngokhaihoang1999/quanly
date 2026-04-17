// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS.JS — Motion System for Mini App
// GPU-only (transform + opacity), interruptible, reduced-motion aware
// ═══════════════════════════════════════════════════════════════════════════════

// ============ 1. MOTION PREFERENCES ============
const MotionPrefs = (() => {
  const mqReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let _reduced = mqReduced?.matches || false;
  mqReduced?.addEventListener?.('change', e => { _reduced = e.matches; });

  // Simple FPS check — run once on first animation
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

// ============ 2. FLIP PROFILE TRANSITION ============
const FlipTransition = (() => {
  let _activeAnimation = null;
  let _lastCardRect = null;
  let _lastCardId = null;

  // Clone the visual appearance of a card for the overlay
  function createClone(card) {
    const clone = card.cloneNode(true);
    clone.className = 'flip-clone';
    clone.style.cssText = `
      position: fixed; z-index: 10001; pointer-events: none;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); overflow: hidden;
      will-change: transform, opacity;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    `;
    // Remove onclick to prevent accidental triggering
    clone.removeAttribute('onclick');
    return clone;
  }

  function open(cardEl, profileId) {
    if (!cardEl || !MotionPrefs.canAnimate()) {
      // Fallback: just show with fade
      _showDetailFade();
      return;
    }

    // Cancel any in-progress animation
    if (_activeAnimation) { _activeAnimation.cancel(); _activeAnimation = null; }

    // FIRST — capture card's position
    const cardRect = cardEl.getBoundingClientRect();
    _lastCardRect = cardRect;
    _lastCardId = profileId;

    // Store scroll position so we can restore later
    _lastCardEl = cardEl;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';
    overlay.id = 'flipOverlay';

    // Create clone of the card
    const clone = createClone(cardEl);

    // Set clone to card's exact position
    clone.style.left = cardRect.left + 'px';
    clone.style.top = cardRect.top + 'px';
    clone.style.width = cardRect.width + 'px';
    clone.style.height = cardRect.height + 'px';

    overlay.appendChild(clone);
    document.body.appendChild(overlay);

    // Hide original card during animation
    cardEl.style.opacity = '0';

    // LAST — calculate target position (full content area)
    const content = document.getElementById('mainContent');
    const contentRect = content ? content.getBoundingClientRect() : { left: 0, top: 60, width: window.innerWidth, height: window.innerHeight - 60 };

    // Target: top of content area, full width, auto height
    const targetLeft = contentRect.left;
    const targetTop = contentRect.top;
    const targetWidth = contentRect.width;

    // Calculate scale and translate
    const scaleX = targetWidth / cardRect.width;
    const scaleY = Math.min(scaleX, 2.5); // Don't stretch too much vertically
    const translateX = targetLeft - cardRect.left + (targetWidth - cardRect.width * scaleX) / 2;
    const translateY = targetTop - cardRect.top;

    // PLAY — animate using Web Animations API
    _activeAnimation = clone.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        opacity: 1,
        borderRadius: 'var(--radius)'
      },
      {
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
        opacity: 0.6,
        borderRadius: '4px'
      }
    ], {
      duration: 320,
      easing: 'cubic-bezier(0.4, 0, 0, 1)',
      fill: 'forwards'
    });

    _activeAnimation.onfinish = () => {
      // Show actual detail view
      _showDetail();
      // Clean up overlay
      overlay.remove();
      _activeAnimation = null;
      // Restore card opacity
      cardEl.style.opacity = '';
    };

    _activeAnimation.oncancel = () => {
      overlay.remove();
      cardEl.style.opacity = '';
      _activeAnimation = null;
    };

    // Haptic feedback
    if (typeof haptic === 'function') haptic('medium');
  }

  let _lastCardEl = null;

  function close() {
    if (!MotionPrefs.canAnimate() || !_lastCardRect) {
      _hideDetail();
      return;
    }

    // Cancel any in-progress animation
    if (_activeAnimation) { _activeAnimation.cancel(); _activeAnimation = null; }

    const detailView = document.getElementById('detailView');
    if (!detailView || detailView.style.display === 'none') {
      _hideDetail();
      return;
    }

    const detailRect = detailView.getBoundingClientRect();

    // Try to find the original card by profile id
    let targetRect = _lastCardRect;
    let targetCard = null;

    if (_lastCardId) {
      targetCard = document.querySelector(`.profile-card[data-pid="${_lastCardId}"]`);
      if (targetCard) {
        // Card is still in DOM — check if it's visible
        const tr = targetCard.getBoundingClientRect();
        if (tr.top > -100 && tr.top < window.innerHeight + 100) {
          targetRect = tr;
        } else {
          // Card out of viewport — use fast animation
          _hideDetailFast();
          return;
        }
      }
    }

    // Create overlay for reverse animation
    const overlay = document.createElement('div');
    overlay.className = 'flip-overlay';
    overlay.id = 'flipOverlay';

    const clone = document.createElement('div');
    clone.className = 'flip-clone';
    clone.style.cssText = `
      position: fixed; z-index: 10001; pointer-events: none;
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 4px; overflow: hidden;
      will-change: transform, opacity;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      left: ${detailRect.left}px; top: ${detailRect.top}px;
      width: ${detailRect.width}px; height: ${Math.min(detailRect.height, 200)}px;
    `;

    overlay.appendChild(clone);
    document.body.appendChild(overlay);

    // Hide detail immediately
    detailView.style.display = 'none';

    // PLAY — reverse animation (detail → card)
    const scaleX = targetRect.width / detailRect.width;
    const scaleY = targetRect.height / Math.min(detailRect.height, 200);
    const translateX = targetRect.left - detailRect.left;
    const translateY = targetRect.top - detailRect.top;

    _activeAnimation = clone.animate([
      {
        transform: 'translate(0, 0) scale(1)',
        opacity: 0.8,
        borderRadius: '4px'
      },
      {
        transform: `translate(${translateX}px, ${translateY}px) scale(${scaleX}, ${scaleY})`,
        opacity: 1,
        borderRadius: 'var(--radius)'
      }
    ], {
      duration: 250,
      easing: 'cubic-bezier(0.4, 0, 0, 1)',
      fill: 'forwards'
    });

    _activeAnimation.onfinish = () => {
      overlay.remove();
      _finishClose();
      _activeAnimation = null;
    };

    _activeAnimation.oncancel = () => {
      overlay.remove();
      _finishClose();
      _activeAnimation = null;
    };

    if (typeof haptic === 'function') haptic('light');
  }

  function _showDetail() {
    document.getElementById('detailView').style.display = 'block';
    // Fade in content inside detail
    const detailContent = document.getElementById('detailView');
    if (detailContent) {
      detailContent.style.opacity = '0';
      detailContent.style.transform = 'translateY(8px)';
      requestAnimationFrame(() => {
        detailContent.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
        detailContent.style.opacity = '1';
        detailContent.style.transform = 'translateY(0)';
        setTimeout(() => {
          detailContent.style.transition = '';
          detailContent.style.transform = '';
        }, 220);
      });
    }
  }

  function _showDetailFade() {
    const dv = document.getElementById('detailView');
    dv.style.display = 'block';
    dv.style.opacity = '0';
    dv.style.transform = 'translateY(12px)';
    requestAnimationFrame(() => {
      dv.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
      dv.style.opacity = '1';
      dv.style.transform = 'translateY(0)';
      setTimeout(() => { dv.style.transition = ''; dv.style.transform = ''; }, 170);
    });
  }

  function _hideDetail() {
    const dv = document.getElementById('detailView');
    dv.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    dv.style.opacity = '0';
    dv.style.transform = 'translateY(12px)';
    setTimeout(() => {
      dv.style.display = 'none';
      dv.style.transition = '';
      dv.style.opacity = '';
      dv.style.transform = '';
      _finishClose();
    }, 160);
  }

  function _hideDetailFast() {
    const dv = document.getElementById('detailView');
    // Quick scale down + fade
    dv.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
    dv.style.opacity = '0';
    dv.style.transform = 'scale(0.95) translateY(8px)';
    setTimeout(() => {
      dv.style.display = 'none';
      dv.style.transition = '';
      dv.style.opacity = '';
      dv.style.transform = '';
      _finishClose();
    }, 190);
  }

  function _finishClose() {
    // Trigger the original backToList logic (tabs, FAB, etc.)
    // This is called AFTER animation completes
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
    currentProfileId = null;

    // Reset stored state
    _lastCardRect = null;
    _lastCardId = null;
    _lastCardEl = null;
  }

  return { open, close };
})();


// ============ 3. LIQUID TAB INDICATOR ============
const TabIndicator = (() => {
  const _indicators = new WeakMap(); // container → indicator element

  function _getOrCreate(container) {
    if (_indicators.has(container)) return _indicators.get(container);

    // Create indicator element
    const ind = document.createElement('div');
    ind.className = 'tab-indicator';
    container.style.position = 'relative';
    container.appendChild(ind);
    _indicators.set(container, ind);

    // Position to current active tab immediately (no animation)
    const activeTab = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active, .chip.active, .chip.selected');
    if (activeTab) {
      _positionTo(ind, activeTab, container, false);
    }

    return ind;
  }

  function _positionTo(ind, tab, container, animate = true) {
    const tabRect = tab.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;

    const left = tabRect.left - containerRect.left + scrollLeft;
    const width = tabRect.width;

    if (!animate || !MotionPrefs.canAnimate()) {
      // Instant position
      ind.style.transition = 'none';
      ind.style.transform = `translateX(${left}px) scaleX(1)`;
      ind.style.width = width + 'px';
      ind.style.opacity = '1';
      return;
    }

    // Get current position
    const currentTransform = ind.style.transform || '';
    const currentX = parseFloat(currentTransform.match(/translateX\(([^)]+)px\)/)?.[1] || left);
    const currentW = parseFloat(ind.style.width) || width;

    // Phase 1: stretch to cover both positions
    const minX = Math.min(currentX, left);
    const maxRight = Math.max(currentX + currentW, left + width);
    const stretchWidth = maxRight - minX;

    ind.style.transition = 'none';
    ind.style.transform = `translateX(${currentX}px) scaleX(1)`;
    ind.style.width = currentW + 'px';

    // Force reflow
    void ind.offsetWidth;

    // Phase 1: stretch
    ind.style.transition = 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), width 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.2s';
    ind.style.transform = `translateX(${minX}px) scaleX(1)`;
    ind.style.width = stretchWidth + 'px';
    ind.style.borderRadius = '10px'; // flatten during stretch

    // Phase 2: contract to target
    setTimeout(() => {
      ind.style.transition = 'transform 0.22s cubic-bezier(0, 0, 0.2, 1), width 0.22s cubic-bezier(0, 0, 0.2, 1), border-radius 0.22s';
      ind.style.transform = `translateX(${left}px) scaleX(1)`;
      ind.style.width = width + 'px';
      ind.style.borderRadius = '20px'; // back to pill shape
    }, 180);

    if (typeof haptic === 'function') haptic('selection');
  }

  function moveTo(tabEl) {
    if (!tabEl) return;
    const container = tabEl.closest('.tab-bar, .form-tabs, .dash-mode-toggle, #statusFilter, #notesFilterChips');
    if (!container) return;
    const ind = _getOrCreate(container);
    _positionTo(ind, tabEl, container, true);
  }

  // Initialize indicators for existing active tabs
  function init() {
    document.querySelectorAll('.tab-bar, .form-tabs').forEach(container => {
      _getOrCreate(container);
    });
  }

  // Refresh position (e.g. after resize)
  function refresh() {
    document.querySelectorAll('.tab-bar, .form-tabs').forEach(container => {
      if (!_indicators.has(container)) return;
      const ind = _indicators.get(container);
      const active = container.querySelector('.tab.active, .form-tab.active');
      if (active) _positionTo(ind, active, container, false);
    });
  }

  return { moveTo, init, refresh };
})();


// ============ 4. SWIPE GESTURE HANDLER ============
const SwipeHandler = (() => {
  let _startX = 0, _startY = 0, _deltaX = 0, _deltaY = 0;
  let _isSwiping = false, _isTracking = false;
  let _ticking = false;
  let _contentEl = null;

  const THRESHOLD = 50;     // min horizontal px to trigger
  const ANGLE_RATIO = 2;    // deltaX must be > deltaY * ratio

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
    if (el.closest('.ac-list, .modal, .modal-overlay, .pin-keypad')) return true;
    // Don't swipe on horizontal-scrollable elements like tab bars
    if (el.closest('.tab-bar, .form-tabs')) return true;
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

    // Determine if this is a horizontal swipe
    if (!_isSwiping) {
      if (Math.abs(_deltaX) > 15 && Math.abs(_deltaX) > Math.abs(_deltaY) * ANGLE_RATIO) {
        _isSwiping = true;
        _contentEl.style.willChange = 'transform, opacity';
      } else if (Math.abs(_deltaY) > 15) {
        // Vertical scroll — abort
        _isTracking = false;
        return;
      }
      return;
    }

    e.preventDefault(); // Prevent scroll while swiping

    if (!_ticking) {
      requestAnimationFrame(() => {
        if (_isSwiping) {
          // Translate content with resistance
          const resistance = 0.4;
          const tx = _deltaX * resistance;
          const opacity = Math.max(0.5, 1 - Math.abs(tx) / 400);
          _contentEl.style.transform = `translateX(${tx}px)`;
          _contentEl.style.opacity = opacity;
        }
        _ticking = false;
      });
      _ticking = true;
    }
  }

  function onUp(e) {
    if (!_isTracking) return;
    _isTracking = false;

    if (!_isSwiping) return;
    _isSwiping = false;

    // Snap back animation
    _contentEl.style.transition = 'transform 0.25s cubic-bezier(0.2, 0, 0, 1), opacity 0.25s ease';
    _contentEl.style.transform = '';
    _contentEl.style.opacity = '';

    setTimeout(() => {
      _contentEl.style.transition = '';
      _contentEl.style.willChange = '';
    }, 260);

    // Check threshold
    if (Math.abs(_deltaX) < THRESHOLD) return;

    const direction = _deltaX > 0 ? -1 : 1; // swipe left = next tab, swipe right = prev tab

    // Determine context: detail view or main tabs
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
    // Trigger the tab switch
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
    // easeOutExpo
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    el.textContent = Math.round(startVal + diff * eased);
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}


// ============ 6. SKELETON → CONTENT CROSSFADE ============
function crossfadeContent(container) {
  if (!container || !MotionPrefs.canAnimate()) return;

  // Apply fade-in to children
  const children = container.children;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    child.style.opacity = '0';
    child.style.transform = 'translateY(8px)';
    child.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    child.style.transitionDelay = (i * 0.04) + 's'; // stagger

    // Trigger reflow then animate
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        child.style.opacity = '1';
        child.style.transform = 'translateY(0)';
        // Cleanup after animation
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
  // direction: 1 = forward (slide from right), -1 = backward (slide from left)
  if (!contentEl || !MotionPrefs.canAnimate()) return;

  const fromX = direction > 0 ? '30px' : '-30px';

  contentEl.style.transition = 'none';
  contentEl.style.transform = `translateX(${fromX})`;
  contentEl.style.opacity = '0';

  // Force reflow
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

// Track tab indices for direction
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

// Same for form tabs
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

  // Delay indicator init slightly to ensure DOM is ready
  setTimeout(() => {
    TabIndicator.init();
    SwipeHandler.init();
  }, 500);

  // Refresh indicator on resize
  window.addEventListener('resize', () => {
    TabIndicator.refresh();
  });
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTransitions);
} else {
  // DOM already loaded — init on next frame
  requestAnimationFrame(initTransitions);
}
