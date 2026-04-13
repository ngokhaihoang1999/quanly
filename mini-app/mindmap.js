// ══════════════════════════════════════════════════════════════════════════════
// MINDMAP v13 — Persistent BB Support + Shared AI Chat
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
// UTILITIES (SMART FORMATTERS FOR MINDMAP)
// ═══════════════════════════════════════════════════
function formatNode(text, maxWidth) {
  if (!text) return '';
  text = String(text).replace(/\n+/g, ' ').trim();
  if (text.length <= maxWidth) return text;
  var words = text.split(' '), lines = [], cur = [], len = 0;
  for (var i=0; i<words.length; i++) {
    if (len + words[i].length > maxWidth) {
      if(cur.length) lines.push(cur.join(' '));
      cur = [words[i]]; len = words[i].length;
    } else {
      cur.push(words[i]); len += words[i].length + 1;
    }
  }
  if (cur.length) lines.push(cur.join(' '));
  return lines.join('<br>');
}

function mdSentences(text, limit) {
  if (!text) return '';
  if (Array.isArray(text)) text = text.join(', ');
  // Split securely without lookbehind for old Safari compatibility
  var sentences = text.match(/[^.!?\n]+[.!?\n]*/g);
  if (!sentences) return '- '+formatNode(text, limit||55)+'\n';
  var cleaned = sentences.map(function(s) { return s.trim(); }).filter(Boolean);
  if (cleaned.length === 0) return '';
  return cleaned.map(function(s) { return '- '+formatNode(s, limit||55)+'\n'; }).join('');
}

function short(t, n) { if(!t) return ''; t=t.replace(/\n/g,' ').trim(); return t.length<=n?t:t.substring(0,n-1)+'\u2026'; }

// ═══════════════════════════════════════════════════
// AI PROXY — calls Supabase Edge Function (key is server-side)
// ═══════════════════════════════════════════════════
async function callAIProxy(messages, opts = {}) {
  const model = opts.model || 'gpt-4.1-mini';
  const temperature = opts.temperature || 0.3;
  const max_tokens = opts.max_tokens || 1000;
  
  const res = await sbFetch('/functions/v1/ai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model, temperature, max_tokens })
  });
  
  if (!res.ok) {
    const err = await res.json().catch(function(){ return {}; });
    throw new Error(err.error || 'AI proxy error ' + res.status);
  }
  return await res.json();
}

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
// TAB 1: Ca nhan (SMART GROUPING)
// ═══════════════════════════════════════════════════
function renderInfoMM(container, p) {
  var d = window._currentInfoSheet || {};
  var name = p.full_name || 'Hồ sơ chưa có tên';
  var md = '# ' + name + '\n';
  
  // 1. Dinh vi xa hoi (Nhan than)
  var dm = [
    d.nam_sinh ? 'Sinh: '+d.nam_sinh : null,
    d.gioi_tinh ? 'Giới tính: '+d.gioi_tinh : null,
    d.nghe_nghiep ? 'Nghề: '+d.nghe_nghiep : null,
    d.hon_nhan ? 'Hôn nhân: '+(Array.isArray(d.hon_nhan)?d.hon_nhan.join(', '):d.hon_nhan) : null,
    d.quan_he_ndd ? 'Quan hệ với NDD: '+(Array.isArray(d.quan_he_ndd)?d.quan_he_ndd.join(', '):d.quan_he_ndd) : null,
    d.khong_gian_song ? 'Ở chung: '+(Array.isArray(d.khong_gian_song)?d.khong_gian_song.join(', '):d.khong_gian_song) : null,
    d.dia_chi ? 'Nơi ở hiện tại: '+d.dia_chi : null,
    d.que_quan ? 'Nhà ba mẹ (Quê): '+d.que_quan : null
  ].filter(Boolean);
  if (dm.length) {
    md += '## 🏛️ Nhân thân & Nền tảng\n';
    dm.forEach(function(v){ md += '- '+formatNode(v, 45)+'\n'; });
  }

  // 2. Gia Dinh (nguoi_than)
  var gd = '';
  if (d.nguoi_than) gd += '### 👨‍👩‍👧‍👦 Hoàn cảnh gia đình\n' + mdSentences(d.nguoi_than, 55);
  if (gd) md += '## 🏡 Gia đình & Hoàn cảnh\n' + gd;

  // 3. He tu truong (Ton giao, Quan diem)
  var tt_md = '';
  if (d.ton_giao) tt_md += '- **Tôn giáo:** '+(Array.isArray(d.ton_giao)?d.ton_giao.join(', '):d.ton_giao)+'\n';
  if (d.quan_diem) tt_md += mdSentences(d.quan_diem, 55);
  if (tt_md) md += '## ⚖️ Hệ tư tưởng & Niềm tin\n' + tt_md;

  // 4. Chieu sau noi tam (Tinh cach, so thich, du dinh)
  var tl = '';
  if (d.tinh_cach) tl += '### 🧩 Tính cách\n' + mdSentences(d.tinh_cach, 50);
  if (d.so_thich) tl += '### 🎨 Đam mê / Sở thích\n' + mdSentences(d.so_thich, 50);
  if (d.du_dinh) tl += '### 🚀 Khát vọng / Dự định\n' + mdSentences(d.du_dinh, 50);
  if (tl) md += '## 🌊 Chiều sâu nội tâm\n' + tl;

  // 5. Goc khuat (Chuyen cu, nguoi_quan_trong)
  var qk = '';
  if (d.nguoi_quan_trong) qk += '### 👥 Người quan trọng nhất\n' + mdSentences(d.nguoi_quan_trong, 50);
  if (d.chuyen_cu) qk += '### 📖 Câu chuyện dấu ấn\n' + mdSentences(d.chuyen_cu, 50);
  if (qk) md += '## ⛓️ Góc khuất & Ràng buộc\n' + qk;

  // 6. Canh bao
  if (d.luu_y) md += '## ⚠️ Lưu ý đặc biệt\n' + mdSentences(d.luu_y, 55);

  if (md.trim() === '# '+name) md += '## 📋 Trái quả này chưa có dữ liệu\n';
  renderMarkmap(container, md);
}

