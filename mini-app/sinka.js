// ============ GIẤY SINKA — Thẻ học viên Center ============

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
  if (!p) return 'Giay_Sinka.docx';

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
    SINKA_FIELDS.forEach(id => {
      const savedVal = d[id];
      if (savedVal !== undefined && savedVal !== null && savedVal !== '') {
        const el = document.getElementById(id);
        if (el) el.value = savedVal;
      }
    });
  } catch(e) { console.warn('loadSinka DB error:', e); }

  _sinkaLoaded = true;
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
    cong_cu: v('t2_cong_cu'),
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
  const nddInfo = [nddStaff?.full_name, nddUnit, nddPhone].filter(Boolean).join(' / ');
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
    fill('sk_gvbb_ten', [gvbbStaff.full_name, gvbbUnit, gvbbPhone].filter(Boolean).join(' / '));
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
    showToast('✅ Đã lưu Giấy Sinka!');
  } catch(e) {
    console.error('saveSinka error:', e);
    showToast('❌ Lỗi khi lưu Giấy Sinka');
  }
}

// ── Copy Sinka to clipboard ──
function copySinka() {
  const v = id => document.getElementById(id)?.value?.trim() || '—';
  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = p?.full_name || '';

  const text = `⬜️ Giấy Sinka
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
          children: [new TextRun({ text: '⬜️ Giấy Sinka', bold: true, size: 36, font: 'Times New Roman' })]
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
