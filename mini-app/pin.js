// ============ PIN LOCK SYSTEM ============
// Extracted from core.js — PIN authentication & setup
// Depends on: _pinUnlocked (global), tg, haptic(), showToast()

const PIN_HASH_KEY = 'cj_pin_hash';
const PIN_ENABLED_KEY = 'cj_pin_enabled';

async function _hashPin(pin) {
  const data = new TextEncoder().encode(pin + '_cj_salt_2026');
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function _isPinEnabled() {
  return localStorage.getItem(PIN_ENABLED_KEY) === '1' && !!localStorage.getItem(PIN_HASH_KEY);
}

function _showPinLock() {
  if (_pinUnlocked || !_isPinEnabled()) return;
  // Create fullscreen PIN overlay
  const overlay = document.createElement('div');
  overlay.id = 'pinLockOverlay';
  overlay.innerHTML = `
    <div class="pin-lock-container">
      <div class="pin-lock-icon">🔒</div>
      <div class="pin-lock-title">Nhập mã PIN</div>
      <div class="pin-lock-subtitle">Vui lòng nhập mã PIN 6 số để mở khoá</div>
      <div class="pin-dots" id="pinDots">
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="pinError"></div>
      <div class="pin-keypad">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k => 
          k === '' ? '<div class="pin-key empty"></div>' :
          k === '⌫' ? '<div class="pin-key del" onclick="_pinKeyPress(\'del\')">⌫</div>' :
          `<div class="pin-key" onclick="_pinKeyPress(${k})">${k}</div>`
        ).join('')}
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

let _pinInput = '';
async function _pinKeyPress(key) {
  const errEl = document.getElementById('pinError');
  if (key === 'del') {
    _pinInput = _pinInput.slice(0, -1);
  } else {
    if (_pinInput.length >= 6) return;
    _pinInput += String(key);
  }
  // Telegram haptic feedback for native feel
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch(e) {}
  // Update dots
  const dots = document.querySelectorAll('#pinDots .pin-dot');
  dots.forEach((d, i) => {
    d.classList.toggle('filled', i < _pinInput.length);
  });
  if (errEl) errEl.textContent = '';
  // Auto-verify on 6 digits
  if (_pinInput.length === 6) {
    const hash = await _hashPin(_pinInput);
    const stored = localStorage.getItem(PIN_HASH_KEY);
    if (hash === stored) {
      _pinUnlocked = true;
      try { tg?.HapticFeedback?.notificationOccurred('success'); } catch(e) {}
      const overlay = document.getElementById('pinLockOverlay');
      if (overlay) {
        overlay.style.animation = 'pinUnlock 0.35s ease-out forwards';
        setTimeout(() => overlay.remove(), 350);
      }
    } else {
      // Wrong PIN — shake + clear
      const container = document.querySelector('.pin-dots');
      if (container) {
        container.style.animation = 'pinShake 0.4s';
        setTimeout(() => container.style.animation = '', 400);
      }
      if (errEl) errEl.textContent = 'Mã PIN không đúng';
      try { tg?.HapticFeedback?.notificationOccurred('error'); } catch(e) {}
      _pinInput = '';
      setTimeout(() => dots.forEach(d => d.classList.remove('filled')), 300);
    }
  }
}

// PIN setup/change dialog (used in settings)
async function _openPinSetup(mode) {
  // mode: 'new' (first time), 'change' (must verify old first), 'off' (verify to turn off)
  const existing = document.getElementById('pinSetupModal');
  if (existing) existing.remove();
  
  const modal = document.createElement('div');
  modal.id = 'pinSetupModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.6);';
  modal.innerHTML = `
    <div style="width:320px;background:var(--surface);border-radius:20px;padding:24px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,0.3);">
      <div style="font-size:28px;margin-bottom:8px;">${mode === 'off' ? '🔓' : '🔐'}</div>
      <div id="pinSetupTitle" style="font-weight:700;font-size:15px;margin-bottom:4px;">${mode === 'off' ? 'Xác nhận tắt PIN' : mode === 'change' ? 'Nhập mã PIN cũ' : 'Đặt mã PIN mới'}</div>
      <div id="pinSetupSubtitle" style="font-size:12px;color:var(--text3);margin-bottom:16px;">${mode === 'new' ? 'Nhập 6 chữ số' : 'Nhập mã PIN hiện tại'}</div>
      <div class="pin-dots" id="setupPinDots" style="margin-bottom:8px;">
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
        <span class="pin-dot"></span><span class="pin-dot"></span><span class="pin-dot"></span>
      </div>
      <div class="pin-error" id="setupPinError" style="min-height:18px;"></div>
      <div class="pin-keypad" style="max-width:260px;margin:0 auto;">
        ${[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map(k =>
          k === '' ? '<div class="pin-key empty"></div>' :
          k === '⌫' ? '<div class="pin-key del" onclick="_setupPinKey(\'del\')">⌫</div>' :
          `<div class="pin-key" onclick="_setupPinKey(${k})">${k}</div>`
        ).join('')}
      </div>
      <button onclick="document.getElementById('pinSetupModal')?.remove();_refreshPinToggle()" style="margin-top:12px;padding:8px 24px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);font-size:13px;cursor:pointer;">Huỷ</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) { modal.remove(); _refreshPinToggle(); } });
  window._pinSetupMode = mode;
  window._pinSetupStep = (mode === 'new') ? 'enter' : 'verify';
  window._pinSetupInput = '';
  window._pinSetupNewPin = '';
}

