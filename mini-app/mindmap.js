// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v13 — Persistent Lacie Insight + Shared AI Chat
// ══════════════════════════════════════════════════════════════════════════════

var _mmCurrentType = 'info';
var _mmCache = {};

function switchMindmap(type, btn) {
  _mmCurrentType = type;
  document.querySelectorAll('#mindmapTab .chip').forEach(function(c){c.classList.remove('active');});
  if (btn) btn.classList.add('active');
  renderMindmap();
}

function renderMindmap() {
  var container = document.getElementById('mindmapContainer');
  if (!container || !currentProfileId) return;
  var p = allProfiles.find(function(x){return x.id===currentProfileId;});
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
  var parts = text.split(/[,;.!?\n]+|(?:\s+(?:v\u00e0|nh\u01b0ng|tuy nhi\u00ean|ngo\u00e0i ra|do \u0111\u00f3|v\u00ec v\u1eady|c\u0169ng|c\u00f2n|n\u00ean|m\u00e0|r\u1ed3i|th\u00ec)\s+)/i);
  var cleaned = parts.map(function(p){return p.trim();}).filter(function(p){return p.length > 4;}).map(function(p){return p.length > 38 ? p.substring(0,36)+'\u2026' : p;});
  if (cleaned.length > 4) return cleaned.slice(0, 4);
  return cleaned.length ? cleaned : [text.length > 38 ? text.substring(0,36)+'\u2026' : text];
}
function mdBranches(text) {
  var parts = splitToBranches(text);
  if (parts.length <= 1) return '- ' + (parts[0] || '') + '\n';
  return parts.map(function(p){return '- '+p+'\n';}).join('');
}
function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'\u2026'; }

// ═══════════════════════════════════════════════════
// OpenAI API KEY
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
  alert('Tong chi phi AI: ~' + Math.round(_aiGlobalCost * 25000) + 'd ($' + _aiGlobalCost.toFixed(4) + ')');
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
  if (id.length) { md += '## \ud83d\udc64 Nh\u00e2n th\u00e2n\n'; id.forEach(function(v){md += '- '+v+'\n';}); }
  var gd = [];
  if (d.hon_nhan) gd.push(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan);
  if (d.nguoi_quan_trong) gd.push('QT: '+d.nguoi_quan_trong);
  if (d.nguoi_than) gd.push(short(d.nguoi_than,35));
  if (gd.length) { md += '## \ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67 Gia \u0111\u00ecnh\n'; gd.forEach(function(v){md += '- '+v+'\n';}); }
  if (d.tinh_cach) { md += '## \ud83e\udde9 T\u00ednh c\u00e1ch\n'; md += mdBranches(d.tinh_cach); }
  if (d.so_thich) { md += '## \u2b50 S\u1edf th\u00edch\n'; md += mdBranches(d.so_thich); }
  if (d.ton_giao) md += '## \ud83d\ude4f T\u00f4n gi\u00e1o\n- '+(Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao)+'\n';
  if (d.du_dinh) { md += '## \ud83c\udfaf D\u1ef1 \u0111\u1ecbnh\n'; md += mdBranches(d.du_dinh); }
  if (d.quan_diem) { md += '## \ud83c\udf1f Quan \u0111i\u1ec3m\n'; md += mdBranches(d.quan_diem); }
  if (d.chuyen_cu) { md += '## \ud83d\udcd6 C\u00e2u chuy\u1ec7n\n'; md += mdBranches(d.chuyen_cu); }
  if (d.luu_y) { md += '## \u26a0\ufe0f L\u01b0u \u00fd\n'; md += mdBranches(d.luu_y); }
  var noi = [d.dia_chi, d.que_quan].filter(Boolean);
  if (noi.length) { md += '## \ud83d\udccd N\u01a1i s\u1ed1ng\n'; noi.forEach(function(v){md += '- '+short(v,30)+'\n';}); }
  if (md.trim() === '# '+name) md += '## \ud83d\udccb Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u\n';
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TAB 2: Lacie Insight — with Supabase persistence
// ═══════════════════════════════════════════════════

