// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v11 — OpenAI-powered Ministry Insight
// Uses GPT-4.1-mini to analyze reports from a ministry manager perspective
// ══════════════════════════════════════════════════════════════════════════════

let _mmCurrentType = 'info';
const _mmCache = {}; // Cache AI responses per profile

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
// UTILITIES
// ═══════════════════════════════════════════════════
function splitToBranches(text) {
  if (!text || text.length < 10) return text ? [text] : [];
  text = text.replace(/\n+/g, ', ').replace(/\s+/g, ' ').trim();
  const parts = text.split(/[,;.!?\n]+|(?:\s+(?:và|nhưng|tuy nhiên|ngoài ra|do đó|vì vậy|cũng|còn|nên|mà|rồi|thì)\s+)/i);
  const cleaned = parts.map(p => p.trim()).filter(p => p.length > 4).map(p => p.length > 38 ? p.substring(0, 36) + '…' : p);
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  return cleaned.length ? cleaned : [text.length > 38 ? text.substring(0, 36) + '…' : text];
}

function mdBranches(text) {
  const parts = splitToBranches(text);
  if (parts.length <= 1) return '- ' + (parts[0] || '') + '\n';
  return parts.map(p => '- ' + p + '\n').join('');
}

function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

// ═══════════════════════════════════════════════════
// OpenAI API KEY management
// ═══════════════════════════════════════════════════
function getOpenAIKey() {
  return localStorage.getItem('cj_openai_key') || '';
}

function setOpenAIKey(key) {
  localStorage.setItem('cj_openai_key', key.trim());
}

function promptForKey(container) {
  container.style.height = 'auto';
  container.style.overflow = 'auto';
  container.innerHTML = `
    <div style="padding:20px;text-align:center;">
      <div style="font-size:28px;margin-bottom:8px;">🤖</div>
      <div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:4px;">AI Mindmap</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:14px;">Nhập OpenAI API Key để hệ thống phân tích</div>
      <input type="password" id="mmKeyInput" placeholder="sk-..." style="width:100%;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);color:var(--text1);font-size:13px;margin-bottom:10px;" />
      <div style="font-size:10px;color:var(--text3);margin-bottom:12px;">Model: gpt-4.1-mini · ~250đ/hồ sơ · Key lưu local</div>
      <button onclick="setOpenAIKey(document.getElementById('mmKeyInput').value);renderMindmap();" style="padding:10px 20px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-weight:700;font-size:13px;cursor:pointer;">✅ Lưu & Phân tích</button>
    </div>`;
}

// ═══════════════════════════════════════════════════
// TAB 1: Cá nhân (no AI needed)
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
// TAB 2: Thu thập — OpenAI analysis
// ═══════════════════════════════════════════════════

async function renderCollectMM(container, p) {
  const apiKey = getOpenAIKey();
  if (!apiKey) { promptForKey(container); return; }

  // Check cache — show if already analyzed
  const cacheKey = p.id;
  if (_mmCache[cacheKey]) {
    renderMarkmap(container, _mmCache[cacheKey]);
    return;
  }

  // Not cached — show button to trigger analysis (don't auto-call API)
  container.style.height = 'auto';
  container.style.overflow = 'auto';
  container.innerHTML = '<div style="text-align:center;padding:40px;">' +
    '<div style="font-size:36px;margin-bottom:8px;">🤖</div>' +
    '<div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:6px;">AI Insight</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:16px;">Phân tích toàn bộ hồ sơ bằng AI</div>' +
    '<button onclick="runAIAnalysis()" style="padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(124,106,247,0.3);">🔍 Phân tích ngay</button>' +
    '<div style="font-size:10px;color:var(--text3);margin-top:10px;">~250đ/hồ sơ · gpt-4.1-mini</div>' +
    '</div>';
  return;
}

