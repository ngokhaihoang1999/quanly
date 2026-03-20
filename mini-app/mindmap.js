// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v9 — Visual CSS Mindmap + Detail Drill-down
// Concise visual tree on top, expandable details below
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

function escH(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function short(t, n) { if(!t)return''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

// ═══════════════════════════════════════════════════
// TAB 1: Cá nhân — Visual profile mindmap
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';

  const branches = [];
  const identity = [d.gioi_tinh||p.gender, d.nam_sinh?'Sinh '+d.nam_sinh:p.birth_year?'Sinh '+p.birth_year:null, d.nghe_nghiep].filter(Boolean);
  if (identity.length) branches.push({ icon:'👤', label:'Nhân thân', items:identity, color:'#6366f1' });

  const family = [];
  if (d.hon_nhan) family.push(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan);
  if (d.nguoi_quan_trong) family.push('QT: '+d.nguoi_quan_trong);
  if (d.nguoi_than) family.push(short(d.nguoi_than,40));
  if (family.length) branches.push({ icon:'👨‍👩‍👧', label:'Gia đình', items:family, color:'#ec4899' });

  if (d.tinh_cach) branches.push({ icon:'🧩', label:'Tính cách', items:[d.tinh_cach], color:'#f59e0b' });
  if (d.so_thich) branches.push({ icon:'⭐', label:'Sở thích', items:[d.so_thich], color:'#10b981' });
  if (d.ton_giao) branches.push({ icon:'🙏', label:'Tôn giáo', items:[Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao], color:'#8b5cf6' });
  if (d.du_dinh) branches.push({ icon:'🎯', label:'Dự định', items:[d.du_dinh], color:'#3b82f6' });
  if (d.quan_diem) branches.push({ icon:'🌟', label:'Quan điểm TL', items:[d.quan_diem], color:'#6366f1' });
  if (d.chuyen_cu) branches.push({ icon:'📖', label:'Câu chuyện', items:[d.chuyen_cu], color:'#64748b' });
  if (d.luu_y) branches.push({ icon:'⚠️', label:'Lưu ý', items:[d.luu_y], color:'#ef4444' });

  const noi = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noi.length) branches.push({ icon:'📍', label:'Nơi sống', items:noi, color:'#14b8a6' });

  if (branches.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">📋 Chưa có dữ liệu<br><small>Hãy điền Phiếu Thông tin</small></div>';
    return;
  }

  container.innerHTML = buildVisualMindmap(name, branches);
}

// ═══════════════════════════════════════════════════
// TAB 2: Thu thập — Ministry insight mindmap
// ═══════════════════════════════════════════════════
const TV_F = [
  { key:'van_de', icon:'🎯' }, { key:'phan_hoi', icon:'💭' },
  { key:'diem_hai', icon:'⭐' }, { key:'de_xuat', icon:'💡' },
  { key:'ket_qua_test', icon:'📋' }, { key:'ten_cong_cu', icon:'🔧' },
];
const BB_F = [
  { key:'khai_thac', icon:'🔍' }, { key:'phan_ung', icon:'💭' },
  { key:'tuong_tac', icon:'🤝' }, { key:'noi_dung', icon:'📖' },
  { key:'de_xuat_cs', icon:'💡' },
];

