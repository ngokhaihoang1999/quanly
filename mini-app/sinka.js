// ============ THẺ HỌC VIÊN — Thẻ học viên Center ============

// ── Vietnamese accent removal ──
function removeVietnamese(str) {
  if (!str) return '';
  return str.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^\w\s\-.,()]/g, '')
    .trim();
}

// ── Compact team label: "HCM2 · Nhóm 1 · Tổ 3" → "HCM2-N1T3" ──
function compactTeamLabel(unitStr) {
  if (!unitStr) return '';
  const parts = unitStr.split('·').map(s => s.trim());
  if (parts.length < 3) return removeVietnamese(unitStr).replace(/\s+/g, '');
  const area = parts[0].trim();
  const nhomMatch = parts[1].match(/(\d+)/);
  const toMatch = parts[2].match(/(\d+)/);
  const nNum = nhomMatch ? nhomMatch[1] : '';
  const tNum = toMatch ? toMatch[1] : '';
  return `${area}-N${nNum}T${tNum}`;
}

// ── Build filename for Word export ──
// Cú pháp: (HL) HoTen HS - HoTen NDD - ToNDD - KVSong.docx
function _buildSinkaFileName() {
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) return 'The_hoc_vien.docx';

  const hsName = removeVietnamese(p.full_name || '');
  
  // NDD info
  const nddCode = p.ndd_staff_code || '';
  const nddStaff = allStaff.find(s => s.staff_code === nddCode);
  const nddName = removeVietnamese(nddStaff?.full_name || nddCode);
  
  // Tổ NDD
  const nddUnit = getStaffUnit(nddCode);
  const toNDD = compactTeamLabel(nddUnit);
  
  // KV HS đang sống — from t2_dia_chi (field 7 Thông tin)
  const diaChiEl = document.getElementById('t2_dia_chi');
  const diaChi = diaChiEl?.value?.trim() || '';
  const kvSong = removeVietnamese(diaChi);
  
  // Detect "học lại"
  const hocLaiEl = document.getElementById('sk_hoc_lai');
  const hocLaiVal = hocLaiEl?.value?.trim() || '';
  const isHocLai = hocLaiVal && hocLaiVal !== 'Nhập học mới' && hocLaiVal !== '';
  const prefix = isHocLai ? '(HL) ' : '';
  
  // Build parts
  const parts = [hsName, nddName, toNDD, kvSong].filter(Boolean);
  return `${prefix}${parts.join(' - ')}.docx`;
}

// ── All Sinka field IDs ──
const SINKA_FIELDS = [
  // Section 1: NDD
  'sk_ngay_ghi_chep',
  'sk_ndd_ten_bo_kv_sdt', 'sk_ndd_ma_dinh_danh', 'sk_hinh_thuc_truyen_dao',
  'sk_moi_quan_he', 'sk_concept_thuoc_the', 'sk_concept_thuoc_linh',
  // Section 2: HS
  'sk_ten_gt_tuoi', 'sk_quoc_tich', 'sk_so_thich_sdt', 'sk_ngay_sinh',
  'sk_dia_chi', 'sk_noi_lam_viec', 'sk_lich_trinh', 'sk_hon_nhan',
  'sk_ban_khac_gioi', 'sk_hoc_lai',
  // Section 3: Gia đình
  'sk_thanh_vien_gd', 'sk_qua_trinh_truong_thanh', 'sk_muc_do_gd_can_thiep',
  // Section 4: Tính cách
  'sk_enneagram_mbti', 'sk_phu_hop_tinh_cach', 'sk_mua_tam_long',
  'sk_quan_tam_thuoc_the', 'sk_quan_tam_thuoc_linh',
  // Section 5: Tâm hướng Thần
  'sk_ton_giao', 'sk_giao_phai', 'sk_ly_do_theo_dao', 'sk_tin_than_linh',
  'sk_nhan_thuc_tin_nguong', 'sk_muc_do_quan_tam_kt',
  // Supplement: GVBB/NDD interview
  'sk_nguoi_trao_doi', 'sk_xac_nhan_center',
  'sk_gvbb_ten', 'sk_gvbb_concept_the', 'sk_gvbb_concept_linh',
  'sk_gvbb_ma_dinh_danh', 'sk_gvbb_ket_noi', 'sk_gvbb_lan_dau',
  'sk_la_ten', 'sk_la_concept_the', 'sk_la_concept_linh', 'sk_la_ket_noi', 'sk_la_lan_dau',
  'sk_la_khac',
  'sk_so_lan_bb', 'sk_ly_do_center', 'sk_8_9_thang',
  'sk_thu_gio_hoc', 'sk_bao_an_ai_biet', 'sk_chien_luoc_concept',
  'sk_dia_diem_zoom', 'sk_da_hoc_zoom', 'sk_du_kien_nhap_ngu',
  'sk_moi_nguy_hiem'
];

