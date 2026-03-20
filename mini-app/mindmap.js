// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v12 — OpenAI-powered + Shared AI Chat via Supabase
// ══════════════════════════════════════════════════════════════════════════════

let _mmCurrentType = 'info';
const _mmCache = {};

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
  var parts = text.split(/[,;.!?\n]+|(?:\s+(?:và|nhưng|tuy nhiên|ngoài ra|do đó|vì vậy|cũng|còn|nên|mà|rồi|thì)\s+)/i);
  var cleaned = parts.map(function(p){return p.trim();}).filter(function(p){return p.length > 4;}).map(function(p){return p.length > 38 ? p.substring(0,36)+'…' : p;});
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  return cleaned.length ? cleaned : [text.length > 38 ? text.substring(0,36)+'…' : text];
}

function mdBranches(text) {
  var parts = splitToBranches(text);
  if (parts.length <= 1) return '- ' + (parts[0] || '') + '\n';
  return parts.map(function(p){return '- '+p+'\n';}).join('');
}

function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'…'; }

// ═══════════════════════════════════════════════════
// OpenAI API KEY — hardcoded
// ═══════════════════════════════════════════════════
var _AI_KEY = atob('c2stcHJvai10bExCMkZZTVc4NzF3bHV4enZfZkw5SXd6QVRRdkJfMUIzQ0lyOWdrdkZfZlBUSkdqaHdYN1pnNnMwWm1Va05vOXdzX2EtYzBPWlQzQmxia0ZKMllzM0kwdHcyMEs1bGY3NHZpZ1BhSlNkRE1TaXhVM2hLSnhQTkxid0J6eTZlNEkyTWhENzlwcmFZbVFEcVlHZy1sZEtmUXlBa0E=');
function getOpenAIKey() { return _AI_KEY; }

// Admin cost tracking
var _aiGlobalCost = parseFloat(localStorage.getItem('cj_ai_cost') || '0');
function trackCost(cost) {
  _aiGlobalCost += cost;
  localStorage.setItem('cj_ai_cost', _aiGlobalCost.toFixed(6));
}
function showAdminCost() {
  var vnd = Math.round(_aiGlobalCost * 25000);
  alert('Tong chi phi AI: ~' + vnd + 'd ($' + _aiGlobalCost.toFixed(4) + ')');
}
var _adminTapCount = 0, _adminTapTimer = null;
document.addEventListener('DOMContentLoaded', function() {
  var t = document.getElementById('mmTitle');
  if (t) t.addEventListener('click', function() {
    _adminTapCount++; clearTimeout(_adminTapTimer);
    _adminTapTimer = setTimeout(function(){_adminTapCount=0;}, 2000);
    if (_adminTapCount >= 5) { _adminTapCount = 0; showAdminCost(); }
  });
});

// ═══════════════════════════════════════════════════
// TAB 1: Ca nhan
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  var d = window._currentInfoSheet || {};
  var name = p.full_name || 'Trai qua';
  var md = '# ' + name + '\n';

  var id = [d.gioi_tinh||p.gender, d.nam_sinh?'Sinh '+d.nam_sinh:null, d.nghe_nghiep].filter(Boolean);
  if (id.length) { md += '## 👤 Nhân thân\n'; id.forEach(function(v){md += '- '+v+'\n';}); }

  var gd = [];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('QT: '+d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(short(d.nguoi_than,35));
  if (gd.length) { md += '## 👨‍👩‍👧 Gia đình\n'; gd.forEach(function(v){md += '- '+v+'\n';}); }

  if (d.tinh_cach) { md += '## 🧩 Tính cách\n'; md += mdBranches(d.tinh_cach); }
  if (d.so_thich) { md += '## ⭐ Sở thích\n'; md += mdBranches(d.so_thich); }
  if (d.ton_giao) md += '## 🙏 Tôn giáo\n- '+(Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao)+'\n';
  if (d.du_dinh) { md += '## 🎯 Dự định\n'; md += mdBranches(d.du_dinh); }
  if (d.quan_diem) { md += '## 🌟 Quan điểm\n'; md += mdBranches(d.quan_diem); }
  if (d.chuyen_cu) { md += '## 📖 Câu chuyện\n'; md += mdBranches(d.chuyen_cu); }
  if (d.luu_y) { md += '## ⚠️ Lưu ý\n'; md += mdBranches(d.luu_y); }

  var noi = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noi.length) { md += '## 📍 Nơi sống\n'; noi.forEach(function(v){md += '- '+short(v,30)+'\n';}); }

  if (md.trim() === '# '+name) md += '## 📋 Chưa có dữ liệu\n';
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TAB 2: AI Insight — button-triggered
// ═══════════════════════════════════════════════════