// ═══════════════════════════════════════════════════
// TAB 2: Hỗ trợ BB — with Supabase persistence
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

  // 3. No saved result — show button (or read-only message for guest)
  if (window.isGuestMode) {
    container.innerHTML = '<div style="text-align:center;padding:40px;">' +
      '<div style="font-size:36px;margin-bottom:8px;">📋</div>' +
      '<div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:6px;">Chưa có phân tích</div>' +
      '<div style="font-size:11px;color:var(--text3);">Hồ sơ này chưa được phân tích bởi AI.</div>' +
      '</div>';
    return;
  }
  container.innerHTML = '<div style="text-align:center;padding:40px;">' +
    '<div style="font-size:36px;margin-bottom:8px;">\ud83d\udc7c</div>' +
    '<div style="font-weight:700;font-size:14px;color:var(--text1);margin-bottom:6px;">Hỗ trợ BB</div>' +
    '<div style="font-size:11px;color:var(--text3);margin-bottom:16px;">Ph\u00e2n t\u00edch to\u00e0n b\u1ed9 h\u1ed3 s\u01a1 v\u1edbi Lacie</div>' +
    '<button onclick="runAIAnalysis()" style="padding:12px 28px;background:var(--accent);color:white;border:none;border-radius:var(--radius-sm);font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 4px 12px rgba(124,106,247,0.3);">\ud83d\udd0d Ph\u00e2n t\u00edch ngay</button>' +
    '</div>';
}

