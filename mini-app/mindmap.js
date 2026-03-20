// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v10 — Markmap with smart sub-branching
// Split long text into visual sub-branches, not raw data dumps
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
// Smart text splitting — break into sub-branches
// ═══════════════════════════════════════════════════

// Split a long text into meaningful phrases for sub-branches
function splitToBranches(text) {
  if (!text || text.length < 10) return text ? [text] : [];
  
  // Clean up
  text = text.replace(/\n+/g, ', ').replace(/\s+/g, ' ').trim();
  
  // Split by Vietnamese connectors and punctuation
  const parts = text.split(/[,;.!?\n]+|(?:\s+(?:và|nhưng|tuy nhiên|ngoài ra|bên cạnh đó|do đó|vì vậy|cũng|còn|hay|hoặc|nên|mà|rồi|thì)\s+)/i);
  
  // Filter: keep meaningful parts (>5 chars), trim, cap at 40 chars
  const cleaned = parts
    .map(p => p.trim())
    .filter(p => p.length > 4)
    .map(p => p.length > 40 ? p.substring(0, 38) + '…' : p);
  
  // If too many parts, take first 4
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  // If only 1 part and it's long, try splitting by space at ~half
  if (cleaned.length === 1 && cleaned[0].length > 35) {
    const mid = Math.floor(cleaned[0].length / 2);
    const spaceIdx = cleaned[0].indexOf(' ', mid - 5);
    if (spaceIdx > 10) {
      return [cleaned[0].substring(0, spaceIdx), cleaned[0].substring(spaceIdx + 1)];
    }
  }
  return cleaned.length ? cleaned : [text.length > 40 ? text.substring(0, 38) + '…' : text];
}

// Create markdown sub-branches from text
function mdBranches(text, depth) {
  const prefix = '#'.repeat(depth) + ' '; // ## or ###
  const bullet = '- ';
  const parts = splitToBranches(text);
  
  if (parts.length <= 1) {
    return bullet + (parts[0] || '') + '\n';
  }
  // Multiple parts → each becomes a bullet
  return parts.map(p => bullet + p + '\n').join('');
}

function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

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

  if (d.tinh_cach) { md += `## 🧩 Tính cách\n`; md += mdBranches(d.tinh_cach, 3); }
  if (d.so_thich) { md += `## ⭐ Sở thích\n`; md += mdBranches(d.so_thich, 3); }
  if (d.ton_giao) md += `## 🙏 Tôn giáo\n- ${Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao}\n`;
  if (d.du_dinh) { md += `## 🎯 Dự định\n`; md += mdBranches(d.du_dinh, 3); }
  if (d.quan_diem) { md += `## 🌟 Quan điểm\n`; md += mdBranches(d.quan_diem, 3); }
  if (d.chuyen_cu) { md += `## 📖 Câu chuyện\n`; md += mdBranches(d.chuyen_cu, 3); }
  if (d.luu_y) { md += `## ⚠️ Lưu ý\n`; md += mdBranches(d.luu_y, 3); }

  const noi = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noi.length) { md += `## 📍 Nơi sống\n`; noi.forEach(v => md += `- ${short(v,30)}\n`); }

  if (md.trim() === `# ${name}`) md += `## 📋 Chưa có dữ liệu\n`;
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TAB 2: Thu thập — Ministry insight
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

    // ── Gather insights by CATEGORY (not by source) ──
    const issues = [];     // van_de from TV + khai_thac from BB
    const feelings = [];   // phan_hoi from TV + phan_ung from BB
    const approach = [];   // tuong_tac from BB + diem_hai from TV
    const nextSteps = [];  // de_xuat from TV + de_xuat_cs from BB
    const noteInsights = []; // notes from user
    const tools = [];      // ten_cong_cu from TV

    tvs.forEach((r, i) => {
      const c = r.content || {};
      if (c.van_de && c.van_de.trim()) issues.push(c.van_de.trim());
      if (c.phan_hoi && c.phan_hoi.trim()) feelings.push(c.phan_hoi.trim());
      if (c.diem_hai && c.diem_hai.trim()) approach.push(c.diem_hai.trim());
      if (c.de_xuat && c.de_xuat.trim()) nextSteps.push(c.de_xuat.trim());
      if (c.ten_cong_cu && c.ten_cong_cu.trim()) tools.push(c.ten_cong_cu.trim());
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      if (c.khai_thac && c.khai_thac.trim()) issues.push(c.khai_thac.trim());
      if (c.phan_ung && c.phan_ung.trim()) feelings.push(c.phan_ung.trim());
      if (c.tuong_tac && c.tuong_tac.trim()) approach.push(c.tuong_tac.trim());
      if (c.de_xuat_cs && c.de_xuat_cs.trim()) nextSteps.push(c.de_xuat_cs.trim());
    });

    nts.forEach(r => {
      const c = r.content || {};
      if (c.title && c.body && c.body.trim()) {
        noteInsights.push({ title: c.title, body: c.body.trim() });
      }
    });

    // ── BUILD MARKDOWN ──
    const name = p.full_name || 'Insight';
    let md = `# 🔍 ${name}\n`;

    // 🎯 Vấn đề trọng tâm (biggest branch — from van_de + khai_thac)
    if (issues.length) {
      md += `## 🎯 Cần chú ý\n`;
      issues.forEach(text => {
        // Each issue becomes a sub-branch with smart splitting
        const parts = splitToBranches(text);
        if (parts.length === 1) {
          md += `- ${parts[0]}\n`;
        } else {
          // First part = branch label, rest = sub-items
          md += `### ${short(parts[0], 30)}\n`;
          parts.slice(1).forEach(p => md += `- ${p}\n`);
        }
      });
    }

    // 💭 Phản hồi & Cảm xúc
    if (feelings.length) {
      md += `## 💭 Phản hồi\n`;
      feelings.forEach(text => {
        const parts = splitToBranches(text);
        parts.forEach(p => md += `- ${p}\n`);
      });
    }

    // 💕 Tương tác & Tiếp cận
    if (approach.length) {
      md += `## 🤝 Tương tác\n`;
      approach.forEach(text => {
        const parts = splitToBranches(text);
        parts.forEach(p => md += `- ${p}\n`);
      });
    }

    // 📌 Ghi chú (user's own notes — title as branch, body split into sub)
    if (noteInsights.length) {
      md += `## 📌 Ghi chú\n`;
      noteInsights.forEach(n => {
        md += `### ${short(n.title, 25)}\n`;
        const parts = splitToBranches(n.body);
        parts.forEach(p => md += `- ${p}\n`);
      });
    }

    // 💡 Hướng đi
    if (nextSteps.length) {
      md += `## 💡 Hướng đi\n`;
      nextSteps.forEach(text => {
        const parts = splitToBranches(text);
        parts.forEach(p => md += `- ${p}\n`);
      });
    }

    // 🔧 Công cụ
    if (tools.length) {
      md += `## 🔧 Công cụ\n`;
      tools.forEach(t => md += `- ${t}\n`);
    }

    // 📊 Tổng quan
    md += `## 📊 Tổng quan\n`;
    md += `- ${tvs.length} TV · ${bbs.length} BB · ${nts.length} note\n`;

    renderMarkmap(container, md);
  } catch(e) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--red);">❌ Lỗi</div>';
    console.error(e);
  }
}
