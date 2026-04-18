// ═══════════════════════════════════════════════════════════════════════════════
// TRANSITIONS.JS v5 — Motion System for Mini App
// GPU-only (transform + opacity), reduced-motion & low-FPS aware
// ═══════════════════════════════════════════════════════════════════════════════

// ============ 1. MOTION PREFERENCES ============
const MotionPrefs = (() => {
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let _reduced = mq?.matches || false;
  mq?.addEventListener?.('change', e => { _reduced = e.matches; });

  let _checked = false, _lowFps = false;
  function checkFps() {
    if (_checked) return;
    _checked = true;
    let frames = 0;
    const t0 = performance.now();
    const count = () => {
      frames++;
      if (performance.now() - t0 < 500) requestAnimationFrame(count);
      else _lowFps = (frames / ((performance.now() - t0) / 1000)) < 30;
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
const TabIndicator = (() => {
  const _ghosts = new WeakMap();
  let _inited = false;

  function _getOrCreate(container) {
    if (_ghosts.has(container)) return _ghosts.get(container);
    const g = document.createElement('div');
    g.className = 'tab-ghost';
    container.style.position = 'relative';
    container.appendChild(g);
    _ghosts.set(container, g);
    g.style.opacity = '0';
    return g;
  }

  function moveTo(newTab) {
    if (!newTab || !MotionPrefs.canAnimate()) return;
    const container = newTab.closest('.tab-bar, .form-tabs, .dash-mode-toggle');
    if (!container) return;
    const ghost = _getOrCreate(container);
    const oldTab = container.querySelector('.tab.active, .form-tab.active, .dash-mode-btn.active');
    if (!oldTab || oldTab === newTab) return;

    const cR = container.getBoundingClientRect();
    const oR = oldTab.getBoundingClientRect();
    const nR = newTab.getBoundingClientRect();
    const sL = container.scrollLeft || 0;
    const br = container.classList.contains('tab-bar') ? '20px' : '8px';
    const ease = '0.35s cubic-bezier(0.4,0,0.2,1)';

    // Snap to old position
    ghost.style.transition = 'none';
    ghost.style.left = (oR.left - cR.left + sL) + 'px';
    ghost.style.top = (oR.top - cR.top) + 'px';
    ghost.style.width = oR.width + 'px';
    ghost.style.height = oR.height + 'px';
    ghost.style.borderRadius = br;
    ghost.style.opacity = '1';
    void ghost.offsetWidth;

    // Slide to new position
    ghost.style.transition = `left ${ease}, top ${ease}, width ${ease}, height ${ease}, opacity 0.35s ease, border-radius 0.2s ease`;
    ghost.style.left = (nR.left - cR.left + sL) + 'px';
    ghost.style.top = (nR.top - cR.top) + 'px';
    ghost.style.width = nR.width + 'px';
    ghost.style.height = nR.height + 'px';

    setTimeout(() => { ghost.style.transition = 'opacity 0.2s ease'; ghost.style.opacity = '0'; }, 360);
  }

  function init() {
    if (_inited) return;
    _inited = true;
    document.querySelectorAll('.tab-bar, .form-tabs').forEach(c => _getOrCreate(c));
  }

  return { moveTo, init };
})();


// ============ 3. PROFILE TRANSITION (Card Blink) ============
const ProfileTransition = (() => {
  let _pid = null, _cardEl = null, _containerId = null;
  let _scroll = { windowY: 0, panel: 0, main: 0 };

  const CONTAINERS = ['profileList', 'dashMyList', 'dashSubUnits', 'dashUnitList', 'staffList', 'unitPopupList'];

  function _saveScroll() {
    _scroll.windowY = window.scrollY || window.pageYOffset || 0;
    const p = document.getElementById('panelCenter');
    _scroll.panel = p ? p.scrollTop : 0;
    const m = document.getElementById('mainContent');
    _scroll.main = m ? m.scrollTop : 0;
  }

  function _restoreScroll() {
    window.scrollTo(0, _scroll.windowY);
    const p = document.getElementById('panelCenter');
    if (p) p.scrollTop = _scroll.panel;
    const m = document.getElementById('mainContent');
    if (m) m.scrollTop = _scroll.main;
  }

  function _blink(card) {
    if (!card || !MotionPrefs.canAnimate()) return;
    card.style.transition = 'transform 0.15s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s ease, border-color 0.15s ease';
    card.style.transform = 'scale(0.96)';
    card.style.boxShadow = '0 0 0 3px var(--accent), 0 4px 20px var(--fab-shadow)';
    card.style.borderColor = 'var(--accent)';
    setTimeout(() => {
      card.style.transform = 'scale(1.02)';
      setTimeout(() => {
        card.style.transition = 'transform 0.2s ease, box-shadow 0.4s ease, border-color 0.4s ease';
        card.style.transform = '';
        card.style.boxShadow = '';
        card.style.borderColor = '';
        setTimeout(() => { card.style.transition = ''; }, 420);
      }, 150);
    }, 150);
  }

  // Animate `el` with a quick fade+slide (in or out)
  function _fade(el, show) {
    if (!MotionPrefs.canAnimate()) return;
    const [from, to] = show ? ['0', '1'] : ['1', '0'];
    const y = show ? '10px' : '8px';
    el.style.opacity = from;
    el.style.transform = show ? `translateY(${y})` : '';
    void el.offsetWidth;
    el.style.transition = `opacity 0.2s ease, transform 0.2s ease`;
    el.style.opacity = to;
    el.style.transform = show ? 'translateY(0)' : `translateY(${y})`;
    setTimeout(() => { el.style.transition = ''; el.style.opacity = ''; el.style.transform = ''; }, 220);
  }

  function _findContainer(cardEl) {
    let el = cardEl?.parentElement;
    while (el) {
      if (el.id && (CONTAINERS.includes(el.id) || el.id.startsWith('subteam_') || el.id.startsWith('subgrp_'))) return el.id;
      el = el.parentElement;
    }
    return null;
  }

  // Find the card to blink on close — prefer stored ref, then container-scoped query, then global
  function _findCard() {
    if (_cardEl && document.body.contains(_cardEl)) return _cardEl;
    if (_containerId) {
      const c = document.querySelector(`#${_containerId} .profile-card[data-pid="${_pid}"]`);
      if (c) return c;
    }
    return document.querySelector(`.profile-card[data-pid="${_pid}"]`);
  }

  function _restoreTabs() {
    const active = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
    ['tab-unit','tab-personal','tab-calendar','tab-priority','tab-staff','tab-structure','tab-reports','tab-notes'].forEach(t => {
      const el = document.getElementById(t);
      if (el && (typeof _isTabPinned !== 'function' || !_isTabPinned(t.replace('tab-','')))) el.style.display = 'none';
    });
    const tTab = document.getElementById('tab-' + active);
    if (tTab && (typeof _isTabPinned !== 'function' || !_isTabPinned(active))) tTab.style.display = 'block';
    document.getElementById('fabBtn').style.display = (active === 'unit' || active === 'personal') ? 'flex' : 'none';
  }

  function _reset() { currentProfileId = null; _pid = null; _cardEl = null; _containerId = null; }

  function open(cardEl, profileId) {
    _pid = profileId;
    _cardEl = cardEl;
    _containerId = _findContainer(cardEl);
    _saveScroll();
    _blink(cardEl);

    setTimeout(() => {
      const dv = document.getElementById('detailView');
      dv.style.display = 'block';
      _fade(dv, true);
    }, 180);

    if (typeof haptic === 'function') haptic('medium');
  }

  function close() {
    const dv = document.getElementById('detailView');
    if (!dv || dv.style.display === 'none') { _restoreTabs(); dv && (dv.style.display = 'none'); setTimeout(_restoreScroll, 60); _reset(); return; }

    if (!MotionPrefs.canAnimate()) {
      dv.style.display = 'none';
      _restoreTabs(); setTimeout(_restoreScroll, 60); _reset();
      return;
    }

    _fade(dv, false);

    setTimeout(() => {
      dv.style.display = 'none';
      _restoreTabs();
      _restoreScroll();

      if (_pid) {
        requestAnimationFrame(() => {
          const card = _findCard();
          _blink(card);
          if (card) {
            const r = card.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          _reset();
        });
      } else {
        _reset();
      }
    }, 190);

    if (typeof haptic === 'function') haptic('light');
  }

  return { open, close };
})();


// ============ 4. SWIPE GESTURE HANDLER ============
const SwipeHandler = (() => {
  let _sx = 0, _sy = 0, _dx = 0, _dy = 0;
  let _swiping = false, _tracking = false, _ticking = false;
  let _el = null;
  const THRESHOLD = 50;
  const SKIP = '.ac-list,.modal,.modal-overlay,.pin-keypad,.markmap,.ai-chat-msgs,.tab-bar,.form-tabs,.tl-container';

  function _isInput(el) {
    if (!el) return false;
    const t = el.tagName;
    return t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || el.contentEditable === 'true' || !!el.closest(SKIP);
  }

  function onDown(e) {
    if (_isInput(e.target) || (e.pointerType === 'mouse' && e.button !== 0)) return;
    _sx = e.clientX; _sy = e.clientY; _dx = 0; _dy = 0;
    _tracking = true; _swiping = false;
  }

  function onMove(e) {
    if (!_tracking) return;
    _dx = e.clientX - _sx; _dy = e.clientY - _sy;
    if (!_swiping) {
      if (Math.abs(_dx) > 15 && Math.abs(_dx) > Math.abs(_dy) * 2) _swiping = true;
      else if (Math.abs(_dy) > 15) { _tracking = false; return; }
      return;
    }
    e.preventDefault();
    if (!_ticking) {
      requestAnimationFrame(() => {
        if (_swiping && _el) {
          const tx = _dx * 0.35;
          _el.style.transform = `translateX(${tx}px)`;
          _el.style.opacity = Math.max(0.6, 1 - Math.abs(tx) / 300);
        }
        _ticking = false;
      });
      _ticking = true;
    }
  }

  function onUp() {
    if (!_tracking) return;
    _tracking = false;
    if (!_swiping) return;
    _swiping = false;
    _el.style.transition = 'transform 0.25s cubic-bezier(0.2,0,0,1), opacity 0.25s ease';
    _el.style.transform = ''; _el.style.opacity = '';
    setTimeout(() => { _el.style.transition = ''; }, 260);
    if (Math.abs(_dx) < THRESHOLD) return;
    const dir = _dx > 0 ? -1 : 1;
    const dv = document.getElementById('detailView');
    (dv && dv.style.display === 'block') ? _swipeForm(dir) : _swipeMain(dir);
  }

  function _swipeMain(dir) {
    const tabs = [...document.querySelectorAll('#mainTabBar .tab')].filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const i = tabs.indexOf(document.querySelector('#mainTabBar .tab.active'));
    const n = i + dir;
    if (n >= 0 && n < tabs.length && tabs[n].dataset.tab && typeof switchMainTab === 'function') switchMainTab(tabs[n], tabs[n].dataset.tab);
  }

  function _swipeForm(dir) {
    const tabs = [...document.querySelectorAll('#profileTabs .form-tab')].filter(t => t.style.display !== 'none' && t.offsetParent !== null);
    const i = tabs.indexOf(document.querySelector('#profileTabs .form-tab.active'));
    const n = i + dir;
    if (n < 0 || n >= tabs.length) return;
    const m = (tabs[n].getAttribute('onclick') || '').match(/'([^']+)'/);
    if (m && typeof switchFormTab === 'function') switchFormTab(tabs[n], m[1]);
  }

  function init() {
    _el = document.getElementById('mainContent');
    if (!_el) return;
    _el.addEventListener('pointerdown', onDown, { passive: true });
    _el.addEventListener('pointermove', onMove, { passive: false });
    _el.addEventListener('pointerup', onUp, { passive: true });
    _el.addEventListener('pointercancel', onUp, { passive: true });
  }

  return { init };
})();


// ============ 5. COUNT-UP ANIMATION ============
function countUp(el, target, duration = 500) {
  if (!el || !MotionPrefs.canAnimate()) { if (el) el.textContent = target; return; }
  const t0 = performance.now(), v0 = parseInt(el.textContent) || 0, diff = target - v0;
  if (diff === 0) return;
  const tick = now => {
    const p = Math.min((now - t0) / duration, 1);
    el.textContent = Math.round(v0 + diff * (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p)));
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}


// ============ 6. DIRECTIONAL NAV SLIDE ============
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
let _lastMainIdx = 0, _lastFormIdx = 0;

function getTabIndex(name) {
  document.querySelectorAll('#mainTabBar .tab').forEach((t, i) => { _tabOrder[t.dataset.tab] = i; });
  return _tabOrder[name] ?? -1;
}
function navDirectionForMainTab(name) {
  const i = getTabIndex(name), d = i >= _lastMainIdx ? 1 : -1;
  _lastMainIdx = i; return d;
}
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