async function renderCollectMM(container, p) {
  // 1. Check memory cache
  if (_mmCache[p.id]) { renderMarkmap(container, _mmCache[p.id]); return; }

  // 2. Check Supabase for saved mindmap
  container.style.height = 'auto'; container.style.overflow = 'auto';
  container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text3);">\u23f3 \u0110ang t\u1ea3i...</div>';
  try {
    var r = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.ai_mindmap&select=id,content&order=created_at.desc&limit=1');
    var rows = await r.json();
    if (rows.length && rows[0].content && rows[0].content.markdown) {
      var saved = rows[0].content.markdown;
      _mmCache[p.id] = saved;
      renderMarkmap(container, saved);
      return;
    }
  } catch(e) { console.warn('Load mindmap:', e); }

  // 3. No saved result — show button
  container.innerHTML = '<div style="text-align:center;padding:40px;">' +
    '<div style="font-size:36px;margin-bottom:8px;">\ud83e\udd16</div>' +
    '<div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:6px;">Lacie Insight</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:16px;">Ph\u00e2n t\u00edch to\u00e0n b\u1ed9 h\u1ed3 s\u01a1 b\u1eb1ng AI</div>' +
    '<button onclick="runAIAnalysis()" style="padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(124,106,247,0.3);">\ud83d\udd0d Ph\u00e2n t\u00edch ngay</button>' +
    '</div>';
}

