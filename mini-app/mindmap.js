// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP — Pure SVG/CSS renderer (zero external libs, zero extra API calls)
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
  if (!p) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">Không tìm thấy hồ sơ</div>'; return; }

  if (_mmCurrentType === 'info') {
    renderInfoMindmap(container, p);
  } else {
    renderCollectMindmap(container, p);
  }
}

// ── Personal Info Mindmap ──
function renderInfoMindmap(container, p) {
  const infoData = window._currentInfoSheet || {};
  const centerLabel = p.full_name || 'Trái quả';
  
  const branches = [];
  if (infoData.gioi_tinh || p.gender) branches.push({ label: '👤 Giới tính', children: [infoData.gioi_tinh || p.gender || '—'] });
  if (infoData.nam_sinh || p.birth_year) branches.push({ label: '📅 Năm sinh', children: [infoData.nam_sinh || p.birth_year || '—'] });
  if (infoData.nghe_nghiep) branches.push({ label: '💼 Nghề nghiệp', children: [infoData.nghe_nghiep] });
  if (infoData.ton_giao) branches.push({ label: '🙏 Tôn giáo', children: Array.isArray(infoData.ton_giao) ? infoData.ton_giao : [infoData.ton_giao] });
  if (infoData.hon_nhan) branches.push({ label: '💍 Hôn nhân', children: Array.isArray(infoData.hon_nhan) ? infoData.hon_nhan : [infoData.hon_nhan] });
  if (infoData.dia_chi) branches.push({ label: '📍 Nơi ở', children: [infoData.dia_chi] });
  if (infoData.que_quan) branches.push({ label: '🏠 Quê quán', children: [infoData.que_quan] });
  if (infoData.tinh_cach) branches.push({ label: '🧩 Tính cách', children: [infoData.tinh_cach] });
  if (infoData.so_thich) branches.push({ label: '⭐ Sở thích', children: [infoData.so_thich] });
  if (infoData.du_dinh) branches.push({ label: '🎯 Dự định', children: [infoData.du_dinh] });
  if (infoData.nguoi_quan_trong) branches.push({ label: '❤️ Người QT', children: [infoData.nguoi_quan_trong] });
  if (infoData.quan_diem) branches.push({ label: '🌟 Quan điểm TL', children: [infoData.quan_diem] });
  if (infoData.sdt || p.phone_number) branches.push({ label: '📞 SĐT', children: [infoData.sdt || p.phone_number || '—'] });
  
  if (branches.length === 0) {
    branches.push({ label: '📋 Chưa có dữ liệu', children: ['Hãy điền Phiếu Thông tin'] });
  }

  drawRadialMindmap(container, centerLabel, branches);
}

