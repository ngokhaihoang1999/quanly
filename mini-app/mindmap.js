// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v8 — Ministry Insight Dashboard
// Designed for: Church ministry manager tracking fruit's spiritual journey
// No more markmap — purpose-built mobile-first card UI
// ══════════════════════════════════════════════════════════════════════════════

let _mmCurrentType = 'info';

function switchMindmap(type, btn) {
  _mmCurrentType = type;
  document.querySelectorAll('#mindmapTab .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderMindmap();
}

function renderMindmap() {
  const container = document.getElementById('mindmapContainer');
  if (!container || !currentProfileId) return;
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) return;
  if (_mmCurrentType === 'info') renderInfoMM(container, p);
  else renderCollectMM(container, p);
}

// ── Utilities ──
function escH(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function condense(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

// ═══════════════════════════════════════════════════
// TAB 1: Cá nhân — Clean profile summary
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  let html = `<div class="mm-dashboard">`;

  // Profile hero
  html += `<div class="mm-hero">
    <div class="mm-hero-name">${escH(name)}</div>
  </div>`;

  // Info sections
  const sections = [];

  const nhanThan=[];
  if (d.gioi_tinh||p.gender) nhanThan.push(d.gioi_tinh||p.gender);
  if (d.nam_sinh||p.birth_year) nhanThan.push('Sinh '+(d.nam_sinh||p.birth_year));
  if (d.nghe_nghiep) nhanThan.push(d.nghe_nghiep);
  if (nhanThan.length) sections.push({ icon:'👤', title:'Nhân thân', items: nhanThan });

  const noi=[d.dia_chi,d.que_quan].filter(Boolean);
  if (noi.length) sections.push({ icon:'📍', title:'Nơi sống', items: noi });

  const gd=[];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('Người QT: '+d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(d.nguoi_than);
  if (gd.length) sections.push({ icon:'👨‍👩‍👧', title:'Gia đình', items: gd });

  if (d.ton_giao) sections.push({ icon:'🙏', title:'Tôn giáo', items: [Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao] });
  if (d.tinh_cach) sections.push({ icon:'🧩', title:'Tính cách', items: [d.tinh_cach] });
  if (d.so_thich) sections.push({ icon:'⭐', title:'Sở thích', items: [d.so_thich] });
  if (d.du_dinh) sections.push({ icon:'🎯', title:'Dự định', items: [d.du_dinh] });
  if (d.quan_diem) sections.push({ icon:'🌟', title:'Quan điểm Thần linh', items: [d.quan_diem] });
  if (d.chuyen_cu) sections.push({ icon:'📖', title:'Câu chuyện', items: [d.chuyen_cu] });
  if (d.luu_y) sections.push({ icon:'⚠️', title:'Lưu ý', items: [d.luu_y] });

  if (sections.length === 0) {
    html += `<div class="mm-empty">📋 Chưa có dữ liệu<br><span style="font-size:11px;color:var(--text3);">Hãy điền Phiếu Thông tin</span></div>`;
  } else {
    sections.forEach((s, si) => {
      const id = 'mmInfo_' + si;
      const preview = escH(condense(s.items[0], 40));
      const hasMore = s.items.length > 1 || s.items[0].length > 40;
      html += `<div class="mm-section">
        <div class="mm-section-head" ${hasMore ? `onclick="document.getElementById('${id}').classList.toggle('mm-open')"` : ''}>
          <span class="mm-section-icon">${s.icon}</span>
          <span class="mm-section-title">${escH(s.title)}</span>
          <span class="mm-section-preview">${preview}</span>
          ${hasMore ? '<span class="mm-section-arrow">›</span>' : ''}
        </div>
        ${hasMore ? `<div class="mm-section-body" id="${id}">
          ${s.items.map(it => `<div class="mm-section-detail">${escH(it)}</div>`).join('')}
        </div>` : ''}
      </div>`;
    });
  }

  html += '</div>';
  container.innerHTML = html;
  container.style.overflow = 'auto';
}

// ═══════════════════════════════════════════════════
// TAB 2: Thu thập — Ministry Insight Dashboard
// ═══════════════════════════════════════════════════

// TV field definitions
const TV_FIELDS = [
  { key:'van_de', label:'Vấn đề khai thác', icon:'🎯', important:true },
  { key:'phan_hoi', label:'Phản hồi trái', icon:'💭', important:true },
  { key:'diem_hai', label:'Điểm hái trái', icon:'⭐', important:false },
  { key:'de_xuat', label:'Đề xuất TVV', icon:'💡', important:true },
  { key:'ket_qua_test', label:'Kết quả test', icon:'📋', important:false },
  { key:'ten_cong_cu', label:'Công cụ', icon:'🔧', important:false },
];

// BB field definitions
const BB_FIELDS = [
  { key:'khai_thac', label:'Phát hiện mới', icon:'🔍', important:true },
  { key:'phan_ung', label:'Phản ứng HS', icon:'💭', important:true },
  { key:'tuong_tac', label:'Tương tác đáng chú ý', icon:'🤝', important:true },
  { key:'noi_dung', label:'Nội dung buổi', icon:'📖', important:false },
  { key:'de_xuat_cs', label:'Đề xuất chăm sóc', icon:'💡', important:true },
  { key:'noi_dung_tiep', label:'Nội dung buổi tiếp', icon:'📅', important:false },
];

async function renderCollectMM(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">⏳ Đang phân tích hồ sơ...</div>';
  container.style.overflow = 'auto';

  try {
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();
    const d = window._currentInfoSheet || {};
    const ph = p.phase || 'chakki';

    if (tvs.length === 0 && bbs.length === 0 && nts.length === 0) {
      container.innerHTML = '<div class="mm-empty">📋 Chưa có dữ liệu<br><span style="font-size:11px;color:var(--text3);">Hãy thêm báo cáo TV, BB hoặc ghi chú</span></div>';
      return;
    }

    // ══ ANALYSIS ══

    // 1. Extract KEY ISSUES from all TV reports (van_de is most important)
    const keyIssues = [];
    tvs.forEach((r, i) => {
      const c = r.content || {};
      if (c.van_de) keyIssues.push({ text: c.van_de, src: 'TV lần '+(c.lan_thu||(i+1)) });
    });
    // Also from BB khai_thac
    bbs.forEach((r, i) => {
      const c = r.content || {};
      if (c.khai_thac) keyIssues.push({ text: c.khai_thac, src: 'BB buổi '+(c.buoi_thu||(i+1)) });
    });

    // 2. Extract RECOMMENDATIONS (de_xuat from TV, de_xuat_cs from BB)
    const recommendations = [];
    tvs.forEach((r, i) => {
      const c = r.content || {};
      if (c.de_xuat) recommendations.push({ text: c.de_xuat, src: 'TV lần '+(c.lan_thu||(i+1)) });
    });
    bbs.forEach((r, i) => {
      const c = r.content || {};
      if (c.de_xuat_cs) recommendations.push({ text: c.de_xuat_cs, src: 'BB buổi '+(c.buoi_thu||(i+1)) });
    });

    // 3. Extract REACTIONS/FEEDBACK (phan_hoi from TV, phan_ung from BB)
    const reactions = [];
    tvs.forEach((r, i) => {
      const c = r.content || {};
      if (c.phan_hoi) reactions.push({ text: c.phan_hoi, src: 'TV lần '+(c.lan_thu||(i+1)) });
    });
    bbs.forEach((r, i) => {
      const c = r.content || {};
      if (c.phan_ung) reactions.push({ text: c.phan_ung, src: 'BB buổi '+(c.buoi_thu||(i+1)) });
    });

    // 4. Extract INTERACTIONS (tuong_tac from BB)
    const interactions = [];
    bbs.forEach((r, i) => {
      const c = r.content || {};
      if (c.tuong_tac) interactions.push({ text: c.tuong_tac, src: 'BB buổi '+(c.buoi_thu||(i+1)) });
    });

    // 5. Notes by user
    const noteItems = [];
    nts.forEach(r => {
      const c = r.content || {};
      if (c.title || c.body) noteItems.push({ title: c.title||'Ghi chú', body: c.body||'' });
    });

    // 6. Emotion analysis
    const negW=['khó khăn','buồn','lo','sợ','mệt','chán','stress','áp lực','thất vọng','đau','tức','giận','cô đơn','trầm','kiểm cặp','khó','tiêu cực','từ chối','không muốn','không chịu'];
    const posW=['vui','hy vọng','tích cực','tiến bộ','mở lòng','hạnh phúc','cam kết','sẵn sàng','cải thiện','hòa thuận','đồng ý','chấp nhận','mở','quan tâm','hứng thú'];
    let negCount=0, posCount=0;
    const allTexts = [
      ...keyIssues.map(x=>x.text), ...reactions.map(x=>x.text),
      ...interactions.map(x=>x.text), ...noteItems.map(x=>x.body)
    ];
    allTexts.forEach(t => {
      const l = t.toLowerCase();
      negW.forEach(w => { if (l.includes(w)) negCount++; });
      posW.forEach(w => { if (l.includes(w)) posCount++; });
    });

    let emotionLabel, emotionColor, emotionIcon;
    if (negCount + posCount === 0) { emotionLabel='Chưa rõ'; emotionColor='var(--text3)'; emotionIcon='❓'; }
    else if (negCount > posCount*2) { emotionLabel='Tiêu cực'; emotionColor='var(--red)'; emotionIcon='⚠️'; }
    else if (posCount > negCount*2) { emotionLabel='Tích cực'; emotionColor='var(--green)'; emotionIcon='✅'; }
    else { emotionLabel='Pha trộn'; emotionColor='#f59e0b'; emotionIcon='🔄'; }

    // ══ RENDER ══
    let html = `<div class="mm-dashboard">`;

    // ── HERO: Overview strip ──
    const phLabel = (typeof PHASE_LABELS !== 'undefined' ? PHASE_LABELS[ph] : ph) || ph;
    const phColor = (typeof PHASE_COLORS !== 'undefined' ? PHASE_COLORS[ph] : '#888') || '#888';
    html += `<div class="mm-hero">
      <div class="mm-hero-name">${escH(p.full_name||'')}</div>
      <div class="mm-hero-stats">
        <span class="mm-stat"><b>${tvs.length}</b> TV</span>
        <span class="mm-stat"><b>${bbs.length}</b> BB</span>
        <span class="mm-stat"><b>${nts.length}</b> ghi chú</span>
        <span class="mm-stat" style="background:${phColor};color:white;">${phLabel}</span>
      </div>
      <div class="mm-hero-emotion">
        <span>${emotionIcon} Xu hướng: <b style="color:${emotionColor}">${emotionLabel}</b></span>
      </div>
    </div>`;

    // ── Section 1: Vấn đề trọng tâm (key issues) ──
    if (keyIssues.length > 0) {
      html += buildSection('mmKI', '🎯', 'Vấn đề trọng tâm', 'Những vấn đề/nhu cầu khai thác được', keyIssues, true);
    }

    // ── Section 2: Phản hồi & Thái độ ──
    if (reactions.length > 0) {
      html += buildSection('mmRE', '💭', 'Phản hồi & Thái độ', 'Cảm nhận và phản ứng', reactions, false);
    }

    // ── Section 3: Tương tác BB ──
    if (interactions.length > 0) {
      html += buildSection('mmIA', '🤝', 'Tương tác trong nhóm', 'Nhận xét đáng chú ý từ BB', interactions, false);
    }

    // ── Section 4: Ghi chú quan sát ──  
    if (noteItems.length > 0) {
      html += `<div class="mm-card mm-card-note">
        <div class="mm-card-head" onclick="document.getElementById('mmNO').classList.toggle('mm-open')">
          <span class="mm-card-icon">📌</span>
          <div class="mm-card-info">
            <div class="mm-card-title">Ghi chú quan sát</div>
            <div class="mm-card-sub">${noteItems.map(n => escH(n.title)).join(' • ')}</div>
          </div>
          <span class="mm-card-arrow">›</span>
        </div>
        <div class="mm-card-body" id="mmNO">`;
      noteItems.forEach(n => {
        html += `<div class="mm-detail-src">${escH(n.title)}</div>
          <div class="mm-detail-text">${escH(n.body)}</div>`;
      });
      html += `</div></div>`;
    }

    // ── Section 5: Đề xuất & Hướng đi ──
    if (recommendations.length > 0) {
      html += buildSection('mmREC', '💡', 'Đề xuất & Hướng đi', 'Khuyến nghị từ TVV và GVBB', recommendations, true);
    }

    // ── Section 6: Tiến trình tư vấn (timeline view) ──
    if (tvs.length > 0 || bbs.length > 0) {
      html += `<div class="mm-card">
        <div class="mm-card-head" onclick="document.getElementById('mmTL').classList.toggle('mm-open')">
          <span class="mm-card-icon">📈</span>
          <div class="mm-card-info">
            <div class="mm-card-title">Tiến trình chi tiết</div>
            <div class="mm-card-sub">${tvs.length} báo cáo TV + ${bbs.length} báo cáo BB</div>
          </div>
          <span class="mm-card-arrow">›</span>
        </div>
        <div class="mm-card-body" id="mmTL">`;

      // Interleave TV and BB chronologically
      const timeline = [];
      tvs.forEach((r,i) => {
        const c = r.content || {};
        timeline.push({ type:'tv', num: c.lan_thu||(i+1), date: r.created_at, content: c });
      });
      bbs.forEach((r,i) => {
        const c = r.content || {};
        timeline.push({ type:'bb', num: c.buoi_thu||(i+1), date: r.created_at, content: c });
      });
      timeline.sort((a,b) => new Date(a.date) - new Date(b.date));

      timeline.forEach(ev => {
        if (ev.type === 'tv') {
          html += `<div class="mm-timeline-item mm-tl-tv">
            <div class="mm-tl-badge">TV ${ev.num}${ev.content.ten_cong_cu ? ' · '+condense(ev.content.ten_cong_cu,15) : ''}</div>`;
          TV_FIELDS.forEach(f => {
            if (ev.content[f.key]) {
              html += `<div class="mm-tl-field${f.important?' mm-tl-important':''}">
                <span class="mm-tl-icon">${f.icon}</span> ${escH(ev.content[f.key])}
              </div>`;
            }
          });
          html += `</div>`;
        } else {
          html += `<div class="mm-timeline-item mm-tl-bb">
            <div class="mm-tl-badge" style="background:var(--green);">BB ${ev.num}</div>`;
          BB_FIELDS.forEach(f => {
            if (ev.content[f.key]) {
              html += `<div class="mm-tl-field${f.important?' mm-tl-important':''}">
                <span class="mm-tl-icon">${f.icon}</span> ${escH(ev.content[f.key])}
              </div>`;
            }
          });
          html += `</div>`;
        }
      });

      html += `</div></div>`;
    }

    html += '</div>';
    container.innerHTML = html;

  } catch(e) {
    container.innerHTML = '<div class="mm-empty">❌ Lỗi tải dữ liệu</div>';
    console.error(e);
  }
}

// ── Build a standard insight section ──
function buildSection(id, icon, title, subtitle, items, startOpen) {
  const preview = condense(items[0].text, 50);
  let html = `<div class="mm-card${startOpen?' mm-card-highlight':''}">
    <div class="mm-card-head" onclick="document.getElementById('${id}').classList.toggle('mm-open')">
      <span class="mm-card-icon">${icon}</span>
      <div class="mm-card-info">
        <div class="mm-card-title">${escH(title)}</div>
        <div class="mm-card-sub">${escH(preview)}</div>
      </div>
      <span class="mm-card-arrow">›</span>
    </div>
    <div class="mm-card-body${startOpen?' mm-open':''}" id="${id}">`;
  items.forEach(it => {
    html += `<div class="mm-detail-item-wrap">
      <div class="mm-detail-src-tag">${escH(it.src)}</div>
      <div class="mm-detail-text">${escH(it.text)}</div>
    </div>`;
  });
  html += `</div></div>`;
  return html;
}