// ── Load Sinka: fetch stored data + auto-fill from existing sources ──
let _sinkaLoaded = false;
async function loadSinka(profileId) {
  if (!profileId) return;
  _sinkaLoaded = false;

  // Clear fields first
  SINKA_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  const p = allProfiles.find(x => x.id === profileId);

  // ── 1. Auto-fill from profiles + form_hanh_chinh + staff + roles ──
  try {
    await _autoFillSinka(profileId, p);
  } catch(e) { console.warn('Sinka auto-fill error:', e); }

  // ── 2. Load saved sk_* data (overrides auto-fill where user has edited) ──
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data`);
    const rows = await res.json();
    const d = rows?.[0]?.data || {};
    // Apply saved sk_* fields — these override auto-fill
    // Reset danh sách tự nhập khi load profile mới
    window._sinkaUserEditedFields = {};

    SINKA_FIELDS.forEach(id => {
      const savedVal = d[id];
      if (savedVal !== undefined && savedVal !== null && savedVal !== '') {
        const el = document.getElementById(id);
        if (el) {
          // Nếu giá trị đã lưu khác biệt với giá trị auto-fill ban đầu thì đánh dấu là tự nhập thủ công
          if (el.value !== savedVal && el.value !== '') {
            window._sinkaUserEditedFields[id] = true;
            el.style.borderLeft = '3px solid var(--accent, #7c6af7)';
          }
          el.value = savedVal;
        }
      }
    });
  } catch(e) { console.warn('loadSinka DB error:', e); }

  _sinkaLoaded = true;
  // Check for any cached AI Scan draft for this profile
  _updateDraftButton(profileId);
  // Auto-resize all text fields after data load
  setTimeout(function() {
    _autoResizeSinkaFields();
    // Take snapshot for unsaved changes detection
    if (typeof DirtyFormGuard !== 'undefined') DirtyFormGuard.snapshot('sinkaContent');
  }, 80);
}

// ── Auto-resize all Sinka text fields ──
function _autoResizeSinkaFields() {
  var container = document.getElementById('sinkaContent');
  if (!container) return;

  // 1. Convert <input type="text"> → <textarea> for auto-resize capability
  var inputs = container.querySelectorAll('input[type="text"]');
  inputs.forEach(function(inp) {
    var ta = document.createElement('textarea');
    ta.id = inp.id;
    ta.value = inp.value;
    ta.placeholder = inp.placeholder || '';
    ta.className = inp.className;
    ta.readOnly = inp.readOnly;
    ta.disabled = inp.disabled;
    // Copy border-left styling (user-edited indicator)
    if (inp.style.borderLeft) ta.style.borderLeft = inp.style.borderLeft;
    ta.style.resize = 'none';
    ta.style.overflow = 'hidden';
    ta.style.minHeight = '38px';
    ta.style.boxSizing = 'border-box';
    ta.rows = 1;
    inp.parentNode.replaceChild(ta, inp);
  });

  // 2. Auto-resize all textareas in sinka
  var allTas = container.querySelectorAll('textarea');
  allTas.forEach(function(ta) {
    ta.style.resize = 'none';
    ta.style.overflow = 'hidden';
    ta.style.boxSizing = 'border-box';
    if (!ta.style.minHeight) ta.style.minHeight = '38px';

    // Apply auto-resize
    _sinkaAutoSize(ta);

    // Bind input event if not already bound
    if (!ta._sinkaResizeBound) {
      ta._sinkaResizeBound = true;
      ta.addEventListener('input', function() { _sinkaAutoSize(this); });
    }
  });
}

function _sinkaAutoSize(ta) {
  ta.style.height = 'auto';
  var sh = ta.scrollHeight;
  ta.style.height = Math.max(sh, 38) + 'px';
}

// ── Auto-fill logic ──
async function _autoFillSinka(profileId, p) {
  if (!p) return;

  const nddCode = p.ndd_staff_code || '';
  const nddStaff = nddCode ? allStaff.find(s => s.staff_code === nddCode) : null;
  const gvbbCode = p.gvbb_staff_code || '';
  const gvbbStaff = gvbbCode && !gvbbCode.startsWith('tg:') ? allStaff.find(s => s.staff_code === gvbbCode) : null;

  // Get la roles from fruit_groups
  let laStaffCodes = [];
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs || []).forEach(fg => {
      (fg.fruit_roles || []).forEach(r => {
        if (r.role_type === 'la') laStaffCodes.push(r.staff_code);
      });
    });
  } catch(e) {}
  const laStaff = laStaffCodes.length ? allStaff.find(s => s.staff_code === laStaffCodes[0]) : null;

  // Get BB count
  let bbCount = 0;
  try {
    const bbRes = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.bien_ban&select=id`, { headers: { 'Prefer': 'count=exact' } });
    const countHeader = bbRes.headers.get('content-range');
    if (countHeader) {
      const match = countHeader.match(/\/(\d+)/);
      if (match) bbCount = parseInt(match[1]);
    } else {
      const bbRows = await bbRes.json();
      bbCount = bbRows?.length || 0;
    }
  } catch(e) {}

  // Get form_hanh_chinh data for cross-fill
  const v = id => document.getElementById(id)?.value?.trim() || '';
  // These may already be loaded by loadInfoSheet — read from DOM
  const t2_values = {
    ho_ten: v('t2_ho_ten') || p.full_name || '',
    gioi_tinh: v('t2_gioi_tinh') || p.gender || '',
    nam_sinh: v('t2_nam_sinh') || p.birth_year || '',
    sdt: v('t2_sdt') || p.phone_number || '',
    dia_chi: v('t2_dia_chi'),
    nghe_nghiep: v('t2_nghe_nghiep'),
    khung_ranh: v('t2_khung_ranh'),
    so_thich: v('t2_so_thich'),
    tinh_cach: v('t2_tinh_cach'),
    nguoi_than: v('t2_nguoi_than'),
    hinh_thuc: v('t2_hinh_thuc'),
    cong_cu: v('t2_concept'),
    ket_noi: v('t2_ket_noi'),
    hon_nhan: '',
    ton_giao: ''
  };
  // Chips → text
  try { t2_values.hon_nhan = getChipValues('chips_hon_nhan')?.join(', ') || ''; } catch(e) {}
  try { t2_values.ton_giao = getChipValues('chips_ton_giao')?.join(', ') || ''; } catch(e) {}

  // ── Fill fields ──
  const fill = (id, val) => {
    if (!val) return;
    const el = document.getElementById(id);
    if (el && !el.value) el.value = val;
  };

  // Date — Shin format (43.04.13)
  const today = new Date();
  const shinYear = today.getFullYear() - 1983;
  const shinDateStr = `${shinYear}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;
  fill('sk_ngay_ghi_chep', shinDateStr);

  // Section 1: NDD
  const nddUnit = nddCode ? getStaffUnit(nddCode) : '';
  const nddPhone = nddStaff?.phone || '';
  // sinka_info (điền sẵn trong Cá nhân hóa) ưu tiên hơn auto-generated
  const nddInfo = nddStaff?.sinka_info || [nddStaff?.full_name, nddUnit, nddPhone].filter(Boolean).join(' / ');
  fill('sk_ndd_ten_bo_kv_sdt', nddInfo);
  // Mã SCJ: lấy từ staff.scj_code (user tự nhập trong Cá nhân hoá)
  fill('sk_ndd_ma_dinh_danh', nddStaff?.scj_code || '');
  fill('sk_hinh_thuc_truyen_dao', t2_values.hinh_thuc);
  fill('sk_moi_quan_he', t2_values.ket_noi);
  fill('sk_concept_thuoc_the', t2_values.cong_cu);

  // Section 2: HS
  const tenGtTuoi = [t2_values.ho_ten, t2_values.gioi_tinh, t2_values.nam_sinh].filter(Boolean).join(' / ');
  fill('sk_ten_gt_tuoi', tenGtTuoi);
  fill('sk_quoc_tich', 'Việt Nam');
  const soThichSdt = [t2_values.so_thich, t2_values.sdt].filter(Boolean).join(' / ');
  fill('sk_so_thich_sdt', soThichSdt);
  fill('sk_ngay_sinh', t2_values.nam_sinh);
  fill('sk_dia_chi', t2_values.dia_chi);
  fill('sk_noi_lam_viec', t2_values.nghe_nghiep);
  fill('sk_lich_trinh', t2_values.khung_ranh);
  fill('sk_hon_nhan', t2_values.hon_nhan);

  // Section 3: Gia đình
  fill('sk_thanh_vien_gd', t2_values.nguoi_than);

  // Section 4: Tính cách
  fill('sk_enneagram_mbti', t2_values.tinh_cach);
  fill('sk_quan_tam_thuoc_the', t2_values.cong_cu);

  // Section 5: Tâm hướng Thần
  fill('sk_ton_giao', t2_values.ton_giao);

  // Supplement: GVBB
  if (gvbbStaff) {
    const gvbbUnit = getStaffUnit(gvbbCode);
    const gvbbPhone = gvbbStaff.phone || '';
    // sinka_info ưu tiên hơn auto-generated
    fill('sk_gvbb_ten', gvbbStaff.sinka_info || [gvbbStaff.full_name, gvbbUnit, gvbbPhone].filter(Boolean).join(' / '));
    // Mã SCJ GVBB: từ staff.scj_code
    fill('sk_gvbb_ma_dinh_danh', gvbbStaff?.scj_code || '');
  } else if (gvbbCode && gvbbCode.startsWith('tg:')) {
    // Unregistered GVBB — show display name from roles
    const display = window._rolesDisplay?.gvbb || gvbbCode;
    fill('sk_gvbb_ten', display);
  }

  // Supplement: Lá
  if (laStaff) {
    const laUnit = getStaffUnit(laStaffCodes[0]);
    const laPhone = laStaff.phone || '';
    fill('sk_la_ten', [laStaff.full_name, laUnit, laPhone].filter(Boolean).join(' / '));
  }

  // Supplement: BB count
  if (bbCount > 0) {
    fill('sk_so_lan_bb', String(bbCount));
  }
}

// ── Save Sinka: merge sk_* into form_hanh_chinh ──
async function saveSinka() {
  if (!currentProfileId) return;

  // 1. Fetch existing form_hanh_chinh data
  let existingData = {};
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}&select=data`);
    const rows = await res.json();
    existingData = rows?.[0]?.data || {};
  } catch(e) {}

  // 2. Build sk_* data from form
  const sinkaData = {};
  SINKA_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    sinkaData[id] = el?.value || '';
  });

  // 3. Merge: keep existing t2_* keys, update sk_* keys
  const merged = { ...existingData, ...sinkaData };

  // 4. Save
  try {
    await sbFetch('/rest/v1/form_hanh_chinh', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ profile_id: currentProfileId, data: merged })
    });
    showToast('✅ Đã lưu Thẻ học viên!');
    if (typeof DirtyFormGuard !== 'undefined') DirtyFormGuard.snapshot('sinkaContent');
  } catch(e) {
    console.error('saveSinka error:', e);
    showToast('❌ Lỗi khi lưu Thẻ học viên');
  }
}