async function runAIAnalysis() {
  var container = document.getElementById('mindmapContainer');
  var p = allProfiles.find(function(x){return x.id===currentProfileId;});
  if (!container || !p) return;
  var apiKey = getOpenAIKey();
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">\ud83e\udd16 AI \u0111ang ph\u00e2n t\u00edch...<br><small style="color:var(--text3);">10-20 gi\u00e2y</small></div>';
  container.style.height = 'auto';
  try {
    var r1 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.tu_van&select=content,created_at&order=created_at.asc');
    var r2 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.bien_ban&select=content,created_at&order=created_at.asc');
    var r3 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.note&select=content,created_at&order=created_at.asc');
    var tvs = await r1.json(), bbs = await r2.json(), nts = await r3.json();
    var d = window._currentInfoSheet || {};
    if (!tvs.length && !bbs.length && !nts.length && !Object.keys(d).length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">\ud83d\udccb Ch\u01b0a c\u00f3 d\u1eef li\u1ec7u</div>';
      return;
    }
    var context = 'TRAI QUA: '+(p.full_name||'N/A')+'\nGIAI DOAN: '+(p.phase||'chakki')+'\n\n';
    if (Object.keys(d).length) {
      context += 'PHIEU THONG TIN:\n';
      ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu'].forEach(function(k){ if(d[k]) context += k+': '+(Array.isArray(d[k])?d[k].join(', '):d[k])+'\n'; });
      context += '\n';
    }
    tvs.forEach(function(r,i){ var c=r.content||{}; context+='--- TV LAN '+(c.lan_thu||(i+1))+' ---\n'; ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    bbs.forEach(function(r,i){ var c=r.content||{}; context+='--- BB BUOI '+(c.buoi_thu||(i+1))+' ---\n'; ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    nts.forEach(function(r){ var c=r.content||{}; if(c.title||c.body) context+='--- GHI CHU: '+(c.title||'')+' ---\n'+(c.body||'')+'\n\n'; });

    var sysPrompt = LACIE_SYSTEM_PROMPT + '\n\n' +
      '=== NHI\u1ec6M V\u1ee4: T\u1ea0O MINDMAP ===\n' +
      'Ph\u00e2n t\u00edch TO\u00c0N B\u1ed8 th\u00f4ng tin h\u1ed3 s\u01a1 v\u00e0 t\u1ea1o mindmap Markdown.\n\n' +
      'QUY T\u1eaeC \u0110\u1ecaNH D\u1ea0NG:\n' +
      '- Output CH\u1ec8 l\u00e0 Markdown, KH\u00d4NG gi\u1ea3i th\u00edch g\u00ec th\u00eam\n' +
      '- # cho root (t\u00ean tr\u00e1i qu\u1ea3), ## nh\u00e1nh ch\u00ednh, ### nh\u00e1nh ph\u1ee5, - cho l\u00e1\n' +
      '- M\u1ed7i node t\u1ed1i \u0111a 35 k\u00fd t\u1ef1, PH\u1ea2I c\u00f3 d\u1ea5u ti\u1ebfng Vi\u1ec7t \u0111\u1ea7y \u0111\u1ee7\n' +
      '- T\u1ed1i \u0111a 6 nh\u00e1nh ch\u00ednh, m\u1ed7i nh\u00e1nh 3-4 m\u1ee5c con, t\u1ed5ng max 30 nodes\n\n' +
      'L\u01af\u1ee4U \u00dd V\u1ec0 V\u1ecf B\u1eccC (Concept):\n' +
      '- V\u1ecf b\u1ecdc l\u00e0 t\u00ean t\u1ed5 ch\u1ee9c/ch\u01b0\u01a1ng tr\u00ecnh m\u00e0 NDD d\u1ef1ng l\u00ean \u0111\u1ec3 che gi\u1ea5u m\u1ee5c \u0111\u00edch h\u1ecdc KT. V\u00ed d\u1ee5: "H\u1ecdc vi\u1ec7n t\u00e2m l\u00fd", "CLB k\u1ef9 n\u0103ng s\u1ed1ng".\n' +
      '- Enneagram, MBTI, t\u00e2m linh, t\u00f4n gi\u00e1o, \u0111\u1eb7c \u0111i\u1ec3m c\u00e1 nh\u00e2n c\u1ee7a tr\u00e1i qu\u1ea3 KH\u00d4NG PH\u1ea2I l\u00e0 v\u1ecf b\u1ecdc.\n' +
      '- N\u1ebfu trong d\u1eef li\u1ec7u KH\u00d4NG c\u00f3 th\u00f4ng tin r\u00f5 r\u00e0ng v\u1ec1 v\u1ecf b\u1ecdc: ghi "\u0110ang d\u00f9ng: Ch\u01b0a r\u00f5" ho\u1eb7c "Ch\u01b0a c\u00f3 th\u00f4ng tin". KH\u00d4NG T\u1ef0 \u0110I\u1ec0N b\u1eefa.\n\n' +
      '6 NH\u00c1NH B\u1eaeT BU\u1ed8C:\n' +
      '## \ud83d\udccb T\u1ed5ng quan \u2014 Giai \u0111o\u1ea1n, ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch, v\u1ecf b\u1ecdc NDD (n\u1ebfu c\u00f3)\n' +
      '## \ud83c\udfaf V\u1ea5n \u0111\u1ec1 & T\u00e2m l\u00fd \u2014 V\u1ea5n \u0111\u1ec1 s\u00e2u xa + c\u1ea3m x\u00fac hi\u1ec7n t\u1ea1i\n' +
      '## \ud83d\udc8e \u0110i\u1ec3m h\u00e1i tr\u00e1i \u2014 \u0110i\u1ec3m ch\u1ea1m c\u1ea3m x\u00fac. N\u1ebfu thi\u1ebfu: "C\u1ea7n khai th\u00e1c th\u00eam"\n' +
      '## \ud83d\udcd6 Li\u00ean k\u1ebft KT \u2014 C\u00e2u chuy\u1ec7n/l\u1eddi d\u1ea1y Kinh th\u00e1nh. CH\u1ec8 t\u1eeb BB tr\u1edf \u0111i\n' +
      '## \ud83e\udd1d Chi\u1ebfn l\u01b0\u1ee3c \u2014 C\u00e1ch ti\u1ebfp c\u1eadn ph\u00f9 h\u1ee3p giai \u0111o\u1ea1n\n' +
      '## \u26a1 H\u00e0nh \u0111\u1ed9ng ti\u1ebfp \u2014 B\u01b0\u1edbc k\u1ebf ti\u1ebfp r\u00f5 r\u00e0ng\n\n' +
      'NGUY\u00caN T\u1eaeC: Ch\u1ec9 d\u1ef1a tr\u00ean d\u1eef li\u1ec7u th\u1ef1c t\u1ebf. Kh\u00f4ng b\u1ecba. N\u1ebfu thi\u1ebfu -> "Ch\u01b0a c\u00f3 th\u00f4ng tin".\n' +
      'QUAN TR\u1eccNG: To\u00e0n b\u1ed9 output PH\u1ea2I c\u00f3 d\u1ea5u ti\u1ebfng Vi\u1ec7t \u0111\u1ea7y \u0111\u1ee7.';

    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: [{role:'system',content:sysPrompt},{role:'user',content:context}], temperature: 0.3, max_tokens: 1000 })
    });
    if (!res.ok) { var err = await res.json().catch(function(){return {};}); throw new Error(err.error?err.error.message:'API '+res.status); }
    var data = await res.json();
    var md = (data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '').trim();
    if (!md || md.charAt(0) !== '#') throw new Error('AI response invalid');
    var u = data.usage || {};
    trackCost((u.prompt_tokens||0)/1e6*0.40 + (u.completion_tokens||0)/1e6*1.60);
    _mmCache[p.id] = md;
    renderMarkmap(container, md);
    saveAIMindmap(p.id, md);
  } catch(e) {
    console.error('AI Mindmap error:', e);
    container.style.height = 'auto';
    container.innerHTML = '<div style="padding:20px;text-align:center;">' +
      '<div style="color:var(--red);font-weight:700;margin-bottom:6px;">\u274c L\u1ed7i ph\u00e2n t\u00edch</div>' +
      '<div style="font-size:11px;color:var(--text3);margin-bottom:12px;">'+(e.message||'L\u1ed7i')+'</div>' +
      '<button onclick="runAIAnalysis()" style="padding:8px 16px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-size:12px;cursor:pointer;">\ud83d\udd04 Th\u1eed l\u1ea1i</button>' +
      '</div>';
  }
}