// Separate function triggered by button click
async function runAIAnalysis() {
  const container = document.getElementById('mindmapContainer');
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!container || !p) return;
  const apiKey = getOpenAIKey();
  if (!apiKey) { promptForKey(container); return; }

  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">🤖 AI đang phân tích hồ sơ...<br><small style="color:var(--text3);">Có thể mất 10-20 giây</small></div>';
  container.style.height = 'auto';

  try {
    // Fetch all data
    const [tvR, bbR, ntR] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
    ]);
    const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();
    const d = window._currentInfoSheet || {};

    if (!tvs.length && !bbs.length && !nts.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">📋 Chưa có dữ liệu</div>';
      return;
    }

    // Build context for AI
    let context = `HỌC VIÊN: ${p.full_name || 'N/A'}\n`;
    context += `GIAI ĐOẠN: ${p.phase || 'chakki'}\n\n`;

    if (Object.keys(d).length > 0) {
      context += `PHIẾU THÔNG TIN:\n`;
      if (d.gioi_tinh) context += `Giới tính: ${d.gioi_tinh}\n`;
      if (d.nam_sinh) context += `Năm sinh: ${d.nam_sinh}\n`;
      if (d.nghe_nghiep) context += `Nghề: ${d.nghe_nghiep}\n`;
      if (d.tinh_cach) context += `Tính cách: ${d.tinh_cach}\n`;
      if (d.so_thich) context += `Sở thích: ${d.so_thich}\n`;
      if (d.ton_giao) context += `Tôn giáo: ${Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao}\n`;
      if (d.quan_diem) context += `Quan điểm tâm linh: ${d.quan_diem}\n`;
      if (d.luu_y) context += `Lưu ý: ${d.luu_y}\n`;
      context += '\n';
    }

    tvs.forEach((r, i) => {
      const c = r.content || {};
      context += `--- BÁO CÁO TƯ VẤN LẦN ${c.lan_thu||(i+1)} ---\n`;
      if (c.ten_cong_cu) context += `Công cụ: ${c.ten_cong_cu}\n`;
      if (c.van_de) context += `Vấn đề khai thác: ${c.van_de}\n`;
      if (c.phan_hoi) context += `Phản hồi trái: ${c.phan_hoi}\n`;
      if (c.diem_hai) context += `Điểm hái: ${c.diem_hai}\n`;
      if (c.de_xuat) context += `Đề xuất TVV: ${c.de_xuat}\n`;
      context += '\n';
    });

    bbs.forEach((r, i) => {
      const c = r.content || {};
      context += `--- BÁO CÁO BB BUỔI ${c.buoi_thu||(i+1)} ---\n`;
      if (c.noi_dung) context += `Nội dung: ${c.noi_dung}\n`;
      if (c.khai_thac) context += `Phát hiện mới: ${c.khai_thac}\n`;
      if (c.phan_ung) context += `Phản ứng: ${c.phan_ung}\n`;
      if (c.tuong_tac) context += `Tương tác: ${c.tuong_tac}\n`;
      if (c.de_xuat_cs) context += `Đề xuất chăm sóc: ${c.de_xuat_cs}\n`;
      context += '\n';
    });

    nts.forEach(r => {
      const c = r.content || {};
      if (c.title || c.body) {
        context += `--- GHI CHÚ: ${c.title||''} ---\n${c.body||''}\n\n`;
      }
    });

    // Call OpenAI
    const systemPrompt = `Bạn là trợ lý phân tích hồ sơ học viên cho người quản lý hoạt động truyền đạo của nhà thờ.
Nhiệm vụ: Phân tích TOÀN BỘ thông tin và tạo mindmap Markdown xúc tích.

QUY TẮC NGHIÊM NGẶT:
- Output CHỈNH là Markdown cho mindmap, KHÔNG giải thích gì thêm
- Dùng # cho root (tên học viên), ## cho nhánh chính, ### cho nhánh phụ, - cho lá
- Mỗi node tối đa 35 ký tự
- Tối đa 5-6 nhánh chính (##)
- Mỗi nhánh tối đa 3-4 mục con
- Tổng không quá 25 nodes

CÁC NHÁNH BẮT BUỘC:
## 🎯 Vấn đề cốt lõi — Những vấn đề sâu xa nhất ảnh hưởng đến bạn (gia đình, tâm lý, hoàn cảnh)
## 💭 Tâm lý hiện tại — Trạng thái cảm xúc, điểm mạnh/yếu tính cách
## 🤝 Cách tiếp cận — Gợi ý cụ thể cách lấy lòng và giúp đỡ bạn
## 💡 Hướng đi — Bước tiếp theo cần làm, cần khai thác thêm gì
## 🤖 Đề xuất hệ thống — Nhận xét tổng quan, cảnh báo, thời điểm phù hợp

QUAN TRỌNG: Phân tích từ GÓC NHÌN TRUYỀN ĐẠO — mục tiêu là hiểu bạn để đồng hành, giúp đỡ, và dẫn dắt bạn đến với đức tin. Chắt lọc insight, KHÔNG liệt kê thông tin raw.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context }
        ],
        temperature: 0.3,
        max_tokens: 800
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.removeItem('cj_openai_key');
        promptForKey(container);
        return;
      }
      throw new Error(err.error?.message || `API error ${res.status}`);
    }

    const data = await res.json();
    const md = (data.choices?.[0]?.message?.content || '').trim();

    if (!md || !md.startsWith('#')) {
      throw new Error('AI response invalid');
    }

    // Cache result
    _mmCache[p.id] = md;

    renderMarkmap(container, md);

  } catch(e) {
    console.error('AI Mindmap error:', e);
    container.style.height = 'auto';
    container.innerHTML = `<div style="padding:20px;text-align:center;">
      <div style="color:var(--red);font-weight:700;margin-bottom:6px;">❌ Lỗi phân tích</div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:12px;">${e.message||'Unknown error'}</div>
      <button onclick="_mmCache['${p.id}']=null;renderMindmap();" style="padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-size:12px;cursor:pointer;">🔄 Thử lại</button>
      <button onclick="localStorage.removeItem('cj_openai_key');renderMindmap();" style="padding:8px 16px;background:var(--surface2);color:var(--text2);border:1px solid var(--border);border-radius:var(--radius-sm);font-size:12px;cursor:pointer;margin-left:6px;">🔑 Đổi Key</button>
    </div>`;
  }
}

// Clear cache when switching profile
function clearMindmapCache(profileId) {
  if (profileId) delete _mmCache[profileId];
  else Object.keys(_mmCache).forEach(k => delete _mmCache[k]);
}

// ══════════════════════════════════════════════════════════════════════════════
// AI CHAT — Interactive Q&A about the profile
// ══════════════════════════════════════════════════════════════════════════════
let _aiChatHistory = [], _aiChatContext = '', _aiTotalCost = 0, _aiChatProfileId = null;

function toggleAIChat() {
  const body = document.getElementById('aiChatBody');
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
  if (body.style.display === 'block') {
    if (_aiChatProfileId !== currentProfileId) {
      _aiChatHistory = []; _aiChatContext = ''; _aiTotalCost = 0;
      _aiChatProfileId = currentProfileId;
      document.getElementById('aiChatMessages').innerHTML =
        '<div class="ai-msg ai-msg-system">Tôi là trợ lý AI. Hãy hỏi bất kỳ điều gì về hồ sơ này.</div>';
      updateCostDisplay();
    }
    document.getElementById('aiChatInput')?.focus();
  }
}

function updateCostDisplay() {
  const el = document.getElementById('aiChatCost');
  if (el) el.textContent = _aiTotalCost > 0 ? '~' + Math.round(_aiTotalCost * 25000) + 'đ' : '';
}

function escChat(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

async function buildChatContext() {
  if (_aiChatContext) return _aiChatContext;
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) return '';
  const [tvR, bbR, ntR] = await Promise.all([
    sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.tu_van&select=content,created_at&order=created_at.asc`),
    sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc`),
    sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=eq.note&select=content,created_at&order=created_at.asc`)
  ]);
  const tvs = await tvR.json(), bbs = await bbR.json(), nts = await ntR.json();
  const d = window._currentInfoSheet || {};
  let ctx = 'HỌC VIÊN: ' + (p.full_name||'N/A') + ' | Giai đoạn: ' + (p.phase||'chakki') + '\n\n';
  if (Object.keys(d).length) {
    ctx += 'PHIẾU THÔNG TIN:\n';
    ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu'].forEach(k => {
      if (d[k]) ctx += k + ': ' + (Array.isArray(d[k]) ? d[k].join(', ') : d[k]) + '\n';
    });
    ctx += '\n';
  }
  tvs.forEach((r, i) => {
    const c = r.content || {};
    ctx += '--- TV LẦN ' + (c.lan_thu||(i+1)) + ' ---\n';
    ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(k => { if (c[k]) ctx += k + ': ' + c[k] + '\n'; });
    ctx += '\n';
  });
  bbs.forEach((r, i) => {
    const c = r.content || {};
    ctx += '--- BB BUỔI ' + (c.buoi_thu||(i+1)) + ' ---\n';
    ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(k => { if (c[k]) ctx += k + ': ' + c[k] + '\n'; });
    ctx += '\n';
  });
  nts.forEach(r => {
    const c = r.content || {};
    if (c.title || c.body) ctx += '--- GHI CHÚ: ' + (c.title||'') + ' ---\n' + (c.body||'') + '\n\n';
  });
  _aiChatContext = ctx;
  return ctx;
}