async function runAIAnalysis() {
  if (window.isGuestMode) { if (typeof showToast === 'function') showToast('🔒 Chế độ xem — không thể phân tích'); return; }
  var container = document.getElementById('mindmapContainer');
  var p = allProfiles.find(function(x){return x.id===currentProfileId;});
  if (!container || !p) return;
  container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);">\ud83d\udc7c AI \u0111ang ph\u00e2n t\u00edch...<br><small style="color:var(--text3);">10-20 gi\u00e2y</small></div>';
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
    var nddName = window._rolesDisplay?.ndd || 'chưa rõ';
    var tvvName = window._rolesDisplay?.tvv || 'chưa rõ';
    var gvbbName = window._rolesDisplay?.gvbb || 'chưa rõ';

    var context = 'Hồ sơ: '+(p.full_name||'N/A')+'\nGiai đoạn: '+(p.phase||'chakki')+'\nTình trạng Kinh Thánh: '+(p.is_kt_opened ? 'Đã mở KT' : 'Chưa mở KT')+'\nTrạng thái: '+(p.fruit_status==='dropout' ? 'Đã nghỉ học (Drop-out)' : p.fruit_status==='pause' ? 'Tạm dừng (Pause)' : 'Đang học (Alive)')+(p.dropout_reason ? '\nLý do: '+p.dropout_reason : '')+'\nNg\u01b0\u1eddi ph\u1ee5 tr\u00e1ch: \n'+'NDD: '+nddName+'\nTVV: '+tvvName+'\nGVBB: '+gvbbName+'\n\n';
    if (Object.keys(d).length) {
      context += 'PHIEU THONG TIN:\n';
      ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu'].forEach(function(k){ if(d[k]) context += k+': '+(Array.isArray(d[k])?d[k].join(', '):d[k])+'\n'; });
      context += '\n';
    }
    tvs.forEach(function(r,i){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; context+='--- TV LAN '+(c.lan_thu||(i+1))+(dt?' ('+dt+')':'')+' ---\n'; ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    bbs.forEach(function(r,i){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; context+='--- BB BUOI '+(c.buoi_thu||(i+1))+(dt?' ('+dt+')':'')+' ---\n'; ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(function(k){if(c[k])context+=k+': '+c[k]+'\n';}); context+='\n'; });
    nts.forEach(function(r){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; if(c.title||c.body) context+='--- GHI CHU'+(dt?' ('+dt+')':'')+': '+(c.title||'')+' ---\n'+(c.body||'')+'\n\n'; });

    var sysPrompt = LACIE_SYSTEM_PROMPT + '\n\n' +
      '=== NHIỆM VỤ: TẠO MINDMAP ===\n' +
      'Phân tích TOÀN BỘ thông tin hồ sơ và tạo mindmap Markdown.\n\n' +
      'QUY TẮC ĐỊNH DẠNG:\n' +
      '- Output CHỈ là Markdown, KHÔNG giải thích gì thêm\n' +
      '- # cho root (Họ Tên), ## nhánh chính, ### nhánh cấp 1, #### nhánh cấp 2 (dẫn chứng), - lá (kết luận/hướng đi).\n' +
      '- Hỗ trợ mở rộng 4 luồng. Luồng 4 (hoặc "-") LÀ KẾT LUẬN HOẶC HƯỚNG ĐI CHI TIẾT.\n' +
      '- TUYỆT ĐỐI KHÔNG DÙNG TÊN BIẾN TIẾNG ANH (Ví dụ KHÔNG dùng "is_kt_opened", "fruit_status"). Hãy dùng ngôn ngữ tự nhiên.\n' +
      '- Mỗi node ngắn gọn, PHẢI có dấu tiếng Việt đầy đủ\n\n' +
      'LƯU Ý CONCEPT:\n' +
      '- Concept là tên vỏ bọc tổ chức mà NDD dựng lên. Enneagram, MBTI KHÔNG PHẢI là concept.\n\n' +
      'LƯU Ý ĐIỂM HÁI TRÁI & KINH THÁNH:\n' +
      '- Điểm hái trái: Cần CHỈ MẶT ĐIỂM CHẠM. Từ điểm hái trái đó, phân tích SÂU: Kinh Thánh (KT) có thể GIÚP ĐƯỢC GÌ cho trái quả? (Tạo các nhánh con chi tiết để làm rõ ý này giúp GVBB dễ chuẩn bị).\n\n' +
      (p.fruit_status === 'dropout' || p.fruit_status === 'pause'
        ? 'CÁC NHÁNH (DROP-OUT):\n' +
          '## 📋 Tổng quan — Giai đoạn nghỉ, NGƯỜI PHỤ TRÁCH (GHI RÕ TÊN NDD, TVV, GVBB), lý do nghỉ\n' +
          '## ⚠️ Nguyên nhân tiềm năng — Vì sao nghỉ? Phân tích sâu\n' +
          '## 🚩 Dấu hiệu cảnh báo — Tín hiệu nhận ra sớm\n' +
          '## 💔 Điểm thất bại — Sai sót concept, bảo an, tốc độ?\n' +
          '## 💡 Bài học rút ra — Kinh nghiệm\n' +
          '## 🛠️ Hướng khắc phục — Cách làm tốt hơn kèm action cụ thể\n\n'
        : p.is_kt_opened
          ? 'CÁC NHÁNH (SAU MỞ KT):\n' +
            '## 📋 Tổng quan — Giai đoạn, NGƯỜI PHỤ TRÁCH (GHI RÕ TÊN NDD, TVV, GVBB)\n' +
            '## 📖 Cảm nhận KT — Phản ứng với KT, mức độ tiếp nhận\n' +
            '## 💎 Điểm hái trái — Xác định điểm hái trái. Phân tích: KT giúp được gì?\n' +
            '## 🛡️ Bảo an — Môi trường học, lý do che đậy, rủi ro\n' +
            '## 🤝 Chiến lược — Cách giúp cảm nhận KT tốt hơn\n' +
            '## ⚡ Hành động — Bước kế, phân công chuẩn bị Center\n\n'
          : 'CÁC NHÁNH (TRƯỚC MỞ KT):\n' +
            '## 📋 Tổng quan — Giai đoạn, NGƯỜI PHỤ TRÁCH (GHI RÕ TÊN NDD, TVV, GVBB), Concept hiện tại\n' +
            '## 🎯 Vấn đề & Tâm lý — Vấn đề sâu xa, cảm xúc, nhu cầu ẩn\n' +
            '## 💎 Điểm hái trái & Mở KT — Kết luận điểm hái trái. Viết rõ: KT giúp giải quyết nỗi đau đó thế nào?\n' +
            '## 🔓 Chuẩn bị mở KT — ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG (Thần tính, sự hợp tác) rất rõ. Kịch bản mở KT.\n' +
            '## 🛡️ Bảo an — Rủi ro lộ, tôn giáo trái quả ảnh hưởng gì?\n' +
            '## ⚡ Hành động — Bước kế tiếp cụ thể cho từng nhân sự (Ai làm gì)\n\n') +
      'NGUYÊN TẮC: Dựa vào dữ liệu. Nếu thiếu -> "Chưa rõ".\n' +
      'QUAN TRỌNG: Toàn bộ output PHẢI có dấu tiếng Việt.';

    var data = await callAIProxy(
      [{role:'system',content:sysPrompt},{role:'user',content:context}],
      { model: 'gpt-4.1-mini', temperature: 0.3, max_tokens: 1000 }
    );
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
  if (window.isGuestMode) { if (typeof showToast === 'function') showToast('🔒 Chế độ xem — không thể thao tác'); return; }
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
  var nddName = window._rolesDisplay?.ndd || 'chưa rõ';
  var tvvName = window._rolesDisplay?.tvv || 'chưa rõ';
  var gvbbName = window._rolesDisplay?.gvbb || 'chưa rõ';
  var ctx = 'Hồ sơ: '+(p.full_name||'N/A')+' | Giai đoạn: '+(p.phase||'chakki')+' | Tình trạng KT: '+(p.is_kt_opened ? 'Đã mở KT' : 'Chưa mở KT')+' | Trạng thái: '+(p.fruit_status==='dropout' ? 'Đã nghỉ học (Drop-out)' : p.fruit_status==='pause' ? 'Tạm dừng (Pause)' : 'Đang học (Alive)')+(p.dropout_reason ? ' | Lý do: '+p.dropout_reason : '')+' | Ngư\u1eddi ph\u1ee5 tr\u00e1ch: NDD:'+nddName+' TVV:'+tvvName+' GVBB:'+gvbbName+'\n\n';
  if (Object.keys(d).length) {
    ctx += 'PHI\u1ebeU TT:\n';
    ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu'].forEach(function(k){
      if (d[k]) ctx += k+': '+(Array.isArray(d[k])?d[k].join(', '):d[k])+'\n';
    });
    ctx += '\n';
  }
  tvs.forEach(function(r,i){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; ctx+='--- TV '+(c.lan_thu||(i+1))+(dt?' ('+dt+')':'')+' ---\n'; ['ten_cong_cu','van_de','phan_hoi','diem_hai','de_xuat'].forEach(function(k){if(c[k])ctx+=k+': '+c[k]+'\n';}); ctx+='\n'; });
  bbs.forEach(function(r,i){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; ctx+='--- BB '+(c.buoi_thu||(i+1))+(dt?' ('+dt+')':'')+' ---\n'; ['noi_dung','khai_thac','phan_ung','tuong_tac','de_xuat_cs'].forEach(function(k){if(c[k])ctx+=k+': '+c[k]+'\n';}); ctx+='\n'; });
  nts.forEach(function(r){ var c=r.content||{}; var dt=r.created_at?shinDate(r.created_at):''; if(c.title||c.body) ctx+='--- Note'+(dt?' ('+dt+')':'')+': '+(c.title||'')+' ---\n'+(c.body||'')+'\n\n'; });
  _aiChatContext = ctx;
  return ctx;
}

async function sendAIChat() {
  if (window.isGuestMode) { if (typeof showToast === 'function') showToast('🔒 Chế độ xem — không thể gửi tin nhắn'); return; }
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
    var data = await callAIProxy(msgs, { model: 'gpt-4.1-mini', temperature: 0.4, max_tokens: 400 });
    var el = document.getElementById('aiTyping'); if(el) el.remove();
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
      setTimeout(function(){ renderMindmap(); }, 50);
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
      setTimeout(function(){ renderMindmap(); }, 100);
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

