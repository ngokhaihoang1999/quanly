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
}`,

  hapja: AI_PARSE_PREFIX + `\n\nTrích xuất thông tin cho phiếu Check Hapja (thông tin ban đầu về trái quả mới) thành JSON. Chỉ điền field có dữ liệu:
{
  "hj_full_name": "họ và tên đầy đủ",
  "hj_birth_year": "năm sinh YYYY (4 chữ số)",
  "hj_gender": "Nam hoặc Nữ hoặc Khác",
  "hj_concept": "concept/lý do tiếp cận",
  "hj_hinh_thuc": "hình thức chakki (gặp trực tiếp, online...)",
  "hj_than_thiet": "Cao hoặc Trung bình hoặc Thấp (mức thân thiết)",
  "hj_noi_o": "nơi ở hiện tại",
  "hj_nghe_nghiep": "nghề nghiệp, nơi làm việc hoặc học tập",
  "hj_tinh_cach_cong_cu": "tính cách theo công cụ (TSH, hình vẽ...)",
  "hj_kntn": "Phản hồi hoặc Không phản hồi (kết nối qua tin nhắn)",
  "hj_than_tinh_co_khong": "Có hoặc Không hoặc Chưa khai thác (thần tính)",
  "hj_than_tinh_chi_tiet": "chi tiết thần tính",
  "hj_hoan_canh_hien_tai": "hoàn cảnh hiện tại",
  "hj_hoc_ki": "kì nghỉ hoặc học kì",
  "hj_noi_lo_lang": "nỗi lo lắng",
  "hj_su_quan_tam": "sự quan tâm, sở thích, kênh youtube xem...",
  "hj_sdt": "số điện thoại"
}`,

  btvn: AI_PARSE_PREFIX + `\n\nTrích xuất thông tin bài tập về nhà (BTVN) thành JSON. Từ hình ảnh hoặc text, liệt kê các câu hỏi (q) và câu trả lời của trái quả (a).
