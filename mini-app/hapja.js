// ============ CHECK HAPJA ============
function canCreateHapja(pos) { return true; } // Ai cũng có thể tạo Hapja
function openCheckHapjaModal() {
  document.getElementById('checkHapjaModal').classList.add('open');
  // Populate NDD select with staff codes
  const sel = document.getElementById('hj_ndd');
  if (sel && allStaff.length) {
    sel.innerHTML = '<option value="">Ch\u1ecdn NDD...</option>' + allStaff.map(s=>`<option value="${s.staff_code}">${s.full_name} (${s.staff_code})</option>`).join('');
  }
}
async function saveCheckHapja() {
  const fullName = document.getElementById('hj_hoten')?.value?.trim();
  if (!fullName) { showToast('\u26a0\ufe0f Nh\u1eadp h\u1ecd t\u00ean tr\u00e1i (m\u1ee5c 1)'); return; }
  const data = {
    full_name: fullName,
    birth_year: document.getElementById('hj_nam_sinh')?.value?.trim() || '',
    gender: document.getElementById('hj_gioi_tinh')?.value || '',
    data: {
      ndd_staff_code: getStaffCodeFromInput('hj_ndd') || '',
      ngay_chakki: document.getElementById('hj_ngay')?.value || '',
      concept: document.getElementById('hj_concept')?.value || '',
      hinh_thuc: getChipValues('chips_hj_hinh_thuc'),
      than_thiet: getChipValues('chips_hj_than_thiet'),
      noi_o: document.getElementById('hj_noi_o')?.value || '',
      nghe_nghiep: document.getElementById('hj_nghe')?.value || '',
      tinh_cach: document.getElementById('hj_tinh_cach')?.value || '',
      ket_noi: getChipValues('chips_hj_ket_noi'),
      tg_ranh: document.getElementById('hj_tg_ranh')?.value || '',
      than_tinh: getChipValues('chips_hj_than_tinh'),
      hoan_canh: document.getElementById('hj_hoan_canh')?.value || '',
      hoc_ki: document.getElementById('hj_hoc_ki')?.value || '',
      noi_lo: document.getElementById('hj_noi_lo')?.value || '',
      sdt: document.getElementById('hj_sdt')?.value || ''
    },
    status: 'pending',
    created_by: getEffectiveStaffCode() || 'unknown'
  };
  try {
    await sbFetch('/rest/v1/check_hapja', { method: 'POST', headers: {'Prefer':'return=representation'}, body: JSON.stringify(data) });
    closeModal('checkHapjaModal');
    showToast('\u2705 \u0110\u00e3 g\u1eedi Check Hapja!');
    ['hj_ngay','hj_concept','hj_hoten','hj_nam_sinh','hj_noi_o','hj_nghe','hj_tinh_cach','hj_tg_ranh','hj_hoan_canh','hj_hoc_ki','hj_noi_lo','hj_sdt'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('hj_ndd').selectedIndex = 0;
    document.getElementById('hj_gioi_tinh').selectedIndex = 0;
    ['chips_hj_hinh_thuc','chips_hj_than_thiet','chips_hj_ket_noi','chips_hj_than_tinh'].forEach(clearChips);
    loadDashboard();
  } catch(e) { showToast('\u274c L\u1ed7i khi g\u1eedi'); console.error(e); }
}
async function openHapjaDetail(id) {
  try {
    const hRes = await sbFetch(`/rest/v1/check_hapja?id=eq.${id}&select=*`);
    const hapjas = await hRes.json();
    if (!hapjas.length) { showToast('⚠️ Không tìm thấy phiếu'); return; }
    const h = hapjas[0];
    const d = h.data || {};
    const date = new Date(h.created_at).toLocaleDateString('vi-VN');
    const pos = getCurrentPosition();
    const canApprove = ['admin','yjyn','ggn_jondo','ggn_chakki'].includes(pos) && h.status === 'pending';
    const body = document.getElementById('hapjaDetailBody');
    const fields = [
      ['Họ tên', h.full_name],
      ['Năm sinh', h.birth_year],
      ['Giới tính', h.gender],
      ['NDD', d.ndd_staff_code || h.created_by],
      ['Ngày Chakki', d.ngay_chakki],
      ['Concept', d.concept],
      ['Hình thức', Array.isArray(d.hinh_thuc) ? d.hinh_thuc.join(', ') : d.hinh_thuc],
      ['Mức thân thiết', Array.isArray(d.than_thiet) ? d.than_thiet.join(', ') : d.than_thiet],
      ['Nơi ở', d.noi_o],
      ['Nghề nghiệp', d.nghe_nghiep],
      ['Tính cách', d.tinh_cach],
      ['Kết nối', Array.isArray(d.ket_noi) ? d.ket_noi.join(', ') : d.ket_noi],
      ['Thời gian rảnh', d.tg_ranh],
      ['Thân tình', Array.isArray(d.than_tinh) ? d.than_tinh.join(', ') : d.than_tinh],
      ['Hoàn cảnh', d.hoan_canh],
      ['Học kì', d.hoc_ki],
      ['Nỗi lo', d.noi_lo],
      ['SĐT', d.sdt],
      ['Trạng thái', h.status === 'pending' ? '⏳ Chờ duyệt' : h.status === 'approved' ? '✅ Đã duyệt' : '❌ Từ chối'],
      ['Ngày tạo', date],
      ['Người tạo', h.created_by],
    ];
    body.innerHTML = fields.filter(([,v]) => v).map(([label, val]) =>
      `<div style="display:flex;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <div style="font-size:12px;font-weight:600;color:var(--text2);min-width:100px;">${label}</div>
        <div style="font-size:13px;color:var(--text);flex:1;">${val}</div>
      </div>`
    ).join('');
    const actions = document.getElementById('hapjaDetailActions');
    let actHtml = '';
    if (canApprove && h.status === 'pending') {
      actHtml += `<button onclick="approveHapja('${h.id}')" style="flex:1;padding:12px;border-radius:var(--radius-sm);border:none;background:var(--green);color:white;font-size:14px;font-weight:700;cursor:pointer;">✅ Duyệt</button>
        <button onclick="rejectHapja('${h.id}')" style="flex:1;padding:12px;border-radius:var(--radius-sm);border:none;background:var(--red);color:white;font-size:14px;font-weight:700;cursor:pointer;">❌ Từ chối</button>`;
    }
    if (h.created_by === getEffectiveStaffCode() && h.status === 'pending') {
      actHtml += `<button onclick="deleteHapja('${h.id}')" style="flex:1;padding:12px;border-radius:var(--radius-sm);border:none;background:var(--text2);color:white;font-size:14px;font-weight:700;cursor:pointer;">🗑️ Xoá</button>`;
    }
    actions.innerHTML = actHtml;
    document.getElementById('hapjaDetailModal').classList.add('open');
  } catch(e) { showToast('❌ Lỗi tải phiếu'); console.error(e); }
}
async function approveHapja(id) {
  try {
    const hRes = await sbFetch(`/rest/v1/check_hapja?id=eq.${id}&select=*`);
    const hapjas = await hRes.json();
    if (!hapjas.length || hapjas[0].status !== 'pending') { showToast('⚠️ Phiếu đã xử lý'); return; }
    const h = hapjas[0];
    const nddCode = h.data?.ndd_staff_code || h.created_by;
    const d = h.data || {};
    // Create profile with NDD + phase chakki + phone
    const pRes = await sbFetch('/rest/v1/profiles', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
      full_name: h.full_name, birth_year: h.birth_year, gender: h.gender,
      phone_number: d.sdt || '', ndd_staff_code: nddCode, created_by: h.created_by, phase: 'chakki'
    })});
    const newProfile = await pRes.json();
    const newPid = newProfile?.[0]?.id;
    // Create fruit_group + NDD role
    if (newPid && nddCode) {
      try {
        const fgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
          telegram_group_id: 0, profile_id: newPid, level: 'tu_van'
        })});
        const fgs = await fgRes.json();
        if (fgs[0]?.id) {
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', body: JSON.stringify({
            fruit_group_id: fgs[0].id, staff_code: nddCode, role_type: 'ndd', assigned_by: getEffectiveStaffCode()
          })});
        }
      } catch(e) { console.warn('NDD role creation:', e); }
    }
    // Auto-create form_hanh_chinh (Phiếu Thông tin) from Hapja data
    if (newPid) {
      try {
        const infoData = {
          t2_ho_ten: h.full_name || '',
          t2_gioi_tinh: h.gender || '',
          t2_nam_sinh: h.birth_year || '',
          t2_sdt: d.sdt || '',
          t2_nghe_nghiep: d.nghe_nghiep || '',
          t2_tinh_cach: d.tinh_cach || '',
          t2_dia_chi: d.noi_o || '',
          t2_que_quan: '',
          t2_khung_ranh: d.tg_ranh || '',
          t2_so_thich: '',
          t2_chuyen_cu: d.hoan_canh || '',
          t2_luu_y: d.noi_lo || '',
        };
        await sbFetch('/rest/v1/form_hanh_chinh', { method:'POST', body: JSON.stringify({ profile_id: newPid, data: infoData }) });
      } catch(e) { console.warn('form_hanh_chinh creation:', e); }
    }
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: 'approved', approved_by: getEffectiveStaffCode(), approved_at: new Date().toISOString(), profile_id: newPid }) });
    showToast('✅ Đã duyệt! Hồ sơ Trái quả đã được tạo.');
    closeModal('hapjaDetailModal');
    loadDashboard(); loadProfiles();
  } catch(e) { showToast('❌ Lỗi khi duyệt'); console.error(e); }
}
async function deleteHapja(id) {
  if (!confirm('Xác nhận xoá phiếu Check Hapja?')) return;
  try {
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, {method:'DELETE'});
    showToast('✅ Đã xoá phiếu');
    closeModal('hapjaDetailModal');
    loadDashboard();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
async function rejectHapja(id) {
  try {
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: 'rejected', approved_by: getEffectiveStaffCode(), approved_at: new Date().toISOString() }) });
    showToast('❌ Đã từ chối phiếu.');
    closeModal('hapjaDetailModal');
    loadDashboard();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
