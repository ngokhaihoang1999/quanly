// ============ ĐK BB — Báo cáo Đăng ký BB ============

// ── Sub-tab switcher ──
function switchSinkaSubtab(tab) {
  const sinkaContent = document.getElementById('sinkaContent');
  const dkbbContent = document.getElementById('dkbbContent');
  const subtabSinka = document.getElementById('subtabSinka');
  const subtabDKBB = document.getElementById('subtabDKBB');
  const sinkaHeaderBtns = document.getElementById('sinkaHeaderBtns');
  const dkbbHeaderBtns = document.getElementById('dkbbHeaderBtns');

  if (tab === 'dkbb') {
    sinkaContent.style.display = 'none';
    dkbbContent.style.display = '';
    subtabSinka.style.color = 'var(--text3)';
    subtabSinka.style.borderBottom = '2px solid transparent';
    subtabDKBB.style.color = 'var(--accent)';
    subtabDKBB.style.borderBottom = '2px solid var(--accent)';
    sinkaHeaderBtns.style.display = 'none';
    dkbbHeaderBtns.style.display = 'flex';
    // Lazy-load ĐK BB data
    if (currentProfileId) loadDKBB(currentProfileId);
  } else {
    sinkaContent.style.display = '';
    dkbbContent.style.display = 'none';
    subtabSinka.style.color = 'var(--accent)';
    subtabSinka.style.borderBottom = '2px solid var(--accent)';
    subtabDKBB.style.color = 'var(--text3)';
    subtabDKBB.style.borderBottom = '2px solid transparent';
    sinkaHeaderBtns.style.display = 'flex';
    dkbbHeaderBtns.style.display = 'none';
  }
}

// ── Phase code helper (same as webhook) ──
function _dkbbPhaseCode(ph) {
  const map = {
    'chakki': 'CK', 'new': 'CK', 'tu_van_hinh': 'TVH', 'tu_van': 'TV',
    'dk_sau_ts': 'ĐK sau TS', 'nghi_he': 'NH', 'bb': 'BB',
    'dk_center': 'ĐK CT', 'center': 'CT', 'completed': 'CT',
    'hoan_lai': 'HL', 'tv_group': 'TV group', 'bb_group': 'BB group'
  };
  return map[ph] || 'CK';
}

// ── Format month: "Tháng 4/2026" or "KGT04" → "April/Tháng 4" ──
function _dkbbFmtMonth(raw) {
  if (!raw) return '';
  const en = ['','Jan','Feb','Mar','April','May','June','July','Aug','Sep','Oct','Nov','Dec'];
  // "Tháng X" pattern
  const m1 = raw.match(/Tháng\s*(\d+)/i);
  if (m1) {
    const mn = parseInt(m1[1]);
    return en[mn] ? (en[mn] + '/Tháng ' + mn) : raw;
  }
  // "KGTXX" pattern
  const m2 = raw.match(/KGT\s*(\d+)/i);
  if (m2) {
    const mn = parseInt(m2[1]);
    return en[mn] ? (en[mn] + '/Tháng ' + mn) : raw;
  }
  return raw;
}

// ── Status helper ──
function _dkbbStatus(fruit_status) {
  if (fruit_status === 'dropout') return 'Drop-out';
  if (fruit_status === 'pause') return 'Pause';
  return 'Alive';
}

// ── Load ĐK BB: auto-fill all fields from DB ──
let _dkbbLoaded = false;
let _dkbbSavedData = {};

