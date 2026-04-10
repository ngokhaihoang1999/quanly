// ============ ANIMATED AVATAR SYSTEM ============
// Zero-storage, CSS-animated profile avatars
// Stores config as JSON in profiles.avatar_color column: { style, emojis, gradient }

// ── STYLE REGISTRY ──────────────────────────────────────────────
const AVATAR_STYLES = [
  // EPIC
  { id: 'orbital',   label: 'Orbital 🪐',          cat: 'epic', hasEmoji: true, defaultEmojis: ['🪐','☄️','⭐'], desc: 'Hệ mặt trời xoay vòng 3D' },
  { id: 'eruption',  label: 'Eruption 💥',          cat: 'epic', hasEmoji: true, defaultEmojis: ['🔥','💥','🚀','⚡'], desc: 'Phun trào năng lượng' },
  { id: 'constel',   label: 'Chòm Sao ✨',          cat: 'epic', hasEmoji: true, defaultEmojis: ['✨','🌟','💫','✨'], desc: 'Các vì sao lấp lánh' },
  { id: 'windbell',  label: 'Phong Linh 🎐',        cat: 'epic', hasEmoji: true, defaultEmojis: ['🎐','🌸','🍃'], desc: 'Chuông gió đong đưa' },
  { id: 'carousel',  label: '3D Carousel 🎠',       cat: 'epic', hasEmoji: true, defaultEmojis: ['👾','💠','🌀'], desc: 'Vòng quay băng chuyền' },
  // CUTE BIBLE
  { id: 'rainbow',   label: 'Cầu Vồng 🌈',         cat: 'cute', hasEmoji: false, desc: 'Cầu vồng lời hứa' },
  { id: 'manna',     label: 'Bánh Manna 🍞',        cat: 'cute', hasEmoji: true, defaultEmojis: ['🍞','🥨'], desc: 'Mưa lương thực từ trời' },
  { id: 'whale',     label: 'Cá Voi Jonah 🐋',      cat: 'cute', hasEmoji: false, desc: 'Cá lớn bơi lội tung tăng' },
  { id: 'angel',     label: 'Bé Thiên Thần 👼',     cat: 'cute', hasEmoji: false, desc: 'Đôi cánh thiên thần vỗ bay' },
  { id: 'ark',       label: 'Tàu Nô-ê 🚢',         cat: 'cute', hasEmoji: false, desc: 'Đại tàu rẽ sóng bình an' },
  { id: 'fruit',     label: 'Trái Thánh Linh 🍇',   cat: 'cute', hasEmoji: true, defaultEmojis: ['🍇','🍉','🍎'], desc: 'Trái cây nhảy múa vui vẻ' },
];

// ── EMOJI SUGGESTIONS ──────────────────────────────────────────
const EMOJI_SUGGESTIONS = [
  // Nature & Space
  '🌸','🌺','🌻','🌹','🌷','🌼','🍀','🌿','🍃','🍂','🍁','☘️',
  '⭐','🌟','✨','💫','☀️','🌙','⚡','🔥','❄️','💧','🌊','🌈',
  '🪐','☄️','🌀','💠','🎐',
  // Bible / Spiritual
  '🕊️','🐋','🐟','🐑','🦁','🐦','🦋','🐝','🐛','🐌','🐢',
  '🍞','🥨','🍇','🍉','🍎','🍑','🍒','🫒','🌾','🥖',
  '✝️','📖','📜','🕯️','🪔','🔔','🎺','👑','💎','💍',
  '🌿','🫂','🙏','💖','💝','❤️‍🔥','🫶',
  // Fun
  '🎵','🎶','🎤','🎸','🎮','🎯','🎪','🎨','🧸','🎁','🎀',
  '🚀','🛸','👾','🤖','💀','👻','🎃','🦄','🐲',
  '⚽','🏀','🎾','🏆','🥇',
  // Objects & Symbols
  '💡','🔮','🪄','🎭','🎠','🎡','🎢','⚙️','🛡️','⚔️',
  '🏔️','🌋','🏝️','🏰','🗼',
];

// ── PARSE / SERIALIZE CONFIG ────────────────────────────────────
function parseAvatarConfig(rawValue) {
  if (!rawValue) return null;
  // New JSON format: { style, emojis, gradient }
  if (rawValue.startsWith('{')) {
    try { return JSON.parse(rawValue); } catch(e) { return null; }
  }
  // Legacy: plain gradient string → treat as gradient-only (no animated style)
  return { style: null, gradient: rawValue, emojis: null };
}

