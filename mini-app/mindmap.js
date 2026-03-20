// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v6 — Smart summarization: extract key points, not raw text
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
// TEXT INTELLIGENCE — Extract key points from text
// ═══════════════════════════════════════════════════

// Vietnamese stop words to ignore
const STOP_WORDS = new Set(['và','là','của','có','được','cho','với','trong','để','các','này','đã',
  'không','những','một','từ','theo','khi','về','như','cũng','đó','tại','sẽ','rất',
  'hay','thì','mà','nhưng','lại','đang','nên','phải','vì','bị','làm','ra','đi',
  'lên','xuống','vào','ở','trên','dưới','qua','tới','thế','nào','gì','ai',
  'đây','kia','nó','họ','tôi','bạn','mình','em','anh','chị']);

// Extract short key phrases from long text
function extractKeyPoints(text, maxPoints) {
  if (!text || text.length < 30) return [text || ''];
  maxPoints = maxPoints || 3;

  // Split into sentences/phrases
  const sents = text.split(/[.!?\n;]+/)
    .map(s => s.trim())
    .filter(s => s.length > 3);

  if (sents.length <= maxPoints) {
    return sents.map(s => s.length > 40 ? s.substring(0, 38) + '…' : s);
  }

  // Score each sentence by keyword density
  // Count word frequency across all text
  const wordFreq = {};
  const allWords = text.toLowerCase().split(/\s+/);
  allWords.forEach(w => {
    const clean = w.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
    if (clean.length > 1 && !STOP_WORDS.has(clean)) {
      wordFreq[clean] = (wordFreq[clean] || 0) + 1;
    }
  });

  // Score sentences
  const scored = sents.map(s => {
    const words = s.toLowerCase().split(/\s+/);
    let score = 0;
    words.forEach(w => {
      const clean = w.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
      if (wordFreq[clean]) score += wordFreq[clean];
    });
    // Bonus for shorter sentences (more concise)
    score *= Math.max(0.5, 1 - s.length / 200);
    return { text: s, score };
  });

  // Take top scored sentences
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPoints).map(s =>
    s.text.length > 40 ? s.text.substring(0, 38) + '…' : s.text
  );
}

// Condense a fragment into 1-line summary
function condenseFrag(text) {
  if (!text) return '';
  const clean = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= 35) return clean;
  // Take first meaningful phrase
  const first = clean.split(/[,;.!?]/).find(s => s.trim().length > 5);
  if (first && first.trim().length <= 35) return first.trim();
  return clean.substring(0, 33) + '…';
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
  if (d.nguoi_than) gd.push(condenseFrag(d.nguoi_than));
  if (gd.length) { md += `## 👨‍👩‍👧 Gia đình\n`; gd.forEach(v => md += `- ${v}\n`); }

  if (d.ton_giao) { const tg = Array.isArray(d.ton_giao) ? d.ton_giao.join(', ') : d.ton_giao; md += `## 🙏 Tôn giáo\n- ${tg}\n`; }
  if (d.tinh_cach) md += `## 🧩 Tính cách\n- ${condenseFrag(d.tinh_cach)}\n`;
  if (d.so_thich) md += `## ⭐ Sở thích\n- ${condenseFrag(d.so_thich)}\n`;
  if (d.du_dinh) md += `## 🎯 Dự định\n- ${condenseFrag(d.du_dinh)}\n`;
  if (d.quan_diem) md += `## 🌟 Quan điểm TL\n- ${condenseFrag(d.quan_diem)}\n`;
  if (d.sdt || p.phone_number) md += `## 📞 Liên hệ\n- ${d.sdt || p.phone_number}\n`;
  if (d.chuyen_cu) { md += `## 📖 Câu chuyện\n`; extractKeyPoints(d.chuyen_cu, 2).forEach(k => md += `- ${k}\n`); }
  if (d.luu_y) md += `## ⚠️ Lưu ý\n- ${condenseFrag(d.luu_y)}\n`;

  if (md.trim() === `# ${name}`) md += `## 📋 Chưa có dữ liệu\n- Hãy điền Phiếu TT\n`;
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// COLLECTED INFO → Insight with smart summary
// ═══════════════════════════════════════════════════