// ── Copy Sinka to clipboard ──
function copySinka() {
  const v = id => document.getElementById(id)?.value?.trim() || '—';
  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = p?.full_name || '';

  const text = `⬜️ Thẻ học viên
Ngày ghi chép: ${v('sk_ngay_ghi_chep')}

1. Người dẫn dắt:

1) Tên/Bộ/Khu vực/Số liên lạc: ${v('sk_ndd_ten_bo_kv_sdt')}
2) ❗️Mã định danh trong SCJ: ${v('sk_ndd_ma_dinh_danh')}
3) Hình thức truyền đạo: ${v('sk_hinh_thuc_truyen_dao')}
4) Mối quan hệ với trái quả: ${v('sk_moi_quan_he')}
5) Concept thuộc thể: ${v('sk_concept_thuoc_the')}
6) Concept thuộc linh: ${v('sk_concept_thuoc_linh')}

2. Thông tin cơ bản của học viên

1) Tên/Giới tính/Tuổi: ${v('sk_ten_gt_tuoi')}
2) Quốc tịch: ${v('sk_quoc_tich')}
3) Sở thích/Sở trường/Số liên lạc: ${v('sk_so_thich_sdt')}
4) Ngày tháng năm sinh: ${v('sk_ngay_sinh')}
5) Địa chỉ nhà (Địa chỉ đang sống): ${v('sk_dia_chi')}
6) Nơi làm việc (Công việc, Vị trí): ${v('sk_noi_lam_viec')}
7) Lịch trình: ${v('sk_lich_trinh')}
8) Tình trạng hôn nhân: ${v('sk_hon_nhan')}
9) Có bạn khác giới không / Thời gian chơi: ${v('sk_ban_khac_gioi')}
10) Có học lại hay không?: ${v('sk_hoc_lai')}

3. Gia đình/Bối cảnh trưởng thành:
1) Các thành viên trong gia đình: ${v('sk_thanh_vien_gd')}
2) Quá trình trưởng thành, hoàn cảnh gia đình: ${v('sk_qua_trinh_truong_thanh')}
3) Mức độ gia đình can thiệp đến học viên: ${v('sk_muc_do_gd_can_thiep')}

4. Tính cách:
1) Khuynh hướng (Enneagram, MBTI): ${v('sk_enneagram_mbti')}
2) Khuynh hướng sẽ phù hợp với tính cách: ${v('sk_phu_hop_tinh_cach')}
3) Những yếu tố có thể mua được tấm lòng: ${v('sk_mua_tam_long')}
4) Mối quan tâm và lo lắng thuộc thể: ${v('sk_quan_tam_thuoc_the')}
5) Mối quan tâm và lo lắng thuộc linh: ${v('sk_quan_tam_thuoc_linh')}

5. Tâm hướng Thần
1) Tôn giáo: ${v('sk_ton_giao')}
2) Giáo phái/tên nhà thờ/thời gian theo đạo/chức trách: ${v('sk_giao_phai')}
3) Lý do bắt đầu theo đạo: ${v('sk_ly_do_theo_dao')}
4) Có tin vào sự tồn tại của thần linh hay không?: ${v('sk_tin_than_linh')}
5) Nhận thức về tín ngưỡng, Cơ đốc giáo, tôn giáo: ${v('sk_nhan_thuc_tin_nguong')}
6) Mức độ quan tâm đến Kinh Thánh: ${v('sk_muc_do_quan_tam_kt')}

🔸 Hạng mục ghi chép bổ sung khi phỏng vấn GVBB, NDD, Lá

1. Người sẽ trao đổi với đội ngũ khai giảng: ${v('sk_nguoi_trao_doi')}
Đã xác nhận học center chưa?: ${v('sk_xac_nhan_center')}

2. Thông tin GVBB
1) Tên/Bộ/Khu vực/Số liên lạc: ${v('sk_gvbb_ten')}
2) Concept thuộc thể: ${v('sk_gvbb_concept_the')}
3) Concept thuộc linh: ${v('sk_gvbb_concept_linh')}
4) ❗️Mã số định danh tại SCJ: ${v('sk_gvbb_ma_dinh_danh')}
5) Phương pháp kết nối: ${v('sk_gvbb_ket_noi')}
6) Thời điểm lần đầu gặp: ${v('sk_gvbb_lan_dau')}

3. Lá
1) Tên/Bộ/Khu vực/Số liên lạc: ${v('sk_la_ten')}
2) Concept thuộc thể: ${v('sk_la_concept_the')}
3) Concept thuộc linh: ${v('sk_la_concept_linh')}
4) Phương pháp kết nối: ${v('sk_la_ket_noi')}
5) Thời điểm lần đầu gặp: ${v('sk_la_lan_dau')}

4. Lá khác: ${v('sk_la_khac')}

5. Thông tin xác nhận
1) Số lần BB (Tên bài học gần nhất): ${v('sk_so_lan_bb')}
2) Lý do mong muốn học center (Điểm hái trái): ${v('sk_ly_do_center')}
3) Đề cập quá trình học kéo dài 8~9 tháng: ${v('sk_8_9_thang')}
4) Thứ và thời gian sẽ học: ${v('sk_thu_gio_hoc')}
5) Bảo an — ai đã biết: ${v('sk_bao_an_ai_biet')}
6) Chiến lược concept với người xung quanh: ${v('sk_chien_luoc_concept')}
7) Địa điểm sẽ học qua Zoom: ${v('sk_dia_diem_zoom')}
8) Đã từng học trên Zoom chưa: ${v('sk_da_hoc_zoom')}
9) Dự kiến ngày nhập ngũ: ${v('sk_du_kien_nhap_ngu')}
10) Mối nguy hiểm lớn nhất: ${v('sk_moi_nguy_hiem')}`;

  copyToClipboard(text);
}