function serializeAvatarConfig(cfg) {
  return JSON.stringify(cfg);
}

// ── RENDER ANIMATED AVATAR (MAIN FUNCTION) ──────────────────────
// Returns HTML string for the avatar element
// size: 'sm' (list card 40px), 'md' (detail 56px), 'lg' (preview 90px)
function renderAnimatedAvatar(letter, config, size = 'md') {
  const cfg = typeof config === 'string' ? parseAvatarConfig(config) : config;
  const sz = size === 'sm' ? 40 : size === 'lg' ? 90 : 56;
  const fz = size === 'sm' ? 18 : size === 'lg' ? 42 : 24;
  const efi = size === 'sm' ? 10 : size === 'lg' ? 22 : 14; // emoji font size inner
  const efo = size === 'sm' ? 8 : size === 'lg' ? 18 : 12;  // emoji font size outer

  // Fallback: no config or legacy gradient
  if (!cfg || !cfg.style) {
    const bg = cfg?.gradient || 'linear-gradient(135deg,var(--accent),#ec4899)';
    return `<div class="av-box" style="width:${sz}px;height:${sz}px;border-radius:${sz<50?12:16}px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${fz}px;font-weight:700;color:white;box-shadow:0 4px 16px rgba(124,106,247,0.3);flex-shrink:0;">${letter}</div>`;
  }

  const emojis = cfg.emojis || AVATAR_STYLES.find(s=>s.id===cfg.style)?.defaultEmojis || [];
  const e = (i) => emojis[i % emojis.length] || '✨';
  const L = letter;
  const r = sz < 50 ? 12 : 16;
  const customBg = cfg.bgColor || '';
  const customTxt = cfg.textColor || '';
  const bgStyle = customBg ? `background:${customBg};` : '';
  const txtStyle = customTxt ? `color:${customTxt};` : '';
  const wrap = `position:relative;width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center;flex-shrink:0;${bgStyle}border-radius:${r}px;`;
  const core = `position:relative;z-index:10;font-size:${fz}px;font-weight:900;${txtStyle}`;

  switch(cfg.style) {
    // ── EPIC ──
    case 'orbital':
      return `<div class="av-orbital" style="${wrap}">
        <div class="av-orb-ring av-orb-r1"><span class="av-orb-e" style="font-size:${efi}px">${e(0)}</span></div>
        <div class="av-orb-ring av-orb-r2"><span class="av-orb-e" style="font-size:${efi}px">${e(1)}</span></div>
        <div class="av-orb-ring av-orb-r3"><span class="av-orb-e" style="font-size:${efi}px">${e(2)}</span></div>
        <span class="av-core-dark" style="${core}">${L}</span>
      </div>`;

    case 'eruption':
      return `<div class="av-eruption" style="${wrap}">
        <span class="av-erupt av-er1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-erupt av-er2" style="font-size:${efi}px">${e(1)}</span>
        <span class="av-erupt av-er3" style="font-size:${efi}px">${e(2)}</span>
        ${emojis.length>3?`<span class="av-erupt av-er4" style="font-size:${efi}px">${e(3)}</span>`:''}
        <span class="av-core-fire" style="${core}">${L}</span>
      </div>`;

    case 'constel':
      return `<div class="av-constel" style="${wrap}">
        <span class="av-star av-st1" style="font-size:${efo}px">${e(0)}</span>
        <span class="av-star av-st2" style="font-size:${Math.round(efo*0.7)}px">${e(1)}</span>
        <span class="av-star av-st3" style="font-size:${efi}px">${e(2)}</span>
        <span class="av-star av-st4" style="font-size:${efo}px">${e(3%emojis.length)}</span>
        <span class="av-core-star" style="${core}">${L}</span>
      </div>`;

    case 'windbell':
      return `<div class="av-windbell-wrap" style="${wrap}">
        <div class="av-wb-roof">
          <div class="av-wb-str av-wb-s1"><span style="font-size:${efi}px">${e(0)}</span></div>
          <div class="av-wb-str av-wb-s2"><span style="font-size:${efi}px">${e(1)}</span></div>
          <div class="av-wb-str av-wb-s3"><span style="font-size:${efi}px">${e(2)}</span></div>
        </div>
        <span class="av-core-bell" style="${core};margin-top:${Math.round(sz*0.18)}px;color:var(--text2);">${L}</span>
      </div>`;

    case 'carousel':
      return `<div class="av-carousel" style="${wrap}">
        <div class="av-cyl">
          <span class="av-ci av-ci1" style="font-size:${efi}px">${e(0)}</span>
          <span class="av-ci av-ci2" style="font-size:${efi}px">${e(1)}</span>
          <span class="av-ci av-ci3" style="font-size:${efi}px">${e(2)}</span>
        </div>
        <span class="av-core-cyl" style="${core}">${L}</span>
      </div>`;

    // ── CUTE BIBLE ──
    case 'rainbow': {
      const arcR = Math.round(sz * 0.38); // arc radius
      return `<div class="av-rain" style="${wrap};${bgStyle}background:${customBg||'#f0fdf4'};border-radius:50%;border:${sz<50?2:3}px solid #fff;overflow:visible;">
        <div class="av-rainbow-arc" style="width:${sz}px;height:${Math.round(sz*0.5)}px;"></div>
        <span class="av-rain-letter" style="font-size:${fz}px;font-weight:900;${txtStyle}color:${customTxt||'#166534'};">
          ${L}
        </span>
        <span class="av-dove" style="position:absolute;font-size:${efo}px;top:${Math.round(sz*0.12)}px;right:${sz<50?-3:-6}px;z-index:15;">🕊️</span>
      </div>`;
    }

    case 'manna':
      return `<div class="av-manna" style="${wrap};background:#fdf4ff;border-radius:${Math.round(sz*0.3)}px;">
        <span class="av-food av-f1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-food av-f2" style="font-size:${efi}px">${e(1)}</span>
        <span style="${core};color:#334155;">${L}</span>
      </div>`;

    case 'whale':
      return `<div class="av-whale" style="${wrap}">
        <div class="av-wh-belly"><span class="av-wh-fish">🐋</span></div>
        <span style="${core};color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${L}</span>
      </div>`;

    case 'angel':
      return `<div class="av-angel" style="${wrap}">
        <div class="av-halo"></div>
        <div class="av-wing-wrap-l"><span class="av-wflap">🪽</span></div>
        <div class="av-wing-wrap-r"><span class="av-wflap">🪽</span></div>
        <span style="${core};color:#f59e0b;z-index:10;">${L}</span>
      </div>`;

    case 'ark':
      return `<div class="av-ark" style="${wrap};background:#e0f2fe;overflow:hidden;border-radius:50%;">
        <div class="av-ark-w2"></div><div class="av-ark-w1"></div>
        <span class="av-ark-ship" style="font-size:${Math.round(sz*0.35)}px">🚢</span>
        <span style="${core};color:#fff;z-index:10;text-shadow:0 2px 2px #000;" class="av-ark-rock-r">${L}</span>
      </div>`;

    case 'fruit':
      return `<div class="av-fruit" style="${wrap};background:#fff1f2;border-radius:50%;box-shadow:inset -4px -4px 0 #ffe4e6;">
        <span class="av-fruitbob av-fb1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-fruitbob av-fb2" style="font-size:${efi}px">${e(1)}</span>
        <span class="av-fruitbob av-fb3" style="font-size:${efi}px">${e(2)}</span>
        <span style="${core};color:#be123c;">${L}</span>
      </div>`;

    default:
      return `<div class="av-box" style="width:${sz}px;height:${sz}px;border-radius:${r}px;background:linear-gradient(135deg,var(--accent),#ec4899);display:flex;align-items:center;justify-content:center;font-size:${fz}px;font-weight:700;color:white;flex-shrink:0;">${L}</div>`;
  }
}