const ASPECTS = [
  { key: 'family', label: 'Gia đình', icon: '👨‍👩‍👧', kw: ['gia đình','ba mẹ','mẹ','bố','cha','vợ','chồng','người thân','ly hôn','kết hôn','kinh tế','tài chính','tiền','khó khăn','nhà','ông','bà','em gái','anh trai','chị'] },
  { key: 'love', label: 'Tình cảm', icon: '💕', kw: ['bạn trai','bạn gái','người yêu','yêu','tình cảm','tình yêu','hẹn hò','chia tay','cưới','quan hệ','cô đơn'] },
  { key: 'work', label: 'Học tập & Công việc', icon: '💼', kw: ['công việc','làm việc','nghề','lương','sếp','kinh doanh','thu nhập','học','thi','trường','đại học','ôn tập','sinh viên','quản trị'] },
  { key: 'mental', label: 'Tâm lý', icon: '🧠', kw: ['cảm xúc','lo lắng','sợ','buồn','vui','stress','áp lực','tự ti','mệt','chán','giận','thất vọng','hy vọng','trầm','khóc','lo','tức'] },
  { key: 'health', label: 'Sức khỏe', icon: '🏥', kw: ['sức khỏe','bệnh','thuốc','bác sĩ','đau','mất ngủ','nghiện','rượu','bia'] },
  { key: 'spiritual', label: 'Tâm linh', icon: '✝️', kw: ['kinh thánh','cầu nguyện','nhà thờ','chùa','chúa','đức tin','thiền','tôn giáo'] },
  { key: 'progress', label: 'Tiến trình', icon: '📈', kw: ['tiến bộ','thay đổi','mở lòng','tích cực','cải thiện','phát triển','cam kết','hợp tác','sẵn sàng'] },
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
    const d = window._currentInfoSheet || {};

    // ── Collect all knowledge ──
    const allFrags = [];

    tvs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'TV' + (c.lan_thu || (i + 1));
      ['noi_dung','tom_tat','cam_xuc','phan_hoi','ghi_chu','nhan_xet','cong_cu'].forEach(k => {
        if (c[k]) allFrags.push({ text: String(c[k]), src, srcType: 'tv' });
      });
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'BB' + (c.buoi_thu || (i + 1));
      ['noi_dung','tom_tat','cam_xuc','phan_hoi','ghi_chu','nhan_xet'].forEach(k => {
        if (c[k]) allFrags.push({ text: String(c[k]), src, srcType: 'bb' });
      });
    });

    // Notes: title IS the category, body is content
    const noteGroups = [];
    nts.forEach(r => {
      const c = r.content || {};
      if (c.title || c.body) {
        noteGroups.push({ title: c.title || 'Ghi chú', body: c.body || '' });
        allFrags.push({ text: [c.title, c.body].filter(Boolean).join(': '), src: c.title || 'Note', srcType: 'note' });
      }
    });

    // Info sheet context
    ['tinh_cach','so_thich','du_dinh','chuyen_cu','luu_y'].forEach(k => {
      if (d[k]) allFrags.push({ text: d[k], src: 'Phiếu', srcType: 'info' });
    });

    // ── Classify into aspects ──
    const aspectMap = {};
    ASPECTS.forEach(a => { aspectMap[a.key] = { ...a, frags: [] }; });
    const ungrouped = [];

    allFrags.forEach(f => {
      const lower = f.text.toLowerCase();
      let placed = false;
      for (const asp of ASPECTS) {
        if (asp.kw.some(kw => lower.includes(kw))) {
          aspectMap[asp.key].frags.push(f);
          placed = true;
          break;
        }
      }
      if (!placed && f.text.length > 5) ungrouped.push(f);
    });

    // ── BUILD MARKDOWN with SMART SUMMARIES ──
    let md = `# 🔍 ${p.full_name || 'Insight'}\n`;

    // A. Overview
    md += `## 📊 Tổng quan\n`;
    md += `- ${tvs.length} TV | ${bbs.length} BB | ${nts.length} ghi chú\n`;

    // B. Note-based insights (user's own classification!)
    if (noteGroups.length > 0) {
      noteGroups.forEach(ng => {
        // Find which aspect this note title belongs to
        const matchAsp = ASPECTS.find(a => a.kw.some(kw => ng.title.toLowerCase().includes(kw)));
        const icon = matchAsp ? matchAsp.icon : '📌';
        md += `## ${icon} ${ng.title}\n`;
        // Extract key points from body
        const points = extractKeyPoints(ng.body, 3);
        points.forEach(pt => { md += `- ${pt}\n`; });
      });
    }

    // C. Aspects from TV/BB that weren't covered by notes
    const noteTitlesLower = noteGroups.map(n => n.title.toLowerCase());
    for (const asp of ASPECTS) {
      const data = aspectMap[asp.key];
      // Skip if a note title already covers this aspect
      const coveredByNote = noteTitlesLower.some(nt =>
        asp.kw.some(kw => nt.includes(kw))
      );
      // Only show TV/BB frags not from notes
      const tvbbFrags = data.frags.filter(f => f.srcType === 'tv' || f.srcType === 'bb');
      if (coveredByNote || tvbbFrags.length === 0) continue;

      md += `## ${asp.icon} ${asp.label}\n`;
      // Combine all text, extract key points
      const combined = tvbbFrags.map(f => f.text).join('. ');
      const points = extractKeyPoints(combined, 3);
      points.forEach(pt => { md += `- ${pt}\n`; });
      // Source summary
      const sources = [...new Set(tvbbFrags.map(f => f.src))];
      md += `- 📎 ${sources.join(', ')}\n`;
    }

    // D. Ungrouped
    if (ungrouped.length > 0) {
      md += `## 📝 Khác\n`;
      ungrouped.slice(0, 5).forEach(f => {
        md += `- ${condenseFrag(f.text)}\n`;
      });
    }

    // E. Insights
    const insights = [];

    // Top aspect
    const sortedAsp = ASPECTS.map(a => ({ ...a, count: aspectMap[a.key].frags.length }))
      .filter(a => a.count > 0).sort((a, b) => b.count - a.count);
    if (sortedAsp.length > 0) {
      insights.push(`Chủ đề nổi bật: **${sortedAsp[0].icon} ${sortedAsp[0].label}**`);
    }

    // Emotion trend
    const negW = ['khó khăn','buồn','lo','sợ','mệt','chán','stress','áp lực','thất vọng','đau','tức','giận','cô đơn','trầm','kiểm cặp'];
    const posW = ['vui','hy vọng','tích cực','tiến bộ','mở lòng','hạnh phúc','cam kết','sẵn sàng','cải thiện','hòa thuận'];
    let neg = 0, pos = 0;
    allFrags.forEach(f => {
      const l = f.text.toLowerCase();
      negW.forEach(w => { if (l.includes(w)) neg++; });
      posW.forEach(w => { if (l.includes(w)) pos++; });
    });
    if (neg + pos > 0) {
      if (neg > pos * 2) insights.push('⚠️ Cảm xúc **tiêu cực** nổi trội');
      else if (pos > neg * 2) insights.push('✅ Xu hướng **tích cực**');
      else insights.push('🔄 Cảm xúc **pha trộn**');
    }

    // Gaps
    const gaps = [];
    if (!aspectMap.work.frags.length) gaps.push('Công việc');
    if (!aspectMap.health.frags.length) gaps.push('Sức khỏe');
    if (!aspectMap.spiritual.frags.length) gaps.push('Tâm linh');
    if (gaps.length > 0) insights.push(`🔎 Cần tìm hiểu: ${gaps.join(', ')}`);

    if (insights.length > 0) {
      md += `## 💡 Insight\n`;
      insights.forEach(ins => { md += `- ${ins}\n`; });
    }

    if (allFrags.length === 0) {
      md += `## 📋 Chưa có dữ liệu\n- Chưa có báo cáo / ghi chú\n`;
    }

    renderMarkmap(container, md);
  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi</div>';
    console.error(e);
  }
}
