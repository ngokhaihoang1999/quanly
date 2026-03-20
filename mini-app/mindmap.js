// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v10.1 — Smart filtering + sub-branching
// Filter noise, deduplicate, only keep meaningful insights
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
  container.style.height = '420px';
  container.style.overflow = 'hidden';
  container.innerHTML = '<div class="markmap" style="width:100%;height:100%;"><script type="text/template">' + md + '<\/script></div>';
  if (window.markmap && window.markmap.autoLoader) {
    window.markmap.autoLoader.renderAll();
  }
}

// ═══════════════════════════════════════════════════
// SMART TEXT PROCESSING
// ═══════════════════════════════════════════════════

function splitToBranches(text) {
  if (!text || text.length < 10) return text ? [text] : [];
  text = text.replace(/\n+/g, ', ').replace(/\s+/g, ' ').trim();
  const parts = text.split(/[,;.!?\n]+|(?:\s+(?:và|nhưng|tuy nhiên|ngoài ra|bên cạnh đó|do đó|vì vậy|cũng|còn|hay|hoặc|nên|mà|rồi|thì)\s+)/i);
  const cleaned = parts.map(p => p.trim()).filter(p => p.length > 4 && !isNoise(p)).map(p => p.length > 38 ? p.substring(0, 36) + '…' : p);
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  if (cleaned.length === 1 && cleaned[0].length > 35) {
    const mid = Math.floor(cleaned[0].length / 2);
    const si = cleaned[0].indexOf(' ', mid - 5);
    if (si > 10) return [cleaned[0].substring(0, si), cleaned[0].substring(si + 1)];
  }
  return cleaned.length ? cleaned : [text.length > 38 ? text.substring(0, 36) + '…' : text];
}

function mdBranches(text) {
  const parts = splitToBranches(text);
  if (parts.length <= 1) return '- ' + (parts[0] || '') + '\n';
  return parts.map(p => '- ' + p + '\n').join('');
}

function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

// ═══════════════════════════════════════════════════
// NOISE FILTER — skip metadata, names, codes, dates
// ═══════════════════════════════════════════════════
const NOISE_RE = [
  /^ngày\s*:/i, /^học sinh\s*:/i, /^người dẫn/i, /^shin\d/i,
  /^báo cáo\s/i, /^buổi\s*\d/i, /^\d{1,2}\/\d{1,2}/,
  /^thứ\s+(hai|ba|tư|năm|sáu|bảy|cn)/i,
  /^[A-Z]{2,}\d+/, /^(tên|sdt|email|mã|code)\s*:/i,
  /^[\d\s\-\/.:]+$/, /^[A-Z][a-z]+\s[A-Z]/, // person names
  /^\d+\s*-\s*\d+$/, /^x+$/i
];

function isNoise(text) {
  if (!text) return true;
  const t = text.trim();
  if (t.length < 8) return true;
  for (const re of NOISE_RE) { if (re.test(t)) return true; }
  // All-caps short = likely a code/label
  if (t.length < 15 && /^[A-ZÀ-Ỹ\s\d-]+$/.test(t)) return true;
  // Just a person name (2-5 words all start uppercase)
  const ws = t.split(/\s+/);
  if (ws.length >= 2 && ws.length <= 5 && ws.every(w => /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỸĐ]/i.test(w) && w.length < 10) && !t.includes(' là ') && !t.includes(' có ') && !t.includes(' không ')) {
    // Probably a name if no verbs
    if (ws.every(w => /^[A-ZÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴĐ]/.test(w))) return true;
  }
  return false;
}

// Filter text block: remove noise lines, join meaningful parts
function filterText(text) {
  if (!text) return '';
  const lines = text.split(/[\n;]+/).map(s => s.trim()).filter(s => s.length > 0);
  const good = lines.filter(l => !isNoise(l));
  return good.join(', ').trim();
}

// Deduplicate by word overlap (>60% = duplicate)
function dedupe(arr) {
  const result = [];
  for (const item of arr) {
    const lower = item.toLowerCase();
    const isDup = result.some(ex => {
      const el = ex.toLowerCase();
      if (el.includes(lower) || lower.includes(el)) return true;
      const w1 = new Set(el.split(/\s+/));
      const w2 = new Set(lower.split(/\s+/));
      let common = 0;
      w2.forEach(w => { if (w1.has(w)) common++; });
      return common / Math.max(w1.size, w2.size) > 0.6;
    });
    if (!isDup && item.length > 5) result.push(item);
  }
  return result;
}

