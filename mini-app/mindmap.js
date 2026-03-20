// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v3 — CSS Tree layout (no SVG, no positioning bugs)
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

// ── Show popup for detail ──
function showMmDetail(title, items) {
  document.querySelectorAll('.mm-popup,.mm-popup-overlay').forEach(e => e.remove());
  const ov = document.createElement('div');
  ov.className = 'mm-popup-overlay';
  const pp = document.createElement('div');
  pp.className = 'mm-popup';

  let body = '';
  if (Array.isArray(items)) {
    body = items.map(it => {
      if (typeof it === 'object' && it.text) {
        return `<div style="margin-bottom:6px;padding:6px 8px;background:var(--surface2);border-radius:6px;">
          <div style="font-size:12px;">${escHtml(it.text)}</div>
          ${it.src ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;">📎 ${escHtml(it.src)}</div>` : ''}
        </div>`;
      }
      return `<div style="padding:4px 0;font-size:12px;">${escHtml(String(it))}</div>`;
    }).join('');
  } else {
    body = `<div style="font-size:12px;">${escHtml(String(items))}</div>`;
  }

  pp.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <b style="font-size:14px;">${escHtml(title)}</b>
      <span onclick="document.querySelectorAll('.mm-popup,.mm-popup-overlay').forEach(e=>e.remove())" style="cursor:pointer;font-size:20px;color:var(--text2);padding:0 4px;">×</span>
    </div>
    <div>${body}</div>`;
  ov.onclick = () => { ov.remove(); pp.remove(); };
  document.body.append(ov, pp);
}

function escHtml(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════
// PERSONAL INFO MINDMAP
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  const branches = [];

  const add = (icon, label, values) => {
    const arr = (Array.isArray(values) ? values : [values]).filter(v => v && String(v).trim());
    if (arr.length) branches.push({ icon, label, items: arr.map(String) });
  };

  // Group meaningfully
  if (d.gioi_tinh || p.gender || d.nam_sinh || p.birth_year || d.nghe_nghiep) {
    const items = [];
    if (d.gioi_tinh || p.gender) items.push(d.gioi_tinh || p.gender);
    if (d.nam_sinh || p.birth_year) items.push('Sinh ' + (d.nam_sinh || p.birth_year));
    if (d.nghe_nghiep) items.push(d.nghe_nghiep);
    if (items.length) branches.push({ icon: '👤', label: 'Nhân thân', items });
  }

  add('📍', 'Nơi sống', [d.dia_chi, d.que_quan].filter(Boolean));
  
  const famItems = [];
  if (d.hon_nhan) {
    const hn = Array.isArray(d.hon_nhan) ? d.hon_nhan.join(', ') : d.hon_nhan;
    famItems.push(hn);
  }
  if (d.nguoi_quan_trong) famItems.push('Người QT: ' + d.nguoi_quan_trong);
  if (famItems.length) branches.push({ icon: '👨‍👩‍👧', label: 'Gia đình', items: famItems });

  if (d.ton_giao) {
    const tg = Array.isArray(d.ton_giao) ? d.ton_giao.join(', ') : d.ton_giao;
    branches.push({ icon: '🙏', label: 'Tôn giáo', items: [tg] });
  }
  add('🧩', 'Tính cách', d.tinh_cach);
  add('⭐', 'Sở thích', d.so_thich);
  add('🎯', 'Dự định', d.du_dinh);
  add('🌟', 'Quan điểm TL', d.quan_diem);
  if (d.sdt || p.phone_number) {
    branches.push({ icon: '📞', label: 'Liên hệ', items: [d.sdt || p.phone_number] });
  }

  if (!branches.length) {
    branches.push({ icon: '📋', label: 'Chưa có dữ liệu', items: ['Hãy điền Phiếu Thông tin'] });
  }

  renderTree(container, name, branches);
}

// ═══════════════════════════════════════════════════
// COLLECTED INFO MINDMAP — Topic-based synthesis
// ═══════════════════════════════════════════════════
async function renderCollectMM(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">⏳ Đang tổng hợp...</div>';
  try {
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();

    // Step 1: Collect all text fragments
    const frags = [];
    tvs.forEach((r, i) => {
      const c = r.content || {};
      [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.nhan_xet].filter(Boolean).forEach(t =>
        frags.push({ text: String(t), src: 'TV lần ' + (c.lan_thu || (i + 1)) })
      );
    });
    bbs.forEach((r, i) => {
      const c = r.content || {};
      [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.nhan_xet].filter(Boolean).forEach(t =>
        frags.push({ text: String(t), src: 'BB buổi ' + (c.buoi_thu || (i + 1)) })
      );
    });
    nts.forEach(r => {
      const c = r.content || {};
      if (c.body) frags.push({ text: String(c.body), src: c.title || 'Ghi chú' });
    });

    // Step 2: Classify by topic keywords
    const topicDefs = [
      { key: 'Tâm lý', icon: '🧠', kw: ['cảm xúc','lo lắng','sợ','buồn','vui','khó khăn','stress','áp lực','tự ti','cô đơn','mệt','chán','tức','giận','thất vọng','hy vọng','trầm','đau khổ'] },
      { key: 'Gia đình', icon: '👨‍👩‍👧', kw: ['gia đình','ba ','mẹ ','anh ','chị ','em ','con ','vợ','chồng','bố','cha ','người thân','ly hôn','kết hôn','kinh tế gia đình'] },
      { key: 'Công việc', icon: '💼', kw: ['công việc','làm việc','nghề','lương','sếp','đồng nghiệp','kinh doanh','thu nhập','tiền','tài chính'] },
      { key: 'Quan hệ', icon: '🤝', kw: ['bạn','người yêu','mối quan hệ','giao tiếp','nhóm','tình bạn','tình yêu','hẹn hò'] },
      { key: 'Sức khỏe', icon: '🏥', kw: ['sức khỏe','bệnh','thuốc','bác sĩ','đau','mất ngủ','nghiện','rượu'] },
      { key: 'Tâm linh', icon: '✝️', kw: ['kinh thánh','cầu nguyện','nhà thờ','chùa','phật','chúa','đức tin','thiền'] },
      { key: 'Tiến trình', icon: '📈', kw: ['tiến bộ','thay đổi','mở lòng','chia sẻ','tích cực','cải thiện','phát triển','cam kết','hợp tác'] },
    ];

    const topicMap = {};
    topicDefs.forEach(td => { topicMap[td.key] = { icon: td.icon, items: [] }; });
    topicMap['Khác'] = { icon: '📝', items: [] };

    frags.forEach(f => {
      const lower = f.text.toLowerCase();
      let placed = false;
      for (const td of topicDefs) {
        if (td.kw.some(kw => lower.includes(kw))) {
          topicMap[td.key].items.push(f);
          placed = true;
          break;
        }
      }
      if (!placed) topicMap['Khác'].items.push(f);
    });

    // Step 3: Build branches (only non-empty topics)
    const branches = [];
    for (const [key, data] of Object.entries(topicMap)) {
      if (!data.items.length) continue;
      branches.push({
        icon: data.icon,
        label: key + ' (' + data.items.length + ')',
        items: data.items.map(f => f.text.length > 40 ? f.text.substring(0, 40) + '…' : f.text),
        detailItems: data.items // for popup
      });
    }

    if (!branches.length) {
      branches.push({ icon: '📋', label: 'Chưa có dữ liệu', items: ['Chưa có báo cáo hoặc ghi chú'] });
    }

    const subtitle = `Nguồn: ${tvs.length} TV, ${bbs.length} BB, ${nts.length} ghi chú`;
    renderTree(container, p.full_name || 'Thu thập', branches, subtitle);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
    console.error(e);
  }
}

// ═══════════════════════════════════════════════════
// TREE RENDERER — Pure CSS, no SVG, no positioning
// ═══════════════════════════════════════════════════
function renderTree(container, centerName, branches, subtitle) {
  let html = `<div class="mm-tree">`;

  // Center / Root
  html += `<div class="mm-root">${escHtml(centerName)}</div>`;
  if (subtitle) html += `<div class="mm-subtitle">${escHtml(subtitle)}</div>`;

  // Branches
  html += `<div class="mm-branches">`;
  branches.forEach((br, bi) => {
    const brId = 'mmBr_' + bi;
    html += `<div class="mm-branch-wrap">
      <div class="mm-branch-head" onclick="document.getElementById('${brId}').classList.toggle('mm-open')">
        <span class="mm-branch-icon">${br.icon}</span>
        <span class="mm-branch-label">${escHtml(br.label)}</span>
        <span class="mm-branch-count">${br.items.length}</span>
        <span class="mm-branch-arrow">›</span>
      </div>
      <div class="mm-branch-items" id="${brId}">`;

    br.items.forEach((item, ii) => {
      const clickAction = br.detailItems
        ? `mmShowTopicDetail(${bi})`
        : '';
      html += `<div class="mm-leaf-item" ${clickAction ? `onclick="${clickAction}"` : ''}>${escHtml(String(item))}</div>`;
    });

    html += `</div></div>`;
  });
  html += `</div></div>`;

  container.innerHTML = html;
  container.style.height = 'auto';

  // Store for popup access
  window._mmBranchData = branches;
}

function mmShowTopicDetail(branchIdx) {
  const br = window._mmBranchData?.[branchIdx];
  if (!br || !br.detailItems) return;
  showMmDetail(br.icon + ' ' + br.label, br.detailItems);
}