Lưu ý: "qas" là mảng danh sách các câu hỏi và câu trả lời.
{
  "qas": [
    {
      "q": "Câu hỏi 1",
      "a": "Câu trả lời 1"
    },
    {
      "q": "Câu hỏi 2",
      "a": "Câu trả lời 2"
    }
  ]
}`
};

// ── Open AI Parse Modal ─────────────────────────────────────────────────────

function openAIParseModal(formType) {
  if (window.isGuestMode) { showToast('🔒 Chế độ xem'); return; }

  // Remove existing modal if any
  const old = document.getElementById('aiParseModal');
  if (old) old.remove();

  const descriptions = {
    thong_tin: 'Dán text bất kỳ — đoạn giới thiệu, tin nhắn, ghi chú — AI sẽ tự bóc tách thông tin vào <b>Phiếu Thông tin</b>.',
    tu_van: 'Dán text bất kỳ — form TV, đoạn văn, ghi chú sau buổi tư vấn — AI sẽ tự bóc tách thông tin vào <b>Báo cáo Tư vấn</b>.',
    bien_ban: 'Dán text bất kỳ — ghi chú sau buổi học, nhận xét về HS — AI sẽ tự bóc tách thông tin vào <b>Báo cáo BB</b>.',
    chien_luoc: 'Dán text bất kỳ — ý tưởng tiếp cận, phân tích trái — AI sẽ tự bóc tách thông tin vào <b>Chiến lược</b>.',
    hapja: 'Dán text bất kỳ — ghi chú sau khi gặp trái mới, đoạn giới thiệu — AI sẽ tự bóc tách thông tin vào <b>Phiếu Check Hapja</b>.',
    btvn: 'Dán text hoặc chọn ảnh chụp (OCR) — tin nhắn, ảnh bài tập — AI sẽ tự trích xuất Câu hỏi & Câu trả lời.'
  };

  const placeholders = {
    thong_tin: 'Ví dụ: Em ấy tên Hoa, sinh năm 95, làm kế toán ở quận 7. Tính cách hướng nội, thích đọc sách self-help, chưa lập gia đình...',
    tu_van: 'Ví dụ: Lần 1, dùng Enneagram. Bạn ấy thuộc type 4, rất nhạy cảm. Khai thác được chuyện gia đình có mâu thuẫn. Phản hồi tích cực, muốn tìm hiểu thêm...',
    bien_ban: 'Ví dụ: Buổi 3, học về gia đình. HS chú ý lắng nghe, hỏi nhiều câu hỏi. Phát hiện HS có nỗi đau về mối quan hệ với ba. Buổi sau dự kiến học về tha thứ...',
    chien_luoc: 'Ví dụ: Quen qua CLB đọc sách. Bạn ấy đang gặp khó khăn về định hướng nghề nghiệp. Dự kiến dùng MBTI lần 1, khai thác sâu nỗi đau gia đình lần 2...',
    hapja: 'Ví dụ: Bạn tên Mai, sinh năm 2000, sinh viên ở Bình Thạnh. Quen qua bạn cùng lớp. Tính cách vui vẻ, thích xem phim. Hiện đang lo lắng về tương lai, chưa có định hướng rõ...',
    btvn: 'Ví dụ: Câu 1: Em thấy Đức Chúa Trời là ai? - Dạ là Đấng Tạo Hóa. Câu 2: Em nghĩ sao về tội lỗi? - Em thấy mình có nhiều lỗi lầm...'
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
    ${descriptions[formType] || ''}
  </div>
  <div class="field-group">
    <label>Dán text${formType === 'btvn' ? ' hoặc tải ảnh lên' : ''} vào đây</label>
    <textarea id="aiParseInput" placeholder="${placeholders[formType] || ''}"
      style="resize:vertical;min-height:140px;font-size:13px;line-height:1.5;"></textarea>
    ${formType === 'btvn' ? `<input type="file" id="aiParseImage" accept="image/*" style="margin-top:8px;font-size:12px;width:100%;" />` : ''}
  </div>
  <div id="aiParseStatus" style="display:none;padding:12px;text-align:center;border-radius:var(--radius-sm);margin-bottom:8px;"></div>
  <button class="save-btn" id="aiParseBtn" onclick="executeAIParse('${formType}')" style="background:linear-gradient(135deg,var(--accent),var(--accent2));">
    ✨ Phân tích bằng AI
  </button>
  <div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;font-size:11px;color:var(--text3);">
    <span>⏱ ~2-3 giây</span>
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

// ── Business Rule Validation ────────────────────────────────────────────────
// Ensures AI parse respects existing workflow constraints before filling forms

async function _validateAIParseRules(formType) {
  // Rule: BC TV requires Chốt TV for that session to exist
  if (formType === 'tu_van' && typeof currentProfileId !== 'undefined' && currentProfileId) {
    try {
      var sessRes = await sbFetch('/rest/v1/consultation_sessions?profile_id=eq.' + currentProfileId + '&select=session_number&order=session_number.desc&limit=1');
      var sessions = await sessRes.json();
      if (!sessions || sessions.length === 0) {
        showToast('⚠️ Chưa có Chốt TV nào. Hãy Chốt TV trước rồi mới viết Báo cáo!');
        return false;
      }
    } catch(e) { console.warn('AI validate TV rule:', e); }
  }

  // Rule: BC BB requires profile to be at least in tu_van phase (đã Lập Group)
  if (formType === 'bien_ban' && typeof currentProfileId !== 'undefined' && currentProfileId) {
    try {
      var p = (typeof allProfiles !== 'undefined') ? allProfiles.find(function(x){ return x.id === currentProfileId; }) : null;
      if (p) {
        var ph = p.phase || 'chakki';
        if (!['tu_van','bb','center','completed'].includes(ph)) {
          showToast('⚠️ Hồ sơ chưa ở giai đoạn BB. Cần Lập Group TV/BB trước!');
          return false;
        }
      }
    } catch(e) { console.warn('AI validate BB rule:', e); }
  }

  return true; // All rules pass
}

// ── Execute AI Parse ────────────────────────────────────────────────────────

async function executeAIParse(formType) {
  var textarea = document.getElementById('aiParseInput');
  var btn = document.getElementById('aiParseBtn');
  var status = document.getElementById('aiParseStatus');
  if (!textarea || !btn) return;

  var text = textarea.value.trim();
  var imageInput = document.getElementById('aiParseImage');
  var base64Image = null;
  
  if (imageInput && imageInput.files && imageInput.files[0]) {
    base64Image = await new Promise((resolve) => {
      var reader = new FileReader();
      reader.onload = function(e) { resolve(e.target.result); };
      reader.readAsDataURL(imageInput.files[0]);
    });
  }

  if (!text && !base64Image) { showToast('⚠️ Cần dán text hoặc chọn ảnh'); return; }
  if (text && text.length < 10 && !base64Image) { showToast('⚠️ Text quá ngắn, cần ít nhất vài câu'); return; }

  // Validate business rules before proceeding
  var rulesOk = await _validateAIParseRules(formType);
  if (!rulesOk) return;

  // Show loading
  btn.disabled = true;
  btn.textContent = '⌛ AI đang phân tích...';
  status.style.display = 'block';
  status.style.background = 'var(--bg2)';
  status.style.color = 'var(--text2)';
  status.innerHTML = '🔍 Đang gửi dữ liệu đến AI... (~2-5 giây)';

  try {
    var sysPrompt = AI_PARSE_PROMPTS[formType];
    if (!sysPrompt) throw new Error('Loại form không hợp lệ: ' + formType);

    var userContent = [];
    if (text) userContent.push({ type: "text", text: text });
    if (base64Image) {
      userContent.push({ type: "image_url", image_url: { url: base64Image } });
      sysPrompt += '\n\nPhân tích thông tin từ cả chữ và (nếu có) hình ảnh được cung cấp.';
    }
    // If only text, keep original string format just in case API wrapper prefers it
    var msgContent = base64Image ? userContent : text;

    var data = await callAIProxy([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: msgContent }
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
    } else if (formType === 'btvn') {
      filledCount = fillRecordModal('btvn', json);
    } else if (formType === 'chien_luoc') {
      filledCount = fillStrategyForm(json);
    } else if (formType === 'hapja') {
      filledCount = fillHapjaForm(json);
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
    if (type === 'btvn') {
      if (json.qas && Array.isArray(json.qas)) {
        var container = document.getElementById('btvn_qa_container');
        if (container) {
          container.innerHTML = ''; // clear all
          json.qas.forEach(function(qa) {
            if (typeof addBTVNQA === 'function') addBTVNQA();
            var blocks = container.querySelectorAll('.qa-block');
            var last = blocks[blocks.length - 1];
            if (last) {
              var qInput = last.querySelector('.btvn-q');
              var aInput = last.querySelector('.btvn-a');
              if (qInput) { qInput.value = qa.q || ''; _highlightField(qInput); }
              if (aInput) { aInput.value = qa.a || ''; _highlightField(aInput); }
              count++;
            }
          });
        }
      }
    } else {
      Object.keys(json).forEach(function(key) {
        if (json[key] && _setField(key, json[key])) count++;
      });
    }
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

// ── Fill Hapja (Check Hapja form in createHapjaModal) ───────────────────────

function fillHapjaForm(json) {
  // Ensure the Hapja modal is open
  var modal = document.getElementById('createHapjaModal');
  if (!modal || !modal.classList.contains('open')) {
    if (typeof openCreateHapjaModal === 'function') openCreateHapjaModal();
  }

  var count = 0;
  var fillFn = function() {
    var filled = 0;
    // Text / number / tel fields
    var textFields = ['hj_full_name', 'hj_birth_year', 'hj_concept', 'hj_hinh_thuc',
      'hj_noi_o', 'hj_nghe_nghiep', 'hj_tinh_cach_cong_cu',
      'hj_than_tinh_chi_tiet', 'hj_hoan_canh_hien_tai', 'hj_hoc_ki',
      'hj_noi_lo_lang', 'hj_su_quan_tam', 'hj_sdt'];
    textFields.forEach(function(key) {
      if (json[key] && _setField(key, json[key])) filled++;
    });

    // Select fields
    var selectFields = ['hj_gender', 'hj_than_thiet', 'hj_kntn', 'hj_than_tinh_co_khong'];
    selectFields.forEach(function(key) {
      if (json[key] && _setField(key, json[key])) filled++;
    });

    return filled;
  };

  // If modal just opened, wait for DOM
  if (!modal || !modal.classList.contains('open')) {
    setTimeout(fillFn, 200);
    return Object.values(json).filter(function(v) { return v && v !== ''; }).length;
  } else {
    return fillFn();
  }
}
