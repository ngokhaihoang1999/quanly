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
// COLLECTED INFO MINDMAP — Smart: notes-title-first
// User's note titles ARE the classification!
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

    let md = `# ${p.full_name || 'Thu thập'}\n`;

    // ── 1. GHI CHÚ: Tiêu đề = nhánh chính, body = nội dung ──
    // User's note titles are THEIR classification — respect it!
    if (nts.length > 0) {
      md += `## 📌 Ghi chú\n`;
      nts.forEach(r => {
        const c = r.content || {};
        const title = c.title || 'Ghi chú';
        const body = c.body || '';
        md += `### ${title}\n`;
        // Split body by lines for sub-items
        const lines = body.split(/\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) {
          lines.forEach(line => {
            md += `- ${line}\n`;
          });
        } else {
          md += `- *(trống)*\n`;
        }
      });
    }

    // ── 2. TƯ VẤN: Mỗi lần TV = 1 nhánh con ──
    if (tvs.length > 0) {
      md += `## 💬 Tư vấn (${tvs.length} lần)\n`;
      tvs.forEach((r, i) => {
        const c = r.content || {};
        const lanThu = c.lan_thu || (i + 1);
        md += `### Lần ${lanThu}\n`;
        const fields = [
          { key: 'noi_dung', label: 'Nội dung' },
          { key: 'tom_tat', label: 'Tóm tắt' },
          { key: 'cam_xuc', label: 'Cảm xúc' },
          { key: 'phan_hoi', label: 'Phản hồi' },
          { key: 'ghi_chu', label: 'Ghi chú' },
          { key: 'nhan_xet', label: 'Nhận xét' },
          { key: 'cong_cu', label: 'Công cụ' },
        ];
        let hasContent = false;
        fields.forEach(f => {
          if (c[f.key]) {
            const txt = String(c[f.key]);
            const short = txt.length > 80 ? txt.substring(0, 80) + '…' : txt;
            md += `- **${f.label}**: ${short}\n`;
            hasContent = true;
          }
        });
        if (!hasContent) md += `- *(chưa có nội dung)*\n`;
      });
    }

    // ── 3. BIÊN BẢN BB: Mỗi buổi = 1 nhánh con ──
    if (bbs.length > 0) {
      md += `## 📝 Biên bản BB (${bbs.length} buổi)\n`;
      bbs.forEach((r, i) => {
        const c = r.content || {};
        const buoi = c.buoi_thu || (i + 1);
        md += `### Buổi ${buoi}\n`;
        const fields = [
          { key: 'noi_dung', label: 'Nội dung' },
          { key: 'tom_tat', label: 'Tóm tắt' },
          { key: 'cam_xuc', label: 'Cảm xúc' },
          { key: 'phan_hoi', label: 'Phản hồi' },
          { key: 'ghi_chu', label: 'Ghi chú' },
          { key: 'nhan_xet', label: 'Nhận xét' },
        ];
        let hasContent = false;
        fields.forEach(f => {
          if (c[f.key]) {
            const txt = String(c[f.key]);
            const short = txt.length > 80 ? txt.substring(0, 80) + '…' : txt;
            md += `- **${f.label}**: ${short}\n`;
            hasContent = true;
          }
        });
        if (!hasContent) md += `- *(chưa có nội dung)*\n`;
      });
    }

    if (tvs.length === 0 && bbs.length === 0 && nts.length === 0) {
      md += `## 📋 Chưa có dữ liệu\n- Chưa có báo cáo hoặc ghi chú\n`;
    }

    renderMarkmap(container, md);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
    console.error(e);
  }
}