async function renderCollectMM(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">⏳ Phân tích...</div>';
  try {
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();

    if (!tvs.length && !bbs.length && !nts.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">📋 Chưa có dữ liệu</div>';
      return;
    }

    // ── Extract insights ──
    const issues = [];    // 🎯 Vấn đề cần chú ý (van_de + khai_thac)
    const approach = [];  // 💕 Cách lấy lòng (so_thich, phan_hoi positive, tuong_tac)
    const warnings = [];  // ⚠️ Lưu ý (negative phan_hoi, phan_ung)
    const nextSteps = []; // 💡 Hướng đi (de_xuat, de_xuat_cs)
    const tools = [];     // 🔧 Công cụ đã dùng

    const negW = ['khó','buồn','lo','sợ','mệt','chán','stress','áp lực','thất vọng','đau','tức','giận','cô đơn','trầm','kiểm cặp','không muốn','từ chối','tiêu cực','khó khăn'];
    const posW = ['vui','hy vọng','tích cực','mở lòng','cam kết','sẵn sàng','hòa thuận','đồng ý','quan tâm','hứng thú','chia sẻ','thoải mái'];

    tvs.forEach((r, i) => {
      const c = r.content || {};
      const label = 'TV' + (c.lan_thu||(i+1));
      if (c.van_de) {
        // Split into sentences for more granular issues
        c.van_de.split(/[.;\n]+/).filter(s=>s.trim().length>3).forEach(s => {
          issues.push({ text: s.trim(), src: label });
        });
      }
      if (c.phan_hoi) {
        const l = c.phan_hoi.toLowerCase();
        if (posW.some(w=>l.includes(w))) approach.push({ text: c.phan_hoi, src: label });
        else if (negW.some(w=>l.includes(w))) warnings.push({ text: c.phan_hoi, src: label });
        else approach.push({ text: c.phan_hoi, src: label });
      }
      if (c.de_xuat) nextSteps.push({ text: c.de_xuat, src: label });
      if (c.ten_cong_cu) tools.push(c.ten_cong_cu);
      if (c.diem_hai) approach.push({ text: '⭐ '+c.diem_hai, src: label });
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      const label = 'BB' + (c.buoi_thu||(i+1));
      if (c.khai_thac) {
        c.khai_thac.split(/[.;\n]+/).filter(s=>s.trim().length>3).forEach(s => {
          issues.push({ text: s.trim(), src: label });
        });
      }
      if (c.phan_ung) {
        const l = c.phan_ung.toLowerCase();
        if (negW.some(w=>l.includes(w))) warnings.push({ text: c.phan_ung, src: label });
        else approach.push({ text: c.phan_ung, src: label });
      }
      if (c.tuong_tac) approach.push({ text: c.tuong_tac, src: label });
      if (c.de_xuat_cs) nextSteps.push({ text: c.de_xuat_cs, src: label });
    });

    // Notes → both issues & approach hints
    nts.forEach(r => {
      const c = r.content || {};
      if (c.title && c.body) {
        const l = (c.title+' '+c.body).toLowerCase();
        if (negW.some(w=>l.includes(w))) {
          warnings.push({ text: c.title+': '+short(c.body,40), src: '📌' });
        } else {
          approach.push({ text: c.title+': '+short(c.body,40), src: '📌' });
        }
      }
    });

    // ── Build mindmap branches ──
    const branches = [];

    if (issues.length) {
      branches.push({
        icon: '🎯', label: 'Cần chú ý',
        items: issues.slice(0,4).map(x => short(x.text,30)),
        full: issues,
        color: '#ef4444'
      });
    }

    if (approach.length) {
      branches.push({
        icon: '💕', label: 'Tiếp cận',
        items: approach.slice(0,4).map(x => short(x.text,30)),
        full: approach,
        color: '#10b981'
      });
    }

    if (warnings.length) {
      branches.push({
        icon: '⚠️', label: 'Lưu ý',
        items: warnings.slice(0,3).map(x => short(x.text,30)),
        full: warnings,
        color: '#f59e0b'
      });
    }

    if (nextSteps.length) {
      branches.push({
        icon: '💡', label: 'Hướng đi',
        items: nextSteps.slice(0,3).map(x => short(x.text,30)),
        full: nextSteps,
        color: '#3b82f6'
      });
    }

    if (tools.length) {
      branches.push({
        icon: '🔧', label: 'Công cụ',
        items: tools.map(t => short(t,20)),
        color: '#8b5cf6'
      });
    }

    // Add stats as a mini branch
    branches.push({
      icon: '📊', label: 'Tổng quan',
      items: [`${tvs.length} TV, ${bbs.length} BB, ${nts.length} note`],
      color: '#64748b'
    });

    const name = p.full_name || 'Thu thập';
    let html = buildVisualMindmap(name, branches);

    // ── Detail drill-down below ──
    html += '<div style="padding:0 4px 8px;">';
    const sections = [
      { id:'dKI', icon:'🎯', title:'Vấn đề cần chú ý', data:issues, color:'#ef4444' },
      { id:'dAP', icon:'💕', title:'Cách tiếp cận & Lấy lòng', data:approach, color:'#10b981' },
      { id:'dWA', icon:'⚠️', title:'Lưu ý & Cảnh báo', data:warnings, color:'#f59e0b' },
      { id:'dNS', icon:'💡', title:'Đề xuất & Hướng đi', data:nextSteps, color:'#3b82f6' },
    ];

    sections.forEach(s => {
      if (!s.data.length) return;
      html += `<div class="mm-card" style="border-left:3px solid ${s.color};">
        <div class="mm-card-head" onclick="document.getElementById('${s.id}').classList.toggle('mm-open')">
          <span class="mm-card-icon">${s.icon}</span>
          <div class="mm-card-info">
            <div class="mm-card-title">${s.title}</div>
            <div class="mm-card-sub">${s.data.length} mục</div>
          </div>
          <span class="mm-card-arrow">›</span>
        </div>
        <div class="mm-card-body" id="${s.id}">`;
      s.data.forEach(it => {
        html += `<div class="mm-detail-item-wrap">
          <div class="mm-detail-src-tag">${escH(it.src)}</div>
          <div class="mm-detail-text">${escH(it.text)}</div>
        </div>`;
      });
      html += `</div></div>`;
    });
    html += '</div>';

    container.innerHTML = html;
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi</div>';
    console.error(e);
  }
}

// ═══════════════════════════════════════════════════
// Visual Mindmap Builder — Pure CSS tree
// ═══════════════════════════════════════════════════
function buildVisualMindmap(rootLabel, branches) {
  let html = '<div class="vmm">';

  // Root node
  html += `<div class="vmm-root">${escH(rootLabel)}</div>`;
  html += '<div class="vmm-connector"></div>';

  // Branches grid
  html += '<div class="vmm-branches">';
  branches.forEach((b, bi) => {
    html += `<div class="vmm-branch">
      <div class="vmm-branch-line" style="background:${b.color};"></div>
      <div class="vmm-branch-head" style="border-color:${b.color};">
        <span>${b.icon}</span> ${escH(b.label)}
      </div>
      <div class="vmm-branch-items">`;
    b.items.forEach(item => {
      html += `<div class="vmm-item" style="border-left-color:${b.color};">${escH(item)}</div>`;
    });
    html += `</div></div>`;
  });
  html += '</div></div>';
  return html;
}