// ── Collected Info Mindmap (from reports + notes) ──
async function renderCollectMindmap(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px;">⏳ Đang phân tích dữ liệu...</div>';
  
  try {
    // Fetch reports + notes (already in records table, minimal API call)
    const [tvRes, bbRes, noteRes] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content&order=created_at.asc`)
    ]);
    const tvRecs = await tvRes.json();
    const bbRecs = await bbRes.json();
    const notes = await noteRes.json();

    const centerLabel = p.full_name || 'Thu thập';
    const branches = [];

    // TV Reports summary
    if (tvRecs.length > 0) {
      const tvChildren = tvRecs.map((r, i) => {
        const c = r.content || {};
        let summary = `Lần ${c.lan_thu || (i+1)}`;
        if (c.noi_dung) summary += ': ' + c.noi_dung.substring(0, 40);
        else if (c.tom_tat) summary += ': ' + c.tom_tat.substring(0, 40);
        return summary;
      });
      branches.push({ label: '💬 Tư vấn (' + tvRecs.length + ')', children: tvChildren });
    }

    // BB Reports summary
    if (bbRecs.length > 0) {
      const bbChildren = bbRecs.map((r, i) => {
        const c = r.content || {};
        let summary = `Buổi ${c.buoi_thu || (i+1)}`;
        if (c.noi_dung) summary += ': ' + c.noi_dung.substring(0, 40);
        else if (c.tom_tat) summary += ': ' + c.tom_tat.substring(0, 40);
        return summary;
      });
      branches.push({ label: '📝 Biên bản (' + bbRecs.length + ')', children: bbChildren });
    }

    // Notes summary
    if (notes.length > 0) {
      const noteChildren = notes.map(n => {
        const c = n.content || {};
        return (c.title || 'Ghi chú') + (c.body ? ': ' + c.body.substring(0, 30) : '');
      });
      branches.push({ label: '📌 Ghi chú (' + notes.length + ')', children: noteChildren });
    }

    // Key themes extraction (simple keyword analysis)
    const allText = [...tvRecs, ...bbRecs, ...notes].map(r => {
      const c = r.content || {};
      return [c.noi_dung, c.tom_tat, c.title, c.body, c.cam_xuc, c.phan_hoi].filter(Boolean).join(' ');
    }).join(' ');
    
    if (allText.length > 20) {
      const keywords = extractKeyThemes(allText);
      if (keywords.length > 0) {
        branches.push({ label: '🔑 Chủ đề nổi bật', children: keywords.slice(0, 6) });
      }
    }

    if (branches.length === 0) {
      branches.push({ label: '📋 Chưa có dữ liệu', children: ['Chưa có báo cáo hoặc ghi chú'] });
    }

    drawRadialMindmap(container, centerLabel, branches);
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);font-size:13px;">❌ Lỗi tải dữ liệu</div>';
    console.error('renderCollectMindmap:', e);
  }
}

// ── Simple keyword extraction ──
function extractKeyThemes(text) {
  const stopWords = new Set(['và','là','của','các','cho','hay','thì','mà','với','trong','này','đó','được','không','có','một','những','đã','sẽ','để','từ','khi','rất','cũng','nhưng','về','theo','lại','ra','vào','lên','xuống','qua','tại','ở']);
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([w, c]) => `${w} (${c})`);
}

// ── Radial Mindmap Renderer (Pure HTML/CSS, no SVG needed) ──
function drawRadialMindmap(container, centerLabel, branches) {
  const W = container.clientWidth || 360;
  const H = Math.max(400, branches.length * 70 + 120);
  container.style.height = H + 'px';
  
  const cx = W / 2, cy = H / 2;
  const branchRadius = Math.min(W * 0.32, 130);
  const leafRadius = Math.min(W * 0.48, 190);
  
  let svgLines = '';
  let nodesHtml = '';
  
  // Center node
  nodesHtml += `<div class="mm-node mm-center" style="left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);">${centerLabel}</div>`;
  
  const n = branches.length;
  branches.forEach((br, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const bx = cx + branchRadius * Math.cos(angle);
    const by = cy + branchRadius * Math.sin(angle);
    
    // Line from center to branch  
    svgLines += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="var(--accent)" stroke-width="2" stroke-opacity="0.3"/>`;
    
    // Branch node
    nodesHtml += `<div class="mm-node mm-branch" style="left:${bx}px;top:${by}px;transform:translate(-50%,-50%);">${br.label}</div>`;
    
    // Leaf nodes
    const leafCount = br.children.length;
    br.children.forEach((leaf, j) => {
      const leafAngle = angle + (j - (leafCount - 1) / 2) * 0.35;
      const lx = cx + leafRadius * Math.cos(leafAngle);
      const ly = cy + leafRadius * Math.sin(leafAngle);
      
      svgLines += `<line x1="${bx}" y1="${by}" x2="${lx}" y2="${ly}" stroke="var(--border)" stroke-width="1" stroke-opacity="0.5"/>`;
      
      const leafText = typeof leaf === 'string' ? (leaf.length > 25 ? leaf.substring(0, 25) + '…' : leaf) : leaf;
      nodesHtml += `<div class="mm-node mm-leaf" style="left:${lx}px;top:${ly}px;transform:translate(-50%,-50%);" title="${typeof leaf === 'string' ? leaf.replace(/"/g, '&quot;') : ''}">${leafText}</div>`;
    });
  });
  
  container.innerHTML = `
    <svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">
      ${svgLines}
    </svg>
    ${nodesHtml}
  `;
}
