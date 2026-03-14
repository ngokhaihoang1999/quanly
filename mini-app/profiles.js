// ============ PROFILES ============
async function loadProfiles() {
  try {
    const res = await sbFetch('/rest/v1/profiles?select=*&order=created_at.desc');
    allProfiles = await res.json();
    renderProfiles(allProfiles);
  } catch { document.getElementById('profileList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Lỗi tải dữ liệu</div></div>'; }
}
function renderProfiles(profiles) {
  const el = document.getElementById('profileList');
  document.getElementById('profileCount').textContent = profiles.length + ' hồ sơ';
  if (!profiles.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Chưa có hồ sơ</div><div class="empty-sub">Nhấn ➕ để thêm</div></div>'; return; }
  el.innerHTML = profiles.map(p => {
    const statusColor = p.fruit_status === 'dropout' ? 'var(--red)' : 'var(--green)';
    const statusLabel = p.fruit_status === 'dropout' ? 'Drop-out' : 'Alive';
    return `
    <div class="profile-card" onclick="openProfileById('${p.id}')">
      <div class="avatar">${(p.full_name||'?')[0]}</div>
      <div class="profile-info">
        <div class="profile-name">${p.full_name}</div>
        <div class="profile-meta"><span class="status-dot" style="background:${statusColor};"></span>${statusLabel} · ${p.phone_number||'Chưa có SĐT'}</div>
      </div>
      <div class="profile-arrow">›</div>
    </div>`;
  }).join('');
}
let currentStatusFilter = 'all';
function setStatusFilter(filter, el) {
  currentStatusFilter = filter;
  document.querySelectorAll('#statusFilter .chip').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  filterProfiles();
}
function filterProfiles() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderProfiles(allProfiles.filter(p => {
    const matchName = p.full_name.toLowerCase().includes(q) || (p.phone_number||'').includes(q);
    const matchStatus = currentStatusFilter === 'all' || (p.fruit_status || 'alive') === currentStatusFilter;
    return matchName && matchStatus;
  }));
}

// ============ PROFILE DETAIL ============
async function openProfileById(id) {
  if (!id || id==='undefined') return;
  const p = allProfiles.find(x=>x.id===id);
  if (!p) { await loadProfiles(); return; }
  openProfile(p);
}
async function openProfile(p) {
  currentProfileId = p.id;
  ['tab-unit','tab-personal','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('detailView').style.display = 'block';
  document.getElementById('fabBtn').style.display = 'none';
  document.getElementById('profileDetailHeader').innerHTML = `
    <div class="profile-detail-avatar">${(p.full_name||'?')[0]}</div>
    <div class="profile-detail-name">${p.full_name}</div>
    <div class="profile-detail-meta">${p.phone_number||''} · ${p.status||'active'}</div>`;
  // Phase
  const phaseMap = {new:'🟡 Chakki', chakki:'🟡 Chakki', tu_van:'💬 Tư vấn', bb:'🎓 BB', center:'🏛️ Center', completed:'✅'};
  const phaseColor = {new:'#f59e0b', chakki:'#f59e0b', tu_van:'var(--accent)', bb:'var(--green)', center:'#8b5cf6', completed:'var(--green)'};
  const ph = p.phase || 'chakki';
  // Fetch roles for this profile
  let rolesInfo = {ndd:'', tvv:[], gvbb:'', la:''};
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${p.id}&select=id,fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs||[]).forEach(fg => (fg.fruit_roles||[]).forEach(r => {
      if (r.role_type==='ndd' && !rolesInfo.ndd) rolesInfo.ndd = r.staff_code;
      if (r.role_type==='tvv') rolesInfo.tvv.push(r.staff_code);
      if (r.role_type==='gvbb' && !rolesInfo.gvbb) rolesInfo.gvbb = r.staff_code;
      if (r.role_type==='la' && !rolesInfo.la) rolesInfo.la = r.staff_code;
    }));
  } catch(e) {}
  const nddDisplay = p.ndd_staff_code || rolesInfo.ndd || '—';
  const tvvDisplay = rolesInfo.tvv.length ? rolesInfo.tvv.join(', ') : '—';
  const gvbbDisplay = rolesInfo.gvbb || '—';
  // Latest session
  let latestInfo = '';
  try {
    const sRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${p.id}&select=*&order=session_number.desc&limit=1`);
    const ss = await sRes.json();
    if (ss[0]) latestInfo = `TV lần ${ss[0].session_number} (${ss[0].tool||'—'})`;
  } catch(e) {}
  // Summary card
  const fruitStatus = p.fruit_status || 'alive';
  const statusBg = fruitStatus === 'dropout' ? 'var(--red)' : 'var(--green)';
  const statusText = fruitStatus === 'dropout' ? '🔴 Drop-out' : '🟢 Alive';
  const reasonHtml = (fruitStatus === 'dropout' && p.dropout_reason) ? `<div style="font-size:11px;color:var(--red);margin-top:2px;padding:4px 8px;background:rgba(248,113,113,0.1);border-radius:4px;margin-bottom:8px;"><b>Lý do:</b> ${p.dropout_reason}</div>` : '';
  
  // Check if current user can toggle status (NDD/GYJN/BGYJN)
  const myCode2 = getEffectiveStaffCode();
  const pos2 = getCurrentPosition();
  const canToggleStatus = pos2 === 'admin' || nddDisplay === myCode2 || ['gyjn','bgyjn'].includes(pos2);
  const statusBtn = canToggleStatus ? `<span onclick="event.stopPropagation();toggleFruitStatus('${p.id}','${fruitStatus}')" style="cursor:pointer;font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>` : `<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>`;

  document.getElementById('profileSummaryCard').innerHTML = `
    <div style="background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);padding:12px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="display:flex;gap:6px;align-items:center;">
          ${statusBtn}
          <span style="font-size:12px;color:var(--text2);">${p.birth_year||'—'} · ${p.gender||'—'}</span>
        </div>
        <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:12px;background:${phaseColor[ph]};color:white;">${phaseMap[ph]||ph}</span>
      </div>
      ${reasonHtml}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;font-size:12px;">
        <div><span style="color:var(--text3);">NDD:</span> <b>${nddDisplay}</b></div>
        <div><span style="color:var(--text3);">TVV:</span> <b>${tvvDisplay}</b></div>
        <div><span style="color:var(--text3);">GVBB:</span> <b>${gvbbDisplay}</b></div>
        <div><span style="color:var(--text3);">GĐ:</span> <b>${phaseMap[ph]||ph}</b></div>
      </div>
      ${latestInfo ? `<div style="font-size:11px;color:var(--accent);margin-top:6px;">⏱ ${latestInfo}</div>` : ''}
    </div>`;
  // Tab visibility
  const tabTV = document.getElementById('tabTV');
  const tabBB = document.getElementById('tabBB');
  if (tabTV) tabTV.style.display = ['tu_van','bb','center','completed'].includes(ph) ? '' : 'none';
  if (tabBB) tabBB.style.display = ['bb','center','completed'].includes(ph) ? '' : 'none';
  clearFormFields();
  loadInfoSheet(p.id);
  loadJourney(p.id, ph);
  loadRecords(p.id, 'tu_van', 'tvList', 'tvCount');
  loadRecords(p.id, 'bien_ban', 'bbList', 'bbCount');
  // Reset tabs — first tab = Thông tin (infoSheet)
  document.querySelectorAll('#profileTabs .form-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('.form-card').forEach((c)=>c.classList.remove('active'));
  document.getElementById('infoSheet')?.classList.add('active');
}
function clearFormFields() {
  ['cv_ten','cv_nam_sinh','cv_gioi_tinh','cv_ndd','cv_tvv','cv_gvbb','cv_la','t2_ho_ten','t2_gioi_tinh','t2_nam_sinh','t2_nghe_nghiep','t2_thoi_gian_lam_viec','t2_sdt','t2_dia_chi','t2_que_quan','t2_khung_ranh','t2_so_thich','t2_tinh_cach','t2_du_dinh','t2_chuyen_cu','t2_nguoi_than','t2_nguoi_quan_trong','t2_quan_diem','t2_cong_cu','t2_luu_y'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['chips_ton_giao','chips_hon_nhan','chips_quan_he_ndd','chips_khong_gian_song'].forEach(clearChips);
}

// Cover page
async function loadCover(p) {
  if (p.full_name) document.getElementById('cv_ten').value = p.full_name;
  if (p.birth_year) document.getElementById('cv_nam_sinh').value = p.birth_year;
  if (p.gender) document.getElementById('cv_gioi_tinh').value = p.gender;
  if (p.ndd_staff_code) setStaffInputValue('cv_ndd', p.ndd_staff_code);
  // Load role names from info_sheet
  const info = p.info_sheet || {};
  if (info.tvv_name) document.getElementById('cv_tvv').value = info.tvv_name;
  if (info.la_name) document.getElementById('cv_la').value = info.la_name;
  // Also load GVBB from fruit_roles (may have been assigned via Telegram bot)
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${p.id}&select=id`);
    const fgs = await fgRes.json();
    if (fgs && fgs.length) {
      const fgId = fgs[0].id;
      const rolesRes = await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=eq.${fgId}&select=*`);
      const roles = await rolesRes.json();
      const gvbbRole = roles.find(r => r.role_type === 'gvbb');
      const tvvRole = roles.find(r => r.role_type === 'tvv');
      const nddRole = roles.find(r => r.role_type === 'ndd');
      if (gvbbRole) {
        const gvbbStaff = allStaff.find(s => s.staff_code === gvbbRole.staff_code);
        document.getElementById('cv_gvbb').value = gvbbStaff ? gvbbStaff.full_name : gvbbRole.staff_code;
      } else if (info.gvbb_name) {
        document.getElementById('cv_gvbb').value = info.gvbb_name;
      }
      if (tvvRole && !info.tvv_name) {
        const tvvStaff = allStaff.find(s => s.staff_code === tvvRole.staff_code);
        if (tvvStaff) document.getElementById('cv_tvv').value = tvvStaff.full_name;
      }
      if (nddRole && !p.ndd_staff_code) setStaffInputValue('cv_ndd', nddRole.staff_code);
    }
  } catch(e) { console.warn('loadCover roles:', e); }

  // Fetch linked Telegram group
  const groupLinkEl = document.getElementById('cv_group_link');
  if (groupLinkEl) {
    groupLinkEl.innerHTML = '';
    try {
      const fgRes2 = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${p.id}&select=telegram_group_id,telegram_group_title`);
      const fgs2 = await fgRes2.json();
      if (fgs2 && fgs2.length && fgs2[0].telegram_group_id) {
        const gid = String(fgs2[0].telegram_group_id);
        const title = fgs2[0].telegram_group_title || 'Group Trái quả';
        // Build deep link: supergroups start with -100
        let tgLink = null;
        if (gid.startsWith('-100')) {
          tgLink = `https://t.me/c/${gid.replace('-100','')}/1`;
        }
        if (tgLink) {
          groupLinkEl.innerHTML = `
            <button onclick="openGroupChat('${tgLink}')" style="
              width:100%;padding:12px;border-radius:var(--radius-sm);
              background:linear-gradient(135deg,#229ed9,#1a86c9);
              color:white;font-weight:600;font-size:14px;
              border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
              ✈️ Truy cập group: ${title}
            </button>`;
        }
      }
    } catch(e2) { console.warn('group link:', e2); }
  }
}
function openGroupChat(url) {
  if (window.Telegram?.WebApp?.openTelegramLink) {
    window.Telegram.WebApp.openTelegramLink(url);
  } else {
    window.open(url, '_blank');
  }
}
async function saveCover() {
  const data = {
    full_name: document.getElementById('cv_ten').value,
    birth_year: document.getElementById('cv_nam_sinh').value,
    gender: document.getElementById('cv_gioi_tinh').value,
    ndd_staff_code: getStaffCodeFromInput('cv_ndd'),
    info_sheet: {
      ...(allProfiles.find(p=>p.id===currentProfileId)?.info_sheet || {}),
      tvv_name: document.getElementById('cv_tvv').value,
      gvbb_name: document.getElementById('cv_gvbb').value,
      la_name: document.getElementById('cv_la').value,
    }
  };
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method: 'PATCH', body: JSON.stringify(data) });
    showToast('✅ Đã lưu Trang bìa!');
    await loadProfiles();
  } catch { showToast('❌ Lỗi khi lưu'); }
}