// ── Export Sinka to Word (.docx) ──
async function exportSinkaWord() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) { showToast('⚠️ Không tìm thấy hồ sơ'); return; }

  showToast('⏳ Đang tải thư viện docx...');
  let docx;
  try {
    docx = await import('https://cdn.jsdelivr.net/npm/docx@9.6.1/+esm');
  } catch (e) {
    console.error('Docx load error:', e);
    showToast('❌ Không thể tải thư viện docx');
    return;
  }
  
  showToast('⏳ Đang tạo file...');

  const fileName = _buildSinkaFileName();
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

  // Helper: labeled field → Paragraph
  const field = (num, label, value) => new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${num}) `, bold: true, size: 24, font: 'Times New Roman' }),
      new TextRun({ text: `${label}: `, bold: true, size: 24, font: 'Times New Roman' }),
      new TextRun({ text: value || '—', size: 24, font: 'Times New Roman' }),
    ]
  });

  const sectionHeader = (text) => new Paragraph({
    spacing: { before: 300, after: 150 },
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, bold: true, size: 28, font: 'Times New Roman' })]
  });

  const subHeader = (text) => new Paragraph({
    spacing: { before: 200, after: 100 },
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, bold: true, size: 26, font: 'Times New Roman' })]
  });

  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Title
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: '⬜️ Thẻ học viên', bold: true, size: 36, font: 'Times New Roman' })]
        }),
        new Paragraph({
          spacing: { after: 200 },
          children: [
            new TextRun({ text: 'Ngày ghi chép: ', bold: true, size: 24, font: 'Times New Roman' }),
            new TextRun({ text: v('sk_ngay_ghi_chep'), size: 24, font: 'Times New Roman' })
          ]
        }),

        // Section 1: NDD
        sectionHeader('1. Người dẫn dắt'),
        field('1', 'Tên/Bộ/Khu vực/Số liên lạc', v('sk_ndd_ten_bo_kv_sdt')),
        field('2', '❗Mã định danh trong SCJ', v('sk_ndd_ma_dinh_danh')),
        field('3', 'Hình thức truyền đạo', v('sk_hinh_thuc_truyen_dao')),
        field('4', 'Mối quan hệ với trái quả', v('sk_moi_quan_he')),
        field('5', 'Concept thuộc thể', v('sk_concept_thuoc_the')),
        field('6', 'Concept thuộc linh', v('sk_concept_thuoc_linh')),

        // Section 2: HS
        sectionHeader('2. Thông tin cơ bản của học viên'),
        field('1', 'Tên/Giới tính/Tuổi', v('sk_ten_gt_tuoi')),
        field('2', 'Quốc tịch', v('sk_quoc_tich')),
        field('3', 'Sở thích/Sở trường/Số liên lạc', v('sk_so_thich_sdt')),
        field('4', 'Ngày tháng năm sinh', v('sk_ngay_sinh')),
        field('5', 'Địa chỉ nhà (Địa chỉ đang sống)', v('sk_dia_chi')),
        field('6', 'Nơi làm việc (Công việc, Vị trí)', v('sk_noi_lam_viec')),
        field('7', 'Lịch trình', v('sk_lich_trinh')),
        field('8', 'Tình trạng hôn nhân', v('sk_hon_nhan')),
        field('9', 'Có bạn khác giới không / Thời gian chơi', v('sk_ban_khac_gioi')),
        field('10', 'Có học lại hay không?', v('sk_hoc_lai')),

        // Section 3: Gia đình
        sectionHeader('3. Gia đình/Bối cảnh trưởng thành'),
        field('1', 'Các thành viên trong gia đình', v('sk_thanh_vien_gd')),
        field('2', 'Quá trình trưởng thành, hoàn cảnh gia đình', v('sk_qua_trinh_truong_thanh')),
        field('3', 'Mức độ gia đình can thiệp đến học viên', v('sk_muc_do_gd_can_thiep')),

        // Section 4: Tính cách
        sectionHeader('4. Tính cách'),
        field('1', 'Khuynh hướng (Enneagram, MBTI)', v('sk_enneagram_mbti')),
        field('2', 'Khuynh hướng sẽ phù hợp với tính cách', v('sk_phu_hop_tinh_cach')),
        field('3', 'Những yếu tố có thể mua được tấm lòng', v('sk_mua_tam_long')),
        field('4', 'Mối quan tâm và lo lắng thuộc thể', v('sk_quan_tam_thuoc_the')),
        field('5', 'Mối quan tâm và lo lắng thuộc linh', v('sk_quan_tam_thuoc_linh')),

        // Section 5: Tâm hướng Thần
        sectionHeader('5. Tâm hướng Thần'),
        field('1', 'Tôn giáo', v('sk_ton_giao')),
        field('2', 'Giáo phái/tên nhà thờ/thời gian theo đạo/chức trách', v('sk_giao_phai')),
        field('3', 'Lý do bắt đầu theo đạo', v('sk_ly_do_theo_dao')),
        field('4', 'Có tin vào sự tồn tại của thần linh hay không?', v('sk_tin_than_linh')),
        field('5', 'Nhận thức về tín ngưỡng, Cơ đốc giáo, tôn giáo', v('sk_nhan_thuc_tin_nguong')),
        field('6', 'Mức độ quan tâm đến Kinh Thánh', v('sk_muc_do_quan_tam_kt')),

        // Supplement
        sectionHeader('🔸 Hạng mục ghi chép bổ sung'),
        subHeader('1. Người sẽ trao đổi với đội ngũ khai giảng'),
        field('', 'Tên/Bộ/Số liên lạc', v('sk_nguoi_trao_doi')),
        field('', 'Đã xác nhận học center chưa?', v('sk_xac_nhan_center')),

        subHeader('2. Thông tin GVBB'),
        field('1', 'Tên/Bộ/Khu vực/Số liên lạc', v('sk_gvbb_ten')),
        field('2', 'Concept thuộc thể', v('sk_gvbb_concept_the')),
        field('3', 'Concept thuộc linh', v('sk_gvbb_concept_linh')),
        field('4', '❗Mã số định danh tại SCJ', v('sk_gvbb_ma_dinh_danh')),
        field('5', 'Phương pháp kết nối', v('sk_gvbb_ket_noi')),
        field('6', 'Thời điểm lần đầu gặp', v('sk_gvbb_lan_dau')),

        subHeader('3. Lá'),
        field('1', 'Tên/Bộ/Khu vực/Số liên lạc', v('sk_la_ten')),
        field('2', 'Concept thuộc thể', v('sk_la_concept_the')),
        field('3', 'Concept thuộc linh', v('sk_la_concept_linh')),
        field('4', 'Phương pháp kết nối', v('sk_la_ket_noi')),
        field('5', 'Thời điểm lần đầu gặp', v('sk_la_lan_dau')),

        subHeader('4. Lá khác'),
        new Paragraph({ children: [new TextRun({ text: v('sk_la_khac') || '—', size: 24, font: 'Times New Roman' })] }),

        subHeader('5. Thông tin xác nhận'),
        field('1', 'Số lần BB (Tên bài học gần nhất)', v('sk_so_lan_bb')),
        field('2', 'Lý do mong muốn học center (Điểm hái trái)', v('sk_ly_do_center')),
        field('3', 'Đề cập quá trình học kéo dài 8~9 tháng', v('sk_8_9_thang')),
        field('4', 'Thứ và thời gian sẽ học', v('sk_thu_gio_hoc')),
        field('5', 'Bảo an — những người xung quanh đã biết', v('sk_bao_an_ai_biet')),
        field('6', 'Chiến lược concept với người xung quanh', v('sk_chien_luoc_concept')),
        field('7', 'Địa điểm sẽ học qua Zoom', v('sk_dia_diem_zoom')),
        field('8', 'Đã từng học trên Zoom chưa', v('sk_da_hoc_zoom')),
        field('9', 'Dự kiến ngày nhập ngũ', v('sk_du_kien_nhap_ngu')),
        field('10', 'Mối nguy hiểm lớn nhất', v('sk_moi_nguy_hiem')),
      ]
    }]
  });

  // Generate .docx blob
  const blob = await Packer.toBlob(doc);

  // ── Telegram WebApp: upload to Supabase Storage → download ──
  if (window.Telegram?.WebApp) {
    try {
      const storagePath = `exports/${currentProfileId}_${Date.now()}.docx`;
      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/sinka-exports/${storagePath}`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'x-upsert': 'true'
        },
        body: blob
      });
      if (!uploadRes.ok) throw new Error('Upload failed: ' + uploadRes.status);

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/sinka-exports/${storagePath}`;

      // Try Telegram downloadFile API (v8.0+)
      if (Telegram.WebApp.downloadFile) {
        try {
          Telegram.WebApp.downloadFile({ url: publicUrl, file_name: fileName });
          showToast('📄 Đang tải: ' + fileName);
          return;
        } catch(e) { console.warn('TG downloadFile failed:', e); }
      }

      Telegram.WebApp.openLink(publicUrl);
      showToast('📄 Đã mở link tải file');
      return;
    } catch(e) {
      console.warn('Storage upload failed:', e);
      showToast('⚠️ Không thể tải file. Dùng nút 📋 Copy rồi paste vào Word.');
      return;
    }
  }

  // ── Desktop: <a download> ──
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 5000);
  showToast('📄 Đã xuất: ' + fileName);
}

// ── Lắng nghe sự kiện chỉnh sửa thủ công của người dùng trên toàn bộ form Sinka ──
document.addEventListener('DOMContentLoaded', function() {
  window._sinkaUserEditedFields = window._sinkaUserEditedFields || {};

  SINKA_FIELDS.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      var eventType = el.tagName === 'SELECT' ? 'change' : 'input';
      el.addEventListener(eventType, function() {
        if (window._sinkaLoaded && currentProfileId) {
          window._sinkaUserEditedFields[id] = true;
          el.style.borderLeft = '3px solid var(--accent, #7c6af7)';
        }
      });
    }
  });
});

// ── AI SCAN SINKA TAB — So sánh, cập nhật bảo vệ thông tin tự nhập ──
async function runAIScanSinka() {
  if (window.isGuestMode) { showToast('🔒 Chế độ xem — không thể quét AI'); return; }
  if (!currentProfileId) { showToast('⚠️ Vui lòng chọn học viên'); return; }

  const btn = document.getElementById('aiScanSinkaBtn');
  if (!btn) return;

  btn.disabled = true;
  btn.innerHTML = '⌛ AI đang quét đối chiếu...';

  try {
    var p = allProfiles.find(function(x){return x.id===currentProfileId;});
    if (!p) throw new Error('Không tìm thấy hồ sơ học viên');

    // 1. Tải toàn bộ lịch sử thô từ DB (bao gồm id để tạo shortcut nguồn)
    var r1 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.tu_van&select=id,content,created_at&order=created_at.asc');
    var r2 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.bien_ban&select=id,content,created_at&order=created_at.asc');
    var r3 = await sbFetch('/rest/v1/records?profile_id=eq.'+p.id+'&record_type=eq.note&select=id,content,created_at&order=created_at.asc');
    var tvs = await r1.json(), bbs = await r2.json(), nts = await r3.json();

    // 2. Gom ngữ cảnh nén thông minh động
    var historyContext = '';
    if (typeof getSmartCompressedContext === 'function') {
      historyContext = getSmartCompressedContext(tvs, bbs, nts);
    }

    // 2b. Xây bảng tra nguồn (source index) cho AI biết record_id
    var sourceIndex = '';
    tvs.forEach(function(r, i) {
      var c = r.content || {};
      var lan = c.lan_thu || (i + 1);
      sourceIndex += 'TV Lần ' + lan + ' → record_id: ' + r.id + ' | record_type: tu_van\n';
    });
    bbs.forEach(function(r, i) {
      var c = r.content || {};
      var buoi = c.buoi_thu || (i + 1);
      sourceIndex += 'BB Buổi ' + buoi + ' → record_id: ' + r.id + ' | record_type: bien_ban\n';
    });
    nts.forEach(function(r, i) {
      var c = r.content || {};
      var title = c.title || 'Note ' + (i + 1);
      sourceIndex += title + ' → record_id: ' + r.id + ' | record_type: note\n';
    });

    var d = window._currentInfoSheet || {};
    var nddName = window._rolesDisplay?.ndd || 'chưa rõ';
    var tvvName = window._rolesDisplay?.tvv || 'chưa rõ';
    var gvbbName = window._rolesDisplay?.gvbb || 'chưa rõ';

    var friendlyPhase = {
      'new': 'Chakki',
      'chakki': 'Chakki',
      'tu_van_hinh': 'TV Hình',
      'tu_van': 'Tư vấn',
      'bb': 'BB (Học tập)',
      'center': 'Center',
      'completed': 'Hoàn thành'
    }[p.phase] || p.phase || 'Chakki';

    var infoContext = 'Hồ sơ học viên: ' + (p.full_name || 'N/A') + '\nGiai đoạn: ' + friendlyPhase + '\nNgười phụ trách: NDD: ' + nddName + ', TVV: ' + tvvName + ', GVBB: ' + gvbbName + '\n\n';
    if (Object.keys(d).length) {
      infoContext += 'PHIẾU THÔNG TIN CÁ NHÂN:\n';
      ['gioi_tinh','nam_sinh','nghe_nghiep','tinh_cach','so_thich','ton_giao','quan_diem','luu_y','hon_nhan','nguoi_quan_trong','du_dinh','chuyen_cu','concept','khong_gian_song','quan_he_ndd','hinh_thuc','khung_ranh','thoi_gian_lam_viec','dia_chi'].forEach(function(k){
        if (d[k]) infoContext += k + ': ' + (Array.isArray(d[k]) ? d[k].join(', ') : d[k]) + '\n';
      });
      infoContext += '\n';
    }

    // 3. Gom dữ liệu Thẻ học viên Sinka hiện tại trên form
    var currentSinka = {};
    SINKA_FIELDS.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        currentSinka[id] = el.value || '';
      }
    });

    var userEditedList = [];
    Object.keys(window._sinkaUserEditedFields || {}).forEach(function(k) {
      if (window._sinkaUserEditedFields[k]) {
        userEditedList.push(k);
      }
    });

    var sysPrompt = `Bạn là trợ lý AI cao cấp chuyên nghiệp của hệ thống quản lý học tập.
