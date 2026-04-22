// ══════════════════════════════════════════════════════════════════════════════
// AI PARSE — Textarea Paste → GPT extract → Auto-fill Form
// Requires: callAIProxy() from mindmap.js, trackCost() from mindmap.js
// ══════════════════════════════════════════════════════════════════════════════

// ── System Prompts (strict anti-hallucination) ──────────────────────────────

const AI_PARSE_PREFIX = `Bạn là trợ lý trích xuất dữ liệu. Phân tích text sau và trả về JSON.
QUY TẮC BẮT BUỘC:
1. CHỈ trả JSON thuần, KHÔNG markdown, KHÔNG giải thích, KHÔNG bọc trong \`\`\`
2. Field KHÔNG CÓ dữ liệu → để "" (chuỗi rỗng)
3. TUYỆT ĐỐI KHÔNG BỊA thông tin không có trong text gốc
4. Giữ nguyên ngôn ngữ gốc (tiếng Việt)
5. Nếu text không liên quan đến form yêu cầu → trả {"_error":"Nội dung không phù hợp"}`;

const AI_PARSE_PROMPTS = {
  thong_tin: AI_PARSE_PREFIX + `\n\nTrích xuất thông tin cá nhân thành JSON. Chỉ điền field có dữ liệu:
{
  "t2_ho_ten": "họ và tên đầy đủ",
  "t2_gioi_tinh": "Nam hoặc Nữ hoặc Khác",
  "t2_nam_sinh": "năm sinh YYYY",
  "t2_nghe_nghiep": "nghề nghiệp",
  "t2_thoi_gian_lam_viec": "ca sáng/chiều/tối",
  "t2_sdt": "số điện thoại",
  "t2_dia_chi": "địa chỉ hiện tại",
  "t2_khung_ranh": "khung giờ rảnh",
  "t2_so_thich": "sở thích, đam mê",
  "t2_tinh_cach": "tính cách, khuynh hướng",
  "t2_du_dinh": "dự định, khát vọng",
  "t2_chuyen_cu": "câu chuyện cũ, dấu ấn",
  "t2_nguoi_than": "thông tin người thân, gia đình",
  "t2_nguoi_quan_trong": "người quan trọng nhất",
  "t2_quan_diem": "quan điểm sống, thế giới quan",
  "t2_concept": "concept tiếp cận, vỏ bọc",
  "t2_luu_y": "lưu ý đặc biệt, cảnh báo",
  "t2_ton_giao": "tôn giáo",
  "t2_hon_nhan": "tình trạng hôn nhân",
  "t2_hinh_thuc": "hình thức tiếp cận",
  "t2_ket_noi": "cách kết nối, quen biết",
  "t2_ghi_chu": "ghi chú bổ sung"
}`,

  tu_van: AI_PARSE_PREFIX + `\n\nTrích xuất thông tin báo cáo tư vấn (TV) thành JSON. Chỉ điền field có dữ liệu:
{
  "rm_lan_thu": "lần tư vấn thứ mấy (số)",
  "rm_ten_cong_cu": "công cụ tư vấn sử dụng (Enneagram, MBTI, OH Card, sách...)",
  "rm_ket_qua_test": "kết quả test công cụ nếu có",
  "rm_van_de": "vấn đề, nhu cầu, thông tin khai thác được",
  "rm_phan_hoi": "phản hồi, cảm nhận của trái quả sau tư vấn",
  "rm_diem_hai": "điểm hái trái (điểm chạm để dẫn dắt)",
  "rm_de_xuat": "đề xuất hướng tiếp cận tiếp theo"
}`,

  bien_ban: AI_PARSE_PREFIX + `\n\nTrích xuất thông tin báo cáo BB (buổi học Bible) thành JSON. Chỉ điền field có dữ liệu:
{
  "rm_buoi_thu": "buổi thứ mấy (số)",
  "rm_noi_dung": "nội dung buổi học",
  "rm_phan_ung": "phản ứng, cảm xúc của học sinh trong và sau buổi",
  "rm_khai_thac": "thông tin mới khai thác được về học sinh",
  "rm_tuong_tac": "tương tác đáng chú ý",
  "rm_de_xuat_cs": "đề xuất hướng chăm sóc tiếp theo",
  "rm_noi_dung_tiep": "nội dung dự kiến buổi tiếp theo"
}`,

  chien_luoc: AI_PARSE_PREFIX + `\n\nTrích xuất chiến lược tiếp cận thành JSON. Chỉ điền field có dữ liệu:
{
  "cl_concept": "concept/vỏ bọc tiếp cận",
  "cl_cach_quen": "cách quen biết",
  "cl_kho_khan": "khó khăn dự kiến",
  "cl_diem_hai": "điểm hái trái dự kiến",
  "cl_rao_can": "rào cản",
  "cl_tv1_cong_cu": "TV1 công cụ",
  "cl_tv1_muc_tieu": "TV1 mục tiêu",
  "cl_tv1_tam_long": "TV1 cây tâm lòng",
  "cl_tv1_khai_thac": "TV1 khai thác",
  "cl_tv1_dan_dat": "TV1 dẫn dắt sang TV2",
  "cl_tv2_cong_cu": "TV2 công cụ",
  "cl_tv2_muc_tieu": "TV2 mục tiêu",
  "cl_tv2_dao_sau": "TV2 đào sâu",
  "cl_tv2_chot_group": "TV2 chốt group",
  "cl_timeline": "timeline dự kiến",
  "cl_lich_gap": "lịch gặp",
  "cl_gvbb_du_kien": "GVBB dự kiến",
  "cl_ghi_chu": "ghi chú chiến lược",
  "cl_rui_ro": "rủi ro",
  "cl_phuong_an": "phương án dự phòng",
  "cl_nguoi_ho_tro": "người hỗ trợ"
}`
};

