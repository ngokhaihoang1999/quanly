// ══════════════════════════════════════════════════════════════════════════════
// STRATEGY v1 — Chiến lược tiếp cận (Manual Planning Board)
// Phương án C: Timeline header + Expand sections
// ══════════════════════════════════════════════════════════════════════════════

const CL_SECTIONS = [
  {
    id: 'boi_canh', icon: '🗺️', label: 'Bối cảnh', color: '#8b5cf6',
    fields: [
      { key: 'cl_concept', label: 'Concept đang dùng', placeholder: 'VD: CLB phát triển bản thân, Học viện tâm lý...', type: 'input' },
      { key: 'cl_cach_quen', label: 'Cách quen / Hoàn cảnh gặp', placeholder: 'CLB nào? Online? Bạn giới thiệu? Sự kiện?', type: 'textarea' },
      { key: 'cl_kho_khan', label: 'Khó khăn / Nỗi đau hiện tại', placeholder: 'Trái đang gặp vấn đề gì? Khao khát gì?', type: 'textarea' },
      { key: 'cl_diem_hai', label: 'Điểm hái trái dự kiến', placeholder: 'Dự đoán ban đầu — nỗi đau sâu nhất có thể khai thác...', type: 'textarea' },
      { key: 'cl_rao_can', label: 'Rào cản tiềm ẩn', placeholder: 'GĐ phản đối? Bận? Đã theo đạo khác? Người yêu?', type: 'textarea' }
    ]
  },
  {
    id: 'tv1', icon: '📋', label: 'TV lần 1', color: '#3b82f6',
    fields: [
      { key: 'cl_tv1_cong_cu', label: '🔧 Công cụ sẽ dùng', placeholder: 'Enneagram? MBTI? Tính Quả? Bài test tâm lý?', type: 'input' },
      { key: 'cl_tv1_muc_tieu', label: 'Mục tiêu buổi 1', placeholder: 'VD: Hiểu tính cách, tạo tin tưởng ban đầu...', type: 'textarea' },
      { key: 'cl_tv1_tam_long', label: 'Chiến lược cày tấm lòng', placeholder: 'Làm gì để trái cảm thấy được quan tâm thật lòng?', type: 'textarea' },
      { key: 'cl_tv1_khai_thac', label: 'Hướng khai thác thông tin', placeholder: 'Muốn tìm hiểu thêm gì? Gia đình? Quá khứ? Nỗi lo?', type: 'textarea' },
      { key: 'cl_tv1_dan_dat', label: 'Kế sách dẫn dắt → TV lần 2', placeholder: 'Lý do hẹn gặp tiếp? Giao "bài tập"? Tạo tò mò ra sao?', type: 'textarea' }
    ]
  },
  {
    id: 'tv2', icon: '📋', label: 'TV lần 2+', color: '#10b981',
    fields: [
      { key: 'cl_tv2_cong_cu', label: '🔧 Công cụ sẽ dùng', placeholder: 'Công cụ mới hay đi sâu hơn công cụ cũ?', type: 'input' },
      { key: 'cl_tv2_muc_tieu', label: 'Mục tiêu buổi 2+', placeholder: 'VD: Xác nhận điểm hái trái, đào sâu nỗi đau...', type: 'textarea' },
      { key: 'cl_tv2_dao_sau', label: 'Chiến lược đào sâu vấn đề', placeholder: 'Hỏi gì để trái tự nhận ra nhu cầu ẩn sâu?', type: 'textarea' },
      { key: 'cl_tv2_chot_group', label: 'Chiến lược chốt vào Group TV-BB', placeholder: 'Giới thiệu group là gì (dưới concept)? Dùng concept nào? Ai sẽ hỗ trợ?', type: 'textarea' }
    ]
  },
  {
    id: 'ky_vong', icon: '🎯', label: 'Kỳ vọng', color: '#f59e0b',
    fields: [
      { key: 'cl_timeline', label: 'Thời gian dự kiến chuyển Group', placeholder: 'VD: Sau 2-3 lần TV, trong 2 tuần...', type: 'input' },
      { key: 'cl_lich_gap', label: 'Lịch gặp dự kiến', placeholder: 'VD: T3 + T6 tối, cuối tuần...', type: 'input' },
      { key: 'cl_gvbb_du_kien', label: 'GVBB dự kiến', placeholder: 'Ai phụ trách khi vào group? Phong cách phù hợp?', type: 'input' },
      { key: 'cl_ghi_chu', label: 'Ghi chú khác', placeholder: 'Lưu ý đặc biệt, cần phối hợp ai...', type: 'textarea' }
    ]
  },
  {
    id: 'rui_ro', icon: '⚠️', label: 'Rủi ro', color: '#ef4444',
    fields: [
      { key: 'cl_rui_ro', label: 'Rủi ro lớn nhất', placeholder: 'Bảo an bị lộ? GĐ? Người yêu? Mất hứng? Bận kéo dài?', type: 'textarea' },
      { key: 'cl_phuong_an', label: 'Phương án xử lý', placeholder: 'Nếu X xảy ra → làm Y...', type: 'textarea' },
      { key: 'cl_nguoi_ho_tro', label: 'Người hỗ trợ (Lá)', placeholder: 'Ai giúp giữ trái? Ai đóng vai "bạn trong CLB"?', type: 'textarea' }
    ]
  }
];