Nhiệm vụ của bạn là so sánh, đối chiếu dòng lịch sử học tập của học sinh (các buổi tư vấn, biên bản học tập, ghi chú) và phiếu thông tin cơ bản với DỮ LIỆU HIỆN CÓ trong THẺ HỌC VIÊN SINKA.
Hãy phát hiện ra các trường Thẻ học viên cần được điền mới, cập nhật, hoặc bổ sung thông tin từ các cập nhật mới nhất trong lịch sử.

CÁC TRƯỜNG THẺ HỌC VIÊN SINKA HIỆN CÓ TRÊN FORM:
${JSON.stringify(currentSinka, null, 2)}

DANH SÁCH CÁC TRƯỜNG DO NGƯỜI DÙNG TỰ TAY NHẬP THỦ CÔNG (Cần cẩn thận khi thay đổi):
${JSON.stringify(userEditedList, null, 2)}

BẢNG TRA NGUỒN (SOURCE INDEX) — dùng để trả về source chính xác:
${sourceIndex}

QUY TẮC CẬP NHẬT QUAN TRỌNG:
1. Quy tắc TÓM TẮT ngắn gọn: Giá trị new_value PHẢI NGẮN GỌN, súc tích, đúng trọng tâm. TUYỆT ĐỐI KHÔNG copy nguyên văn câu dài từ báo cáo. Hãy chắt lọc thông tin cốt lõi thành cụm từ hoặc câu ngắn. Ví dụ: thay vì "Học sinh chia sẻ rằng bạn ấy rất thích xem phim hành động và thường xuyên đi phượt vào cuối tuần" → viết "Thích phim hành động, đi phượt cuối tuần".
2. Quy tắc bổ sung thông minh (Smart Appending): Nếu thông tin mới bổ sung cho cũ, GHÉP LẠI ngắn gọn bằng dấu phẩy. Không xóa thông tin cũ có ích.
3. Quy tắc tôn trọng dữ liệu tự nhập: Chỉ đề xuất sửa trường tự nhập nếu có thông tin mới xung đột hoặc bổ sung quan trọng. Giải thích rõ.
4. Chỉ đề xuất trường có dữ liệu kiểm chứng rõ ràng từ báo cáo (TV, BB, Notes). Không bịa đặt.