// ── AVATAR STYLE PICKER MODAL ───────────────────────────────────
let _avatarPickerState = { profileId: null, style: null, emojis: [], gradient: null };

function openAvatarStylePicker(profileId, encodedRaw) {
  const currentRaw = decodeURIComponent(encodedRaw || '');
  const cfg = parseAvatarConfig(currentRaw) || {};
  _avatarPickerState = {
    profileId,
    style: cfg.style || null,
    emojis: cfg.emojis ? [...cfg.emojis] : [],
    gradient: cfg.gradient || 'linear-gradient(135deg,var(--accent),#ec4899)',
    bgColor: cfg.bgColor || '',
    textColor: cfg.textColor || '',
  };

  let existing = document.getElementById('avatarStyleModal');
  if (existing) existing.remove();

  const letter = (allProfiles?.find(p=>p.id===profileId)?.full_name || '?')[0];

  const modal = document.createElement('div');
  modal.id = 'avatarStyleModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.55);';
  modal.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:90vh;overflow-y:auto;background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px 36px;box-shadow:0 -8px 50px rgba(0,0,0,0.35);">
      <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>
      
      <!-- PREVIEW -->
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        <div id="avPickerPreview" style="transform:scale(1.2);"></div>
      </div>
      <div id="avPickerStyleName" style="text-align:center;font-size:13px;font-weight:700;color:var(--accent);margin-bottom:20px;min-height:18px;"></div>

      <!-- STYLE GRID -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">✨ Phong cách Epic</div>
      <div id="avPickerEpicGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px;"></div>
      
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🧸 Kinh Thánh Dễ Thương</div>
      <div id="avPickerCuteGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;"></div>

      <!-- EMOJI PICKER (shown only for emoji styles) -->
      <div id="avEmojiSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">🎨 Chọn Emoji (nhấn để thêm/bỏ)</div>
        <div id="avSelectedEmojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;padding:8px 10px;background:var(--surface2);border-radius:10px;border:1px dashed var(--border);"></div>
        <div id="avEmojiGrid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;margin-bottom:16px;padding:4px;"></div>
      </div>

      <!-- GRADIENT (for legacy / no-style) -->
      <div id="avGradientSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🖌 Hoặc chỉ chọn màu nền</div>
        <div id="avGradientGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>
      </div>

      <!-- CUSTOM COLORS -->
      <div id="avColorSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">🎨 Tuỳ chỉnh màu sắc</div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="avBgColorPick" value="#1e1b4b" onchange="_onAvatarColorChange()" style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;padding:0;" />
            <span style="font-size:11px;color:var(--text2);font-weight:600;">Nền</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="avTxtColorPick" value="#ffffff" onchange="_onAvatarColorChange()" style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;padding:0;" />
            <span style="font-size:11px;color:var(--text2);font-weight:600;">Chữ</span>
          </div>
          <button onclick="_clearAvatarColors()" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;">Xóa màu</button>
        </div>
      </div>

      <!-- ACTIONS -->
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('avatarStyleModal').remove()" style="flex:1;padding:13px;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">Huỷ</button>
        <button onclick="_saveAvatarStyle()" style="flex:2;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">✅ Lưu Avatar</button>
      </div>
    </div>`;
  
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  // Render style thumbnails
  _renderStyleGrid(letter);
  // Render gradient presets
  _renderGradientGrid();
  // Render emoji picker grid
  _renderEmojiGrid();
  // Update preview
  _updateAvatarPreview(letter);

  // If a style is already selected, trigger its panel
  if (_avatarPickerState.style) {
    _selectAvatarStyle(_avatarPickerState.style, letter);
  } else {
    // Show gradient section for legacy/plain users
    document.getElementById('avGradientSection').style.display = 'block';
  }
}

function _renderStyleGrid(letter) {
  const epicGrid = document.getElementById('avPickerEpicGrid');
  const cuteGrid = document.getElementById('avPickerCuteGrid');

  AVATAR_STYLES.forEach(s => {
    const isSelected = _avatarPickerState.style === s.id;
    const thumb = document.createElement('div');
    thumb.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 4px;border-radius:12px;cursor:pointer;border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};background:${isSelected ? 'rgba(99,102,241,0.08)' : 'var(--surface2)'};transition:all 0.2s;`;
    thumb.dataset.styleId = s.id;

    // Mini preview
    const miniCfg = { style: s.id, emojis: _avatarPickerState.style === s.id && _avatarPickerState.emojis.length ? _avatarPickerState.emojis : s.defaultEmojis };
    thumb.innerHTML = `
      <div style="pointer-events:none;transform:scale(0.55);transform-origin:center;margin:-12px 0;">${renderAnimatedAvatar(letter, miniCfg, 'md')}</div>
      <div style="font-size:9px;font-weight:600;color:var(--text2);text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px;">${s.label}</div>`;
    
    thumb.onclick = () => _selectAvatarStyle(s.id, letter);
    
    if (s.cat === 'epic') epicGrid.appendChild(thumb);
    else cuteGrid.appendChild(thumb);
  });
}