// ── Open AI Parse Modal ─────────────────────────────────────────────────────

function openAIParseModal(formType) {
  if (window.isGuestMode) { showToast('🔒 Chế độ xem'); return; }

  // Remove existing modal if any
  const old = document.getElementById('aiParseModal');
  if (old) old.remove();

  const labels = {
    thong_tin: 'Phiếu Thông tin',
    tu_van: 'Báo cáo Tư vấn',
    bien_ban: 'Báo cáo BB',
    chien_luoc: 'Chiến lược'
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'aiParseModal';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
<div class="modal" style="max-height:85vh;display:flex;flex-direction:column;">
  <div class="modal-handle"></div>
  <div class="modal-title">✨ AI nhập nhanh</div>
  <div style="font-size:12px;color:var(--text3);margin-bottom:12px;padding:8px 12px;background:var(--bg2);border-radius:var(--radius-sm);line-height:1.6;">
    Dán text bất kỳ — tin nhắn, ghi chú, đoạn giới thiệu — AI sẽ tự bóc tách thông tin vào <b>${labels[formType] || formType}</b>.
  </div>
  <div class="field-group">
    <label>Dán text vào đây</label>
    <textarea id="aiParseInput" placeholder="Ví dụ: Em ấy tên Hoa, sinh năm 95, làm kế toán ở quận 7. Tính cách hướng nội, thích đọc sách self-help..."
      style="resize:vertical;min-height:140px;font-size:13px;line-height:1.5;"></textarea>
  </div>
  <div id="aiParseStatus" style="display:none;padding:12px;text-align:center;border-radius:var(--radius-sm);margin-bottom:8px;"></div>
  <button class="save-btn" id="aiParseBtn" onclick="executeAIParse('${formType}')" style="background:linear-gradient(135deg,var(--accent),var(--accent2));">
    ✨ Phân tích bằng AI
  </button>
  <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text3);">
    <span>⏱ ~2-3 giây</span>
    <span>·</span>
    <span>~16đ/lần</span>
    <span>·</span>
    <span>🔒 AI không bịa thông tin</span>
  </div>
  <button onclick="document.getElementById('aiParseModal').remove()" style="background:none;border:none;color:var(--text2);font-size:13px;cursor:pointer;padding:8px;width:100%;text-align:center;margin-top:4px;">Đóng</button>
</div>`;

  document.body.appendChild(overlay);
  // Auto-focus textarea
  setTimeout(function() {
    var ta = document.getElementById('aiParseInput');
    if (ta) ta.focus();
  }, 150);
}

// ── Execute AI Parse ────────────────────────────────────────────────────────

async function executeAIParse(formType) {
  var textarea = document.getElementById('aiParseInput');
  var btn = document.getElementById('aiParseBtn');
  var status = document.getElementById('aiParseStatus');
  if (!textarea || !btn) return;

  var text = textarea.value.trim();
  if (!text) { showToast('⚠️ Dán text trước rồi bấm phân tích'); return; }
  if (text.length < 10) { showToast('⚠️ Text quá ngắn, cần ít nhất vài câu'); return; }

  // Show loading
  btn.disabled = true;
  btn.textContent = '⌛ AI đang phân tích...';
  status.style.display = 'block';
  status.style.background = 'var(--bg2)';
  status.style.color = 'var(--text2)';
  status.innerHTML = '🔍 Đang gửi text đến AI... (~2-3 giây)';

  try {
    var sysPrompt = AI_PARSE_PROMPTS[formType];
    if (!sysPrompt) throw new Error('Loại form không hợp lệ: ' + formType);

    var data = await callAIProxy([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: text }
    ], { temperature: 0.1, max_tokens: 800 });

    var raw = (data.choices && data.choices[0] && data.choices[0].message)
      ? data.choices[0].message.content.trim()
      : '';

    // Track cost
    var u = data.usage || {};
    trackCost((u.prompt_tokens || 0) / 1e6 * 0.40 + (u.completion_tokens || 0) / 1e6 * 1.60);

    // Parse JSON — strip markdown wrappers if GPT adds them
    var cleaned = raw.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
    var json;
    try {
      json = JSON.parse(cleaned);
    } catch(parseErr) {
      throw new Error('AI trả format lỗi. Hãy thử lại hoặc chỉnh sửa text cho rõ hơn.');
    }

    // Check for AI error response
    if (json._error) {
      status.style.background = 'rgba(248,113,113,0.1)';
      status.style.color = 'var(--red)';
      status.innerHTML = '⚠️ ' + json._error;
      btn.disabled = false;
      btn.textContent = '✨ Phân tích bằng AI';
      return;
    }

    // Close modal
    var modal = document.getElementById('aiParseModal');
    if (modal) modal.remove();

    // Fill form based on type
    var filledCount = 0;
    if (formType === 'thong_tin') {
      filledCount = fillInfoSheet(json);
    } else if (formType === 'tu_van') {
      filledCount = fillRecordModal('tu_van', json);
    } else if (formType === 'bien_ban') {
      filledCount = fillRecordModal('bien_ban', json);
    } else if (formType === 'chien_luoc') {
      filledCount = fillStrategyForm(json);
    }

    if (filledCount > 0) {
      showToast('✨ AI đã điền ' + filledCount + ' field — hãy kiểm tra trước khi lưu!');
      haptic('success');
    } else {
      showToast('⚠️ AI không tìm được thông tin phù hợp trong text');
    }

  } catch(e) {
    console.error('AI Parse error:', e);
    status.style.display = 'block';
    status.style.background = 'rgba(248,113,113,0.1)';
    status.style.color = 'var(--red)';
    status.innerHTML = '❌ ' + (e.message || 'Lỗi không xác định');
    btn.disabled = false;
    btn.textContent = '✨ Phân tích bằng AI';
  }
}

// ── Fill helpers ────────────────────────────────────────────────────────────

function _setField(elId, value) {
  if (!value || value === '') return false;
  var el = document.getElementById(elId);
  if (!el) return false;

  // Handle select elements
  if (el.tagName === 'SELECT') {
    // Try exact match first
    for (var i = 0; i < el.options.length; i++) {
      if (el.options[i].value === value || el.options[i].text === value) {
        el.selectedIndex = i;
        _highlightField(el);
        return true;
      }
    }
    // Try case-insensitive partial match
    var lower = value.toLowerCase();
    for (var j = 0; j < el.options.length; j++) {
      if (el.options[j].value.toLowerCase().includes(lower) ||
          el.options[j].text.toLowerCase().includes(lower)) {
        el.selectedIndex = j;
        _highlightField(el);
        return true;
      }
    }
    return false;
  }

  // Handle input/textarea
  el.value = value;
  _highlightField(el);
  return true;
}

function _highlightField(el) {
  el.style.outline = '2px solid var(--green, #22c55e)';
  el.style.outlineOffset = '-1px';
  el.style.transition = 'outline 0.3s';
  setTimeout(function() {
    el.style.outline = '';
    el.style.outlineOffset = '';
  }, 5000);
}

// ── Fill Thông tin (23 fields, directly on page) ────────────────────────────

function fillInfoSheet(json) {
  var count = 0;
  var fields = [
    't2_ho_ten', 't2_gioi_tinh', 't2_nam_sinh', 't2_nghe_nghiep',
    't2_thoi_gian_lam_viec', 't2_sdt', 't2_dia_chi', 't2_khung_ranh',
    't2_so_thich', 't2_tinh_cach', 't2_du_dinh', 't2_chuyen_cu',
    't2_nguoi_than', 't2_nguoi_quan_trong', 't2_quan_diem', 't2_concept',
    't2_luu_y', 't2_hinh_thuc', 't2_ket_noi', 't2_ghi_chu'
  ];

  // Also check select fields that need special handling
  var selectFields = ['t2_gioi_tinh'];
  // Also multi-value fields stored as arrays in some places
  var multiFields = ['t2_ton_giao', 't2_hon_nhan'];

  fields.forEach(function(key) {
    if (json[key] && _setField(key, json[key])) count++;
  });

  // Handle ton_giao and hon_nhan (might be checkboxes or text in different contexts)
  multiFields.forEach(function(key) {
    if (json[key] && _setField(key, json[key])) count++;
  });

  // Scroll to first filled field
  if (count > 0) {
    var first = fields.find(function(k) { return json[k]; });
    if (first) {
      var el = document.getElementById(first);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  return count;
}

// ── Fill BC TV / BC BB (inside modal) ───────────────────────────────────────

function fillRecordModal(type, json) {
  // First open the modal if not already open
  var modal = document.getElementById('addRecordModal');
  var isOpen = modal && modal.classList.contains('open');

  if (!isOpen) {
    // Open the record modal first, then fill after render
    if (typeof openAddRecordModal === 'function') {
      openAddRecordModal(type);
    }
  }

  // Use setTimeout to wait for modal DOM to render
  var count = 0;
  var fillFn = function() {
    Object.keys(json).forEach(function(key) {
      if (json[key] && _setField(key, json[key])) count++;
    });
    return count;
  };

  if (!isOpen) {
    // Modal just opened — wait for DOM
    setTimeout(fillFn, 200);
    // We can't return correct count synchronously, but the toast is shown from executeAIParse
    // Estimate count from json
    return Object.values(json).filter(function(v) { return v && v !== ''; }).length;
  } else {
    return fillFn();
  }
}

// ── Fill Chiến lược (strategy tab) ──────────────────────────────────────────

function fillStrategyForm(json) {
  var count = 0;
  Object.keys(json).forEach(function(key) {
    if (!json[key] || json[key] === '') return;
    // Set DOM value
    if (_setField(key, json[key])) {
      count++;
      // Also update in-memory strategy data for persistence
      if (typeof _saveStrategyField === 'function') {
        _saveStrategyField(key, json[key]);
      }
    }
  });

  // Open all sections that have filled fields so user can review
  if (count > 0 && typeof CL_SECTIONS !== 'undefined') {
    CL_SECTIONS.forEach(function(s) {
      var hasFilled = s.fields.some(function(f) { return json[f.key] && json[f.key] !== ''; });
      if (hasFilled) {
        var body = document.getElementById('cl_body_' + s.id);
        if (body && body.style.display === 'none') {
          if (typeof toggleStrategySection === 'function') toggleStrategySection(s.id);
        }
      }
    });
  }

  return count;
}