async function _setupPinKey(key) {
  const errEl = document.getElementById('setupPinError');
  if (key === 'del') {
    window._pinSetupInput = window._pinSetupInput.slice(0, -1);
  } else {
    if (window._pinSetupInput.length >= 6) return;
    window._pinSetupInput += String(key);
  }
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch(e) {}
  const dots = document.querySelectorAll('#setupPinDots .pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < window._pinSetupInput.length));
  if (errEl) errEl.textContent = '';

  if (window._pinSetupInput.length === 6) {
    const pin = window._pinSetupInput;
    const mode = window._pinSetupMode;
    const step = window._pinSetupStep;

    if (step === 'verify') {
      // Verify old PIN
      const hash = await _hashPin(pin);
      const stored = localStorage.getItem(PIN_HASH_KEY);
      if (hash !== stored) {
        if (errEl) errEl.textContent = 'Mã PIN không đúng';
        window._pinSetupInput = '';
        const c = document.querySelector('#setupPinDots');
        if (c) { c.style.animation = 'pinShake 0.4s'; setTimeout(() => c.style.animation = '', 400); }
        setTimeout(() => dots.forEach(d => d.classList.remove('filled')), 300);
        return;
      }
      if (mode === 'off') {
        // Turn off PIN
        localStorage.removeItem(PIN_HASH_KEY);
        localStorage.removeItem(PIN_ENABLED_KEY);
        document.getElementById('pinSetupModal')?.remove();
        showToast('🔓 Đã tắt khoá PIN');
        _refreshPinToggle();
        return;
      }
      // mode === 'change' — proceed to enter new
      window._pinSetupStep = 'enter';
      window._pinSetupInput = '';
      dots.forEach(d => d.classList.remove('filled'));
      document.getElementById('pinSetupTitle').textContent = 'Đặt mã PIN mới';
      document.getElementById('pinSetupSubtitle').textContent = 'Nhập 6 chữ số';
      return;
    }

    if (step === 'enter') {
      window._pinSetupNewPin = pin;
      window._pinSetupStep = 'confirm';
      window._pinSetupInput = '';
      dots.forEach(d => d.classList.remove('filled'));
      document.getElementById('pinSetupTitle').textContent = 'Xác nhận mã PIN';
      document.getElementById('pinSetupSubtitle').textContent = 'Nhập lại mã PIN mới';
      return;
    }

    if (step === 'confirm') {
      if (pin !== window._pinSetupNewPin) {
        if (errEl) errEl.textContent = 'Mã PIN không khớp. Thử lại.';
        window._pinSetupStep = 'enter';
        window._pinSetupInput = '';
        window._pinSetupNewPin = '';
        const c = document.querySelector('#setupPinDots');
        if (c) { c.style.animation = 'pinShake 0.4s'; setTimeout(() => c.style.animation = '', 400); }
        setTimeout(() => {
          dots.forEach(d => d.classList.remove('filled'));
          document.getElementById('pinSetupTitle').textContent = 'Đặt mã PIN mới';
          document.getElementById('pinSetupSubtitle').textContent = 'Nhập 6 chữ số';
        }, 400);
        return;
      }
      // Save PIN
      const hash = await _hashPin(pin);
      localStorage.setItem(PIN_HASH_KEY, hash);
      localStorage.setItem(PIN_ENABLED_KEY, '1');
      _pinUnlocked = true;
      document.getElementById('pinSetupModal')?.remove();
      showToast('🔒 Đã đặt mã PIN');
      _refreshPinToggle();
    }
  }
}

function _refreshPinToggle() {
  const el = document.getElementById('pinToggleArea');
  if (!el) return;
  const on = _isPinEnabled();
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:13px;font-weight:600;">🔒 Khoá bằng mã PIN</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">${on ? 'Đang bật — yêu cầu PIN khi mở app' : 'Chưa đặt mã PIN'}</div>
      </div>
      <label class="pin-switch">
        <input type="checkbox" ${on ? 'checked' : ''} onchange="_onPinToggle(this.checked)">
        <span class="pin-slider"></span>
      </label>
    </div>
    ${on ? '<button onclick="_openPinSetup(\'change\')" style="margin-top:8px;padding:8px 16px;background:none;border:1px solid var(--border);border-radius:8px;color:var(--text2);font-size:12px;cursor:pointer;width:100%;">🔑 Đổi mã PIN</button>' : ''}
  `;
}

function _onPinToggle(checked) {
  if (checked) {
    _openPinSetup('new');
  } else {
    _openPinSetup('off');
  }
}
