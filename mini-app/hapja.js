// ============ CHECK HAPJA ============
function canCreateHapja(pos) { return hasPermission('create_hapja'); }
function openCreateHapjaModal() {
  document.getElementById('createHapjaModal').classList.add('open');
  const sel = document.getElementById('hj_ndd');
  if (sel) sel.value = '';
}
async function submitCreateHapja() {
  const ndd = getStaffCodeFromInput('hj_ndd');
  const ngayChakki = document.getElementById('hj_ngay_chakki')?.value;
  const concept = document.getElementById('hj_concept')?.value?.trim();
  const fullName = document.getElementById('hj_full_name')?.value?.trim();
  const birthYear = document.getElementById('hj_birth_year')?.value?.trim() || '';
  const gender = document.getElementById('hj_gender')?.value || '';
  const hinhThuc = document.getElementById('hj_hinh_thuc')?.value?.trim();
  const thanThiet = document.getElementById('hj_than_thiet')?.value;
  const noiO = document.getElementById('hj_noi_o')?.value?.trim();
  const ngheNghiep = document.getElementById('hj_nghe_nghiep')?.value?.trim();
  const tcCongCu = document.getElementById('hj_tinh_cach_cong_cu')?.value?.trim();
  const tcKetNoi = document.getElementById('hj_kntn')?.value;
  const ttCoKhong = document.getElementById('hj_than_tinh_co_khong')?.value;
  const ttChiTiet = document.getElementById('hj_than_tinh_chi_tiet')?.value?.trim();
  const hcHienTai = document.getElementById('hj_hoan_canh_hien_tai')?.value?.trim();
  const hcHocKi = document.getElementById('hj_hoc_ki')?.value?.trim();
  const nlLoLang = document.getElementById('hj_noi_lo_lang')?.value?.trim();
  const nlQuanTam = document.getElementById('hj_su_quan_tam')?.value?.trim();
  const sdt = document.getElementById('hj_sdt')?.value?.trim();
  const henTV = document.getElementById('hj_hen_tv')?.value;

  if (!ndd) { showToast('⚠️ Vui lòng chọn NDD'); return; }
  if (!ngayChakki) { showToast('⚠️ Vui lòng chọn Ngày chakki'); return; }
  if (!concept) { showToast('⚠️ Vui lòng nhập Concept'); return; }
  if (!fullName) { showToast('⚠️ Vui lòng nhập Họ tên (mục 1)'); return; }
  if (!birthYear) { showToast('⚠️ Vui lòng nhập Năm sinh (mục 1)'); return; }
  if (!gender) { showToast('⚠️ Vui lòng chọn Giới tính (mục 1)'); return; }
  if (!hinhThuc) { showToast('⚠️ Vui lòng nhập Hình thức chakki (mục 2)'); return; }
  if (!thanThiet) { showToast('⚠️ Vui lòng chọn Mức độ thân thiết (mục 2)'); return; }
  if (!noiO) { showToast('⚠️ Vui lòng nhập Nơi ở (mục 3)'); return; }
  if (!ngheNghiep) { showToast('⚠️ Vui lòng nhập Nghề nghiệp/Nơi làm làm việc (mục 4)'); return; }
  if (!tcCongCu) { showToast('⚠️ Vui lòng nhập Tính cách theo công cụ (mục 5)'); return; }
  if (!tcKetNoi) { showToast('⚠️ Vui lòng chọn Kết nối tin nhắn (mục 5)'); return; }
  if (!ttCoKhong) { showToast('⚠️ Vui lòng chọn Thần tính phân loại (mục 6)'); return; }
  if (ttCoKhong !== 'Chưa khai thác' && !ttChiTiet) { showToast('⚠️ Vui lòng nhập Chi tiết thần tính (mục 6)'); return; }
  if (!hcHienTai) { showToast('⚠️ Vui lòng nhập Hoàn cảnh hiện tại (mục 7)'); return; }
  if (!hcHocKi) { showToast('⚠️ Vui lòng nhập Kì nghỉ/Học kì (mục 7)'); return; }
  if (!nlLoLang) { showToast('⚠️ Vui lòng nhập Nỗi lo lắng (mục 8)'); return; }
  if (!nlQuanTam) { showToast('⚠️ Vui lòng nhập Sự quan tâm (mục 8)'); return; }
  if (!sdt) { showToast('⚠️ Vui lòng nhập Số điện thoại (mục 9)'); return; }

  const payload = {
    full_name: fullName,
    birth_year: birthYear,
    gender: gender,
    data: {
      ndd_staff_code: ndd,
      ngay_chakki: ngayChakki,
      concept: concept,
      hinh_thuc: hinhThuc,
      than_thiet: thanThiet,
      noi_o: noiO,
      nghe_nghiep: ngheNghiep,
      tinh_cach_cong_cu: tcCongCu,
      tinh_cach_ket_noi: tcKetNoi,
      than_tinh_co_khong: ttCoKhong,
      than_tinh_chi_tiet: ttChiTiet,
      hoan_canh_hien_tai: hcHienTai,
      hoc_ki: hcHocKi,
      noi_lo_lang: nlLoLang,
      su_quan_tam: nlQuanTam,
      sdt: sdt,
      hen_tv: henTV
    },
    status: 'pending',
    created_by: typeof getEffectiveStaffCode === 'function' ? getEffectiveStaffCode() : 'unknown',
    semester_id: typeof currentSemesterId !== 'undefined' ? currentSemesterId : null
  };

  const btn = document.querySelector('#createHapjaModal .save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang gửi...'; }

  try {
    const res = await sbFetch('/rest/v1/check_hapja', { 
      method: 'POST', 
      headers: {'Prefer':'return=representation'}, 
      body: JSON.stringify(payload) 
    });
    
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Lỗi từ máy chủ');
    }

    closeModal('createHapjaModal');
    showToast('✅ Đã tạo phiếu Hapja!');
    
    const idsToClear = ['hj_ngay_chakki','hj_concept','hj_full_name','hj_birth_year',
    'hj_hinh_thuc','hj_noi_o','hj_nghe_nghiep','hj_tinh_cach_cong_cu','hj_than_tinh_chi_tiet',
    'hj_hoan_canh_hien_tai','hj_hoc_ki','hj_noi_lo_lang','hj_su_quan_tam','hj_sdt','hj_hen_tv'];
    idsToClear.forEach(id => {
      if(document.getElementById(id)) document.getElementById(id).value = '';
    });
    if(document.getElementById('hj_ndd')) document.getElementById('hj_ndd').value = '';
    if(document.getElementById('hj_gender')) document.getElementById('hj_gender').selectedIndex = 0;
    if(document.getElementById('hj_than_thiet')) document.getElementById('hj_than_thiet').selectedIndex = 0;
    if(document.getElementById('hj_kntn')) document.getElementById('hj_kntn').selectedIndex = 0;
    if(document.getElementById('hj_than_tinh_co_khong')) document.getElementById('hj_than_tinh_co_khong').selectedIndex = 0;

    // === Notify approvers about new Hapja ===
    try {
      const approverCodes = typeof getApproverCodes === 'function' ? await getApproverCodes() : [];
      if (typeof createNotification === 'function' && approverCodes.length > 0) {
        await createNotification(
          approverCodes,
          'hapja_created',
          `🍎 Phiếu Check Hapja mới`,
          `${fullName} — NDD: ${ndd || 'Chưa chọn'}`,
          null
        );
      }
      if (typeof loadPriority === 'function') loadPriority();
      if (typeof loadNotifCount === 'function') loadNotifCount();
    } catch(e) { console.warn('Hapja notify error:', e); }

    if (typeof loadDashboard === 'function') loadDashboard();
  } catch(e) { 
    showToast('❌ Lỗi: ' + e.message); 
    console.error(e); 
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📋 Tạo Phiếu'; }
  }
}
async function openHapjaDetail(id) {
  try {
    const hRes = await sbFetch(`/rest/v1/check_hapja?id=eq.${id}&select=*`);
    const hapjas = await hRes.json();
    if (!hapjas.length) { showToast('⚠️ Không tìm thấy phiếu'); return; }
    const h = hapjas[0];
    const d = h.data || {};
    const date = new Date(h.created_at).toLocaleDateString('vi-VN');
    const canApprove = hasPermission('approve_hapja') && h.status === 'pending';
    const body = document.getElementById('hapjaDetailBody');
    const fields = [
      ['Họ tên', h.full_name],
      ['Năm sinh', h.birth_year],
      ['Giới tính', h.gender],
      ['NDD', d.ndd_staff_code || h.created_by],
      ['Ngày Chakki', d.ngay_chakki],
      ['Concept', d.concept],
      ['Hình thức', d.hinh_thuc || (Array.isArray(d.hinh_thuc) ? d.hinh_thuc.join(', ') : '')],
      ['Mức thân thiết', d.than_thiet || (Array.isArray(d.than_thiet) ? d.than_thiet.join(', ') : '')],
      ['Nơi ở', d.noi_o],
      ['Nghề nghiệp', d.nghe_nghiep],
      ['Tính cách (CC)', d.tinh_cach_cong_cu || d.tinh_cach],
      ['Tính cách (TN)', d.tinh_cach_ket_noi],
      ['Thần tính', (d.than_tinh_co_khong || '') + (d.than_tinh_chi_tiet ? ` - ${d.than_tinh_chi_tiet}` : '') || (Array.isArray(d.than_tinh) ? d.than_tinh.join(', ') : d.than_tinh)],
      ['Hoàn cảnh HT', d.hoan_canh_hien_tai || d.hoan_canh],
      ['Học kì', d.hoc_ki],
      ['Nỗi lo', d.noi_lo_lang || d.noi_lo],
      ['Sự quan tâm', d.su_quan_tam],
      ['SĐT', d.sdt],
      ['Hẹn lịch TV', d.hen_tv ? new Date(d.hen_tv).toLocaleString('vi-VN') : ''],
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
      phone_number: d.sdt || '', ndd_staff_code: nddCode, created_by: h.created_by, phase: 'chakki',
      semester_id: h.semester_id || currentSemesterId || null
    })});
    const newProfile = await pRes.json();
    const newPid = newProfile?.[0]?.id;
    // Create fruit_group + NDD role
    if (newPid && nddCode) {
      try {
        const fgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
          telegram_group_id: null, profile_id: newPid, level: 'tu_van'
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
          t2_tinh_cach: d.tinh_cach_cong_cu || d.tinh_cach || '',
          t2_dia_chi: d.noi_o || '',
          t2_que_quan: '',
          t2_khung_ranh: d.tg_ranh || '',
          t2_so_thich: d.su_quan_tam || '',
          t2_chuyen_cu: d.hoan_canh_hien_tai || d.hoan_canh || '',
          t2_luu_y: d.noi_lo_lang || d.noi_lo || '',
        };
        await sbFetch('/rest/v1/form_hanh_chinh', { method:'POST', body: JSON.stringify({ profile_id: newPid, data: infoData }) });
      } catch(e) { console.warn('form_hanh_chinh creation:', e); }

      // Auto-create Chốt TV lần 1 
      try {
        await sbFetch('/rest/v1/consultation_sessions', { method:'POST', body: JSON.stringify({
          profile_id: newPid,
          session_number: 1,
          scheduled_at: d.hen_tv || null,
          created_by: getEffectiveStaffCode()
        })});
      } catch (e) { console.warn('Chot TV lan 1 fallback:', e); }
    }
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: 'approved', approved_by: getEffectiveStaffCode(), approved_at: new Date().toISOString(), profile_id: newPid }) });
    
    // Auto-sync into Google Sheets via Webhook
    if (typeof syncToGoogleSheet === 'function' && newPid) {
      setTimeout(() => syncToGoogleSheet(newPid), 1000); // delay 1s to ensure form data is saved
    }

    showToast('✅ Đã duyệt! Hồ sơ Trái quả đã được tạo.');
    closeModal('hapjaDetailModal');

    // === Auto-triggers for Hapja approval ===
    if (newPid) {
      // Priority: Smart task cho NDD — title tuỳ theo đã có lịch hẹn TV chưa
      // (TVV chưa thể biết lúc này — sẽ được điền khi Chốt TV → updateChotTV1Task tự cập nhật)
      if (typeof createPriorityTask === 'function' && nddCode) {
        const hasSchedule = !!(d.hen_tv); // Đã hẹn lịch TV từ phiếu Hapja
        const taskTitle = hasSchedule
          ? `Cần tìm TVV + xếp lịch TV — ${h.full_name}`
          : `Cần tìm TVV và xếp lịch TV — ${h.full_name}`;
        createPriorityTask(nddCode, newPid, 'chot_tv_1', taskTitle, null);
      }
      // Notification: notify creator
      if (typeof createNotification === 'function') {
        createNotification([h.created_by, nddCode], 'hapja_approved', '✅ Hapja đã duyệt', h.full_name, newPid);
      }
    }

    loadDashboard(); loadProfiles();
  } catch(e) { showToast('❌ Lỗi khi duyệt'); console.error(e); }
}
async function deleteHapja(id) {
  if (!await showConfirmAsync('Xác nhận xoá phiếu Check Hapja?')) return;
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
// Records (Tư vấn / BB)
async function loadRecords(profileId, type, listElId, countElId) {
  try {
    // Lấy cả danh sách tab lẫn record mới nhất TOÀN BỘ dòng thời gian song song
    const [res, latestRes] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.${type}&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=in.(tu_van,bien_ban)&select=id,record_type&order=created_at.desc&limit=1`)
    ]);
    const records = await res.json();
    const latestRows = await latestRes.json();
    document.getElementById(countElId).textContent = records.length + ' phiếu';
    const listEl = document.getElementById(listElId);
    if (!records.length) { listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có phiếu nào</div>'; return; }

    // ID mới nhất trên toàn bộ dòng thời gian (không phân biệt TV/BB)
    const globalNewestId = latestRows[0]?.id;
    const globalNewestType = latestRows[0]?.record_type;

    listEl.innerHTML = records.map((r, i) => {
      const c = r.content||{};
      const title = c.lan_thu ? `Lần thứ ${c.lan_thu}${c.ten_cong_cu ? ' — ' + c.ten_cong_cu : ''}` :
                    c.buoi_thu ? `Buổi thứ ${c.buoi_thu}` :
                    c.ten_cong_cu || 'Phiếu #'+(i+1);
      const preview = c.van_de || c.noi_dung || c.phan_hoi || '';
      const date = new Date(r.created_at).toLocaleDateString('vi-VN');
      // Nút xóa chỉ hiện nếu đây là record mới nhất TRÊN TOÀN BỘ dòng thời gian
      const isGlobalNewest = (r.id === globalNewestId && globalNewestType === type);
      const delBtn = isGlobalNewest
        ? `<button class="record-delete" onclick="event.stopPropagation();deleteRecord('${r.id}','${type}')" title="Xóa (đây là mới nhất trên dòng thời gian)">🗑️</button>`
        : `<button class="record-delete" style="opacity:0.2;cursor:not-allowed;" title="Không thể xóa — không phải mới nhất trên dòng thời gian" onclick="event.stopPropagation();">🔒</button>`;
      return `<div class="record-item" onclick="viewRecord('${r.id}','${type}')" style="cursor:pointer;">
        <div class="record-number">${i+1}</div>
        <div class="record-content">
          <div class="record-date">📅 ${date}</div>
          <div class="record-title">${title}</div>
          <div class="record-preview">${preview.substring(0,80)}${preview.length>80?'...':''}</div>
        </div>
        ${delBtn}
      </div>`;
    }).join('');
  } catch {}
}
async function deleteProfile() {
  if (!currentProfileId || !await showConfirmAsync('Xác nhận xoá hồ sơ này?')) return;
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
    // 1. Delete check_hapja (Previously unlinked, now hard delete as requested)
    await del(`/rest/v1/check_hapja?profile_id=eq.${pid}`);
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
  // Kiểm tra: đây có phải record mới nhất TRÊN TOÀN BỘ dòng thời gian không?
  try {
    const checkRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=in.(tu_van,bien_ban)&select=id&order=created_at.desc&limit=1`);
    const latest = await checkRes.json();
    if (!latest || !latest[0] || latest[0].id !== id) {
      showToast('⚠️ Chỉ xóa được báo cáo mới nhất trên dòng thời gian!');
      return;
    }
  } catch { showToast('❌ Lỗi kiểm tra'); return; }

  if (!await showConfirmAsync('Xóa phiếu mới nhất này?')) return;
  try {
    await sbFetch(`/rest/v1/records?id=eq.${id}`, {method:'DELETE'});
    showToast('✅ Đã xóa!');
    // Refresh cả timeline và cả 2 tab TV + BB
    const p = allProfiles.find(x => x.id === currentProfileId);
    if (p) loadJourney(p.id, p.phase || 'chakki');
    loadRecords(currentProfileId, 'tu_van', 'tvList', 'tvCount');
    loadRecords(currentProfileId, 'bien_ban', 'bbList', 'bbCount');
  } catch { showToast('❌ Lỗi'); }
}