async function renderCollectMM(container, p) {
  if (_mmCache[p.id]) { renderMarkmap(container, _mmCache[p.id]); return; }
  container.style.height = 'auto'; container.style.overflow = 'auto';
  container.innerHTML = '<div style="text-align:center;padding:40px;">' +
    '<div style="font-size:36px;margin-bottom:8px;">🤖</div>' +
    '<div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:6px;">AI Insight</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:16px;">Phân tích toàn bộ hồ sơ bằng AI</div>' +
    '<button onclick="runAIAnalysis()" style="padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(124,106,247,0.3);">🔍 Phân tích ngay</button>' +
    '</div>';
}

async function runAIAnalysis() {
  var container = document.getElementById('mindmapContainer');
  var p = allProfiles.find(function(x){return x.id===currentProfileId;});
  if (!container || !p) return;
  var apiKey = getOpenAIKey();
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">🤖 AI đang phân tích...<br><small style="color:var(--text3);">10-20 giây</small></div>';
  container.style.height = 'auto';
  try {
    var r1 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.tu_van&select=content,created_at&order=created_at.asc');
    var r2 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc');
    var r3 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.note&select=content,created_at&order=created_at.asc');
    var tvs = await r1.json(), bbs = await r2.json(), nts = await r3.json();
    var d = window._currentInfoSheet || {};
    if (!tvs.length && !bbs.length && !nts.length) { container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">📋 Chưa có dữ liệu</div>'; return; }
    var context = 'HỌC VIÊN: '+(p.full_name||'N/A')+'\nGIAI ĐOẠN: '+(p.phase||'chakki')+'\n\n';
    if (Object.keys(d).length) {
      context += 'PHIẾU THÔNG TIN:\n';
      ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y'].forEach(function(k){ if(d[k]) context += k+': '+(Array.isArray(d[k])?d[k].join(', '):d[k])+'\n'; });
      context += '\n';
    }
    tvs.forEach(function(r,i){ var c=r.content||{}; context+='--- TV LẦN '+(c.lan_thu||(i+1))+' ---\n'; ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    bbs.forEach(function(r,i){ var c=r.content||{}; context+='--- BB BUỔI '+(c.buoi_thu||(i+1))+' ---\n'; ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    nts.forEach(function(r){ var c=r.content||{}; if(c.title||c.body) context+='--- GHI CHÚ: '+(c.title||'')+' ---\n'+(c.body||'')+'\n\n'; });

    var sysPrompt = 'Bạn là trợ lý phân tích hồ sơ học viên cho người quản lý hoạt động truyền đạo của nhà thờ.\n'+
      'Nhiệm vụ: Phân tích TOÀN BỘ thông tin và tạo mindmap Markdown xúc tích.\n\n'+
      'QUY TẮC NGHIÊM NGẶT:\n- Output CHỈNH là Markdown cho mindmap, KHÔNG giải thích gì thêm\n'+
      '- Dùng # cho root, ## cho nhánh chính, ### cho nhánh phụ, - cho lá\n'+
      '- Mỗi node tối đa 35 ký tự\n- Tối đa 5-6 nhánh chính\n- Mỗi nhánh tối đa 3-4 mục con\n- Tổng không quá 25 nodes\n\n'+
      'CÁC NHÁNH BẮT BUỘC:\n## 🎯 Vấn đề cốt lõi\n## 💭 Tâm lý hiện tại\n## 🤝 Cách tiếp cận\n## 💡 Hướng đi\n## 🤖 Đề xuất\n\n'+
      'QUAN TRỌNG: Góc nhìn TRUYỀN ĐẠO — hiểu, giúp đỡ, dẫn dắt. Chắt lọc insight, KHÔNG liệt kê raw.';

    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: [{role:'system',content:sysPrompt},{role:'user',content:context}], temperature: 0.3, max_tokens: 800 })
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); throw new Error(err.error?err.error.message:'API '+res.status); }
    var data = await res.json();
    var md = (data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '').trim();
    if (!md || md.charAt(0) !== '#') throw new Error('AI response invalid');
    var u = data.usage || {};
    trackCost((u.prompt_tokens||0)/1e6*0.40 + (u.completion_tokens||0)/1e6*1.60);
    _mmCache[p.id] = md;
    renderMarkmap(container, md);
  } catch(e) {
    console.error('AI Mindmap error:', e);
    container.style.height = 'auto';
    container.innerHTML = '<div style="padding:20px;text-align:center;">' +
      '<div style="color:var(--red);font-weight:700;margin-bottom:6px;">❌ Lỗi phân tích</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">'+(e.message||'Lỗi')+'</div>' +
      '<button onclick="runAIAnalysis()" style="padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-size:12px;cursor:pointer;">🔄 Thử lại</button>' +
      '</div>';
  }
}

function clearMindmapCache(profileId) {
  if (profileId) delete _mmCache[profileId];
  else Object.keys(_mmCache).forEach(function(k){delete _mmCache[k];});
}

// ══════════════════════════════════════════════════════════════════════════════
// AI CHAT — Shared per profile, stored in Supabase
// ══════════════════════════════════════════════════════════════════════════════
var _aiChatHistory = [], _aiChatContext = '', _aiChatProfileId = null, _aiChatRecordId = null;

function escChat(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderChatBubbles(msgBox) {
  var html = '<div class="ai-msg ai-msg-system">Trợ lý AI cho hồ sơ này. Mọi người cùng thấy.</div>';
  _aiChatHistory.forEach(function(m) {
    if (m.role === 'user') html += '<div class="ai-msg ai-msg-user">' + escChat(m.content) + '</div>';
    else if (m.role === 'assistant') html += '<div class="ai-msg ai-msg-ai">' + escChat(m.content) + '</div>';
  });
  msgBox.innerHTML = html;
  msgBox.scrollTop = msgBox.scrollHeight;
}

async function toggleAIChat() {
  var body = document.getElementById('aiChatBody');
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
  if (body.style.display === 'block') {
    if (_aiChatProfileId !== currentProfileId) {
      _aiChatHistory = []; _aiChatContext = ''; _aiChatRecordId = null;
      _aiChatProfileId = currentProfileId;
      var msgBox = document.getElementById('aiChatMessages');
      msgBox.innerHTML = '<div class="ai-msg ai-msg-system">⏳ Đang tải...</div>';
      try {
        var r = await sbFetch('/rest/v1/records?profile_id=eq.'+currentProfileId+'&record_type=eq.ai_chat&select=id,content&order=created_at.desc&limit=1');
        var rows = await r.json();
        if (rows.length && rows[0].content && rows[0].content.messages) {
          _aiChatRecordId = rows[0].id;
          _aiChatHistory = rows[0].content.messages;
        }
      } catch(e) { console.warn('Load chat:', e); }
      renderChatBubbles(msgBox);
    }
    var inp = document.getElementById('aiChatInput');
    if (inp) inp.focus();
  }
}

async function saveChatToDB() {
  var payload = { messages: _aiChatHistory };
  try {
    if (_aiChatRecordId) {
      await sbFetch('/rest/v1/records?id=eq.'+_aiChatRecordId, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', 'Prefer':'return=minimal' },
        body: JSON.stringify({ content: payload })
      });
    } else {
      var r = await sbFetch('/rest/v1/records', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Prefer':'return=representation' },
        body: JSON.stringify({ profile_id: currentProfileId, record_type: 'ai_chat', content: payload })
      });
      var rows = await r.json();
      if (rows && rows.length) _aiChatRecordId = rows[0].id;
    }
  } catch(e) { console.warn('Save chat:', e); }
}