let _strategyLoaded = false;
let _strategyData = {};

function _clEsc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Render Strategy Board ──────────────────────────────────────────────────
function renderStrategyBoard() {
  const container = document.getElementById('strategyContent');
  if (!container) return;

  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = p?.full_name || '—';

  // Mini roadmap header (horizontal timeline)
  let roadmapHtml = `<div class="cl-roadmap">`;
  CL_SECTIONS.forEach((s, i) => {
    roadmapHtml += `
      <div class="cl-roadmap-node" data-section="${s.id}" onclick="scrollToSection('${s.id}')" style="--node-color:${s.color};">
        <div class="cl-roadmap-icon">${s.icon}</div>
        <div class="cl-roadmap-label">${s.label}</div>
      </div>`;
    if (i < CL_SECTIONS.length - 1) roadmapHtml += `<div class="cl-roadmap-line"></div>`;
  });
  roadmapHtml += `</div>`;

  // Sections (accordion cards)
  let sectionsHtml = '';
  CL_SECTIONS.forEach(s => {
    const fieldCount = s.fields.filter(f => _strategyData[f.key]?.trim()).length;
    const badge = fieldCount ? `<span class="cl-badge">${fieldCount}/${s.fields.length}</span>` : '';
    
    let fieldsHtml = '';
    s.fields.forEach(f => {
      const val = _strategyData[f.key] || '';
      if (f.type === 'textarea') {
        fieldsHtml += `
          <div class="cl-field">
            <label>${f.label}</label>
            <textarea id="${f.key}" placeholder="${f.placeholder}" onblur="_saveStrategyField('${f.key}',this.value)">${_clEsc(val)}</textarea>
          </div>`;
      } else {
        fieldsHtml += `
          <div class="cl-field">
            <label>${f.label}</label>
            <input type="text" id="${f.key}" value="${_clEsc(val)}" placeholder="${f.placeholder}" onblur="_saveStrategyField('${f.key}',this.value)" />
          </div>`;
      }
    });

    sectionsHtml += `
      <div class="cl-section" id="cl_sec_${s.id}" data-section="${s.id}">
        <div class="cl-section-header" onclick="toggleStrategySection('${s.id}')" style="--sec-color:${s.color};">
          <div class="cl-section-icon" style="background:${s.color};">${s.icon}</div>
          <div class="cl-section-title">${s.label}</div>
          ${badge}
          <div class="cl-section-arrow" id="cl_arrow_${s.id}">▾</div>
        </div>
        <div class="cl-section-body" id="cl_body_${s.id}" style="display:none;">
          ${fieldsHtml}
        </div>
      </div>`;
  });

  // Action buttons
  const actionsHtml = `
    <div class="cl-actions">
      <button class="cl-btn cl-btn-copy" onclick="copyStrategy()">📋 Copy chiến lược</button>
      <button class="cl-btn cl-btn-fullscreen" onclick="openStrategyPitchDeck()" style="background:var(--accent);color:#fff;box-shadow:0 4px 12px rgba(124,106,247,0.3);">✨ Trực quan</button>
    </div>`;

  container.innerHTML = `
    <div class="cl-board" id="strategyBoard">
      <div class="cl-header">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="cl-header-title">🧭 Chiến lược tiếp cận</div>
          <button onclick="openAIParseModal('chien_luoc')" style="background:linear-gradient(135deg,var(--accent),var(--accent2));border:none;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;color:white;font-weight:600;">✨ AI nhập nhanh</button>
        </div>
        <div class="cl-header-name">${name}</div>
      </div>
      ${roadmapHtml}
      ${sectionsHtml}
      ${actionsHtml}
    </div>`;
}

// ── Toggle section expand/collapse ─────────────────────────────────────────
function toggleStrategySection(sectionId) {
  const body = document.getElementById('cl_body_' + sectionId);
  const arrow = document.getElementById('cl_arrow_' + sectionId);
  if (!body) return;
  
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.textContent = isOpen ? '▾' : '▴';
  
  // Animate
  if (!isOpen) {
    body.style.opacity = '0';
    body.style.transform = 'translateY(-8px)';
    requestAnimationFrame(() => {
      body.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      body.style.opacity = '1';
      body.style.transform = 'translateY(0)';
    });
  }
}