async function deleteProfile() {
  if (!currentProfileId || !confirm('Xác nhận xoá hồ sơ này?')) return;
  const pid = currentProfileId;
  async function del(path, method='DELETE', body=null) {
    const opts = {method};
    if (body) opts.body = JSON.stringify(body);
    const res = await sbFetch(path, opts);
    if (!res.ok) {
      const err = await res.text();
      console.error(`DELETE FAIL ${path}:`, err);
      throw new Error(err);
    }
  }
  try {
    // 1. Unlink check_hapja (FK → profiles, no CASCADE)
    await del(`/rest/v1/check_hapja?profile_id=eq.${pid}`, 'PATCH', {profile_id: null});
    // 2. Records FIRST (has FK session_id → consultation_sessions)
    await del(`/rest/v1/records?profile_id=eq.${pid}`);
    // 3. Consultation sessions
    await del(`/rest/v1/consultation_sessions?profile_id=eq.${pid}`);
    // 4. Form hanh chinh
    await del(`/rest/v1/form_hanh_chinh?profile_id=eq.${pid}`);
    // 5. Fruit roles → groups
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${pid}&select=id`);
    const fgs = await fgRes.json();
    for (const fg of (fgs||[])) {
      await del(`/rest/v1/fruit_roles?fruit_group_id=eq.${fg.id}`);
    }
    await del(`/rest/v1/fruit_groups?profile_id=eq.${pid}`);
    // 6. Profile
    await del(`/rest/v1/profiles?id=eq.${pid}`);
    showToast('✅ Đã xoá!'); backToList(); await loadProfiles();
  } catch(e) { showToast('❌ Lỗi: ' + (e.message||'').slice(0,80)); console.error('deleteProfile:', e); }
}
async function deleteRecord(id, type) {
  if (!confirm('Xoá phiếu này?')) return;
  try {
    await sbFetch(`/rest/v1/records?id=eq.${id}`, {method:'DELETE'});
    showToast('✅ Đã xoá!');
    if (type==='tu_van') loadRecords(currentProfileId,'tu_van','tvList','tvCount');
    else loadRecords(currentProfileId,'bien_ban','bbList','bbCount');
  } catch { showToast('❌ Lỗi'); }
}