async function saveAIMindmap(profileId, md) {
  try {
    // Check existing
    var r = await sbFetch('/rest/v1/records?profile_id=eq.'+profileId+'&record_type=eq.ai_mindmap&select=id&order=created_at.desc&limit=1');
    var rows = await r.json();
    if (rows.length) {
      await sbFetch('/rest/v1/records?id=eq.'+rows[0].id, {
        method: 'PATCH',
        headers: { 'Content-Type':'application/json', 'Prefer':'return=minimal' },
        body: JSON.stringify({ content: { markdown: md } })
      });
    } else {
      await sbFetch('/rest/v1/records', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', 'Prefer':'return=minimal' },
        body: JSON.stringify({ profile_id: profileId, record_type: 'ai_mindmap', content: { markdown: md } })
      });
    }
  } catch(e) { console.warn('Save mindmap:', e); }
}

function clearMindmapCache(profileId) {
  if (profileId) delete _mmCache[profileId];
  else Object.keys(_mmCache).forEach(function(k){delete _mmCache[k];});
  // Also delete from Supabase so next analysis is fresh
  if (profileId) {
    sbFetch('/rest/v1/records?profile_id=eq.'+profileId+'&record_type=eq.ai_mindmap', { method:'DELETE' }).catch(function(){});
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// AI CHAT — Shared per profile, stored in Supabase
// ══════════════════════════════════════════════════════════════════════════════
var _aiChatHistory = [], _aiChatContext = '', _aiChatProfileId = null, _aiChatRecordId = null;

function escChat(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderChatBubbles(msgBox) {
  var html = '<div class="ai-msg ai-msg-system">Tr\u1ee3 l\u00fd AI cho h\u1ed3 s\u01a1 n\u00e0y. M\u1ecdi ng\u01b0\u1eddi c\u00f9ng th\u1ea5y.</div>';
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
      msgBox.innerHTML = '<div class="ai-msg ai-msg-system">\u23f3 \u0110ang t\u1ea3i...</div>';
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
  var ctx = 'H\u1eccC VI\u00caN: '+(p.full_name||'N/A')+' | '+(p.phase||'chakki')+'\n\n';
  if (Object.keys(d).length) {
    ctx += 'PHI\u1ebeU TT:\n';
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
      { role: 'system', content: LACIE_SYSTEM_PROMPT + '\n\nHO SO TRAI QUA HIEN TAI:\n' + context }
    ].concat(_aiChatHistory.slice(-8));
    var res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getOpenAIKey() },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: msgs, temperature: 0.4, max_tokens: 400 })
    });
    var el = document.getElementById('aiTyping'); if(el) el.remove();
    if (!res.ok) { var e = await res.json().catch(function(){return {};}); throw new Error(e.error?e.error.message:'API '+res.status); }
    var data = await res.json();
    var answer = (data.choices && data.choices[0] ? data.choices[0].message.content : 'Kh\u00f4ng c\u00f3 ph\u1ea3n h\u1ed3i');
    var u = data.usage || {};
    trackCost((u.prompt_tokens||0)/1e6*0.40 + (u.completion_tokens||0)/1e6*1.60);
    _aiChatHistory.push({ role: 'assistant', content: answer });
    renderChatBubbles(msgBox);
    saveChatToDB();
  } catch(e) {
    var el2 = document.getElementById('aiTyping'); if(el2) el2.remove();
    _aiChatHistory.pop();
    renderChatBubbles(msgBox);
    msgBox.innerHTML += '<div class="ai-msg ai-msg-system" style="color:var(--red);">\u274c '+escChat(e.message)+'</div>';
  }
  msgBox.scrollTop = msgBox.scrollHeight;
}