// ── Scroll to section from roadmap ─────────────────────────────────────────
function scrollToSection(sectionId) {
  const el = document.getElementById('cl_sec_' + sectionId);
  if (!el) return;
  
  // Open section if closed
  const body = document.getElementById('cl_body_' + sectionId);
  if (body && body.style.display === 'none') toggleStrategySection(sectionId);
  
  // Highlight roadmap node
  document.querySelectorAll('.cl-roadmap-node').forEach(n => n.classList.remove('active'));
  document.querySelector(`.cl-roadmap-node[data-section="${sectionId}"]`)?.classList.add('active');
  
  // Scroll
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Load strategy data from form_hanh_chinh ────────────────────────────────
async function loadStrategy() {
  if (!currentProfileId) return;
  _strategyLoaded = false;
  _strategyData = {};
  
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}&select=data`);
    const rows = await res.json();
    const d = rows?.[0]?.data || {};
    
    // Extract cl_* keys
    Object.keys(d).forEach(k => {
      if (k.startsWith('cl_')) _strategyData[k] = d[k];
    });
  } catch(e) { console.warn('loadStrategy:', e); }
  
  _strategyLoaded = true;
  renderStrategyBoard();
}

// ── Save single field (debounced) ──────────────────────────────────────────
let _strategySaveTimer = null;
function _saveStrategyField(key, value) {
  _strategyData[key] = value;
  
  // Update roadmap badge
  _updateSectionBadge(key);
  
  // Debounce save
  clearTimeout(_strategySaveTimer);
  _strategySaveTimer = setTimeout(() => _saveAllStrategy(), 800);
}

function _updateSectionBadge(changedKey) {
  CL_SECTIONS.forEach(s => {
    if (!s.fields.find(f => f.key === changedKey)) return;
    const count = s.fields.filter(f => _strategyData[f.key]?.trim()).length;
    const badge = document.querySelector(`#cl_sec_${s.id} .cl-badge`);
    if (badge) {
      badge.textContent = `${count}/${s.fields.length}`;
      badge.style.display = count ? '' : 'none';
    } else if (count) {
      const header = document.querySelector(`#cl_sec_${s.id} .cl-section-header`);
      if (header) {
        const arrow = header.querySelector('.cl-section-arrow');
        const span = document.createElement('span');
        span.className = 'cl-badge';
        span.textContent = `${count}/${s.fields.length}`;
        header.insertBefore(span, arrow);
      }
    }
  });
}

async function _saveAllStrategy() {
  if (!currentProfileId) return;
  try {
    // Fetch existing, merge cl_* keys
    const exRes = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}&select=data`);
    const exRows = await exRes.json();
    const existing = exRows?.[0]?.data || {};
    
    // Merge: keep all non-cl_ keys, overwrite cl_ keys
    const merged = { ...existing };
    Object.keys(_strategyData).forEach(k => { merged[k] = _strategyData[k]; });
    
    await sbFetch('/rest/v1/form_hanh_chinh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ profile_id: currentProfileId, data: merged })
    });
    showToast('✅ Đã lưu chiến lược');
  } catch(e) {
    console.error('saveStrategy:', e);
    showToast('❌ Lỗi lưu chiến lược');
  }
}

// ── Copy Strategy ──────────────────────────────────────────────────────────
function copyStrategy() {
  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = p?.full_name || '—';
  const v = key => _strategyData[key]?.trim() || '—';
  
  let text = `🧭 CHIẾN LƯỢC TIẾP CẬN\n🍎 ${name}\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  CL_SECTIONS.forEach(s => {
    text += `${s.icon} ${s.label.toUpperCase()}\n`;
    s.fields.forEach(f => {
      text += `• ${f.label.replace(/🔧 /, '')}: ${v(f.key)}\n`;
    });
    text += '\n';
  });
  
  copyToClipboard(text.trim());
}

// ── Pitch Deck (Story Mode) ────────────────────────────────────────────────
let _deckActiveSlide = 0;