function _selectAvatarStyle(styleId, letter) {
  const styleDef = AVATAR_STYLES.find(s => s.id === styleId);
  _avatarPickerState.style = styleId;
  
  // If switching to a new style, seed with default emojis
  if (styleDef && styleDef.defaultEmojis && !_avatarPickerState.emojis.length) {
    _avatarPickerState.emojis = [...styleDef.defaultEmojis];
  }

  // Re-highlight selected
  document.querySelectorAll('#avPickerEpicGrid > div, #avPickerCuteGrid > div').forEach(el => {
    const sel = el.dataset.styleId === styleId;
    el.style.borderColor = sel ? 'var(--accent)' : 'var(--border)';
    el.style.background = sel ? 'rgba(99,102,241,0.08)' : 'var(--surface2)';
  });

  // Show/hide emoji section + color section
  const emojiSec = document.getElementById('avEmojiSection');
  const gradSec = document.getElementById('avGradientSection');
  const colorSec = document.getElementById('avColorSection');
  if (styleDef?.hasEmoji) {
    emojiSec.style.display = 'block';
    gradSec.style.display = 'none';
  } else {
    emojiSec.style.display = 'none';
    gradSec.style.display = 'none';
  }
  // Always show color customization when a style is selected
  if (colorSec) {
    colorSec.style.display = 'block';
    // Pre-fill with saved values
    const bgPick = document.getElementById('avBgColorPick');
    const txtPick = document.getElementById('avTxtColorPick');
    if (bgPick && _avatarPickerState.bgColor) bgPick.value = _avatarPickerState.bgColor;
    if (txtPick && _avatarPickerState.textColor) txtPick.value = _avatarPickerState.textColor;
  }

  // Update style name
  const nameEl = document.getElementById('avPickerStyleName');
  if (nameEl) nameEl.textContent = styleDef ? `${styleDef.label} — ${styleDef.desc}` : '';

  _renderSelectedEmojis();
  _updateAvatarPreview(letter || 'A');
}

