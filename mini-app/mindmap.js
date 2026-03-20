// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v2 — Smart topic-based layout with zoom & popup
// ══════════════════════════════════════════════════════════════════════════════

let _mmCurrentType = 'info';
let _mmZoom = 1;

function switchMindmap(type, btn) {
  _mmCurrentType = type;
  document.querySelectorAll('#mindmapTab .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _mmZoom = 1;
  renderMindmap();
}

function mmZoomIn() { _mmZoom = Math.min(_mmZoom + 0.15, 2.5); applyZoom(); }
function mmZoomOut() { _mmZoom = Math.max(_mmZoom - 0.15, 0.4); applyZoom(); }
function applyZoom() {
  const el = document.getElementById('mmInner');
  const lbl = document.getElementById('mmZoomLvl');
  if (el) el.style.transform = `scale(${_mmZoom})`;
  if (lbl) lbl.textContent = Math.round(_mmZoom * 100) + '%';
}

function showMmPopup(title, html) {
  document.querySelectorAll('.mm-popup,.mm-popup-overlay').forEach(e => e.remove());
  const ov = document.createElement('div'); ov.className = 'mm-popup-overlay';
  const pp = document.createElement('div'); pp.className = 'mm-popup';
  pp.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
    <b style="font-size:14px;">${title}</b>
    <span onclick="this.closest('.mm-popup').remove();document.querySelector('.mm-popup-overlay')?.remove()" style="cursor:pointer;font-size:20px;color:var(--text2);">×</span>
  </div><div style="font-size:12px;line-height:1.7;color:var(--text2);">${html}</div>`;
  ov.onclick = () => { ov.remove(); pp.remove(); };
  document.body.append(ov, pp);
}

function renderMindmap() {
  const c = document.getElementById('mindmapContainer');
  if (!c || !currentProfileId) return;
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) return;
  _mmCurrentType === 'info' ? renderInfoMM(c, p) : renderCollectMM(c, p);
}

// ── PERSONAL INFO MINDMAP ──
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  const br = [];
  const add = (icon, lbl, val) => {
    if (!val || (Array.isArray(val) && !val.length)) return;
    const arr = Array.isArray(val) ? val.filter(Boolean) : [val];
    if (!arr.length) return;
    br.push({ label: icon + ' ' + lbl, items: arr });
  };

  // Group by category for cleaner mindmap
  add('👤', 'Nhân thân', [
    d.gioi_tinh || p.gender,
    d.nam_sinh || p.birth_year ? `Sinh ${d.nam_sinh || p.birth_year}` : null,
    d.nghe_nghiep ? `${d.nghe_nghiep}` : null
  ].filter(Boolean));
  add('🏠', 'Nơi sống', [d.dia_chi, d.que_quan].filter(Boolean));
  add('💍', 'Gia đình', [
    ...(Array.isArray(d.hon_nhan) ? d.hon_nhan : d.hon_nhan ? [d.hon_nhan] : []),
    d.nguoi_quan_trong ? `QT: ${d.nguoi_quan_trong}` : null
  ].filter(Boolean));
  add('🙏', 'Tôn giáo', Array.isArray(d.ton_giao) ? d.ton_giao : d.ton_giao ? [d.ton_giao] : []);
  add('🧩', 'Tính cách', d.tinh_cach ? [d.tinh_cach] : []);
  add('⭐', 'Sở thích', d.so_thich ? [d.so_thich] : []);
  add('🎯', 'Dự định', d.du_dinh ? [d.du_dinh] : []);
  add('🌟', 'Quan điểm', d.quan_diem ? [d.quan_diem] : []);
  add('📞', 'Liên hệ', [d.sdt || p.phone_number].filter(Boolean));

  if (!br.length) br.push({ label: '📋 Chưa có dữ liệu', items: ['Hãy điền Phiếu Thông tin'] });
  drawMM(container, name, br);
}

// ── COLLECTED INFO MINDMAP — Smart topic synthesis ──
async function renderCollectMM(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">⏳ Đang tổng hợp...</div>';
  try {
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();

    // ── Step 1: Extract all text fragments with source labels ──
    const fragments = [];
    tvs.forEach((r, i) => {
      const c = r.content || {};
      const entries = [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.cong_cu, c.nhan_xet].filter(Boolean);
      entries.forEach(t => fragments.push({ text: t, src: `TV lần ${c.lan_thu || (i + 1)}` }));
    });
    bbs.forEach((r, i) => {
      const c = r.content || {};
      const entries = [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.nhan_xet].filter(Boolean);
      entries.forEach(t => fragments.push({ text: t, src: `BB buổi ${c.buoi_thu || (i + 1)}` }));
    });
    nts.forEach(r => {
      const c = r.content || {};
      if (c.body) fragments.push({ text: c.body, src: c.title || 'Ghi chú' });
    });

    // ── Step 2: Classify fragments into TOPIC categories ──
    const topics = {
      'Tâm lý': { icon: '🧠', keywords: ['cảm xúc','lo lắng','sợ','buồn','vui','khó khăn','stress','áp lực','tự ti','cô đơn','mệt','chán','tức','giận','thất vọng','hy vọng','tin','lo','trầm','hạnh phúc','đau'], items: [] },
      'Gia đình': { icon: '👨‍👩‍👧', keywords: ['gia đình','ba','mẹ','anh','chị','em','con','vợ','chồng','bố','cha','bác','cô','chú','dì','ông','bà','người thân','ly hôn','kết hôn'], items: [] },
      'Công việc': { icon: '💼', keywords: ['công việc','làm việc','nghề','lương','sếp','đồng nghiệp','dự án','kinh doanh','thu nhập','tiền','tài chính','kinh tế'], items: [] },
      'Quan hệ XH': { icon: '🤝', keywords: ['bạn','người yêu','mối quan hệ','xã hội','giao tiếp','cộng đồng','nhóm','hội','kết nối','tình bạn','tình yêu'], items: [] },
      'Sức khỏe': { icon: '🏥', keywords: ['sức khỏe','bệnh','thuốc','bác sĩ','khám','đau','mất ngủ','ăn','tập','thể dục','nghiện'], items: [] },
      'Tâm linh': { icon: '🌟', keywords: ['kinh','thần','linh','cầu nguyện','nhà thờ','chùa','phật','chúa','tôn giáo','đức tin','thiền','tin lành'], items: [] },
      'Tiến trình': { icon: '📈', keywords: ['tiến bộ','thay đổi','mở lòng','chia sẻ','hợp tác','tích cực','cải thiện','phát triển','cam kết','quyết tâm'], items: [] },
      'Ghi nhận': { icon: '📝', keywords: [], items: [] } // catch-all
    };

    fragments.forEach(f => {
      const lower = f.text.toLowerCase();
      let matched = false;
      for (const [topic, data] of Object.entries(topics)) {
        if (topic === 'Ghi nhận') continue;
        if (data.keywords.some(kw => lower.includes(kw))) {
          const short = f.text.length > 50 ? f.text.substring(0, 50) + '…' : f.text;
          data.items.push({ short, full: f.text, src: f.src });
          matched = true;
          break; // each fragment goes to first matching topic
        }
      }
      if (!matched) {
        const short = f.text.length > 50 ? f.text.substring(0, 50) + '…' : f.text;
        topics['Ghi nhận'].items.push({ short, full: f.text, src: f.src });
      }
    });

    // ── Step 3: Build branches from non-empty topics ──
    const branches = [];
    for (const [topic, data] of Object.entries(topics)) {
      if (!data.items.length) continue;
      const items = data.items.map(it => it.short);
      const detailHtml = data.items.map(it =>
        `<div style="margin-bottom:8px;padding:6px 8px;background:var(--surface2);border-radius:6px;">
          <div style="font-size:12px;">${it.full}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px;">📎 ${it.src}</div>
        </div>`
      ).join('');
      branches.push({
        label: `${data.icon} ${topic} (${data.items.length})`,
        items: items.slice(0, 4), // max 4 leaves visible
        detailHtml: detailHtml
      });
    }

    // Summary stats
    const statsHtml = `TV: ${tvs.length} | BB: ${bbs.length} | Ghi chú: ${nts.length} | Tổng đoạn: ${fragments.length}`;

    if (!branches.length) {
      branches.push({ label: '📋 Chưa có dữ liệu', items: ['Chưa có báo cáo hoặc ghi chú'], detailHtml: '' });
    }

    drawMM(container, p.full_name || 'Thu thập', branches, statsHtml);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
    console.error(e);
  }
}

// ── DRAW MINDMAP (Radial layout) ──
function drawMM(container, center, branches, subtitle) {
  const W = container.clientWidth || 340;
  const totalLeaves = branches.reduce((s, b) => s + b.items.length, 0);
  const H = Math.max(380, branches.length * 75 + totalLeaves * 18 + 80);

  const cx = W / 2, cy = H / 2;
  const R1 = Math.min(W * 0.28, 110); // branch radius
  const R2 = Math.min(W * 0.46, 175); // leaf radius

  let svg = '', html = '';

  // Center node
  const esc = s => (s || '').replace(/'/g, "\\'");
  html += `<div class="mm-node mm-center" style="left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${esc(center)}','${esc(subtitle || center)}')">${center}</div>`;

  const n = branches.length;
  branches.forEach((br, i) => {
    const a = (2 * Math.PI * i / n) - Math.PI / 2;
    const bx = cx + R1 * Math.cos(a);
    const by = cy + R1 * Math.sin(a);

    svg += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="var(--accent)" stroke-width="2" opacity="0.3"/>`;

    const popDetail = br.detailHtml || br.items.map(it => `<div style="padding:4px 0;border-bottom:1px dotted var(--border);">${it}</div>`).join('');
    html += `<div class="mm-node mm-branch" style="left:${bx}px;top:${by}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${esc(br.label)}','${esc(popDetail)}')">${br.label}</div>`;

    // Leaves
    const lc = br.items.length;
    const spread = lc > 3 ? 0.22 : 0.32;
    br.items.forEach((leaf, j) => {
      const la = a + (j - (lc - 1) / 2) * spread;
      const lx = cx + R2 * Math.cos(la);
      const ly = cy + R2 * Math.sin(la);
      svg += `<line x1="${bx}" y1="${by}" x2="${lx}" y2="${ly}" stroke="var(--border)" stroke-width="1" opacity="0.4"/>`;
      const txt = typeof leaf === 'string' ? (leaf.length > 16 ? leaf.substring(0, 16) + '…' : leaf) : leaf;
      html += `<div class="mm-node mm-leaf" style="left:${lx}px;top:${ly}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${esc(br.label)}','${esc(popDetail)}')" title="${esc(leaf)}">${txt}</div>`;
    });
  });

  container.style.height = H + 'px';
  container.innerHTML = `
    <div id="mmInner" style="position:relative;width:100%;height:${H}px;transform-origin:center center;transition:transform 0.15s;transform:scale(${_mmZoom});">
      <svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${svg}</svg>
      ${html}
    </div>
    <div class="mm-zoom-bar">
      <button onclick="mmZoomIn()">+</button>
      <span class="mm-zoom-level" id="mmZoomLvl">${Math.round(_mmZoom * 100)}%</span>
      <button onclick="mmZoomOut()">−</button>
    </div>`;
}