async function loadDKBB(profileId) {
  if (!profileId) return;
  _dkbbLoaded = false;

  const p = allProfiles.find(x => x.id === profileId);
  if (!p) return;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  // 1. Họ tên trái
  set('dkbb_ho_ten', p.full_name);

  // 2. Tổ NDD
  const nddCode = p.ndd_staff_code || '';
  const nddUnit = nddCode ? getStaffUnit(nddCode) : '';
  set('dkbb_to_ndd', nddUnit ? compactTeamLabel(nddUnit) : '');

  // 3. ID NDD
  set('dkbb_id_ndd', nddCode);

  // 4. Tổ GVBB
  const gvbbCode = p.gvbb_staff_code || '';
  const gvbbUnit = (gvbbCode && !gvbbCode.startsWith('tg:')) ? getStaffUnit(gvbbCode) : '';
  set('dkbb_to_gvbb', gvbbUnit ? compactTeamLabel(gvbbUnit) : '');

  // 5. ID GVBB
  set('dkbb_id_gvbb', gvbbCode);

  // 6. Giai đoạn
  set('dkbb_giai_doan', _dkbbPhaseCode(p.phase));

  // 7. Trạng thái
  set('dkbb_trang_thai', _dkbbStatus(p.fruit_status));

  // 8. Mục tiêu tháng (from profiles.semester_id → allSemesters lookup)
  const semRaw = (p.semester_id && typeof allSemesters !== 'undefined')
    ? (allSemesters.find(s => s.id === p.semester_id)?.name || '') : '';
  set('dkbb_muc_tieu', _dkbbFmtMonth(semRaw));

  // 10. Độ tuổi
  const birthYear = p.birth_year ? parseInt(p.birth_year) : 0;
  const age = birthYear ? (new Date().getFullYear() - birthYear) : '';
  set('dkbb_do_tuoi', age ? String(age) : '');

  // 16. Ngày mở KT
  if (p.kt_opened_at) {
    const d = new Date(p.kt_opened_at);
    set('dkbb_ngay_mo_kt', d.toLocaleDateString('vi-VN'));
  } else {
    set('dkbb_ngay_mo_kt', p.is_kt_opened ? 'Đã mở (chưa ghi ngày)' : 'Chưa mở');
  }

  // 17. Tuần chuyển BB
  set('dkbb_tuan_chuyen', p.bb_week || '');

  // 18. Lý do
  set('dkbb_ly_do', p.dropout_reason || '');

  // ── Fetch form_hanh_chinh for fields 9, 12, 13 ──
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data`);
    const rows = await res.json();
    const d = rows?.[0]?.data || {};

    // 9. Quan hệ với NDD
    const moiQuanHe = d.sk_moi_quan_he || '';
    const hinhThuc = d.sk_hinh_thuc_truyen_dao || d.t2_hinh_thuc || '';
    const quanHe = (moiQuanHe && moiQuanHe !== 'Không') ? moiQuanHe : hinhThuc;
    set('dkbb_quan_he', quanHe);

    // 12. Nơi ở
    set('dkbb_noi_o', d.sk_dia_chi || d.t2_dia_chi || '');

    // 13. Nghề nghiệp
    set('dkbb_nghe_nghiep', d.t2_nghe_nghiep || '');

    // Load saved ĐK BB manual fields
    _dkbbSavedData = d;
    if (d.dkbb_ton_giao) set('dkbb_ton_giao', d.dkbb_ton_giao);
    if (d.dkbb_ngay_hoc_dau) set('dkbb_ngay_hoc_dau', d.dkbb_ngay_hoc_dau);
    if (d.dkbb_so_lan_gd) set('dkbb_so_lan_gd', d.dkbb_so_lan_gd);
  } catch(e) { console.warn('DKBB form_hanh_chinh error:', e); }

  // ── Fetch BB records count + KT content count ──
  try {
    const bbRes = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.bien_ban&select=id,content`);
    const bbRecords = await bbRes.json();
    const totalBB = bbRecords?.length || 0;
    const ktCount = (bbRecords || []).filter(r => r.content?.has_kt_content === true).length;
    set('dkbb_tong_buoi', String(totalBB));
    set('dkbb_buoi_kt', String(ktCount));
  } catch(e) {
    set('dkbb_tong_buoi', '0');
    set('dkbb_buoi_kt', '0');
  }

  _dkbbLoaded = true;
}