// Info sheet (Phiếu Thông tin - stored in form_hanh_chinh)
async function loadInfoSheet(profileId) {
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=*`);
    const data = await res.json();
    if (data.length > 0 && data[0].data) {
      const d = data[0].data;
      Object.entries(d).forEach(([key, val]) => { if (typeof val === 'string') { const el=document.getElementById(key); if(el) el.value=val; } });
      if (d.t2_ton_giao) setChipValues('chips_ton_giao', d.t2_ton_giao);
      if (d.t2_hon_nhan) setChipValues('chips_hon_nhan', d.t2_hon_nhan);
      if (d.t2_quan_he_ndd) setChipValues('chips_quan_he_ndd', d.t2_quan_he_ndd);
      if (d.t2_khong_gian_song) setChipValues('chips_khong_gian_song', d.t2_khong_gian_song);
    }
  } catch {}
}
async function saveInfoSheet() {
  const data = {};
  ['t2_ho_ten','t2_gioi_tinh','t2_nam_sinh','t2_nghe_nghiep','t2_thoi_gian_lam_viec','t2_sdt','t2_dia_chi','t2_que_quan','t2_khung_ranh','t2_so_thich','t2_tinh_cach','t2_du_dinh','t2_chuyen_cu','t2_nguoi_than','t2_nguoi_quan_trong','t2_quan_diem','t2_cong_cu','t2_luu_y'].forEach(id=>{ data[id]=document.getElementById(id)?.value||''; });
  data.t2_ton_giao = getChipValues('chips_ton_giao');
  data.t2_hon_nhan = getChipValues('chips_hon_nhan');
  data.t2_quan_he_ndd = getChipValues('chips_quan_he_ndd');
  data.t2_khong_gian_song = getChipValues('chips_khong_gian_song');
  try {
    await sbFetch('/rest/v1/form_hanh_chinh', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify({ profile_id: currentProfileId, data: data }) });
    showToast('✅ Đã lưu Phiếu Thông tin!');
  } catch { showToast('❌ Lỗi khi lưu'); }
}

// Records (Tư vấn / BB)
async function loadRecords(profileId, type, listElId, countElId) {
  try {
    const res = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.${type}&select=*&order=created_at.desc`);
    const records = await res.json();
    document.getElementById(countElId).textContent = records.length + ' phiếu';
    const listEl = document.getElementById(listElId);
    if (!records.length) { listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có phiếu nào</div>'; return; }
    listEl.innerHTML = records.map((r,i) => {
      const c = r.content||{};
      const title = c.lan_thu ? `Lần thứ ${c.lan_thu}${c.ten_cong_cu ? ' — ' + c.ten_cong_cu : ''}` :
                    c.buoi_thu ? `Buổi thứ ${c.buoi_thu}` :
                    c.ten_cong_cu || 'Phiếu #'+(i+1);
      const preview = c.van_de || c.noi_dung || c.phan_hoi || '';
      const date = new Date(r.created_at).toLocaleDateString('vi-VN');
      return `<div class="record-item" onclick="openRecord('${r.id}','${type}')" style="cursor:pointer;">
        <div class="record-number">${i+1}</div>
        <div class="record-content">
          <div class="record-date">📅 ${date}</div>
          <div class="record-title">${title}</div>
          <div class="record-preview">${preview.substring(0,80)}${preview.length>80?'...':''}</div>
        </div>
        <button class="record-delete" onclick="event.stopPropagation();deleteRecord('${r.id}','${type}')" title="Xoá">🗑️</button>
      </div>`;
    }).join('');
  } catch {}
}
async function openRecord(recordId, type) {
  // Fetch full record from server
  const res = await sbFetch(`/rest/v1/records?id=eq.${recordId}&select=*`);
  const rows = await res.json();
  if (!rows || !rows.length) return;
  const r = rows[0];
  currentRecordId = recordId;
  openAddRecordModal(type || r.record_type, r.content);
}