// ═══════════════════════════════════════════════════
// TAB 1: Cá nhân
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  const d = window._currentInfoSheet || {};
  const name = p.full_name || 'Trái quả';
  let md = `# ${name}\n`;

  const id = [d.gioi_tinh||p.gender, d.nam_sinh?'Sinh '+d.nam_sinh:null, d.nghe_nghiep].filter(Boolean);
  if (id.length) { md += `## 👤 Nhân thân\n`; id.forEach(v => md += `- ${v}\n`); }

  const gd = [];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('QT: '+d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(short(d.nguoi_than,35));
  if (gd.length) { md += `## 👨‍👩‍👧 Gia đình\n`; gd.forEach(v => md += `- ${v}\n`); }

  if (d.tinh_cach) { md += `## 🧩 Tính cách\n`; md += mdBranches(d.tinh_cach); }
  if (d.so_thich) { md += `## ⭐ Sở thích\n`; md += mdBranches(d.so_thich); }
  if (d.ton_giao) md += `## 🙏 Tôn giáo\n- ${Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao}\n`;
  if (d.du_dinh) { md += `## 🎯 Dự định\n`; md += mdBranches(d.du_dinh); }
  if (d.quan_diem) { md += `## 🌟 Quan điểm\n`; md += mdBranches(d.quan_diem); }
  if (d.chuyen_cu) { md += `## 📖 Câu chuyện\n`; md += mdBranches(d.chuyen_cu); }
  if (d.luu_y) { md += `## ⚠️ Lưu ý\n`; md += mdBranches(d.luu_y); }

  const noi = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noi.length) { md += `## 📍 Nơi sống\n`; noi.forEach(v => md += `- ${short(v,30)}\n`); }

  if (md.trim() === `# ${name}`) md += `## 📋 Chưa có dữ liệu\n`;
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TAB 2: Thu thập — Filtered, deduped, concise
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

    if (!tvs.length && !bbs.length && !nts.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">📋 Chưa có dữ liệu</div>';
      return;
    }

    // ── Gather & FILTER — only meaningful content ──
    const rawIssues = [], rawFeelings = [], rawApproach = [], rawNext = [];
    const noteInsights = [], tools = [];

    tvs.forEach(r => {
      const c = r.content || {};
      if (c.van_de) { const f = filterText(c.van_de); if (f) rawIssues.push(f); }
      if (c.phan_hoi) { const f = filterText(c.phan_hoi); if (f) rawFeelings.push(f); }
      if (c.diem_hai) { const f = filterText(c.diem_hai); if (f) rawApproach.push(f); }
      if (c.de_xuat) { const f = filterText(c.de_xuat); if (f) rawNext.push(f); }
      if (c.ten_cong_cu && c.ten_cong_cu.trim()) tools.push(c.ten_cong_cu.trim());
    });

    bbs.forEach(r => {
      const c = r.content || {};
      if (c.khai_thac) { const f = filterText(c.khai_thac); if (f) rawIssues.push(f); }
      if (c.phan_ung) { const f = filterText(c.phan_ung); if (f) rawFeelings.push(f); }
      if (c.tuong_tac) { const f = filterText(c.tuong_tac); if (f) rawApproach.push(f); }
      if (c.de_xuat_cs) { const f = filterText(c.de_xuat_cs); if (f) rawNext.push(f); }
    });

    nts.forEach(r => {
      const c = r.content || {};
      if (c.title && c.body && c.body.trim().length > 5) {
        noteInsights.push({ title: c.title, body: filterText(c.body) || c.body.trim() });
      }
    });

    // ── Deduplicate & limit ──
    const issues = dedupe(rawIssues).slice(0, 3);
    const feelings = dedupe(rawFeelings).slice(0, 3);
    const approach = dedupe(rawApproach).slice(0, 3);
    const nextSteps = dedupe(rawNext).slice(0, 3);

    // ── BUILD CONCISE MARKDOWN ──
    const name = p.full_name || 'Insight';
    let md = `# 🔍 ${name}\n`;

    if (issues.length) {
      md += `## 🎯 Cần chú ý\n`;
      issues.forEach(text => {
        const parts = splitToBranches(text);
        if (parts.length <= 1) { md += `- ${parts[0]||''}\n`; }
        else { md += `### ${short(parts[0],28)}\n`; parts.slice(1).forEach(p => md += `- ${p}\n`); }
      });
    }

    if (feelings.length) {
      md += `## 💭 Phản hồi\n`;
      feelings.forEach(text => { splitToBranches(text).slice(0,3).forEach(p => md += `- ${p}\n`); });
    }

    if (approach.length) {
      md += `## 🤝 Tiếp cận\n`;
      approach.forEach(text => { splitToBranches(text).slice(0,3).forEach(p => md += `- ${p}\n`); });
    }

    if (noteInsights.length) {
      md += `## 📌 Ghi chú\n`;
      noteInsights.slice(0, 4).forEach(n => {
        md += `### ${short(n.title, 20)}\n`;
        splitToBranches(n.body).slice(0,3).forEach(p => md += `- ${p}\n`);
      });
    }

    if (nextSteps.length) {
      md += `## 💡 Hướng đi\n`;
      nextSteps.forEach(text => { splitToBranches(text).slice(0,2).forEach(p => md += `- ${p}\n`); });
    }

    if (tools.length) {
      md += `## 🔧 Công cụ\n- ${[...new Set(tools)].join(', ')}\n`;
    }

    renderMarkmap(container, md);
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi</div>';
    console.error(e);
  }
}