// ── Save bb_week to profiles ──
async function saveDKBBWeek() {
  if (!currentProfileId) return;
  const weekVal = document.getElementById('dkbb_tuan_chuyen')?.value || '';
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {
      method: 'PATCH', body: JSON.stringify({ bb_week: weekVal })
    });
    // Sync local cache
    const p = allProfiles.find(x => x.id === currentProfileId);
    if (p) p.bb_week = weekVal;

    // Also save manual fields to form_hanh_chinh
    await _saveDKBBManualFields();

    showToast('✅ Đã lưu Tuần chuyển BB');
  } catch(e) {
    showToast('❌ Lỗi lưu: ' + e.message);
  }
}

// ── Save manual fields (Tôn giáo, Ngày học đầu, Số lần GD) to form_hanh_chinh ──
async function _saveDKBBManualFields() {
  if (!currentProfileId) return;
  const tonGiao = document.getElementById('dkbb_ton_giao')?.value || '';
  const ngayHocDau = document.getElementById('dkbb_ngay_hoc_dau')?.value || '';
  const soLanGD = document.getElementById('dkbb_so_lan_gd')?.value || '';

  try {
    // Fetch existing
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}&select=data`);
    const rows = await res.json();
    const existing = rows?.[0]?.data || {};

    const merged = {
      ...existing,
      dkbb_ton_giao: tonGiao,
      dkbb_ngay_hoc_dau: ngayHocDau,
      dkbb_so_lan_gd: soLanGD
    };

    await sbFetch('/rest/v1/form_hanh_chinh', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body: JSON.stringify({ profile_id: currentProfileId, data: merged })
    });
  } catch(e) { console.warn('saveDKBBManualFields error:', e); }
}

// ── Copy ĐK BB report to clipboard ──
function copyDKBB() {
  const v = id => document.getElementById(id)?.value?.trim() || '—';

  // Save manual fields before copy
  _saveDKBBManualFields();

  const text = `🌿 Những cột cần xuất thông tin để ĐK BB 🌿

1/ Họ tên trái: ${v('dkbb_ho_ten')}
2/ Tổ của NDD: ${v('dkbb_to_ndd')}
3/ ID NDD: ${v('dkbb_id_ndd')}
4/ Tổ của GVBB: ${v('dkbb_to_gvbb')}
5/ ID GVBB: ${v('dkbb_id_gvbb')}
6/ Giai đoạn: ${v('dkbb_giai_doan')}
7/ Trạng thái: ${v('dkbb_trang_thai')}
8/ Mục tiêu tháng: ${v('dkbb_muc_tieu')}
9/ Quan hệ với NDD: ${v('dkbb_quan_he')}
10/ Độ tuổi: ${v('dkbb_do_tuoi')}
11/ Tôn giáo: ${v('dkbb_ton_giao')}
12/ Nơi ở: ${v('dkbb_noi_o')}
13/ Nghề Nghiệp: ${v('dkbb_nghe_nghiep')}
14/ Ngày học đầu tiên: ${v('dkbb_ngay_hoc_dau')}
15/ Số lần giáo dục/tuần: ${v('dkbb_so_lan_gd')}
16/ Ngày mở KT: ${v('dkbb_ngay_mo_kt')}
17/ Tuần chuyển BB: ${v('dkbb_tuan_chuyen')}
18/ Lý do dropped/pause: ${v('dkbb_ly_do')}

*Tổng số buổi đã học: ${v('dkbb_tong_buoi')}
*Số buổi đã học có nội dung KT: ${v('dkbb_buoi_kt')}`;

  copyToClipboard(text);
}

// ── Auto-save manual fields on blur ──
document.addEventListener('DOMContentLoaded', () => {
  ['dkbb_ton_giao', 'dkbb_ngay_hoc_dau', 'dkbb_so_lan_gd'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', () => _saveDKBBManualFields());
  });
});