DANH SÁCH MÃ ID VÀ LABEL CỦA CÁC TRƯỜNG SINKA:
- sk_ten_gt_tuoi: Tên/Giới tính/Tuổi
- sk_so_thich_sdt: Sở thích/Sở trường/Số liên lạc
- sk_dia_chi: Địa chỉ nhà (Địa chỉ đang sống)
- sk_noi_lam_viec: Nơi làm việc (Công việc, Vị trí)
- sk_lich_trinh: Lịch trình rảnh
- sk_hon_nhan: Tình trạng hôn nhân
- sk_thanh_vien_gd: Các thành viên trong gia đình
- sk_qua_trinh_truong_thanh: Quá trình trưởng thành, hoàn cảnh gia đình
- sk_enneagram_mbti: Khuynh hướng tính cách (Enneagram, MBTI)
- sk_mua_tam_long: Những yếu tố có thể mua được tấm lòng
- sk_quan_tam_thuoc_the: Mối quan tâm và lo lắng thuộc thể
- sk_quan_tam_thuoc_linh: Mối quan tâm và lo lắng thuộc linh
- sk_ton_giao: Tôn giáo học sinh
- sk_giao_phai: Giáo phái/tên nhà thờ/thời gian theo đạo/chức trách
- sk_ly_do_theo_dao: Lý do bắt đầu theo đạo
- sk_tin_than_linh: Có tin vào sự tồn tại của thần linh hay không?
- sk_nhan_thuc_tin_nguong: Nhận thức về tín ngưỡng, Cơ đốc giáo, tôn giáo
- sk_muc_do_quan_tam_kt: Mức độ quan tâm đến Kinh Thánh
- sk_so_lan_bb: Số lần BB (Tên bài học gần nhất)
- sk_ly_do_center: Lý do mong muốn học center (Điểm hái trái)
- sk_8_9_thang: Đề cập quá trình học kéo dài 8~9 tháng
- sk_thu_gio_hoc: Thứ và thời gian sẽ học
- sk_bao_an_ai_biet: Bảo an — ai đã biết
- sk_chien_luoc_concept: Chiến lược concept với người xung quanh
- sk_moi_nguy_hiem: Mối nguy hiểm lớn nhất (Bảo an)

QUY ĐỊNH ĐẦU RA (OUTPUT FORMAT):
Chỉ trả về JSON thuần túy, KHÔNG bọc trong \`\`\`json, KHÔNG có văn bản giải thích. Cấu trúc JSON bắt buộc phải như sau:
{
  "fields": [
    {
      "id": "mã_trường_sk_xxx",
      "label": "Tên nhãn tiếng Việt",
      "old_value": "giá trị cũ hiện tại trên form",
      "new_value": "giá trị mới ngắn gọn, súc tích (KHÔNG copy nguyên văn)",
      "reason": "Lý do ngắn gọn",
      "sources": [
        { "label": "TV Lần 3", "record_type": "tu_van", "record_id": "uuid-xxx" },
        { "label": "BB Buổi 5", "record_type": "bien_ban", "record_id": "uuid-xxx" }
      ]
    }
  ]
}

LƯU Ý VỀ sources: Mỗi field PHẢI có mảng sources chứa danh sách các tài liệu nguồn đã dùng làm căn cứ. Dùng record_id và record_type từ BẢNG TRA NGUỒN ở trên. Nếu nguồn từ phiếu thông tin cá nhân (không phải record), dùng record_type: "info" và record_id: "info".`;

    var userPrompt = `DỮ LIỆU NGỮ CẢNH HỒ SƠ HỌC SINH:\n${infoContext}\n${historyContext}`;

    var data = await callAIProxy([
      { role: 'system', content: sysPrompt },
      { role: 'user', content: userPrompt }
    ], { model: 'deepseek-v4-pro', temperature: 0.1, max_tokens: 3500 });

    if (!data) {
      throw new Error("Không nhận được phản hồi từ AI Edge Function.");
    }
    if (data.error) {
      throw new Error("AI Proxy trả về lỗi: " + (typeof data.error === 'object' ? data.error.message || JSON.stringify(data.error) : data.error));
    }
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Phản hồi AI không đúng định dạng chuẩn. Chi tiết: " + JSON.stringify(data));
    }
    var raw = '';
    var msg = data.choices[0].message;
    // Primary: content field (normal mode / thinking disabled)
    if (msg.content && msg.content.trim()) {
      raw = msg.content.trim();
    }
    // Fallback: reasoning_content (DeepSeek V4 thinking mode puts response here)
    else if (msg.reasoning_content && msg.reasoning_content.trim()) {
      raw = msg.reasoning_content.trim();
      console.log('[AI Scan] Using reasoning_content as fallback');
    }

    if (!raw) {
      console.error('[AI Scan] Empty response from AI. Full data:', JSON.stringify(data));
      throw new Error('AI trả về nội dung rỗng. Model: ' + (data.model || 'unknown') + '. Vui lòng thử lại.');
    }

    console.log('[AI Scan] Raw AI response (first 200 chars):', raw.substring(0, 200));
    
    // Multi-stage Robust JSON Parser
    var json;
    try {
      json = robustJSONParse(raw);
    } catch (parseErr) {
      console.error('Raw AI response parsing failed. Raw text:', raw);
      var snippet = raw.substring(0, 200) + '...';
      throw new Error('Định dạng phản hồi AI không đúng JSON. Nội dung AI: "' + snippet + '". Chi tiết: ' + parseErr.message);
    }

    btn.disabled = false;
    btn.innerHTML = '✨ AI Scan Thẻ Học Viên';

    if (json.fields && Array.isArray(json.fields) && json.fields.length > 0) {
      // Save draft to sessionStorage
      _saveSinkaDraft(currentProfileId, json.fields);
      showSinkaDiffPopup(json.fields);
    } else {
      showToast('🍀 AI Scan: Không phát hiện thêm thông tin mới cần cập nhật!');
    }
  } catch (err) {
    console.error('AI Scan Sinka failed:', err);
    showToast('❌ Lỗi AI Scan: ' + (err.message || 'Không xác định'));
    btn.disabled = false;
    btn.innerHTML = '✨ AI Scan Thẻ Học Viên';
  }
}

// ═══════════════════════════════════════════════════
// DRAFT CACHING — save/restore AI Scan results
// ═══════════════════════════════════════════════════
function _getSinkaDraftKey(profileId) {
  return 'sinka_draft_' + (profileId || 'unknown');
}

function _saveSinkaDraft(profileId, fields) {
  try {
    sessionStorage.setItem(_getSinkaDraftKey(profileId), JSON.stringify({
      fields: fields,
      savedAt: Date.now()
    }));
    _updateDraftButton(profileId);
  } catch(e) { console.warn('[Sinka Draft] Save failed:', e); }
}

function _loadSinkaDraft(profileId) {
  try {
    var raw = sessionStorage.getItem(_getSinkaDraftKey(profileId));
    if (!raw) return null;
    var data = JSON.parse(raw);
    // Draft expires after 30 minutes
    if (Date.now() - data.savedAt > 30 * 60 * 1000) {
      sessionStorage.removeItem(_getSinkaDraftKey(profileId));
      return null;
    }
    return data;
  } catch(e) { return null; }
}

function _clearSinkaDraft(profileId) {
  sessionStorage.removeItem(_getSinkaDraftKey(profileId));
  _updateDraftButton(profileId);
}

function _updateDraftButton(profileId) {
  var btn = document.getElementById('aiScanDraftBtn');
  var draft = _loadSinkaDraft(profileId);
  if (btn) {
    btn.style.display = draft ? 'inline-flex' : 'none';
  }
}

function restoreSinkaDraft() {
  var draft = _loadSinkaDraft(currentProfileId);
  if (draft && draft.fields) {
    showSinkaDiffPopup(draft.fields);
    showToast('📋 Đã mở bản nháp AI Scan lần trước');
  } else {
    showToast('Không có bản nháp nào');
  }
}

// Helper: Open source record from AI Scan popup
function _openSourceRecord(recordId, recordType) {
  if (!recordId || recordId === 'info') {
    // Source is from the info sheet, switch to info tab
    var infoTab = document.querySelector('[data-tab="personal"]') || document.querySelector('[onclick*="thongTinTab"]');
    if (infoTab) infoTab.click();
    showToast('📄 Đang mở Phiếu thông tin cá nhân');
    return;
  }
  // Close the diff modal first
  var modal = document.getElementById('sinkaDiffModal');
  if (modal) modal.remove();
  // Map record_type 
  var typeMap = { 'tu_van': 'tu_van', 'bien_ban': 'bien_ban', 'note': 'note' };
  var type = typeMap[recordType] || recordType;
  if (typeof openRecord === 'function') {
    openRecord(recordId, type);
    if (typeof haptic === 'function') haptic('light');
  } else {
    showToast('⚠️ Không thể mở tài liệu');
  }
}