// Fullscreen toggle for mindmap & chat
function toggleFullscreen(elId) {
  var el = document.getElementById(elId);
  if (!el) return;
  if (el.classList.contains('ai-fullscreen')) {
    // Exit fullscreen
    el.classList.remove('ai-fullscreen');
    document.body.style.overflow = '';
    var closeBtn = document.getElementById('aiFsClose');
    if (closeBtn) closeBtn.remove();
    // Re-render mindmap at normal size
    if (elId === 'mindmapContainer') {
      el.style.height = '420px';
      var pid = currentProfileId;
      if (_mmCache[pid]) {
        setTimeout(function(){ renderMarkmap(el, _mmCache[pid]); }, 50);
      }
    }
  } else {
    // Enter fullscreen
    el.classList.add('ai-fullscreen');
    document.body.style.overflow = 'hidden';
    // Add close button
    var btn = document.createElement('button');
    btn.id = 'aiFsClose';
    btn.className = 'ai-fs-close';
    btn.innerHTML = '\u2715';
    btn.onclick = function() { toggleFullscreen(elId); };
    document.body.appendChild(btn);
    // Mindmap: re-render at full size
    if (elId === 'mindmapContainer') {
      el.style.height = '100vh';
      var pid2 = currentProfileId;
      if (_mmCache[pid2]) {
        setTimeout(function(){ renderMarkmap(el, _mmCache[pid2]); }, 100);
      }
    }
    // Chat: auto-open body + focus input
    if (elId === 'aiChatCard') {
      var body = document.getElementById('aiChatBody');
      if (body) body.style.display = 'flex';
      var inp = document.getElementById('aiChatInput');
      if (inp) setTimeout(function(){ inp.focus(); }, 150);
    }
  }
}

