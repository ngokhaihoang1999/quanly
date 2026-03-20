// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP — Interactive SVG with Zoom & Popup Detail
// ══════════════════════════════════════════════════════════════════════════════

let _mmCurrentType = 'info';
let _mmZoom = 1;
let _mmBranches = [];

function switchMindmap(type, btn) {
  _mmCurrentType = type;
  document.querySelectorAll('#mindmapTab .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  _mmZoom = 1;
  renderMindmap();
}

function mmZoomIn() { _mmZoom = Math.min(_mmZoom + 0.15, 2.5); applyMmZoom(); }
function mmZoomOut() { _mmZoom = Math.max(_mmZoom - 0.15, 0.4); applyMmZoom(); }
function applyMmZoom() {
  const inner = document.getElementById('mmInner');
  const lvl = document.getElementById('mmZoomLvl');
  if (inner) inner.style.transform = `scale(${_mmZoom})`;
  if (lvl) lvl.textContent = Math.round(_mmZoom * 100) + '%';
}

function showMmPopup(title, details) {
  // Remove existing
  document.querySelectorAll('.mm-popup,.mm-popup-overlay').forEach(e => e.remove());
  const overlay = document.createElement('div');
  overlay.className = 'mm-popup-overlay';
  overlay.onclick = () => { overlay.remove(); popup.remove(); };
  const popup = document.createElement('div');
  popup.className = 'mm-popup';
  popup.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-weight:700;font-size:15px;">${title}</div>
      <button onclick="this.closest('.mm-popup').remove();document.querySelector('.mm-popup-overlay')?.remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text2);">×</button>
    </div>
    <div style="font-size:13px;color:var(--text2);line-height:1.6;">${details}</div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function renderMindmap() {
  const container = document.getElementById('mindmapContainer');
  if (!container || !currentProfileId) return;
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">Không tìm thấy hồ sơ</div>'; return; }
  if (_mmCurrentType === 'info') renderInfoMindmap(container, p);
  else renderCollectMindmap(container, p);
}

// ── Personal Info Mindmap ──
function renderInfoMindmap(container, p) {
  const d = window._currentInfoSheet || {};
  const centerLabel = p.full_name || 'Trái quả';
  const branches = [];
  
  const add = (icon, label, val) => {
    if (!val || (Array.isArray(val) && val.length === 0)) return;
    const children = Array.isArray(val) ? val : [val];
    branches.push({ label: icon + ' ' + label, children, fullData: children.join(', ') });
  };
  
  add('👤', 'Giới tính', d.gioi_tinh || p.gender);
  add('📅', 'Năm sinh', d.nam_sinh || p.birth_year);
  add('💼', 'Nghề nghiệp', d.nghe_nghiep);
  add('🙏', 'Tôn giáo', d.ton_giao);
  add('💍', 'Hôn nhân', d.hon_nhan);
  add('📍', 'Nơi ở', d.dia_chi);
  add('🏠', 'Quê quán', d.que_quan);
  add('🧩', 'Tính cách', d.tinh_cach);
  add('⭐', 'Sở thích', d.so_thich);
  add('🎯', 'Dự định', d.du_dinh);
  add('❤️', 'Người QT', d.nguoi_quan_trong);
  add('🌟', 'Quan điểm TL', d.quan_diem);
  add('📞', 'SĐT', d.sdt || p.phone_number);
  
  if (branches.length === 0) {
    branches.push({ label: '📋 Chưa có', children: ['Hãy điền Phiếu Thông tin'], fullData: 'Chưa có dữ liệu' });
  }
  _mmBranches = branches;
  drawRadialMindmap(container, centerLabel, branches);
}

// ── Collected Info Mindmap ──
async function renderCollectMindmap(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px;">⏳ Đang phân tích...</div>';
  try {
    const [tvRes, bbRes, noteRes] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content&order=created_at.asc`)
    ]);
    const tvRecs = await tvRes.json(), bbRecs = await bbRes.json(), notes = await noteRes.json();
    const centerLabel = p.full_name || 'Thu thập';
    const branches = [];

    if (tvRecs.length > 0) {
      const details = tvRecs.map((r, i) => {
        const c = r.content || {};
        return `<b>Lần ${c.lan_thu || (i+1)}</b>: ${c.noi_dung || c.tom_tat || '—'}`;
      }).join('<br>');
      branches.push({
        label: '💬 Tư vấn (' + tvRecs.length + ')',
        children: tvRecs.map((r, i) => 'Lần ' + (r.content?.lan_thu || (i+1))),
        fullData: details
      });
    }

    if (bbRecs.length > 0) {
      const details = bbRecs.map((r, i) => {
        const c = r.content || {};
        return `<b>Buổi ${c.buoi_thu || (i+1)}</b>: ${c.noi_dung || c.tom_tat || '—'}`;
      }).join('<br>');
      branches.push({
        label: '📝 Biên bản (' + bbRecs.length + ')',
        children: bbRecs.map((r, i) => 'Buổi ' + (r.content?.buoi_thu || (i+1))),
        fullData: details
      });
    }

    if (notes.length > 0) {
      const details = notes.map(n => {
        const c = n.content || {};
        return `<b>${c.title || 'Ghi chú'}</b>: ${c.body || '—'}`;
      }).join('<br>');
      branches.push({
        label: '📌 Ghi chú (' + notes.length + ')',
        children: notes.map(n => n.content?.title || 'Ghi chú'),
        fullData: details
      });
    }

    // Key themes
    const allText = [...tvRecs, ...bbRecs, ...notes].map(r => {
      const c = r.content || {};
      return [c.noi_dung, c.tom_tat, c.title, c.body, c.cam_xuc, c.phan_hoi].filter(Boolean).join(' ');
    }).join(' ');
    if (allText.length > 20) {
      const keywords = extractKeyThemes(allText);
      if (keywords.length > 0) {
        branches.push({ label: '🔑 Chủ đề', children: keywords.slice(0, 5), fullData: keywords.join(', ') });
      }
    }

    if (branches.length === 0) {
      branches.push({ label: '📋 Chưa có', children: ['N/A'], fullData: 'Chưa có báo cáo' });
    }
    _mmBranches = branches;
    drawRadialMindmap(container, centerLabel, branches);
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
  }
}

function extractKeyThemes(text) {
  const stopWords = new Set(['và','là','của','các','cho','hay','thì','mà','với','trong','này','đó','được','không','có','một','những','đã','sẽ','để','từ','khi','rất','cũng','nhưng','về','theo','lại','ra','vào','lên','xuống','qua','tại','ở']);
  const words = text.toLowerCase().replace(/[^\p{L}\s]/gu, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 8).map(([w, c]) => `${w} (${c})`);
}

// ── Radial Mindmap Renderer with Zoom + Popup ──
function drawRadialMindmap(container, centerLabel, branches) {
  const W = container.clientWidth || 360;
  const baseH = Math.max(360, branches.length * 65 + 100);
  
  const cx = W / 2, cy = baseH / 2;
  const branchR = Math.min(W * 0.3, 120);
  const leafR = Math.min(W * 0.48, 185);
  
  let svgLines = '';
  let nodesHtml = '';
  
  // Center
  nodesHtml += `<div class="mm-node mm-center" style="left:${cx}px;top:${cy}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${centerLabel.replace(/'/g,"\\'")}','Tổng quan hồ sơ: ${branches.length} nhóm thông tin')">${centerLabel}</div>`;
  
  const n = branches.length;
  branches.forEach((br, i) => {
    const angle = (2 * Math.PI * i / n) - Math.PI / 2;
    const bx = cx + branchR * Math.cos(angle);
    const by = cy + branchR * Math.sin(angle);
    
    svgLines += `<line x1="${cx}" y1="${cy}" x2="${bx}" y2="${by}" stroke="var(--accent)" stroke-width="2" stroke-opacity="0.25"/>`;
    
    // Escape for onclick
    const popupTitle = br.label.replace(/'/g, "\\'");
    const popupDetail = (br.fullData || br.children.join(', ')).replace(/'/g, "\\'").replace(/\n/g, '<br>');
    
    nodesHtml += `<div class="mm-node mm-branch" style="left:${bx}px;top:${by}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${popupTitle}','${popupDetail}')">${br.label}</div>`;
    
    // Leaves — only show short label, detail in popup
    const lc = br.children.length;
    br.children.forEach((leaf, j) => {
      const la = angle + (j - (lc - 1) / 2) * (lc > 3 ? 0.25 : 0.35);
      const lx = cx + leafR * Math.cos(la);
      const ly = cy + leafR * Math.sin(la);
      
      svgLines += `<line x1="${bx}" y1="${by}" x2="${lx}" y2="${ly}" stroke="var(--border)" stroke-width="1" stroke-opacity="0.4"/>`;
      
      const leafText = typeof leaf === 'string' ? (leaf.length > 18 ? leaf.substring(0, 18) + '…' : leaf) : leaf;
      const leafFull = (typeof leaf === 'string' ? leaf : '').replace(/'/g, "\\'");
      nodesHtml += `<div class="mm-node mm-leaf" style="left:${lx}px;top:${ly}px;transform:translate(-50%,-50%);" onclick="showMmPopup('${popupTitle}','${leafFull}')">${leafText}</div>`;
    });
  });
  
  container.innerHTML = `
    <div id="mmInner" style="position:relative;width:100%;height:${baseH}px;transform-origin:center center;transition:transform 0.2s;transform:scale(${_mmZoom});">
      <svg style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;">${svgLines}</svg>
      ${nodesHtml}
    </div>
    <div class="mm-zoom-bar">
      <button onclick="mmZoomIn()">+</button>
      <span class="mm-zoom-level" id="mmZoomLvl">${Math.round(_mmZoom * 100)}%</span>
      <button onclick="mmZoomOut()">−</button>
    </div>
  `;
  container.style.height = baseH + 'px';
}