function _onAvatarColorChange() {
  const bg = document.getElementById('avBgColorPick')?.value || '';
  const txt = document.getElementById('avTxtColorPick')?.value || '';
  _avatarPickerState.bgColor = bg;
  _avatarPickerState.textColor = txt;
  const letter = _avatarPickerState.profileId === '__staff__'
    ? (myStaff?.nickname || myStaff?.full_name || '?')[0]
    : (allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name || '?')[0];
  _updateAvatarPreview(letter);
}

function _clearAvatarColors() {
  _avatarPickerState.bgColor = '';
  _avatarPickerState.textColor = '';
  const bgPick = document.getElementById('avBgColorPick');
  const txtPick = document.getElementById('avTxtColorPick');
  if (bgPick) bgPick.value = '#1e1b4b';
  if (txtPick) txtPick.value = '#ffffff';
  const letter = _avatarPickerState.profileId === '__staff__'
    ? (myStaff?.nickname || myStaff?.full_name || '?')[0]
    : (allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name || '?')[0];
  _updateAvatarPreview(letter);
  showToast('Đã xoá màu tuỳ chỉnh');
}

function _renderEmojiGrid() {
  const grid = document.getElementById('avEmojiGrid');
  if (!grid) return;
  grid.innerHTML = EMOJI_SUGGESTIONS.map(em =>
    `<span onclick="_toggleEmojiSelection('${em}')" style="font-size:22px;cursor:pointer;padding:3px;border-radius:6px;transition:background 0.15s;user-select:none;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">${em}</span>`
  ).join('');
}

function _toggleEmojiSelection(emoji) {
  const idx = _avatarPickerState.emojis.indexOf(emoji);
  if (idx >= 0) {
    _avatarPickerState.emojis.splice(idx, 1);
  } else {
    if (_avatarPickerState.emojis.length >= 6) {
      showToast('⚠️ Tối đa 6 emoji');
      return;
    }
    _avatarPickerState.emojis.push(emoji);
  }
  _renderSelectedEmojis();
  const letter = (allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name || '?')[0];
  _updateAvatarPreview(letter);
}