function openStrategyPitchDeck() {
  if (document.getElementById('strategyPitchDeck')) return;
  
  _deckActiveSlide = 0;
  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = p?.full_name || '—';
  
  const overlay = document.createElement('div');
  overlay.id = 'strategyPitchDeck';
  overlay.className = 'pitch-deck-overlay';
  
  // Ambient blobs
  const blobs = `
    <div class="ambient-blobs">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
    </div>`;
  
  // Progress bar
  let progressHtml = '<div class="deck-progress">';
  CL_SECTIONS.forEach((_, i) => {
    progressHtml += `<div class="deck-progress-bar"><div class="deck-progress-fill" id="deck_prog_${i}"></div></div>`;
  });
  progressHtml += '</div>';

  // Slides
  let slidesHtml = '';
  CL_SECTIONS.forEach((s, i) => {
    let fHtml = '';
    s.fields.forEach(f => {
      const val = _strategyData[f.key]?.trim();
      if (!val) return; // Only show filled fields
      
      const vEsc = _clEsc(val);
      // Highlight specific tool fields
      if (f.key.includes('cong_cu')) {
        fHtml += `<div class="deck-field"><label>${f.label.replace('🔧 ', '')}</label><div class="deck-tool-badge">${vEsc}</div></div>`;
      } else {
        fHtml += `<div class="deck-field"><label>${f.label}</label><div class="deck-field-val">${vEsc}</div></div>`;
      }
    });
    
    if (!fHtml) fHtml = '<div style="color:#64748b; font-size:14px; font-style:italic;">Chưa có dữ liệu</div>';
    
    slidesHtml += `
      <div class="deck-card ${i === 0 ? 'active' : ''}" id="deck_slide_${i}">
        <div class="deck-card-header">
          <div class="deck-card-icon" style="color: ${s.color}; box-shadow: 0 0 15px ${s.color}40;">${s.icon}</div>
          <div class="deck-card-title">${s.label}</div>
        </div>
        ${fHtml}
      </div>`;
  });

  overlay.innerHTML = `
    ${blobs}
    <button class="deck-close" onclick="closeStrategyPitchDeck()">✕</button>
    <div class="deck-container">
      <div style="text-align:center; margin-bottom:16px;">
        <div style="font-weight:700; opacity:0.6; font-size:11px; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">Nhiệm vụ mục tiêu</div>
        <div style="font-size:15px; font-weight:800; color:#0284c7;">${name}</div>
      </div>
      ${progressHtml}
      <div class="deck-slide-area">
        ${slidesHtml}
      </div>
      <div class="deck-nav-hitbox deck-nav-left" onclick="navDeckSlide(-1)"></div>
      <div class="deck-nav-hitbox deck-nav-right" onclick="navDeckSlide(1)"></div>
    </div>`;
  
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  _updateDeckProgress();
  
  // Hide heavy content behind overlay on desktop to reduce GPU compositing
  if (window.innerWidth >= 1024) {
    const desktopLayout = document.querySelector('.desktop-layout');
    if (desktopLayout) desktopLayout.style.visibility = 'hidden';
    const header = document.querySelector('.header');
    if (header) header.style.visibility = 'hidden';
  }
  
  // Add keyboard navigation
  window.addEventListener('keydown', _deckKeyHandler);
}

function navDeckSlide(dir) {
  const newIdx = _deckActiveSlide + dir;
  if (newIdx < 0) {
    // maybe close deck if swiping left on first slide? Nah
    return;
  }
  if (newIdx >= CL_SECTIONS.length) {
    closeStrategyPitchDeck();
    return;
  }
  
  const currCard = document.getElementById('deck_slide_' + _deckActiveSlide);
  const nextCard = document.getElementById('deck_slide_' + newIdx);
  
  if (currCard) {
    currCard.classList.remove('active');
    currCard.classList.toggle('prev', dir > 0);
  }
  if (nextCard) {
    nextCard.classList.add('active');
    nextCard.classList.remove('prev');
  }
  
  _deckActiveSlide = newIdx;
  _updateDeckProgress();
}

function _updateDeckProgress() {
  CL_SECTIONS.forEach((_, i) => {
    const bar = document.getElementById('deck_prog_' + i);
    if (!bar) return;
    if (i < _deckActiveSlide) bar.style.width = '100%';
    else if (i === _deckActiveSlide) bar.style.width = '100%';
    else bar.style.width = '0%';
    
    // Add opacity diff for completed vs active
    bar.style.opacity = i === _deckActiveSlide ? '1' : (i < _deckActiveSlide ? '0.6' : '0');
  });
}

function closeStrategyPitchDeck() {
  const overlay = document.getElementById('strategyPitchDeck');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); }, 200);
  }
  document.body.style.overflow = '';
  window.removeEventListener('keydown', _deckKeyHandler);
  
  // Restore hidden content
  const desktopLayout = document.querySelector('.desktop-layout');
  if (desktopLayout) desktopLayout.style.visibility = '';
  const header = document.querySelector('.header');
  if (header) header.style.visibility = '';
}

function _deckKeyHandler(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') navDeckSlide(1);
  else if (e.key === 'ArrowLeft') navDeckSlide(-1);
  else if (e.key === 'Escape') closeStrategyPitchDeck();
}
