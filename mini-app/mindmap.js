// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v5 — Insight-driven: synthesize story & patterns, not just data
// Uses Markmap for rendering, heuristic analysis for content
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

function renderMarkmap(container, md) {
  container.innerHTML = '<script type="text/template">' + md + '<\/script>';
  if (window.markmap && window.markmap.autoLoader) {
    window.markmap.autoLoader.renderAll();
  }
}

// ═══════════════════════════════════════════════════
// PERSONAL INFO → Structured profile
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  let md = `# ${name}\n`;

  const nhanThan = [];
  if (d.gioi_tinh || p.gender) nhanThan.push(d.gioi_tinh || p.gender);
  if (d.nam_sinh || p.birth_year) nhanThan.push('Sinh ' + (d.nam_sinh || p.birth_year));
  if (d.nghe_nghiep) nhanThan.push(d.nghe_nghiep);
  if (nhanThan.length) { md += `## 👤 Nhân thân\n`; nhanThan.forEach(v => md += `- ${v}\n`); }

  const noiSong = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noiSong.length) { md += `## 📍 Nơi sống\n`; noiSong.forEach(v => md += `- ${v}\n`); }

  const gd = [];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan) ? d.hon_nhan.join(', ') : d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('Người QT: ' + d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(d.nguoi_than);
  if (gd.length) { md += `## 👨‍👩‍👧 Gia đình\n`; gd.forEach(v => md += `- ${v}\n`); }

  if (d.ton_giao) { const tg = Array.isArray(d.ton_giao) ? d.ton_giao.join(', ') : d.ton_giao; md += `## 🙏 Tôn giáo\n- ${tg}\n`; }
  if (d.tinh_cach) md += `## 🧩 Tính cách\n- ${d.tinh_cach}\n`;
  if (d.so_thich) md += `## ⭐ Sở thích\n- ${d.so_thich}\n`;
  if (d.du_dinh) md += `## 🎯 Dự định\n- ${d.du_dinh}\n`;
  if (d.quan_diem) md += `## 🌟 Quan điểm TL\n- ${d.quan_diem}\n`;
  if (d.sdt || p.phone_number) md += `## 📞 Liên hệ\n- ${d.sdt || p.phone_number}\n`;
  if (d.chuyen_cu) md += `## 📖 Câu chuyện\n- ${d.chuyen_cu}\n`;
  if (d.luu_y) md += `## ⚠️ Lưu ý\n- ${d.luu_y}\n`;

  if (md.trim() === `# ${name}`) md += `## 📋 Chưa có dữ liệu\n- Hãy điền Phiếu Thông tin\n`;
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// COLLECTED INFO → Insight-driven synthesis
// ═══════════════════════════════════════════════════

// Aspect keyword maps for cross-source grouping
const ASPECTS = [
  { key: 'family', label: '👨‍👩‍👧 Gia đình & Hoàn cảnh', kw: ['gia đình','ba','mẹ','anh','chị','em','con','vợ','chồng','bố','cha','người thân','ly hôn','kết hôn','kinh tế','tài chính','tiền','khó khăn','giàu','nghèo','nhà','ông','bà','dì','cô','chú','bác'] },
  { key: 'love', label: '💕 Tình cảm & Quan hệ', kw: ['bạn trai','bạn gái','người yêu','yêu','tình cảm','tình yêu','hẹn hò','chia tay','kết hôn','cưới','quan hệ','bạn bè','cô đơn','giao tiếp'] },
  { key: 'work', label: '💼 Công việc & Học tập', kw: ['công việc','làm việc','nghề','lương','sếp','đồng nghiệp','kinh doanh','thu nhập','học','thi','trường','ôn tập','giáo viên','sinh viên'] },
  { key: 'mental', label: '🧠 Tâm lý & Cảm xúc', kw: ['cảm xúc','lo lắng','sợ','buồn','vui','stress','áp lực','tự ti','mệt','chán','giận','thất vọng','hy vọng','trầm','hạnh phúc','khóc','cười','lo','tức'] },
  { key: 'health', label: '🏥 Sức khỏe', kw: ['sức khỏe','bệnh','thuốc','bác sĩ','đau','mất ngủ','nghiện','rượu','bia','hút','thể dục','tập'] },
  { key: 'spiritual', label: '✝️ Tâm linh & Đức tin', kw: ['kinh thánh','cầu nguyện','nhà thờ','chùa','phật','chúa','đức tin','thiền','tôn giáo','tin lành','công giáo'] },
  { key: 'progress', label: '📈 Tiến trình & Thay đổi', kw: ['tiến bộ','thay đổi','mở lòng','chia sẻ','tích cực','cải thiện','phát triển','cam kết','hợp tác','đồng ý','sẵn sàng','chấp nhận'] },
];

async function renderCollectMM(container, p) {
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">⏳ Đang phân tích insight...</div>';
  try {
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();
    const d = window._currentInfoSheet || {};

    // ══ STEP 1: EXTRACT ALL KNOWLEDGE FRAGMENTS ══
    const allFrags = []; // {text, src, srcType, date}

    tvs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'TV lần ' + (c.lan_thu || (i + 1));
      const fields = [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.nhan_xet, c.cong_cu];
      fields.filter(Boolean).forEach(t => allFrags.push({ text: String(t), src, srcType: 'tv', date: r.created_at }));
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'BB buổi ' + (c.buoi_thu || (i + 1));
      const fields = [c.noi_dung, c.tom_tat, c.cam_xuc, c.phan_hoi, c.ghi_chu, c.nhan_xet];
      fields.filter(Boolean).forEach(t => allFrags.push({ text: String(t), src, srcType: 'bb', date: r.created_at }));
    });

    nts.forEach(r => {
      const c = r.content || {};
      if (c.title || c.body) {
        const text = [c.title, c.body].filter(Boolean).join(': ');
        allFrags.push({ text, src: '📌 ' + (c.title || 'Ghi chú'), srcType: 'note', date: r.created_at });
      }
    });

    // Add info sheet data as context
    const infoTexts = [];
    if (d.tinh_cach) infoTexts.push({ text: d.tinh_cach, src: 'Phiếu TT', srcType: 'info' });
    if (d.so_thich) infoTexts.push({ text: d.so_thich, src: 'Phiếu TT', srcType: 'info' });
    if (d.du_dinh) infoTexts.push({ text: d.du_dinh, src: 'Phiếu TT', srcType: 'info' });
    if (d.chuyen_cu) infoTexts.push({ text: d.chuyen_cu, src: 'Phiếu TT', srcType: 'info' });
    if (d.luu_y) infoTexts.push({ text: d.luu_y, src: 'Phiếu TT', srcType: 'info' });

    // ══ STEP 2: CROSS-SOURCE ASPECT GROUPING ══
    const aspectMap = {};
    ASPECTS.forEach(a => { aspectMap[a.key] = { ...a, frags: [] }; });
    const ungrouped = [];

    [...allFrags, ...infoTexts].forEach(f => {
      const lower = f.text.toLowerCase();
      let placed = false;
      for (const asp of ASPECTS) {
        if (asp.kw.some(kw => lower.includes(kw))) {
          aspectMap[asp.key].frags.push(f);
          placed = true;
          break;
        }
      }
      if (!placed) ungrouped.push(f);
    });

    // ══ STEP 3: DETECT PATTERNS & BUILD INSIGHT MARKDOWN ══
    let md = `# 🔍 ${p.full_name || 'Insight'}\n`;

    // ── A. Bức tranh tổng quát ──
    md += `## 📊 Tổng quan\n`;
    md += `- Giai đoạn: **${PHASE_LABELS[p.phase] || p.phase || '?'}**\n`;
    md += `- Tư vấn: **${tvs.length}** lần | BB: **${bbs.length}** buổi | Ghi chú: **${nts.length}**\n`;
    md += `- Tổng fragments: **${allFrags.length}** đoạn thông tin\n`;

    // ── B. Câu chuyện theo khía cạnh (cross-source) ──
    for (const asp of ASPECTS) {
      const data = aspectMap[asp.key];
      if (!data.frags.length) continue;

      md += `## ${asp.label}\n`;

      // Group by srcType for narrative flow
      const bySrc = {};
      data.frags.forEach(f => {
        if (!bySrc[f.src]) bySrc[f.src] = [];
        bySrc[f.src].push(f);
      });

      for (const [src, items] of Object.entries(bySrc)) {
        md += `### ${src}\n`;
        items.forEach(f => {
          const short = f.text.length > 100 ? f.text.substring(0, 100) + '…' : f.text;
          md += `- ${short}\n`;
        });
      }
    }

    // ── C. Thông tin chưa phân loại ──
    if (ungrouped.length > 0) {
      md += `## 📝 Thông tin khác\n`;
      ungrouped.forEach(f => {
        const short = f.text.length > 80 ? f.text.substring(0, 80) + '…' : f.text;
        md += `- ${short} *(${f.src})*\n`;
      });
    }

    // ── D. INSIGHT: Phát hiện patterns ──
    const insights = [];

    // D1: Chủ đề nổi bật (aspect có nhiều fragments nhất)
    const sortedAspects = ASPECTS.map(a => ({ label: a.label, count: aspectMap[a.key].frags.length }))
      .filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    if (sortedAspects.length > 0) {
      insights.push(`Chủ đề nổi bật nhất: **${sortedAspects[0].label}** (${sortedAspects[0].count} lần nhắc)`);
    }

    // D2: Cảm xúc tiêu cực nhiều?
    const negWords = ['khó khăn','buồn','lo','sợ','mệt','chán','stress','áp lực','thất vọng','đau','tức','giận','cô đơn','trầm'];
    const posWords = ['vui','hy vọng','tích cực','tiến bộ','mở lòng','hạnh phúc','cam kết','sẵn sàng','cải thiện'];
    let negCount = 0, posCount = 0;
    allFrags.forEach(f => {
      const l = f.text.toLowerCase();
      negWords.forEach(w => { if (l.includes(w)) negCount++; });
      posWords.forEach(w => { if (l.includes(w)) posCount++; });
    });
    if (negCount > 0 || posCount > 0) {
      const ratio = posCount / Math.max(negCount, 1);
      if (ratio < 0.5) insights.push('⚠️ Xu hướng cảm xúc: **Tiêu cực chiếm đa số** → Cần chú ý hỗ trợ tâm lý');
      else if (ratio > 1.5) insights.push('✅ Xu hướng cảm xúc: **Tích cực** → Đang có chuyển biến tốt');
      else insights.push('🔄 Xu hướng cảm xúc: **Trung tính** — cần theo dõi thêm');
    }

    // D3: Khoảng trống thông tin
    const gaps = [];
    if (!d.nghe_nghiep && !aspectMap.work.frags.length) gaps.push('Công việc/Học tập');
    if (!d.hon_nhan && !aspectMap.family.frags.length && !aspectMap.love.frags.length) gaps.push('Gia đình & Tình cảm');
    if (!d.ton_giao && !aspectMap.spiritual.frags.length) gaps.push('Tâm linh');
    if (!aspectMap.health.frags.length) gaps.push('Sức khỏe');
    if (gaps.length > 0) {
      insights.push(`🔎 Khoảng trống: chưa có thông tin về **${gaps.join(', ')}**`);
    }

    // D4: Cross-reference note titles
    const noteTitles = nts.map(n => n.content?.title).filter(Boolean);
    if (noteTitles.length >= 2) {
      insights.push(`📌 Người quan sát đã ghi nhận ${noteTitles.length} khía cạnh: **${noteTitles.join(', ')}**`);
    }

    if (insights.length > 0) {
      md += `## 💡 Insight\n`;
      insights.forEach(ins => { md += `- ${ins}\n`; });
    }

    // ── E. Empty state ──
    if (allFrags.length === 0 && infoTexts.length === 0) {
      md += `## 📋 Chưa có dữ liệu\n- Chưa có báo cáo hoặc ghi chú nào\n`;
    }

    renderMarkmap(container, md);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi tải</div>';
    console.error(e);
  }
}