async function buildChatCtx() {
  if (_aiChatContext) return _aiChatContext;
  var p = allProfiles.find(function(x){return x.id===currentProfileId;});
  if (!p) return '';
  var r1 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.tu_van&select=content&order=created_at.asc');
  var r2 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.bien_ban&select=content&order=created_at.asc');
  var r3 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.note&select=content&order=created_at.asc');
  var tvs = await r1.json(), bbs = await r2.json(), nts = await r3.json();
  var d = window._currentInfoSheet || {};
  var ctx = 'HỌC VIÊN: '+(p.full_name||'N/A')+' | '+(p.phase||'chakki')+'\n\n';
  if (Object.keys(d).length) {
    ctx += 'PHIẾU TT:\n';
    ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu'].forEach(function(k){
      if (d[k]) ctx += k+': '+(Array.isArray(d[k])?d[k].join(', '):d[k])+'\n';
    });
    ctx += '\n';
  }
  tvs.forEach(function(r,i){ var c=r.content||{}; ctx+='--- TV '+(c.lan_thu||(i+1))+' ---\n'; ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(function(k){if(c[k])ctx+=k+': '+c[k]+'\n';}); ctx+='\n'; });
  bbs.forEach(function(r,i){ var c=r.content||{}; ctx+='--- BB '+(c.buoi_thu||(i+1))+' ---\n'; ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(function(k){if(c[k])ctx+=k+': '+c[k]+'\n';}); ctx+='\n'; });
  nts.forEach(function(r){ var c=r.content||{}; if(c.title||c.body) ctx+='--- Note: '+(c.title||'')+' ---\n'+(c.body||'')+'\n\n'; });
  _aiChatContext = ctx;
  return ctx;
}

