// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v4 — Markmap (interactive, zoomable, collapsible like NotebookLM)
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

// ── Render markdown into markmap ──
function renderMarkmap(container, md) {
  // Clear previous SVG
  container.innerHTML = '<script type="text/template">' + md + '<\/script>';
  // Use markmap autoloader to render
  if (window.markmap && window.markmap.autoLoader) {
    window.markmap.autoLoader.renderAll();
  }
}

// ═══════════════════════════════════════════════════
// PERSONAL INFO MINDMAP
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  let md = `# ${name}\n`;

  // Nhân thân
  const nhanThan = [];
  if (d.gioi_tinh || p.gender) nhanThan.push(d.gioi_tinh || p.gender);
  if (d.nam_sinh || p.birth_year) nhanThan.push('Sinh ' + (d.nam_sinh || p.birth_year));
  if (d.nghe_nghiep) nhanThan.push(d.nghe_nghiep);
  if (nhanThan.length) {
    md += `## 👤 Nhân thân\n`;
    nhanThan.forEach(v => { md += `- ${v}\n`; });
  }

  // Nơi sống
  const noiSong = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noiSong.length) {
    md += `## 📍 Nơi sống\n`;
    noiSong.forEach(v => { md += `- ${v}\n`; });
  }

  // Gia đình
  const gd = [];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan) ? d.hon_nhan.join(', ') : d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('Người QT: ' + d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(d.nguoi_than);
  if (gd.length) {
    md += `## 👨‍👩‍👧 Gia đình\n`;
    gd.forEach(v => { md += `- ${v}\n`; });
  }

  // Tôn giáo
  if (d.ton_giao) {
    const tg = Array.isArray(d.ton_giao) ? d.ton_giao.join(', ') : d.ton_giao;
    md += `## 🙏 Tôn giáo\n- ${tg}\n`;
  }

  // Tính cách
  if (d.tinh_cach) md += `## 🧩 Tính cách\n- ${d.tinh_cach}\n`;

  // Sở thích
  if (d.so_thich) md += `## ⭐ Sở thích\n- ${d.so_thich}\n`;

  // Dự định
  if (d.du_dinh) md += `## 🎯 Dự định\n- ${d.du_dinh}\n`;

  // Quan điểm
  if (d.quan_diem) md += `## 🌟 Quan điểm TL\n- ${d.quan_diem}\n`;

  // Liên hệ
  if (d.sdt || p.phone_number) md += `## 📞 Liên hệ\n- ${d.sdt || p.phone_number}\n`;

  // Câu chuyện
  if (d.chuyen_cu) md += `## 📖 Câu chuyện\n- ${d.chuyen_cu}\n`;

  // Lưu ý
  if (d.luu_y) md += `## ⚠️ Lưu ý\n- ${d.luu_y}\n`;

  if (md.trim() === `# ${name}`) {
    md += `## 📋 Chưa có dữ liệu\n- Hãy điền Phiếu Thông tin\n`;
  }

  renderMarkmap(container, md);
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

    // Collect fragments with source labels
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
      if (c.body) frags.push({ text: String(c.body), src: '📌 ' + (c.title || 'Ghi chú') });
    });

    // Classify by topic
    const topicDefs = [
      { key: 'Tâm lý', icon: '🧠', kw: ['cảm xúc','lo lắng','sợ','buồn','vui','khó khăn','stress','áp lực','tự ti','cô đơn','mệt','chán','tức','giận','thất vọng','hy vọng','trầm','đau khổ'] },
      { key: 'Gia đình', icon: '👨‍👩‍👧', kw: ['gia đình','ba ','mẹ ','anh ','chị ','em ','con ','vợ','chồng','bố','cha ','người thân','ly hôn','kết hôn','kinh tế gia'] },
      { key: 'Công việc', icon: '💼', kw: ['công việc','làm việc','nghề','lương','sếp','đồng nghiệp','kinh doanh','thu nhập','tiền','tài chính'] },
      { key: 'Quan hệ', icon: '🤝', kw: ['bạn trai','bạn gái','người yêu','mối quan hệ','giao tiếp','nhóm','tình bạn','tình yêu','hẹn hò','bạn bè'] },
      { key: 'Sức khỏe', icon: '🏥', kw: ['sức khỏe','bệnh','thuốc','bác sĩ','đau','mất ngủ','nghiện','rượu'] },
      { key: 'Tâm linh', icon: '✝️', kw: ['kinh thánh','cầu nguyện','nhà thờ','chùa','phật','chúa','đức tin','thiền','tôn giáo'] },
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

    // Build Markdown
    let md = `# ${p.full_name || 'Thu thập'}\n`;

    for (const [key, data] of Object.entries(topicMap)) {
      if (!data.items.length) continue;
      md += `## ${data.icon} ${key} (${data.items.length})\n`;
      data.items.forEach(f => {
        // Truncate long text for readability
        const txt = f.text.length > 80 ? f.text.substring(0, 80) + '…' : f.text;
        md += `- ${txt}\n`;
        md += `  - 📎 *${f.src}*\n`;
      });
    }

    if (frags.length === 0) {
      md += `## 📋 Chưa có dữ liệu\n- Chưa có báo cáo hoặc ghi chú\n`;
    }

    renderMarkmap(container, md);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
    console.error(e);
  }
}
