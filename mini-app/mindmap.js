// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v7 — Topic-cross-source with detail popup
// Group ALL sources (TV, BB, Notes) by TOPIC, short labels, tap for full text
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
// TEXT UTILS
// ═══════════════════════════════════════════════════
const STOP_WORDS = new Set(['và','là','của','có','được','cho','với','trong','để','các','này','đã',
  'không','những','một','từ','theo','khi','về','như','cũng','đó','tại','sẽ','rất',
  'hay','thì','mà','nhưng','lại','đang','nên','phải','vì','bị','làm','ra','đi',
  'lên','xuống','vào','ở','trên','dưới','qua','tới','thế','nào','gì','ai',
  'đây','kia','nó','họ','tôi','bạn','mình','em','anh','chị']);

function extractKeyPoints(text, maxPoints) {
  if (!text || text.length < 20) return [text || ''];
  maxPoints = maxPoints || 3;
  const sents = text.split(/[.!?\n;]+/).map(s => s.trim()).filter(s => s.length > 3);
  if (sents.length <= maxPoints) return sents.map(s => s.length > 35 ? s.substring(0, 33) + '…' : s);
  const wordFreq = {};
  text.toLowerCase().split(/\s+/).forEach(w => {
    const c = w.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
    if (c.length > 1 && !STOP_WORDS.has(c)) wordFreq[c] = (wordFreq[c] || 0) + 1;
  });
  const scored = sents.map(s => {
    let score = 0;
    s.toLowerCase().split(/\s+/).forEach(w => {
      const c = w.replace(/[^a-zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, '');
      if (wordFreq[c]) score += wordFreq[c];
    });
    score *= Math.max(0.5, 1 - s.length / 200);
    return { text: s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxPoints).map(s => s.text.length > 35 ? s.text.substring(0, 33) + '…' : s.text);
}

function condense(text, max) {
  if (!text) return '';
  max = max || 30;
  const c = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  if (c.length <= max) return c;
  return c.substring(0, max - 1) + '…';
}

function escH(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ═══════════════════════════════════════════════════
// PERSONAL INFO
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
  if (d.nguoi_quan_trong) gd.push('QT: ' + d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(condense(d.nguoi_than));
  if (gd.length) { md += `## 👨‍👩‍👧 Gia đình\n`; gd.forEach(v => md += `- ${v}\n`); }
  if (d.ton_giao) md += `## 🙏 Tôn giáo\n- ${Array.isArray(d.ton_giao) ? d.ton_giao.join(', ') : d.ton_giao}\n`;
  if (d.tinh_cach) md += `## 🧩 Tính cách\n- ${condense(d.tinh_cach)}\n`;
  if (d.so_thich) md += `## ⭐ Sở thích\n- ${condense(d.so_thich)}\n`;
  if (d.du_dinh) md += `## 🎯 Dự định\n- ${condense(d.du_dinh)}\n`;
  if (d.quan_diem) md += `## 🌟 Quan điểm TL\n- ${condense(d.quan_diem)}\n`;
  if (d.sdt || p.phone_number) md += `## 📞 Liên hệ\n- ${d.sdt || p.phone_number}\n`;
  if (d.chuyen_cu) { md += `## 📖 Câu chuyện\n`; extractKeyPoints(d.chuyen_cu, 2).forEach(k => md += `- ${k}\n`); }
  if (d.luu_y) md += `## ⚠️ Lưu ý\n- ${condense(d.luu_y)}\n`;
  if (md.trim() === `# ${name}`) md += `## 📋 Chưa có\n- Hãy điền Phiếu TT\n`;
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TOPIC DEFINITIONS
// ═══════════════════════════════════════════════════
const TOPICS = [
  { key: 'family', label: 'Gia đình', icon: '👨‍👩‍👧', kw: ['gia đình','ba mẹ','mẹ','bố','cha','vợ','chồng','người thân','ly hôn','kết hôn','kinh tế','tài chính','tiền','khó khăn','nhà','ông','bà','em gái','anh trai','chị','ba ','kiểm cặp'] },
  { key: 'love', label: 'Tình cảm', icon: '💕', kw: ['bạn trai','bạn gái','người yêu','yêu','tình cảm','tình yêu','hẹn hò','chia tay','cưới','cô đơn'] },
  { key: 'work', label: 'Học tập & Việc làm', icon: '💼', kw: ['công việc','làm việc','nghề','lương','sếp','kinh doanh','thu nhập','học','thi','trường','đại học','ôn tập','sinh viên','quản trị'] },
  { key: 'mental', label: 'Tâm lý', icon: '🧠', kw: ['cảm xúc','lo lắng','sợ','buồn','vui','stress','áp lực','tự ti','mệt','chán','giận','thất vọng','hy vọng','trầm','khóc','lo','tức'] },
  { key: 'health', label: 'Sức khỏe', icon: '🏥', kw: ['sức khỏe','bệnh','thuốc','bác sĩ','đau','mất ngủ','nghiện','rượu','bia'] },
  { key: 'spiritual', label: 'Tâm linh', icon: '✝️', kw: ['kinh thánh','cầu nguyện','nhà thờ','chùa','chúa','đức tin','thiền','tôn giáo'] },
  { key: 'progress', label: 'Tiến trình', icon: '📈', kw: ['tiến bộ','thay đổi','mở lòng','tích cực','cải thiện','phát triển','cam kết','hợp tác','sẵn sàng'] },
];

// TV field mappings (correct field names from the form)
const TV_FIELDS = [
  { key: 'van_de', label: '🎯 Vấn đề' },
  { key: 'phan_hoi', label: '💭 Phản hồi' },
  { key: 'diem_hai', label: '⭐ Điểm hái' },
  { key: 'de_xuat', label: '💡 Đề xuất' },
  { key: 'ket_qua_test', label: '📋 Test' },
  { key: 'ten_cong_cu', label: '🔧 Công cụ' },
];

// BB field mappings
const BB_FIELDS = [
  { key: 'khai_thac', label: '🔍 Phát hiện mới' },
  { key: 'phan_ung', label: '💭 Phản ứng' },
  { key: 'tuong_tac', label: '🤝 Tương tác' },
  { key: 'noi_dung', label: '📖 Nội dung' },
  { key: 'de_xuat_cs', label: '💡 Đề xuất' },
];

// ═══════════════════════════════════════════════════
// COLLECTED INFO — Topic-cross-source
// ═══════════════════════════════════════════════════
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

    // ── Collect ALL fragments with source + label ──
    const allFrags = []; // {text, src, label}

    tvs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'TV lần ' + (c.lan_thu || (i + 1));
      TV_FIELDS.forEach(f => {
        if (c[f.key] && String(c[f.key]).trim())
          allFrags.push({ text: String(c[f.key]), src, label: f.label });
      });
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      const src = 'BB buổi ' + (c.buoi_thu || (i + 1));
      BB_FIELDS.forEach(f => {
        if (c[f.key] && String(c[f.key]).trim())
          allFrags.push({ text: String(c[f.key]), src, label: f.label });
      });
    });

    nts.forEach(r => {
      const c = r.content || {};
      if (c.body && c.body.trim()) {
        allFrags.push({ text: String(c.body), src: '📌 ' + (c.title || 'Ghi chú'), label: c.title || 'Ghi chú' });
      }
    });

    // Info sheet
    if (d.tinh_cach) allFrags.push({ text: d.tinh_cach, src: 'Phiếu TT', label: 'Tính cách' });
    if (d.chuyen_cu) allFrags.push({ text: d.chuyen_cu, src: 'Phiếu TT', label: 'Câu chuyện' });
    if (d.luu_y) allFrags.push({ text: d.luu_y, src: 'Phiếu TT', label: 'Lưu ý' });

    // ── Classify into TOPICS (cross all sources) ──
    const topicMap = {};
    TOPICS.forEach(t => { topicMap[t.key] = { ...t, frags: [] }; });
    topicMap['other'] = { key: 'other', label: 'Khác', icon: '📝', frags: [], kw: [] };

    // Also use note titles as topic hints
    const noteTitleMap = {};
    nts.forEach(r => {
      const c = r.content || {};
      if (c.title && c.body) noteTitleMap[c.title] = c.body;
    });

    allFrags.forEach(f => {
      const lower = (f.text + ' ' + f.label).toLowerCase();
      let placed = false;
      for (const t of TOPICS) {
        if (t.kw.some(kw => lower.includes(kw))) {
          topicMap[t.key].frags.push(f);
          placed = true;
          break;
        }
      }
      if (!placed) topicMap['other'].frags.push(f);
    });

    // ── Build MARKMAP (short labels) ──
    let md = `# 🔍 ${p.full_name || 'Insight'}\n`;

    const activeTopics = [];
    for (const [key, topic] of Object.entries(topicMap)) {
      if (!topic.frags.length) continue;
      activeTopics.push(topic);
      md += `## ${topic.icon} ${topic.label}\n`;
      // Show max 3 condensed key points
      const combined = topic.frags.map(f => f.text).join('. ');
      const points = extractKeyPoints(combined, 3);
      points.forEach(pt => { md += `- ${pt}\n`; });
    }

    // Insights branch
    const insights = [];
    const sorted = [...activeTopics].sort((a, b) => b.frags.length - a.frags.length);
    if (sorted.length > 0) insights.push(`${sorted[0].icon} ${sorted[0].label} nổi bật`);
    
    const negW = ['khó khăn','buồn','lo','sợ','mệt','chán','stress','áp lực','thất vọng','đau','tức','giận','cô đơn','kiểm cặp'];
    const posW = ['vui','hy vọng','tích cực','tiến bộ','mở lòng','cam kết','sẵn sàng','cải thiện','hòa thuận'];
    let neg = 0, pos = 0;
    allFrags.forEach(f => { const l = f.text.toLowerCase(); negW.forEach(w => { if (l.includes(w)) neg++; }); posW.forEach(w => { if (l.includes(w)) pos++; }); });
    if (neg + pos > 0) {
      if (neg > pos * 2) insights.push('⚠️ Tiêu cực nổi trội');
      else if (pos > neg * 2) insights.push('✅ Tích cực');
      else insights.push('🔄 Pha trộn');
    }
    const gaps = [];
    TOPICS.forEach(t => { if (!topicMap[t.key].frags.length) gaps.push(t.label); });
    if (gaps.length > 0 && gaps.length <= 4) insights.push('🔎 Thiếu: ' + gaps.join(', '));

    if (insights.length > 0) {
      md += `## 💡 Insight\n`;
      insights.forEach(ins => md += `- ${ins}\n`);
    }

    if (allFrags.length === 0) {
      md += `## 📋 Chưa có dữ liệu\n`;
    }

    // ── Render: Markmap + Detail Panel ──
    container.innerHTML = '';
    container.style.height = 'auto';

    // Markmap area
    const mmDiv = document.createElement('div');
    mmDiv.className = 'markmap';
    mmDiv.style.cssText = 'width:100%;min-height:350px;';
    mmDiv.innerHTML = '<script type="text/template">' + md + '<\/script>';
    container.appendChild(mmDiv);

    // Hint
    const hint = document.createElement('div');
    hint.style.cssText = 'text-align:center;font-size:10px;color:var(--text3);padding:4px 0;';
    hint.textContent = '👆 Kéo/zoom mindmap | 👇 Bấm chủ đề bên dưới để xem chi tiết';
    container.appendChild(hint);

    // Detail panel (expandable topics)
    const detailDiv = document.createElement('div');
    detailDiv.style.cssText = 'padding:0 4px 8px;';
    let detailHtml = '';

    activeTopics.forEach((topic, ti) => {
      const topicId = 'mmDetail_' + ti;
      detailHtml += `<div class="mm-topic-card">
        <div class="mm-topic-head" onclick="document.getElementById('${topicId}').classList.toggle('mm-open')">
          <span>${topic.icon} <b>${escH(topic.label)}</b></span>
          <span style="font-size:10px;color:var(--text3);">${topic.frags.length} mục ›</span>
        </div>
        <div class="mm-topic-body" id="${topicId}">`;

      // Group frags by source for narrative flow
      const bySrc = {};
      topic.frags.forEach(f => {
        if (!bySrc[f.src]) bySrc[f.src] = [];
        bySrc[f.src].push(f);
      });

      for (const [src, items] of Object.entries(bySrc)) {
        detailHtml += `<div class="mm-detail-src">${escH(src)}</div>`;
        items.forEach(it => {
          detailHtml += `<div class="mm-detail-item">
            <div class="mm-detail-label">${escH(it.label)}</div>
            <div class="mm-detail-text">${escH(it.text)}</div>
          </div>`;
        });
      }

      detailHtml += `</div></div>`;
    });

    detailDiv.innerHTML = detailHtml;
    container.appendChild(detailDiv);

    // Render markmap
    if (window.markmap && window.markmap.autoLoader) {
      window.markmap.autoLoader.renderAll();
    }

  } catch (e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi</div>';
    console.error(e);
  }
}
