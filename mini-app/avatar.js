// ============ ANIMATED AVATAR SYSTEM ============
// Zero-storage, CSS-animated profile avatars
// Stores config as JSON in profiles.avatar_color column: { style, emojis, gradient }

// ── STYLE REGISTRY ──────────────────────────────────────────────
const AVATAR_STYLES = [
  // EPIC
  { id: 'eruption',  label: 'Eruption 💥',          cat: 'epic', hasEmoji: true, defaultEmojis: ['🔥','💥','🚀','⚡'], desc: 'Phun trào năng lượng' },
  { id: 'constel',   label: 'Chòm Sao ✨',          cat: 'epic', hasEmoji: true, defaultEmojis: ['✨','🌟','💫','✨'], desc: 'Các vì sao lấp lánh' },
  { id: 'windbell',  label: 'Phong Linh 🎐',        cat: 'epic', hasEmoji: true, defaultEmojis: ['🎐','🌸','🍃'], desc: 'Chuông gió đong đưa' },
  { id: 'carousel',  label: '3D Carousel 🎠',       cat: 'epic', hasEmoji: true, defaultEmojis: ['👾','💠','🌀'], desc: 'Vòng quay băng chuyền' },
  // CUTE BIBLE
  { id: 'growth',    label: 'Bertumbuh 🌱',         cat: 'cute', hasEmoji: false, desc: 'Hạt giống → Cây mầm → Cây lớn' },
  { id: 'manna',     label: 'Bánh Manna 🍞',        cat: 'cute', hasEmoji: true, defaultEmojis: ['🍞','🥨'], desc: 'Mưa lương thực từ trời' },
  { id: 'whale',     label: 'Cá Voi Jonah 🐋',      cat: 'cute', hasEmoji: false, desc: 'Cá lớn bơi lội tung tăng' },
  { id: 'angel',     label: 'Bé Thiên Thần 👼',     cat: 'cute', hasEmoji: false, desc: 'Đôi cánh thiên thần vỗ bay' },
  { id: 'ark',       label: 'Tàu Nô-ê ⛵',         cat: 'cute', hasEmoji: false, desc: 'Đại tàu gỗ rẽ sóng bình an' },
  { id: 'fishing',   label: 'Câu Cá 🎣',            cat: 'cute', hasEmoji: false, desc: 'Buông câu theo Chúa' },
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
    try {
      const parsed = JSON.parse(rawValue);
      // Migrate deprecated styles
      if (parsed.style === 'rainbow') parsed.style = 'growth';
      if (parsed.style === 'orbital') parsed.style = 'eruption';
      return parsed;
    } catch(e) { return null; }
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


    case 'eruption':
      return `<div class="av-eruption" style="${wrap}">
        <span class="av-erupt av-er1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-erupt av-er2" style="font-size:${efi}px">${e(1)}</span>
        <span class="av-erupt av-er3" style="font-size:${efi}px">${e(2)}</span>
        ${emojis.length>3?`<span class="av-erupt av-er4" style="font-size:${efi}px">${e(3)}</span>`:''}
        <span class="av-core-fire av-letter-fire" style="${core}">${L}</span>
      </div>`;

    case 'constel':
      return `<div class="av-constel" style="${wrap}">
        <span class="av-star av-st1" style="font-size:${efo}px">${e(0)}</span>
        <span class="av-star av-st2" style="font-size:${Math.round(efo*0.7)}px">${e(1)}</span>
        <span class="av-star av-st3" style="font-size:${efi}px">${e(2)}</span>
        <span class="av-star av-st4" style="font-size:${efo}px">${e(3%emojis.length)}</span>
        <span class="av-core-star av-letter-star" style="${core}">${L}</span>
      </div>`;

    case 'windbell':
      return `<div class="av-windbell-wrap" style="${wrap}">
        <div class="av-wb-roof">
          <div class="av-wb-str av-wb-s1"><span style="font-size:${efi}px">${e(0)}</span></div>
          <div class="av-wb-str av-wb-s2"><span style="font-size:${efi}px">${e(1)}</span></div>
          <div class="av-wb-str av-wb-s3"><span style="font-size:${efi}px">${e(2)}</span></div>
        </div>
        <span class="av-core-bell av-letter-bell" style="${core};margin-top:${Math.round(sz*0.18)}px;color:var(--text2);">${L}</span>
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

    case 'growth': {
      const eSz = Math.round(sz * 0.35);
      const plantBot = Math.round(sz * 0.18);
      return `<div class="av-growth" style="${wrap};${bgStyle}background:${customBg||'linear-gradient(180deg,#ecfdf5 0%,#d1fae5 60%,#a7f3d0 100%)'};border-radius:50%;border:${sz<50?2:3}px solid #fff;overflow:hidden;">
        <div class="av-growth-soil"></div>
        <span class="av-growth-stage av-growth-seed" style="font-size:${eSz}px;bottom:${plantBot}px;left:50%;transform:translateX(-50%);">🌰</span>
        <span class="av-growth-stage av-growth-sprout" style="font-size:${eSz}px;bottom:${plantBot}px;left:50%;transform:translateX(-50%);">🌱</span>
        <span class="av-growth-stage av-growth-tree" style="font-size:${Math.round(sz*0.45)}px;bottom:${plantBot - 4}px;left:50%;transform:translateX(-50%);">🌳</span>
        <span class="av-letter-growth" style="${core};${txtStyle}color:${customTxt||'#166534'};z-index:10;text-shadow:0 1px 3px rgba(255,255,255,0.7);">${L}</span>
      </div>`;
    }

    case 'manna':
      return `<div class="av-manna" style="${wrap};background:#fdf4ff;border-radius:${Math.round(sz*0.3)}px;">
        <span class="av-food av-f1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-food av-f2" style="font-size:${efi}px">${e(1)}</span>
        <span class="av-letter-manna" style="${core};color:#334155;">${L}</span>
      </div>`;

    case 'whale':
      return `<div class="av-whale" style="${wrap}">
        <div class="av-wh-belly"><span class="av-wh-fish">🐋</span></div>
        <span class="av-letter-whale" style="${core};color:#fff;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${L}</span>
      </div>`;

    case 'angel':
      return `<div class="av-angel" style="${wrap}">
        <div class="av-halo"></div>
        <div class="av-wing-wrap-l"><span class="av-wflap">🪽</span></div>
        <div class="av-wing-wrap-r"><span class="av-wflap">🪽</span></div>
        <span class="av-letter-angel" style="${core};color:#f59e0b;z-index:10;">${L}</span>
      </div>`;

    case 'ark': {
      const shipSz = Math.round(sz * 0.4);
      return `<div class="av-ark" style="${wrap};background:linear-gradient(180deg,#bae6fd 55%,#0ea5e9 55%,#0369a1);overflow:hidden;border-radius:50%;">
        <div class="av-ark-w2"></div><div class="av-ark-w1"></div>
        <span class="av-ark-ship" style="font-size:${shipSz}px;left:50%;transform:translateX(-50%);">🚢</span>
        <span class="av-letter-ark" style="position:absolute;top:10%;left:50%;font-size:${fz}px;font-weight:900;color:#1e3a5f;z-index:20;text-shadow:0 1px 3px rgba(255,255,255,0.6);">${L}</span>
      </div>`;
    }

    case 'fishing': {
      const rodSz = Math.round(sz * 0.35);
      return `<div class="av-fishing" style="${wrap};background:linear-gradient(180deg,#fef3c7 40%,#38bdf8 40%,#0284c7);border-radius:50%;overflow:hidden;">
        <span style="position:absolute;top:${Math.round(sz*0.02)}px;right:${Math.round(sz*0.08)}px;font-size:${rodSz}px;z-index:5;animation:av-rock 2.5s ease-in-out infinite alternate;filter:drop-shadow(0 2px 3px rgba(0,0,0,0.15));">🎣</span>
        <span class="av-fish-sw av-fs1">🐟</span>
        <span class="av-fish-sw av-fs2">🐠</span>
        <span class="av-fish-sw av-fs3">🐡</span>
        <span class="av-letter-fish" style="${core};color:#78350f;z-index:10;">${L}</span>
      </div>`;
    }

    case 'fruit':
      return `<div class="av-fruit" style="${wrap};background:#fff1f2;border-radius:50%;box-shadow:inset -4px -4px 0 #ffe4e6;">
        <span class="av-fruitbob av-fb1" style="font-size:${efi}px">${e(0)}</span>
        <span class="av-fruitbob av-fb2" style="font-size:${efi}px">${e(1)}</span>
        <span class="av-fruitbob av-fb3" style="font-size:${efi}px">${e(2)}</span>
        <span class="av-letter-fruit" style="${core};color:#be123c;">${L}</span>
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

  const letter = getNameInitial(allProfiles?.find(p=>p.id===profileId)?.full_name);

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

      <!-- STYLE GRID -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">✨ Phong cách Epic</div>
      <div id="avPickerEpicGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px;"></div>
      
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🧸 Kinh Thánh Dễ Thương</div>
      <div id="avPickerCuteGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;"></div>

      <!-- EMOJI PICKER (shown only for emoji styles) -->
      <div id="avEmojiSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center;">
          <span>🎨 Chọn Emoji (nhấn để thêm)</span>
          <input type="text" placeholder="➕ Nhập từ phím..." style="width:110px;background:none;border:none;border-bottom:1px dashed var(--accent);color:var(--text);font-size:12px;font-weight:600;text-align:right;outline:none;" oninput="if(this.value.trim()){_addCustomEmoji(this.value.trim()); this.value='';}" title="Gõ emoji bất kỳ từ bàn phím điện thoại của bạn" />
        </div>
        <div id="avSelectedEmojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;padding:8px 10px;background:var(--surface2);border-radius:10px;border:1px dashed var(--border);"></div>
        <div id="avEmojiGrid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;margin-bottom:16px;padding:4px;"></div>
      </div>

      <!-- GRADIENT (for legacy / no-style) -->
      <div id="avGradientSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🖌 Hoặc chỉ chọn màu nền</div>
        <div id="avGradientGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>
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
    thumb.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 0;border-radius:12px;cursor:pointer;border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};background:${isSelected ? 'rgba(99,102,241,0.08)' : 'var(--surface2)'};transition:all 0.2s;`;
    thumb.dataset.styleId = s.id;

    // Mini preview only (no text labels as requested)
    const miniCfg = { style: s.id, emojis: _avatarPickerState.style === s.id && _avatarPickerState.emojis.length ? _avatarPickerState.emojis : s.defaultEmojis };
    thumb.innerHTML = `<div style="pointer-events:none;transform:scale(0.8);transform-origin:center;margin:0;">${renderAnimatedAvatar(letter, miniCfg, 'md')}</div>`;
    
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

  // Show/hide emoji section
  const emojiSec = document.getElementById('avEmojiSection');
  const gradSec = document.getElementById('avGradientSection');
  if (styleDef?.hasEmoji) {
    if (emojiSec) emojiSec.style.display = 'block';
    if (gradSec) gradSec.style.display = 'none';
  } else {
    if (emojiSec) emojiSec.style.display = 'none';
    if (gradSec) gradSec.style.display = 'none';
  }

  _renderSelectedEmojis();
  _updateAvatarPreview(letter || 'A');
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
  const letter = getNameInitial(allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name);
  _updateAvatarPreview(letter);
}

window._addCustomEmoji = function(val) {
  if (!val) return;
  const em = val; // Users can paste any emoji
  if (_avatarPickerState.emojis.length >= 6) {
    showToast('⚠️ Tối đa 6 emoji');
    return;
  }
  if (!_avatarPickerState.emojis.includes(em)) {
    _avatarPickerState.emojis.push(em);
  }
  _renderSelectedEmojis();
  const letter = _avatarPickerState.profileId === '__staff__'
    ? getNameInitial(myStaff?.nickname || myStaff?.full_name)
    : getNameInitial(allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name);
  _updateAvatarPreview(letter);
};

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
  const letter = getNameInitial(allProfiles?.find(p=>p.id===_avatarPickerState.profileId)?.full_name);
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
    value = gradient;
  } else {
    showToast('⚠️ Chưa chọn phong cách');
    return;
  }

  // Disable button during save
  const saveBtn = document.querySelector('#avatarStyleModal button[onclick*="_saveAvatarStyle"]');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Đang lưu...'; }

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
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '✅ Lưu Avatar'; }
  }
}

// ── STAFF AVATAR PICKER (Cá nhân hoá TĐ) ───────────────────────
// Opens the same style picker modal but saves to staff table instead
function _openStaffAvatarPicker() {
  const currentRaw = document.getElementById('prof_staff_avatar_color')?.value || '';
  const cfg = parseAvatarConfig(currentRaw) || {};
  const letter = getNameInitial(myStaff?.nickname || myStaff?.full_name);

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
      
      <div style="display:flex;justify-content:center;margin-bottom:20px;">
        <div id="avPickerPreview" style="transform:scale(1.2);"></div>
      </div>

      <!-- STYLE GRID -->
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">✨ Phong cách Epic</div>
      <div id="avPickerEpicGrid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:18px;"></div>
      
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🧸 Kinh Thánh Dễ Thương</div>
      <div id="avPickerCuteGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:18px;"></div>

      <!-- EMOJI PICKER -->
      <div id="avEmojiSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;display:flex;justify-content:space-between;align-items:center;">
          <span>🎨 Chọn Emoji (nhấn để thêm)</span>
          <input type="text" placeholder="➕ Nhập từ phím..." style="width:110px;background:none;border:none;border-bottom:1px dashed var(--accent);color:var(--text);font-size:12px;font-weight:600;text-align:right;outline:none;" oninput="if(this.value.trim()){_addCustomEmoji(this.value.trim()); this.value='';}" title="Gõ emoji bất kỳ từ bàn phím điện thoại của bạn" />
        </div>
        <div id="avSelectedEmojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;min-height:32px;padding:8px 10px;background:var(--surface2);border-radius:10px;border:1px dashed var(--border);"></div>
        <div id="avEmojiGrid" style="display:flex;flex-wrap:wrap;gap:4px;max-height:120px;overflow-y:auto;margin-bottom:16px;padding:4px;"></div>
      </div>

      <!-- GRADIENT -->
      <div id="avGradientSection" style="display:none;">
        <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:10px;text-transform:uppercase;letter-spacing:1px;">🖌 Hoặc chỉ chọn màu nền</div>
        <div id="avGradientGrid" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;"></div>
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

async function _saveStaffAvatarStyle() {
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
    showToast('⚠️ Chưa chọn phong cách');
    return;
  }

  // Save directly to DB
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${myStaff.staff_code}`, {
      method: 'PATCH',
      body: JSON.stringify({ staff_avatar_color: value })
    });
    // Update local cache
    myStaff.staff_avatar_color = value;

    // Update hidden input in settings panel (if open)
    const input = document.getElementById('prof_staff_avatar_color');
    if (input) input.value = value;

    // Update preview box in settings panel
    const letter = getNameInitial(myStaff?.nickname || myStaff?.full_name);
    const previewBox = document.getElementById('staffAvatarPreviewBox');
    if (previewBox) {
      previewBox.innerHTML = renderAnimatedAvatar(letter, value, 'md');
    }

    // Refresh header avatar
    const headerAv = document.getElementById('headerAvatar');
    if (headerAv) {
      const dn = myStaff.nickname || myStaff.full_name || '?';
      const lt = getNameInitial(dn);
      const avH = typeof renderAnimatedAvatar === 'function'
        ? renderAnimatedAvatar(lt, value, 'md')
        : `<div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${lt}</div>`;
      headerAv.innerHTML = `<div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="openPersonalizationPanel()" title="Cài đặt"><div style="padding:2px;border-radius:50%;background:linear-gradient(135deg,rgba(255,255,255,0.5),rgba(255,255,255,0.15));box-shadow:0 0 12px rgba(255,255,255,0.2);">${avH}</div><div style="display:flex;flex-direction:column;gap:1px;"><span style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.97);text-shadow:0 1px 3px rgba(0,0,0,0.2);line-height:1.2;">${dn}</span><span style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.6);line-height:1;">Hệ thống quản lý</span></div></div>`;
    }

    showToast('✅ Đã lưu avatar!');
    document.getElementById('avatarStyleModal')?.remove();
  } catch(e) {
    console.error('saveStaffAvatarStyle:', e);
    showToast('❌ Lỗi lưu avatar');
  }
}