function _renderSelectedEmojis() {
  const box = document.getElementById('avSelectedEmojis');
  if (!box) return;
  if (!_avatarPickerState.emojis.length) {
    box.innerHTML = '<span style="font-size:11px;color:var(--text3);">Chưa chọn emoji nào. Nhấn bên dưới để thêm.</span>';
    return;
  }
  box.innerHTML = _avatarPickerState.emojis.map(em =>
    `<span onclick="_toggleEmojiSelection('${em}')" style="font-size:24px;cursor:pointer;padding:2px 4px;background:rgba(99,102,241,0.1);border-radius:8px;border:1px solid var(--accent);transition:all 0.15s;" title="Nhấn để bỏ">${em}</span>`
  ).join('');
}

function _renderGradientGrid() {
  const grid = document.getElementById('avGradientGrid');
  if (!grid) return;
  const presets = typeof AVATAR_GRADIENT_PRESETS !== 'undefined' ? AVATAR_GRADIENT_PRESETS : [];
  grid.innerHTML = presets.map(g =>
    `<div onclick="_selectGradientOnly('${g.val}')" title="${g.label}" style="width:36px;height:36px;border-radius:10px;cursor:pointer;background:${g.val};border:2px solid transparent;transition:all 0.15s;flex-shrink:0;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform=''"></div>`
  ).join('');
}

function _selectGradientOnly(gradient) {
  _avatarPickerState.style = null;
  _avatarPickerState.gradient = gradient;
  _avatarPickerState.emojis = [];
  // Deselect all styles
  document.querySelectorAll('#avPickerEpicGrid > div, #avPickerCuteGrid > div').forEach(el => {
    el.style.borderColor = 'var(--border)';
    el.style.background = 'var(--surface2)';
  });
  document.getElementById('avEmojiSection').style.display = 'none';
  document.getElementById('avPickerStyleName').textContent = '🖌 Chỉ dùng màu nền (không có animation)';
  const letter = (allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name || '?')[0];
  _updateAvatarPreview(letter);
}

function _updateAvatarPreview(letter) {
  const box = document.getElementById('avPickerPreview');
  if (!box) return;
  const cfg = {
    style: _avatarPickerState.style,
    emojis: _avatarPickerState.emojis.length ? _avatarPickerState.emojis : undefined,
    gradient: _avatarPickerState.gradient,
    bgColor: _avatarPickerState.bgColor || undefined,
    textColor: _avatarPickerState.textColor || undefined,
  };
  box.innerHTML = renderAnimatedAvatar(letter, cfg, 'lg');
}

async function _saveAvatarStyle() {
  const { profileId, style, emojis, gradient, bgColor, textColor } = _avatarPickerState;
  if (!profileId) return;

  let value;
  if (style) {
    const cfgObj = { style, emojis: emojis.length ? emojis : undefined, gradient };
    if (bgColor) cfgObj.bgColor = bgColor;
    if (textColor) cfgObj.textColor = textColor;
    value = serializeAvatarConfig(cfgObj);
  } else if (gradient) {
    // Legacy gradient-only
    value = gradient;
  } else {
    return;
  }

  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatar_color: value })
    });
    const p = allProfiles.find(x => x.id === profileId);
    if (p) p.avatar_color = value;
    showToast('✅ Đã lưu avatar!');
    document.getElementById('avatarStyleModal')?.remove();
    // Refresh profile view
    if (p) openProfile(p);
  } catch(e) {
    console.error('saveAvatarStyle:', e);
    showToast('❌ Lỗi lưu avatar');
  }
}