// ═══════════════════════════════════════════════════
// DIFF POPUP — Card-based responsive layout
// ═══════════════════════════════════════════════════
function showSinkaDiffPopup(proposedFields) {
  const old = document.getElementById('sinkaDiffModal');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay open';
  overlay.id = 'sinkaDiffModal';
  overlay.style.zIndex = '9999';
  overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

  // Build card-based items
  // Build card-based items (accordion style - all expanded by default)
  var cardsHtml = '';
  proposedFields.forEach(function(f, idx) {
    var isUserEdited = window._sinkaUserEditedFields && window._sinkaUserEditedFields[f.id];
    var badgeHtml = isUserEdited 
      ? '<span class="sd-badge-user">✍️ Tự nhập</span>'
      : '';
    var checkedAttribute = isUserEdited ? '' : 'checked';
    var safeNewVal = (f.new_value || '').replace(/"/g, '&quot;');

    // Build source shortcut chips
    var sourcesHtml = '';
    if (f.sources && Array.isArray(f.sources) && f.sources.length > 0) {
      var chips = f.sources.map(function(s) {
        if (s.record_type === 'info') {
          return '<span class="sd-source-chip sd-source-info" title="Phiếu thông tin cá nhân">📄 ' + (s.label || 'Phiếu TT') + '</span>';
        }
        return '<button class="sd-source-chip sd-source-link" onclick="event.stopPropagation();_openSourceRecord(\'' + s.record_id + '\',\'' + s.record_type + '\')" title="Mở tài liệu nguồn">📎 ' + (s.label || s.record_type) + '</button>';
      }).join('');
      sourcesHtml = '<div class="sd-sources"><span class="sd-sources-label">Nguồn:</span> ' + chips + '</div>';
    }
    
    cardsHtml += `
      <div class="sd-card sd-expanded" data-idx="${idx}">
        <div class="sd-card-header" onclick="this.parentElement.classList.toggle('sd-expanded')">
          <div class="sd-card-title">
            <label class="sd-check-label" onclick="event.stopPropagation()">
              <input type="checkbox" class="sinka-diff-checkbox" data-id="${f.id}" data-newval="${safeNewVal}" ${checkedAttribute} />
              <span class="sd-check-custom"></span>
            </label>
            <span class="sd-field-name">${f.label}</span>
            ${badgeHtml}
            <span class="sd-chevron">▾</span>
          </div>
        </div>
        <div class="sd-card-body">
          <div class="sd-row">
            <div class="sd-col sd-col-old">
              <div class="sd-col-label">Giá trị cũ</div>
              <div class="sd-col-value">${f.old_value || '<i class="sd-empty">(Trống)</i>'}</div>
            </div>
            <div class="sd-col sd-col-arrow">→</div>
            <div class="sd-col sd-col-new">
              <div class="sd-col-label">Đề xuất mới</div>
              <div class="sd-col-value">${f.new_value || '—'}</div>
            </div>
          </div>
          ${f.reason ? '<div class="sd-reason"><span class="sd-reason-icon">💡</span> ' + f.reason + '</div>' : ''}
          ${sourcesHtml}
        </div>
      </div>
    `;
  });

  var checkedCount = proposedFields.filter(function(f) {
    return !(window._sinkaUserEditedFields && window._sinkaUserEditedFields[f.id]);
  }).length;

  overlay.innerHTML = `
    <div class="sd-modal">
      <!-- Sticky Header -->
      <div class="sd-sticky-header">
        <div class="sd-header-top">
          <div class="sd-header-title">✨ AI Scan: Đề xuất cập nhật</div>
          <button class="sd-close-btn" onclick="document.getElementById('sinkaDiffModal').remove()" title="Đóng">✕</button>
        </div>
        <div class="sd-header-meta">
          AI phát hiện <strong>${proposedFields.length}</strong> trường cần cập nhật.
          Trường <span class="sd-badge-user-inline">✍️ Tự nhập</span> mặc định không chọn ghi đè.
        </div>
        <div class="sd-header-actions">
          <button id="sinkaSelectAllBtn" class="sd-btn sd-btn-outline">Chọn tất cả</button>
          <button id="sinkaCollapseAllBtn" class="sd-btn sd-btn-outline" onclick="var cards=document.querySelectorAll('.sd-card');var allExpanded=document.querySelectorAll('.sd-card.sd-expanded').length===cards.length;cards.forEach(function(c){allExpanded?c.classList.remove('sd-expanded'):c.classList.add('sd-expanded')});this.textContent=allExpanded?'Mở tất cả':'Thu gọn'">Thu gọn</button>
          <span class="sd-counter" id="sdCheckedCounter">${checkedCount}/${proposedFields.length} đã chọn</span>
          <div style="flex:1;"></div>
          <button onclick="document.getElementById('sinkaDiffModal').remove()" class="sd-btn sd-btn-ghost">Hủy</button>
          <button id="sinkaApplyDiffBtn" class="sd-btn sd-btn-primary">✅ Áp dụng</button>
        </div>
      </div>

      <!-- Scrollable Card List -->
      <div class="sd-card-list">
        ${cardsHtml}
      </div>
    </div>

    <style>
      .sd-modal {
        width: 94%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column;
        background: var(--bg, #fff); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        overflow: hidden; animation: sdSlideUp 0.3s ease;
      }
      @keyframes sdSlideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .sd-sticky-header {
        position: sticky; top: 0; z-index: 10;
        background: var(--bg, #fff); padding: 16px 18px 12px;
        border-bottom: 1px solid var(--border, #e5e7eb);
        flex-shrink: 0;
      }
      .sd-header-top {
        display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;
      }
      .sd-header-title {
        font-size: 15px; font-weight: 700; color: var(--text1, #1f2937);
      }
      .sd-close-btn {
        width: 28px; height: 28px; border-radius: 50%; border: none;
        background: var(--surface2, #f3f4f6); color: var(--text3, #9ca3af);
        font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      .sd-close-btn:hover { background: var(--border, #e5e7eb); color: var(--text1, #374151); }
      .sd-header-meta {
        font-size: 11px; color: var(--text3, #6b7280); line-height: 1.4; margin-bottom: 10px;
      }
      .sd-header-actions {
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      }
      .sd-counter {
        font-size: 11px; color: var(--accent, #7c6af7); font-weight: 600;
        background: rgba(124,106,247,0.08); padding: 3px 8px; border-radius: 10px;
      }
      .sd-btn {
        padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 600;
        cursor: pointer; border: none; transition: all 0.15s; white-space: nowrap;
      }
      .sd-btn-outline {
        background: none; border: 1px solid var(--border, #e5e7eb); color: var(--text2, #4b5563);
      }
      .sd-btn-outline:hover { background: var(--surface2, #f3f4f6); }
      .sd-btn-ghost { background: none; color: var(--text3, #9ca3af); }
      .sd-btn-ghost:hover { color: var(--text1, #374151); }
      .sd-btn-primary {
        background: linear-gradient(135deg, var(--accent, #7c6af7), var(--accent2, #a78bfa));
        color: white; box-shadow: 0 3px 10px rgba(124,106,247,0.2);
      }
      .sd-btn-primary:hover { box-shadow: 0 4px 14px rgba(124,106,247,0.35); transform: translateY(-1px); }

      /* Card List */
      .sd-card-list {
        flex: 1; overflow-y: auto; padding: 12px 14px 16px; display: flex; flex-direction: column; gap: 10px;
        -webkit-overflow-scrolling: touch;
      }
      .sd-card {
        background: var(--surface, #fafafa); border: 1px solid var(--border, #e5e7eb);
        border-radius: 10px; transition: border-color 0.2s, box-shadow 0.2s;
      }
      .sd-card.sd-expanded {
        border-color: var(--accent, #7c6af7); box-shadow: 0 0 0 1px rgba(124,106,247,0.1);
      }
      .sd-card-header {
        padding: 10px 12px; background: var(--surface2, #f3f4f6);
        border-radius: 10px; cursor: pointer; user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .sd-card.sd-expanded .sd-card-header {
        border-radius: 10px 10px 0 0;
        border-bottom: 1px solid var(--border, #e5e7eb);
      }
      .sd-card-header:active { opacity: 0.8; }
      .sd-card-title {
        display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600;
        color: var(--text1, #1f2937);
      }
      .sd-field-name { flex: 1; min-width: 0; }
      .sd-chevron {
        font-size: 12px; color: var(--text3, #9ca3af); transition: transform 0.2s;
        flex-shrink: 0;
      }
      .sd-card.sd-expanded .sd-chevron { transform: rotate(0deg); }
      .sd-card:not(.sd-expanded) .sd-chevron { transform: rotate(-90deg); }
      .sd-badge-user, .sd-badge-user-inline {
        background: #f97316; color: white; padding: 1px 6px; border-radius: 4px;
        font-size: 10px; font-weight: 700; white-space: nowrap; flex-shrink: 0;
      }
      .sd-badge-user-inline { font-size: 9px; padding: 1px 5px; vertical-align: middle; }

      /* Custom Checkbox */
      .sd-check-label {
        position: relative; display: inline-flex; align-items: center; cursor: pointer; flex-shrink: 0;
      }
      .sd-check-label input { position: absolute; opacity: 0; width: 0; height: 0; }
      .sd-check-custom {
        width: 18px; height: 18px; border-radius: 5px;
        border: 2px solid var(--border, #d1d5db); background: var(--bg, #fff);
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s; flex-shrink: 0;
      }
      .sd-check-label input:checked + .sd-check-custom {
        background: var(--accent, #7c6af7); border-color: var(--accent, #7c6af7);
      }
      .sd-check-label input:checked + .sd-check-custom::after {
        content: '✓'; color: white; font-size: 11px; font-weight: 700;
      }

      /* Card Body — accordion toggle */
      .sd-card-body {
        display: none; padding: 10px 12px;
      }
      .sd-card.sd-expanded .sd-card-body {
        display: block;
      }
      .sd-row {
        display: flex; align-items: flex-start; gap: 8px;
      }
      .sd-col { flex: 1; min-width: 0; }
      .sd-col-arrow {
        flex: 0 0 20px; text-align: center; color: var(--accent, #7c6af7);
        font-weight: 700; font-size: 14px; padding-top: 16px;
      }
      .sd-col-label {
        font-size: 10px; font-weight: 600; color: var(--text3, #9ca3af);
        text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 3px;
      }
      .sd-col-value {
        font-size: 12px; color: var(--text2, #4b5563); line-height: 1.4;
        white-space: pre-wrap; word-break: break-word;
      }
      .sd-col-old .sd-col-value { color: var(--text3, #9ca3af); }
      .sd-col-new .sd-col-value {
        color: var(--green, #22c55e); font-weight: 600;
        background: rgba(34,197,94,0.06); padding: 4px 6px; border-radius: 4px;
      }
      .sd-empty { color: var(--text3, #ccc); font-style: italic; }
      .sd-reason {
        margin-top: 8px; font-size: 11px; color: var(--text3, #6b7280);
        line-height: 1.4; padding: 6px 8px; background: rgba(124,106,247,0.04);
        border-radius: 6px; border-left: 3px solid var(--accent, #7c6af7);
      }
      .sd-reason-icon { font-size: 12px; }

      /* Source shortcut chips */
      .sd-sources {
        margin-top: 6px; display: flex; flex-wrap: wrap; align-items: center; gap: 5px;
      }
      .sd-sources-label {
        font-size: 10px; color: var(--text3, #9ca3af); font-weight: 600;
      }
      .sd-source-chip {
        display: inline-flex; align-items: center; gap: 2px;
        font-size: 10px; padding: 2px 8px; border-radius: 10px;
        font-weight: 600; white-space: nowrap; transition: all 0.15s;
      }
      .sd-source-info {
        background: rgba(124,106,247,0.06); color: var(--text3, #6b7280); border: none;
      }
      .sd-source-link {
        background: rgba(59,130,246,0.08); color: #3b82f6;
        border: 1px solid rgba(59,130,246,0.2); cursor: pointer;
      }
      .sd-source-link:hover {
        background: rgba(59,130,246,0.15); border-color: #3b82f6;
        transform: translateY(-1px); box-shadow: 0 2px 6px rgba(59,130,246,0.15);
      }

      /* Desktop 2-column grid when enough space */
      @media (min-width: 600px) {
        .sd-modal { max-width: 780px; }
        .sd-card-body .sd-row { gap: 12px; }
      }

      /* Mobile adjustments */
      @media (max-width: 480px) {
        .sd-modal { width: 100%; max-height: 95vh; border-radius: 16px 16px 0 0; align-self: flex-end; }
        .sd-sticky-header { padding: 14px 14px 10px; }
        .sd-header-title { font-size: 14px; }
        .sd-card-list { padding: 10px 10px 20px; }
        .sd-row { flex-direction: column; gap: 6px; }
        .sd-col-arrow { display: none; }
        .sd-col-new .sd-col-label::before { content: '→ '; }
        .sd-header-actions { gap: 6px; }
        .sd-btn { padding: 6px 10px; font-size: 11px; }
      }
    </style>
  `;

  document.body.appendChild(overlay);

  // Update counter on checkbox change
  function updateCounter() {
    var total = document.querySelectorAll('.sinka-diff-checkbox').length;
    var checked = document.querySelectorAll('.sinka-diff-checkbox:checked').length;
    var counter = document.getElementById('sdCheckedCounter');
    if (counter) counter.textContent = checked + '/' + total + ' đã chọn';
  }
  overlay.addEventListener('change', function(e) {
    if (e.target.classList.contains('sinka-diff-checkbox')) updateCounter();
  });

  // Select All toggle
  var allSelected = false;
  document.getElementById('sinkaSelectAllBtn').onclick = function() {
    allSelected = !allSelected;
    document.querySelectorAll('.sinka-diff-checkbox').forEach(function(cb) {
      cb.checked = allSelected;
    });
    this.textContent = allSelected ? 'Bỏ chọn tất cả' : 'Chọn tất cả';
    updateCounter();
  };

  // Apply selected
  document.getElementById('sinkaApplyDiffBtn').onclick = function() {
    var applyCount = 0;
    document.querySelectorAll('.sinka-diff-checkbox:checked').forEach(function(cb) {
      var id = cb.getAttribute('data-id');
      var newVal = cb.getAttribute('data-newval');
      
      var el = document.getElementById(id);
      if (el) {
        el.value = newVal;
        applyCount++;
        // Auto-resize textarea to fit new content
        if (el.tagName === 'TEXTAREA') _sinkaAutoSize(el);
        
        el.style.outline = '2px solid var(--green, #22c55e)';
        el.style.outlineOffset = '-1px';
        el.style.transition = 'outline 0.3s';
        
        if (window._sinkaUserEditedFields) {
          window._sinkaUserEditedFields[id] = true;
          el.style.borderLeft = '3px solid var(--accent, #7c6af7)';
        }

        setTimeout(function() {
          el.style.outline = '';
          el.style.outlineOffset = '';
        }, 5000);
      }
    });

    overlay.remove();
    // Clear draft after applying
    _clearSinkaDraft(currentProfileId);
    if (applyCount > 0) {
      showToast(`✨ Đã cập nhật ${applyCount} trường — hãy lưu Thẻ Học Viên!`);
      if (typeof haptic === 'function') haptic('success');
    }
  };
}

