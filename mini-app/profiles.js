// ============ PROFILES ============
async function loadProfiles() {
  try {
    const semFilter = typeof getSemesterFilter === 'function' ? getSemesterFilter() : '';
    const res = await sbFetch('/rest/v1/profiles?select=*,fruit_groups(fruit_roles(staff_code,role_type))&order=created_at.desc' + semFilter);
    const rawData = await res.json();
    allProfiles = rawData.map(p => {
      let tvv = [], gvbb = null, nddRole = null;
      (p.fruit_groups || []).forEach(fg => {
        (fg.fruit_roles || []).forEach(r => {
          if (r.role_type === 'ndd') nddRole = r.staff_code;
          if (r.role_type === 'tvv') tvv.push(r.staff_code);
          if (r.role_type === 'gvbb') gvbb = r.staff_code;
        });
      });
      p.ndd_staff_code = nddRole || p.ndd_staff_code;
      p.tvv_staff_code = tvv.length ? tvv.join(', ') : '';
      p.gvbb_staff_code = gvbb || '';
      return p;
    });
    renderProfiles(allProfiles);
    markFresh('profiles');
  } catch { document.getElementById('profileList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Lỗi tải dữ liệu</div></div>'; }
}
function renderProfiles(profiles) {
  const el = document.getElementById('profileList');
  document.getElementById('profileCount').textContent = profiles.length + ' hồ sơ';
  if (!profiles.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👤</div><div class="empty-title">Chưa có hồ sơ</div><div class="empty-sub">Nhấn ➕ để thêm</div></div>';
    return;
  }
  el.innerHTML = profiles.map(p => renderProfileCard(p)).join('');
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
  let p = allProfiles.find(x=>x.id===id);
  // Profile not in filtered cache (e.g. different semester) → fetch directly from DB
  if (!p) {
    try {
      const res = await sbFetch(`/rest/v1/profiles?id=eq.${id}&select=*,fruit_groups(fruit_roles(staff_code,role_type))`);
      const data = await res.json();
      if (!data || !data.length) { showToast('⚠️ Không tìm thấy hồ sơ'); return; }
      p = data[0];
      // Inject roles like loadProfiles does
      let tvv = [], gvbb = null, nddRole = null;
      (p.fruit_groups || []).forEach(fg => {
        (fg.fruit_roles || []).forEach(r => {
          if (r.role_type === 'ndd') nddRole = r.staff_code;
          if (r.role_type === 'tvv') tvv.push(r.staff_code);
          if (r.role_type === 'gvbb') gvbb = r.staff_code;
        });
      });
      p.ndd_staff_code = nddRole || p.ndd_staff_code;
      p.tvv_staff_code = tvv.length ? tvv.join(', ') : '';
      p.gvbb_staff_code = gvbb || '';
    } catch(e) { showToast('❌ Lỗi mở hồ sơ'); return; }
  }
  openProfile(p);
}
async function openProfile(p) {
  currentProfileId = p.id;
  ['tab-unit','tab-personal','tab-staff','tab-structure','tab-calendar','tab-priority'].forEach(t=>{ const el=document.getElementById(t); if(el) el.style.display='none'; });
  document.getElementById('detailView').style.display = 'block';
  document.getElementById('fabBtn').style.display = 'none';


  const ph = p.phase || 'chakki';
  const fStatus = p.fruit_status || 'alive';
  const isDropout = fStatus === 'dropout';
  const statusBg = isDropout ? 'var(--red)' : 'var(--green)';
  const statusText = isDropout ? '🔴 Drop-out' : '🟢 Alive';
  const myCode2 = getEffectiveStaffCode();
  const pos2 = getCurrentPosition();

  // Fetch roles + check real BB group
  let rolesInfo = {ndd:'', tvv:[], gvbb:''};
  let hasRealBBGroup = false;
  let realGroupId = null;
  let realGroupTitle = '';
  let realGroupInviteLink = '';
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${p.id}&select=id,telegram_group_id,telegram_group_title,invite_link,fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs||[]).forEach(fg => {
      // Real Telegram group ID: negative but > -1e12 (max ~13 digits)
      // Old placeholder -Date.now() values are < -1e12 — skip those
      const gid = fg.telegram_group_id;
      if (gid && gid > -1000000000000) {
        hasRealBBGroup = true;
        realGroupId = fg.telegram_group_id;
        realGroupTitle = fg.telegram_group_title || 'Group BB';
        if (fg.invite_link) realGroupInviteLink = fg.invite_link;
      }
      (fg.fruit_roles||[]).forEach(r => {
        if (r.role_type==='ndd' && !rolesInfo.ndd) rolesInfo.ndd = r.staff_code;
        if (r.role_type==='tvv') rolesInfo.tvv.push(r.staff_code);
        if (r.role_type==='gvbb' && !rolesInfo.gvbb) rolesInfo.gvbb = r.staff_code;
      });
    });
  } catch(e) {}
  const nddCode    = p.ndd_staff_code || rolesInfo.ndd || null;
  const tvvCode    = rolesInfo.tvv.length ? rolesInfo.tvv[0] : null; // primary TVV
  const gvbbCode   = rolesInfo.gvbb || null;
  const nddDisplay = nddCode ? getStaffLabel(nddCode) : '—';
  const tvvDisplay = rolesInfo.tvv.length
    ? rolesInfo.tvv.map(c => getStaffLabel(c)).join(', ') : '—';
  const gvbbDisplay = gvbbCode ? getStaffLabel(gvbbCode) : '—';

  // Per-profile role of current user
  const isProfileNDD  = (p.ndd_staff_code === myCode2) || (rolesInfo.ndd === myCode2);
  const isProfileTVV  = rolesInfo.tvv.includes(myCode2);
  const isProfileGVBB = rolesInfo.gvbb === myCode2;
  const hasFullEdit   = hasPermission('edit_profile') || isProfileNDD;
  const canEditTV     = hasFullEdit || isProfileTVV;
  const canEditBB     = hasFullEdit || isProfileGVBB;
  const canAccessTuDuy = (hasFullEdit || isProfileGVBB) && ['tu_van','bb','center','completed'].includes(ph);
  // Store for use in other functions
  window._profileRole = { isNDD: isProfileNDD, isTVV: isProfileTVV, isGVBB: isProfileGVBB, hasFullEdit, canEditTV, canEditBB };
  window._rolesDisplay = { ndd: nddDisplay, tvv: tvvDisplay, gvbb: gvbbDisplay };

  // Warning: phase tu_van/BB/center but no real Telegram group
  const bbNoGroupWarning = ['tu_van','bb','center'].includes(ph) && !hasRealBBGroup
    ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:5px 10px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.35);border-radius:6px;font-size:11px;color:var(--red);font-weight:600;">
        ⚠️ Chưa kết nối Group Telegram
       </div>` : '';

  // Latest activity
  let latestInfo = '';
  try {
    const [rRes, sRes] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&record_type=not.in.(mo_kt,note,ai_mindmap,ai_chat)&select=record_type,content,created_at&order=created_at.desc&limit=1`),
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${p.id}&select=session_number,tool,created_at&order=created_at.desc&limit=1`)
    ]);
    latestInfo = latestActivityLabel((await rRes.json())[0]||null, (await sRes.json())[0]||null);
  } catch(e) {}

    const canToggleStatus = hasFullEdit || isProfileNDD;
  const statusBtn = canToggleStatus
    ? `<span onclick="event.stopPropagation();toggleFruitStatus('${p.id}','${fStatus}')" style="cursor:pointer;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>`
    : `<span style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>`;
  const reasonHtml = (fStatus==='dropout' && p.dropout_reason)
    ? `<div style="font-size:11px;color:var(--red);padding:4px 8px;background:rgba(248,113,113,0.1);border-radius:4px;margin-top:4px;"><b>Lý do:</b> ${p.dropout_reason}</div>` : '';

  // KT toggle: NDD, GVBB hoặc full edit
  const isKT = p.is_kt_opened === true;
  const showKT = ['bb', 'center', 'completed'].includes(ph);
  const canToggleKT = (hasFullEdit || isProfileGVBB) && !isDropout;
  const ktHtml = showKT
    ? `<span ${canToggleKT ? `onclick="event.stopPropagation();toggleKTStatus('${p.id}', ${!isKT})"` : ''} style="${canToggleKT?'':'opacity:0.6;'}cursor:${canToggleKT?'pointer':'default'};font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;">${isKT ? '📖 Đã mở KT' : '📕 Chưa mở KT'}</span>`
    : '';

  // Avatar color & Gradient picker
  const avatarBg = p.avatar_color ? p.avatar_color : 'linear-gradient(135deg,var(--accent),#ec4899)';
  const canEditColor = hasFullEdit || isProfileNDD;
  const avatarClick = canEditColor ? `onclick="openAvatarGradientPicker('${p.id}','${encodeURIComponent(avatarBg)}')"` : '';
  const editHint = canEditColor ? `<div style="position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.45);text-align:center;font-size:8px;color:white;padding:2px 0;">🎨</div>` : '';

  // Khoá/Mở Khai Giảng - Tag Semester
  const semName = p.semester_id ? (allSemesters.find(s => s.id === p.semester_id)?.name || 'Kỳ ẩn') : 'Chưa có kỳ (Kỳ cũ)';
  const canEditSem = hasPermission('edit_profile') || hasPermission('manage_semester') || isProfileNDD;
  const semTag = `<span ${canEditSem ? `onclick="event.stopPropagation();promptChangeSemester('${p.id}', '${p.semester_id||''}')" style="cursor:pointer;"` : 'style="opacity:0.8;"'} class="semester-badge" title="Nhấn để Đổi Khai Giảng cho Trái này">📅 ${semName}</span>`;

  // ONE unified card
  document.getElementById('profileSummaryCard').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--border);border-radius:var(--radius);padding:18px 16px;">
      <!-- Top: avatar + name + badges + refresh -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div style="position:relative;width:56px;height:56px;border-radius:16px;background:${avatarBg};display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0;box-shadow:0 4px 16px rgba(124,106,247,0.3);overflow:hidden;cursor:${canEditColor?'pointer':'default'};" ${avatarClick}>
          ${(p.full_name||'?')[0]}
          ${editHint}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:18px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.full_name}</div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            ${statusBtn}
            <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:${PHASE_COLORS[ph]};color:white;">${PHASE_LABELS[ph]||ph}</span>
            ${ktHtml}
            ${semTag}
            ${p.birth_year ? `<span style="font-size:11px;color:var(--text2);">${p.birth_year}${p.gender ? ' · '+p.gender : ''}</span>` : (p.gender ? `<span style="font-size:11px;color:var(--text2);">${p.gender}</span>` : '')}

          </div>
          ${reasonHtml}
          ${bbNoGroupWarning}
        </div>
        <button data-share-id="${p.id}" data-share-name="${(p.full_name||'').replace(/"/g,'&quot;')}" onclick="shareProfile(this.dataset.shareId, this.dataset.shareName)" title="Chia sẻ hồ sơ" style="
          flex-shrink:0;width:34px;height:34px;border-radius:50%;border:1px solid var(--border);
          background:var(--accent);color:white;cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:all 0.2s;align-self:flex-start;padding:0;
          "><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
        <button id="profileRefreshBtn" onclick="refreshProfileInPlace()" title="Đồng bộ dữ liệu mới nhất" style="
          flex-shrink:0;width:34px;height:34px;border-radius:50%;border:1px solid var(--border);
          background:var(--surface2);color:var(--text2);font-size:16px;cursor:pointer;
          display:flex;align-items:center;justify-content:center;transition:all 0.2s;align-self:flex-start;
          ">🔄</button>
      </div>
      <!-- Bottom: roles grid + latest -->
      <div style="border-top:1px solid var(--border);padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:12px;">
        <div><span style="color:var(--text3);">NDD:</span> ${nddCode ? `<b onclick="showStaffCard('${nddCode}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted;" title="Xem hồ sơ TĐ">${nddDisplay}</b>` : `<b>${nddDisplay||'---'}</b>`}</div>
        <div><span style="color:var(--text3);">TVV:</span> ${tvvCode ? `<b onclick="showStaffCard('${tvvCode}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted;" title="Xem hồ sơ TĐ">${tvvDisplay}</b>` : `<b>${tvvDisplay||'---'}</b>`}</div>
        <div><span style="color:var(--text3);">GVBB:</span> ${gvbbCode ? `<b onclick="showStaffCard('${gvbbCode}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted;" title="Xem hồ sơ TĐ">${gvbbDisplay}</b>` : `<b>${gvbbDisplay||'---'}</b>`}</div>
        ${latestInfo ? `<div style="color:var(--accent);font-size:11px;">⏱ ${latestInfo}</div>` : '<div></div>'}
      </div>
      ${hasRealBBGroup && ['tu_van','bb','center','completed'].includes(ph) ? `
      <div style="margin-top:10px;border-top:1px solid var(--border);padding-top:10px;display:flex;align-items:center;gap:10px;">
        <span style="font-size:15px;">💬</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${realGroupTitle}</div>
        </div>
        <button onclick="openBBGroup(this)"
           data-gid="${realGroupId}"
           data-link="${(realGroupInviteLink||'').replace(/"/g,'&quot;')}"
           style="padding:5px 14px;border-radius:20px;background:var(--green);color:white;font-size:11px;font-weight:700;border:none;cursor:pointer;white-space:nowrap;">Mở Group →</button>
      </div>` : ''}
      </div>
    </div>`;

  // Tab TV: hiện khi có TVV, bất kể phase (vì Chốt TV có thể xảy ra ở phase Chakki)
  const tabTV = document.getElementById('tabTV');
  const tabBB = document.getElementById('tabBB');
  const tabMM = document.getElementById('tabMindmap');
  const showTabTV = canEditTV && !!tvvCode;
  if (tabTV) tabTV.style.display = showTabTV ? '' : 'none';
  if (tabBB) tabBB.style.display = (canEditBB && ['tu_van','bb','center','completed'].includes(ph)) ? '' : 'none';
  if (tabMM) tabMM.style.display = canAccessTuDuy ? '' : 'none';
  clearFormFields();
  loadInfoSheet(p.id);
  loadJourney(p.id, ph);
  loadRecords(p.id, 'tu_van', 'tvList', 'tvCount');
  loadRecords(p.id, 'bien_ban', 'bbList', 'bbCount');
  loadNotes(p.id);

  // ── Smart default tab theo phase ──────────────────────────────────────────
  // Phase tu_van_hinh hoặc chakki mà đã có TVV → mở tab TV để viết BC
  // Phase tu_van (Group TV) → mở tab BB (và Tư Duy nếu accessible)
  // Còn lại → Giai đoạn
  let defaultTabId = 'journeyTab';    // mặc định Giai đoạn
  let defaultTabEl = null;

  if (['tu_van_hinh','chakki','new'].includes(ph) && showTabTV) {
    // Có TVV → mở tab TV để viết báo cáo
    defaultTabId = 'tuVan';
  } else if (ph === 'tu_van' && canEditBB) {
    // Đã vào Group TV (phase 3) → mở BB
    defaultTabId = 'bienBan';
  }

  document.querySelectorAll('#profileTabs .form-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.form-card').forEach(c => c.classList.remove('active'));

  // Tìm tab button và card tương ứng
  defaultTabEl = [...document.querySelectorAll('#profileTabs .form-tab')]
    .find(t => t.getAttribute('onclick')?.includes(defaultTabId));
  const defaultCard = document.getElementById(defaultTabId);

  if (defaultTabEl && defaultCard && defaultCard.style.display !== 'none' && defaultTabEl.style.display !== 'none') {
    defaultTabEl.classList.add('active');
    defaultCard.classList.add('active');
  } else {
    // Fallback: Giai đoạn
    const journeyTabEl = [...document.querySelectorAll('#profileTabs .form-tab')]
      .find(t => t.getAttribute('onclick')?.includes('journeyTab'));
    if (journeyTabEl) journeyTabEl.classList.add('active');
    document.getElementById('journeyTab')?.classList.add('active');
  }
  
  // Show/hide delete button at bottom of infoSheet
  const delBtn = document.getElementById('deleteProfileBtn');
  if (delBtn) delBtn.style.display = hasPermission('edit_profile') ? 'block' : 'none';

  // Hide add buttons if dropout
  document.querySelectorAll('.add-record-btn').forEach(b => {
      if (fStatus === 'dropout') b.style.display = 'none';
      else b.style.display = '';
  });
}

// ── Refresh in-place: sync dữ liệu mới nhất, giữ nguyên tab đang mở ──
async function refreshProfileInPlace() {
  if (!currentProfileId) return;
  const btn = document.getElementById('profileRefreshBtn');
  if (btn) { btn.style.transform = 'rotate(360deg)'; btn.style.transition = 'transform 0.5s ease'; }
  // Nhớ tab đang active
  const activeTab = document.querySelector('#profileTabs .form-tab.active');
  const activeCard = document.querySelector('.form-card.active');
  const activeTabId = activeTab?.getAttribute('onclick')?.match(/'([^']+)'/)?.[1] || null;

  try {
    // Fetch profile mới nhất
    const pRes = await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&select=*`);
    const ps = await pRes.json();
    if (!ps[0]) { showToast('⚠️ Không tìm thấy hồ sơ'); return; }
    const p = ps[0];
    // Cập nhật cache
    const idx = allProfiles.findIndex(x => x.id === currentProfileId);
    if (idx >= 0) allProfiles[idx] = p;

    const ph = p.phase || 'chakki';
    // Refresh timeline + records (phần thay đổi nhiều nhất)
    await Promise.all([
      loadJourney(p.id, ph),
      loadRecords(p.id, 'tu_van', 'tvList', 'tvCount'),
      loadRecords(p.id, 'bien_ban', 'bbList', 'bbCount')
    ]);

    // Refresh summary card (cập nhật phase badge, KT badge, roles)
    await openProfile(p);

    // Khôi phục tab đang mở
    if (activeTabId) {
      const targetTab = [...document.querySelectorAll('#profileTabs .form-tab')]
        .find(t => t.getAttribute('onclick')?.includes(activeTabId));
      const targetCard = document.getElementById(activeTabId);
      if (targetTab && targetCard) {
        document.querySelectorAll('#profileTabs .form-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.form-card').forEach(c => c.classList.remove('active'));
        targetTab.classList.add('active');
        targetCard.classList.add('active');
      }
    }
    showToast('✅ Đã đồng bộ dữ liệu');
  } catch(e) {
    showToast('❌ Lỗi đồng bộ'); console.error(e);
  } finally {
    if (btn) { setTimeout(() => { btn.style.transform = ''; btn.style.transition = ''; }, 520); }
  }
}
function clearFormFields() {
  ['t2_ho_ten','t2_gioi_tinh','t2_nam_sinh','t2_nghe_nghiep','t2_thoi_gian_lam_viec','t2_sdt','t2_dia_chi','t2_que_quan','t2_khung_ranh','t2_so_thich','t2_tinh_cach','t2_du_dinh','t2_chuyen_cu','t2_nguoi_than','t2_nguoi_quan_trong','t2_quan_diem','t2_cong_cu','t2_luu_y'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['chips_ton_giao','chips_hon_nhan','chips_quan_he_ndd','chips_khong_gian_song'].forEach(clearChips);
}


// Info sheet (Phiếu Thông tin - stored in form_hanh_chinh)
async function loadInfoSheet(profileId) {
  try {
    const res = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=*`);
    const data = await res.json();
    if (data.length > 0 && data[0].data) {
      const d = data[0].data;
      // Store for mindmap use
      window._currentInfoSheet = {
        gioi_tinh: d.t2_gioi_tinh, nam_sinh: d.t2_nam_sinh, nghe_nghiep: d.t2_nghe_nghiep,
        ton_giao: d.t2_ton_giao, hon_nhan: d.t2_hon_nhan, dia_chi: d.t2_dia_chi,
        que_quan: d.t2_que_quan, tinh_cach: d.t2_tinh_cach, so_thich: d.t2_so_thich,
        du_dinh: d.t2_du_dinh, nguoi_quan_trong: d.t2_nguoi_quan_trong,
        quan_diem: d.t2_quan_diem, sdt: d.t2_sdt,
        chuyen_cu: d.t2_chuyen_cu, nguoi_than: d.t2_nguoi_than, luu_y: d.t2_luu_y,
        khong_gian_song: d.t2_khong_gian_song, quan_he_ndd: d.t2_quan_he_ndd
      };
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
    // 1. Save info sheet
    await sbFetch('/rest/v1/form_hanh_chinh', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify({ profile_id: currentProfileId, data: data }) });

    // 2. Sync key fields to profiles table (name, birth_year, gender, phone)
    const profilePatch = {};
    if (data.t2_ho_ten)    profilePatch.full_name    = data.t2_ho_ten;
    if (data.t2_nam_sinh)  profilePatch.birth_year   = data.t2_nam_sinh;
    if (data.t2_gioi_tinh) profilePatch.gender       = data.t2_gioi_tinh;
    if (data.t2_sdt)       profilePatch.phone_number = data.t2_sdt;
    if (Object.keys(profilePatch).length > 0) {
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify(profilePatch) });
      // 3. Update local cache
      const idx = allProfiles.findIndex(x => x.id === currentProfileId);
      if (idx >= 0) {
        Object.assign(allProfiles[idx], profilePatch);
        // Re-render summary card with updated data
        const p = allProfiles[idx];
        const fStatus = p.fruit_status || 'alive';
        const statusLabel = fStatus === 'dropout' ? '🔴 Drop-out' : '🟢 Alive';
        // Update just the name+meta in the card without full reload
        const nameEl = document.querySelector('#profileSummaryCard [data-field="name"]');
        if (nameEl) nameEl.textContent = p.full_name;
        // Trigger full re-render of summary card
        openProfile(p);
      }
      // 4. Refresh profile list
      filterProfiles();
    }

    showToast('✅ Đã lưu Phữu Thông tin!');
    // Auto-sync form changes to Google Sheets
    if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(currentProfileId);
  } catch { showToast('❌ Lỗi khi lưu'); }
}

// Records (Tư vấn / BB) → loadRecords() và deleteRecord() định nghĩa trong hapja.js
async function openRecord(recordId, type) {
  // Fetch full record from server
  const res = await sbFetch(`/rest/v1/records?id=eq.${recordId}&select=*`);
  const rows = await res.json();
  if (!rows || !rows.length) return;
  const r = rows[0];
  currentRecordId = recordId;
  openAddRecordModal(type || r.record_type, r.content);
}

function openBBGroup(btnEl) {
  const groupId = btnEl.dataset.gid;
  const inviteLink = btnEl.dataset.link;
  const tgWA = window.Telegram && Telegram.WebApp;

  // Priority 1: use stored invite link
  if (inviteLink) {
    tgWA ? Telegram.WebApp.openTelegramLink(inviteLink) : window.open(inviteLink, '_blank');
    return;
  }

  // Priority 2: supergroup → t.me/c/XXXXX
  const idStr = String(groupId);
  if (idStr.startsWith('-100')) {
    const link = 'https://t.me/c/' + idStr.slice(4); // remove '-100'
    tgWA ? Telegram.WebApp.openTelegramLink(link) : window.open(link, '_blank');
    return;
  }

  // Priority 3: basic group → tg:// deep link (works if user is member)
  // Use openLink (not openTelegramLink) for tg:// scheme
  const tgDeep = 'tg://openmessage?chat_id=' + groupId;
  if (tgWA && Telegram.WebApp.openLink) {
    try {
      Telegram.WebApp.openLink(tgDeep);
      return;
    } catch(e) {}
  }

  // Priority 4: try to refresh invite link from DB (bypassing cache) then alert
  sbFetch(`/rest/v1/fruit_groups?telegram_group_id=eq.${groupId}&select=invite_link`, {
    headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  }).then(async r => {
    const rows = await r.json();
    const fresh = rows?.[0]?.invite_link;
    if (fresh) {
      btnEl.dataset.link = fresh; // Cập nhật luôn cho lần click sau đỡ fetch
      tgWA ? Telegram.WebApp.openTelegramLink(fresh) : window.open(fresh, '_blank');
    } else {
      alert('⚠️ Chưa có link mời vào group.\n\nCách xử lý:\nTrong Group Telegram, Admin hãy copy Link Mời (Settings > Invite Link) và gửi lệnh:\n/setlink [Link_vừa_copy]');
    }
  }).catch(() => {
    alert('⚠️ Lỗi kiểm tra link. Hãy thử đóng Mini App và mở lại.');
  });
}

// ── XOÁ HỒ SƠ ──────────────────────────────────────────────────────────────
async function deleteProfile(profileId, name) {
  if (!hasPermission('edit_profile')) { showToast('🚫 Không có quyền xoá'); return; }
  const confirmed = await showConfirmAsync(
    `🗑️ Xoá hồ sơ "${name}"?\n\nHành động này sẽ xoá TOÀN BỘ dữ liệu liên quan (records, ghi chú, TV, BB, Hapja...) và KHÔNG THỂ KHÔI PHỤC.`
  );
  if (!confirmed) return;
  try {
    showToast('⏳ Đang xoá...');
    // Cascade delete in correct order (FK constraints)
    await Promise.all([
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}`, { method: 'DELETE' }),
      sbFetch(`/rest/v1/records?profile_id=eq.${profileId}`, { method: 'DELETE' }),
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}`, { method: 'DELETE' }),
      sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}`, { method: 'DELETE' }),
    ]);
    // Delete fruit_roles → fruit_groups → profiles
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id`);
    const fgs = await fgRes.json();
    if (fgs && fgs.length) {
      const fgIds = fgs.map(g => g.id).join(',');
      await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=in.(${fgIds})`, { method: 'DELETE' });
      await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}`, { method: 'DELETE' });
    }
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, { method: 'DELETE' });
    // Remove from local cache and go back
    allProfiles = allProfiles.filter(x => x.id !== profileId);
    renderProfiles(allProfiles);
    backToList();
    showToast('🗑️ Đã xoá hồ sơ thành công');
  } catch(e) {
    console.error('deleteProfile:', e);
    showToast('❌ Lỗi khi xoá hồ sơ');
  }
}

// ============ SHARE PROFILE ============
function shareProfile(profileId, profileName) {
  window._shareProfileName = profileName || '';
  let existing = document.getElementById('shareProfileModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'shareProfileModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -8px 40px rgba(0,0,0,0.3);">
      <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 14px;"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">📤 Chia sẻ hồ sơ</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">${profileName}</div>

      <!-- Option 1: Send to staff -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">🔔 Gửi tới TĐ trong hệ thống</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">TĐ sẽ nhận hồ sơ trong phần Thông báo 🔔</div>
        <div style="position:relative;">
          <input type="text" id="shareStaffSearch" placeholder="Tìm mã TĐ hoặc tên..." oninput="_searchShareStaff(this.value)"
            style="width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;" />
          <div id="shareStaffResults" style="display:none;position:absolute;left:0;right:0;top:100%;background:var(--surface);border:1px solid var(--border);border-radius:0 0 8px 8px;max-height:160px;overflow-y:auto;z-index:10;box-shadow:0 4px 12px rgba(0,0,0,0.15);"></div>
        </div>
        <div id="shareStaffSelected" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;"></div>
        <button id="shareSendBtn" onclick="_sendShareToStaff('${profileId}','${profileName.replace(/'/g,"\\'")}')" disabled
          style="margin-top:10px;width:100%;padding:10px;background:var(--accent);color:white;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;opacity:0.5;">
          📨 Gửi thông báo
        </button>
      </div>

      <!-- Option 2: Copy deep link -->
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:14px;">
        <div style="font-size:13px;font-weight:600;margin-bottom:8px;">🔗 Lấy link mở hồ sơ</div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:10px;">Link mở Mini App đến thẳng hồ sơ này</div>
        <input id="shareDeepLinkInput" type="text" readonly value="https://t.me/quanlyhcm_bot/app?startapp=${profileId}"
          onclick="this.select()" style="width:100%;padding:9px 12px;border-radius:8px 8px 0 0;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:11px;box-sizing:border-box;font-family:monospace;" />
        <button onclick="_copyProfileDeepLink('${profileId}')"
          style="width:100%;padding:10px;background:var(--accent);color:white;border:none;border-radius:0 0 10px 10px;font-size:13px;font-weight:600;cursor:pointer;">
          📋 Sao chép link
        </button>
      </div>

      <button onclick="document.getElementById('shareProfileModal').remove()"
        style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;">Đóng</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

let _shareSelectedStaff = [];

function _searchShareStaff(q) {
  const box = document.getElementById('shareStaffResults');
  if (!box) return;
  if (!q.trim() || q.length < 1) { box.style.display = 'none'; return; }
  const ql = q.toLowerCase();
  const matches = (allStaff || []).filter(s =>
    (s.staff_code||'').toLowerCase().includes(ql) ||
    (s.full_name||'').toLowerCase().includes(ql) ||
    (s.nickname||'').toLowerCase().includes(ql)
  ).slice(0, 8);
  if (!matches.length) { box.style.display = 'none'; return; }
  box.style.display = 'block';
  box.innerHTML = matches.map(s => {
    const alreadySelected = _shareSelectedStaff.includes(s.staff_code);
    return `<div onclick="_addShareStaff('${s.staff_code}','${(s.nickname||s.full_name||'').replace(/'/g,"\\'")}')"
      style="padding:8px 12px;cursor:${alreadySelected?'default':'pointer'};font-size:12px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;${alreadySelected?'opacity:0.4;':''}">
      <span><b>${s.staff_code}</b> · ${s.nickname||s.full_name}</span>
      ${alreadySelected ? '<span style="color:var(--accent);font-size:10px;">✓ đã chọn</span>' : ''}
    </div>`;
  }).join('');
}

function _addShareStaff(code, name) {
  if (_shareSelectedStaff.includes(code)) return;
  _shareSelectedStaff.push(code);
  const selBox = document.getElementById('shareStaffSelected');
  if (selBox) {
    selBox.innerHTML += `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--accent);color:white;border-radius:16px;font-size:11px;font-weight:600;">
      ${code} <span onclick="_removeShareStaff('${code}')" style="cursor:pointer;opacity:0.7;font-size:14px;">✕</span>
    </span>`;
  }
  document.getElementById('shareStaffSearch').value = '';
  document.getElementById('shareStaffResults').style.display = 'none';
  const btn = document.getElementById('shareSendBtn');
  if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
}

function _removeShareStaff(code) {
  _shareSelectedStaff = _shareSelectedStaff.filter(c => c !== code);
  const selBox = document.getElementById('shareStaffSelected');
  if (selBox) selBox.innerHTML = _shareSelectedStaff.map(c =>
    `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:var(--accent);color:white;border-radius:16px;font-size:11px;font-weight:600;">
      ${c} <span onclick="_removeShareStaff('${c}')" style="cursor:pointer;opacity:0.7;font-size:14px;">✕</span>
    </span>`
  ).join('');
  const btn = document.getElementById('shareSendBtn');
  if (btn && !_shareSelectedStaff.length) { btn.disabled = true; btn.style.opacity = '0.5'; }
}

async function _sendShareToStaff(profileId, profileName) {
  if (!_shareSelectedStaff.length) return;
  const btn = document.getElementById('shareSendBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang gửi...'; }
  try {
    const myName = myStaff?.nickname || myStaff?.full_name || myStaff?.staff_code || '';
    const title = `📤 ${myName} chia sẻ hồ sơ: ${profileName}`;
    const body = `Nhấn để xem hồ sơ trái quả "${profileName}"`;
    await createNotification(_shareSelectedStaff, 'chot_tv', title, body, profileId);
    showToast(`✅ Đã gửi tới ${_shareSelectedStaff.length} TĐ!`);
    _shareSelectedStaff = [];
    document.getElementById('shareProfileModal')?.remove();
  } catch(e) {
    showToast('❌ Lỗi gửi thông báo');
    console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = '📨 Gửi thông báo'; }
  }
}

function _copyProfileDeepLink(profileId) {
  const link = `https://t.me/quanlyhcm_bot/app?startapp=${profileId}`;
  const displayName = (window._shareProfileName || 'Hồ sơ trái quả').trim();
  const copyText = `🍎 ${displayName}\n${link}`;

  // Update the input to show the full text
  const inp = document.getElementById('shareDeepLinkInput');

  // Method 1: execCommand via hidden textarea (most reliable in Telegram WebApp)
  const ta = document.createElement('textarea');
  ta.value = copyText;
  ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, 99999);
  try {
    document.execCommand('copy');
    showToast('📋 Đã sao chép: ' + displayName);
    ta.remove();
    return;
  } catch(e) { console.warn('execCommand copy failed:', e); }
  ta.remove();

  // Method 2: Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(copyText).then(() => {
      showToast('📋 Đã sao chép: ' + displayName);
    }).catch(() => showToast('⚠️ Copy thất bại, hãy chọn link bên trên và copy thủ công'));
    return;
  }

  showToast('⚠️ Hãy nhấn vào ô link bên trên, giữ và chọn "Copy"');
}

function _fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); showToast('📋 Đã sao chép link!'); }
  catch(e) { showToast('⚠️ Không thể copy, hãy copy thủ công: ' + text); }
  ta.remove();
}