// ── STAFF AVATAR PICKER (Cá nhân hoá TĐ) ───────────────────────
// Opens the same style picker modal but saves to staff table instead
function _openStaffAvatarPicker() {
  const currentRaw = document.getElementById('prof_staff_avatar_color')?.value || '';
  const cfg = parseAvatarConfig(currentRaw) || {};
  const letter = (myStaff?.nickname || myStaff?.full_name || '?')[0];

  _avatarPickerState = {
    profileId: '__staff__',
    style: cfg.style || null,
    emojis: cfg.emojis ? [...cfg.emojis] : [],
    gradient: cfg.gradient || 'linear-gradient(135deg,var(--accent),#ec4899)',
    bgColor: cfg.bgColor || '',
    textColor: cfg.textColor || '',
  };

  let existing = document.getElementById('avatarStyleModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'avatarStyleModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.55);';
  modal.innerHTML = `
    <div style="width:100%;max-width:520px;max-height:90vh;overflow-y:auto;background:var(--surface);border-radius:24px 24px 0 0;padding:20px 16px 36px;box-shadow:0 -8px 50px rgba(0,0,0,0.35);">
      <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>
      
      <!-- PREVIEW -->
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        <div id="avPickerPreview" style="transform:scale(1.2);"></div>
      </div>
      <div id="avPickerStyleName" style="text-align:center;font-size:13px;font-weight:700;color:var(--accent);margin-bottom:20px;min-height:18px;"></div>

      <!-- STYLE GRID -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">✨ Phong cách Epic</div>
      <div id="avPickerEpicGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px;"></div>
      
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🧸 Kinh Thánh Dễ Thương</div>
      <div id="avPickerCuteGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;"></div>

      <!-- EMOJI PICKER -->
      <div id="avEmojiSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">🎨 Chọn Emoji (nhấn để thêm/bỏ)</div>
        <div id="avSelectedEmojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;padding:8px 10px;background:var(--surface2);border-radius:10px;border:1px dashed var(--border);"></div>
        <div id="avEmojiGrid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;margin-bottom:16px;padding:4px;"></div>
      </div>

      <!-- GRADIENT -->
      <div id="avGradientSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🖌 Hoặc chỉ chọn màu nền</div>
        <div id="avGradientGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>
      </div>

      <!-- ACTIONS -->
      <!-- CUSTOM COLORS -->
      <div id="avColorSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">🎨 Tuỳ chỉnh màu sắc</div>
        <div style="display:flex;gap:12px;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="avBgColorPick" value="#1e1b4b" onchange="_onAvatarColorChange()" style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;padding:0;" />
            <span style="font-size:11px;color:var(--text2);font-weight:600;">Nền</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="color" id="avTxtColorPick" value="#ffffff" onchange="_onAvatarColorChange()" style="width:32px;height:32px;border:none;border-radius:8px;cursor:pointer;padding:0;" />
            <span style="font-size:11px;color:var(--text2);font-weight:600;">Chữ</span>
          </div>
          <button onclick="_clearAvatarColors()" style="font-size:11px;padding:5px 10px;border-radius:6px;border:1px solid var(--border);background:none;color:var(--text3);cursor:pointer;">Xóa màu</button>
        </div>
      </div>

      <!-- ACTIONS -->
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('avatarStyleModal').remove()" style="flex:1;padding:13px;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;">Huỷ</button>
        <button onclick="_saveStaffAvatarStyle()" style="flex:2;padding:13px;background:var(--accent);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;">✅ Lưu Avatar TĐ</button>
      </div>
    </div>`;
  
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  _renderStyleGrid(letter);
  _renderGradientGrid();
  _renderEmojiGrid();
  _updateAvatarPreview(letter);

  if (_avatarPickerState.style) {
    _selectAvatarStyle(_avatarPickerState.style, letter);
  } else {
    document.getElementById('avGradientSection').style.display = 'block';
  }
}

function _saveStaffAvatarStyle() {
  const { style, emojis, gradient, bgColor, textColor } = _avatarPickerState;
  let value;
  if (style) {
    const cfgObj = { style, emojis: emojis.length ? emojis : undefined, gradient };
    if (bgColor) cfgObj.bgColor = bgColor;
    if (textColor) cfgObj.textColor = textColor;
    value = serializeAvatarConfig(cfgObj);
  } else if (gradient) {
    value = gradient;
  } else {
    return;
  }

  // Update hidden inputs in the settings panel
  const input = document.getElementById('prof_staff_avatar_color');
  if (input) input.value = value;

  // Update the preview box
  const previewBox = document.getElementById('staffAvatarPreviewBox');
  const letter = (myStaff?.nickname || myStaff?.full_name || '?')[0];
  if (previewBox) {
    previewBox.innerHTML = renderAnimatedAvatar(letter, value, 'md');
  }

  showToast('✅ Đã chọn phong cách! Nhấn "Lưu hồ sơ TĐ" để áp dụng.');
  document.getElementById('avatarStyleModal')?.remove();
}