async function sendAIChat() {
  const input = document.getElementById('aiChatInput');
  const msgBox = document.getElementById('aiChatMessages');
  if (!input || !msgBox) return;
  const q = input.value.trim();
  if (!q) return;
  const apiKey = getOpenAIKey();
  if (!apiKey) { alert('Chưa có API Key. Vào Mindmap > AI Insight để nhập.'); return; }
  input.value = '';
  msgBox.innerHTML += '<div class="ai-msg ai-msg-user">' + escChat(q) + '</div>';
  msgBox.innerHTML += '<div class="ai-typing" id="aiTyping"><span></span><span></span><span></span></div>';
  msgBox.scrollTop = msgBox.scrollHeight;
  try {
    const context = await buildChatContext();
    _aiChatHistory.push({ role: 'user', content: q });
    const msgs = [
      { role: 'system', content: 'Bạn là trợ lý AI cho người quản lý truyền đạo nhà thờ. Có hồ sơ học viên bên dưới. Trả lời ngắn gọn, TỐI ĐA 150 từ, tiếng Việt. Góc nhìn truyền đạo.\n\nHỒ SƠ:\n' + context },
      ..._aiChatHistory.slice(-6)
    ];
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: msgs, temperature: 0.4, max_tokens: 400 })
    });
    document.getElementById('aiTyping')?.remove();
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error?.message || 'API ' + res.status); }
    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content || 'Không có phản hồi';
    const u = data.usage || {};
    const cost = (u.prompt_tokens||0) / 1e6 * 0.40 + (u.completion_tokens||0) / 1e6 * 1.60;
    _aiTotalCost += cost;
    _aiChatHistory.push({ role: 'assistant', content: answer });
    msgBox.innerHTML += '<div class="ai-msg ai-msg-ai">' + escChat(answer) + '</div>';
    if (cost > 0) msgBox.innerHTML += '<div class="ai-msg-cost">~' + Math.round(cost * 25000) + 'đ</div>';
    updateCostDisplay();
  } catch(e) {
    document.getElementById('aiTyping')?.remove();
    msgBox.innerHTML += '<div class="ai-msg ai-msg-system" style="color:var(--red);">❌ ' + escChat(e.message) + '</div>';
  }
  msgBox.scrollTop = msgBox.scrollHeight;
}