async function sendAIChat() {
  var input = document.getElementById('aiChatInput');
  var msgBox = document.getElementById('aiChatMessages');
  if (!input || !msgBox) return;
  var q = input.value.trim();
  if (!q) return;
  input.value = '';
  _aiChatHistory.push({ role: 'user', content: q });
  renderChatBubbles(msgBox);
  msgBox.innerHTML += '<div class="ai-typing" id="aiTyping"><span></span><span></span><span></span></div>';
  msgBox.scrollTop = msgBox.scrollHeight;
  try {
    var context = await buildChatCtx();
    var msgs = [
      { role: 'system', content: 'Bạn là trợ lý AI cho người quản lý truyền đạo nhà thờ. Có hồ sơ học viên bên dưới. Trả lời ngắn gọn, TỐI ĐA 150 từ, tiếng Việt. Góc nhìn truyền đạo.\n\nHỒ SƠ:\n' + context }
    ].concat(_aiChatHistory.slice(-8));
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getOpenAIKey() },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: msgs, temperature: 0.4, max_tokens: 400 })
    });
    var el = document.getElementById('aiTyping'); if(el) el.remove();
    if (!res.ok) { var e = await res.json().catch(function(){return {};}); throw new Error(e.error?e.error.message:'API '+res.status); }
    var data = await res.json();
    var answer = (data.choices && data.choices[0] ? data.choices[0].message.content : 'Không có phản hồi');
    var u = data.usage || {};
    trackCost((u.prompt_tokens||0)/1e6*0.40 + (u.completion_tokens||0)/1e6*1.60);
    _aiChatHistory.push({ role: 'assistant', content: answer });
    renderChatBubbles(msgBox);
    saveChatToDB();
  } catch(e) {
    var el2 = document.getElementById('aiTyping'); if(el2) el2.remove();
    _aiChatHistory.pop();
    renderChatBubbles(msgBox);
    msgBox.innerHTML += '<div class="ai-msg ai-msg-system" style="color:var(--red);">❌ '+escChat(e.message)+'</div>';
  }
  msgBox.scrollTop = msgBox.scrollHeight;
}
