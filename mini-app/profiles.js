// ============ PROFILES ============
async function loadProfiles(force = false) {
  if (!force && typeof isFresh === 'function' && isFresh('profiles') && allProfiles && allProfiles.length > 0) {
    renderProfiles(allProfiles);
    return;
  }
  try {
    const semFilter = typeof getSemesterFilter === 'function' ? getSemesterFilter() : '';
    const res = await sbFetch('/rest/v1/profiles?select=*,fruit_groups(telegram_group_id,fruit_roles(staff_code,role_type))&order=created_at.desc' + semFilter);
    const rawData = await res.json();
    allProfiles = rawData.map(p => {
      let tvv = [], gvbb = null, nddRole = null, la = [];
      // Sort fruit_groups: real Telegram groups first (has telegram_group_id > -1e12), placeholders last
      const sortedFGs = (p.fruit_groups || []).sort((a, b) => {
        const aReal = a.telegram_group_id && a.telegram_group_id > -1000000000000 ? 1 : 0;
        const bReal = b.telegram_group_id && b.telegram_group_id > -1000000000000 ? 1 : 0;
        return bReal - aReal; // real groups first
      });
      sortedFGs.forEach(fg => {
        (fg.fruit_roles || []).forEach(r => {
          if (r.role_type === 'ndd' && !nddRole) nddRole = r.staff_code;
          if (r.role_type === 'tvv') tvv.push(r.staff_code);
          if (r.role_type === 'gvbb' && !gvbb) gvbb = r.staff_code;
          if (r.role_type === 'la') la.push(r.staff_code);
        });
      });
      p.ndd_staff_code = nddRole || p.ndd_staff_code;
      p.tvv_staff_code = tvv.length ? tvv.join(', ') : '';
      p.gvbb_staff_code = gvbb || '';
      p.la_staff_code = la.length ? la.join(', ') : '';
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
let _filterDebounce = 0;
function filterProfiles() {
  clearTimeout(_filterDebounce);
  _filterDebounce = setTimeout(_filterProfilesNow, 150);
}
function _filterProfilesNow() {
  const q = document.getElementById('searchInput').value.toLowerCase();
  renderProfiles(allProfiles.filter(p => {
    const matchName = p.full_name.toLowerCase().includes(q) || (p.phone_number||'').includes(q);
    const matchStatus = currentStatusFilter === 'all' || (p.fruit_status || 'alive') === currentStatusFilter;
    return matchName && matchStatus;
  }));
}

// ============ PROFILE DETAIL ============
async function openProfileById(id, evt, initialTabId) {
  if (!id || id==='undefined') return;
  // Find the card element: use the event target (exact click) instead of querySelector (which grabs first match in DOM)
  let cardEl = null;
  if (evt && evt.target) {
    cardEl = evt.target.closest('.profile-card');
  }
  if (!cardEl) {
    cardEl = document.querySelector(`.profile-card[data-pid="${id}"]`);
  }
  let p = allProfiles.find(x=>x.id===id);
  // Profile not in filtered cache (e.g. different semester) → fetch directly from DB
  if (!p) {
    try {
      const res = await sbFetch(`/rest/v1/profiles?id=eq.${id}&select=*,fruit_groups(telegram_group_id,fruit_roles(staff_code,role_type))`);
      const data = await res.json();
      if (!data || !data.length) { showToast('⚠️ Không tìm thấy hồ sơ'); return; }
      p = data[0];
      // Inject roles like loadProfiles does — prioritize real groups
      let tvv = [], gvbb = null, nddRole = null, la = [];
      const sortedFGs = (p.fruit_groups || []).sort((a, b) => {
        const aReal = a.telegram_group_id && a.telegram_group_id > -1000000000000 ? 1 : 0;
        const bReal = b.telegram_group_id && b.telegram_group_id > -1000000000000 ? 1 : 0;
        return bReal - aReal;
      });
      sortedFGs.forEach(fg => {
        (fg.fruit_roles || []).forEach(r => {
          if (r.role_type === 'ndd' && !nddRole) nddRole = r.staff_code;
          if (r.role_type === 'tvv') tvv.push(r.staff_code);
          if (r.role_type === 'gvbb' && !gvbb) gvbb = r.staff_code;
          if (r.role_type === 'la') la.push(r.staff_code);
        });
      });
      p.ndd_staff_code = nddRole || p.ndd_staff_code;
      p.tvv_staff_code = tvv.length ? tvv.join(', ') : '';
      p.gvbb_staff_code = gvbb || '';
      p.la_staff_code = la.length ? la.join(', ') : '';
    } catch(e) { showToast('❌ Lỗi mở hồ sơ'); return; }
  }
  // Guard: check unsaved changes before switching profile
  if (typeof DirtyFormGuard !== 'undefined' && currentProfileId && currentProfileId !== id) {
    var blocked = DirtyFormGuard.guard(function() {
      var pp = allProfiles.find(function(x){ return x.id === id; }) || p;
      openProfile(pp, cardEl, initialTabId);
    });
    if (blocked) return;
  }
  openProfile(p, cardEl, initialTabId);
}
async function openProfile(p, cardEl, initialTabId) {
  currentProfileId = p.id;

  window.isDetailViewOpen = true;
  document.body.classList.add('detail-view-open');
  document.documentElement.classList.add('detail-view-open');
  // Animated profile transition
  if (typeof ProfileTransition !== 'undefined') {
    ProfileTransition.open(cardEl, p.id);
  } else {
    document.getElementById('detailView').style.display = 'block';
  }
  // Hide ALL center tabs (including reports, unit, etc.) — not just the static list
  ['tab-unit','tab-personal','tab-staff','tab-structure','tab-calendar','tab-priority','tab-reports','tab-notes'].forEach(t=>{ 
    const el = document.getElementById(t); 
    if (el && (typeof _isTabPinned !== 'function' || !_isTabPinned(t.replace('tab-','')))) {
      el.style.display = 'none'; 
    }
  });
  document.getElementById('fabBtn').style.display = 'none';


  const ph = p.phase || 'chakki';
  const fStatus = p.fruit_status || 'alive';
  const isInactive = fStatus === 'dropout' || fStatus === 'pause';
  const statusBg = fStatus === 'dropout' ? 'var(--red)' : fStatus === 'pause' ? '#9ca3af' : 'var(--green)';
  const statusText = fStatus === 'dropout' ? '🔴 Drop-out' : fStatus === 'pause' ? '⏸️ Pause' : '🟢 Alive';
  const myCode2 = getEffectiveStaffCode();
  const pos2 = getCurrentPosition();

  // Fetch roles + latest activity cùng 1 lần (giảm từ 2 round-trips xuống 1)
  let rolesInfo = {ndd:'', tvv:[], gvbb:'', la:[]};
  let hasRealBBGroup = false;
  let realGroupId = null;
  let realGroupTitle = '';
  let realGroupInviteLink = '';
  let latestInfo = '';
  let sessionsRows = [];
  window._hasDKCenter = false;

  try {
    const [fgRes, rRes, sRes, dkRes] = await Promise.all([
      sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${p.id}&select=id,telegram_group_id,telegram_group_title,invite_link,fruit_roles(id,staff_code,role_type,display_name)`),
      sbFetch(`/rest/v1/profile_records?profile_id=eq.${p.id}&record_type=not.in.(mo_kt,note,ai_mindmap,ai_chat,phase_change)&select=record_type,content,created_at&order=created_at.desc&limit=1`),
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${p.id}&select=id,session_number,tool,tvv_staff_code,created_at,scheduled_at&order=session_number.asc`),
      sbFetch(`/rest/v1/profile_records?profile_id=eq.${p.id}&record_type=eq.dky_center&select=id&limit=1`)
    ]);

    // ── Parse fruit_groups ──
    if (fgRes && fgRes.ok) {
      const fgs = await fgRes.json();
      if (Array.isArray(fgs)) {
        const sortedFGs = [...fgs].sort((a, b) => {
          const aReal = a.telegram_group_id && a.telegram_group_id > -1000000000000 ? 1 : 0;
          const bReal = b.telegram_group_id && b.telegram_group_id > -1000000000000 ? 1 : 0;
          return bReal - aReal;
        });
        sortedFGs.forEach(fg => {
          const gid = fg.telegram_group_id;
          if (gid && gid > -1000000000000) {
            hasRealBBGroup = true;
            realGroupId = fg.telegram_group_id;
            realGroupTitle = fg.telegram_group_title || 'Group BB';
            if (fg.invite_link) realGroupInviteLink = fg.invite_link;
          }
          (fg.fruit_roles||[]).forEach(r => {
            if (r.role_type==='ndd' && !rolesInfo.ndd) rolesInfo.ndd = r.staff_code;
            if (r.role_type==='tvv') rolesInfo.tvv.push({ id: r.id, code: r.staff_code, displayName: r.display_name || null });
            if (r.role_type==='la') rolesInfo.la.push({ id: r.id, code: r.staff_code, displayName: r.display_name || null });
            if (r.role_type==='gvbb' && !rolesInfo.gvbb) {
              rolesInfo.gvbb = r.staff_code;
              rolesInfo.gvbbDisplayName = r.display_name || null;
            }
          });
        });
      }
    }

    // ── Parse latest activity ──
    let latestRecord = null;
    if (rRes && rRes.ok) {
      const rData = await rRes.json();
      if (Array.isArray(rData)) latestRecord = rData[0] || null;
    }

    if (sRes && sRes.ok) {
      const sData = await sRes.json();
      if (Array.isArray(sData)) {
        sessionsRows = sData;
      }
    }

    const sortedSessions = [...sessionsRows].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    const latestSession = sortedSessions[0] || null;
    try {
      latestInfo = typeof latestActivityLabel === 'function' ? latestActivityLabel(latestRecord, latestSession) : '';
    } catch(err) { latestInfo = ''; }
    
    // ── Parse ĐK Center milestone ──
    if (dkRes && dkRes.ok) {
      const dkRows = await dkRes.json();
      window._hasDKCenter = !!(dkRows && dkRows.length > 0);
    }
  } catch(e) {
    console.error('Error fetching or parsing profile details:', e);
  }

  const tvv1 = sessionsRows.find(s => s.session_number === 1) || null;
  const tvv2 = sessionsRows.find(s => s.session_number === 2) || null;
  const tvv3 = sessionsRows.find(s => s.session_number === 3) || null;
  
  const tvv1Code = tvv1 ? tvv1.tvv_staff_code : null;
  const tvv2Code = tvv2 ? tvv2.tvv_staff_code : null;
  const tvv3Code = tvv3 ? tvv3.tvv_staff_code : null;
  
  const tvv1Display = tvv1Code ? (tvv1Code.startsWith('tg:') ? tvv1Code.replace('tg:', '') : getStaffLabel(tvv1Code)) : 'Chưa có';
  const tvv2Display = tvv2Code ? (tvv2Code.startsWith('tg:') ? tvv2Code.replace('tg:', '') : getStaffLabel(tvv2Code)) : 'Chưa có';
  const tvv3Display = tvv3Code ? (tvv3Code.startsWith('tg:') ? tvv3Code.replace('tg:', '') : getStaffLabel(tvv3Code)) : 'Chưa có';

  const nddCode    = p.ndd_staff_code || rolesInfo.ndd || null;
  const tvvCode    = rolesInfo.tvv.length ? rolesInfo.tvv[0].code : null; // primary TVV
  const gvbbCode   = rolesInfo.gvbb || null;
  const nddDisplay = nddCode ? getStaffLabel(nddCode) : 'Chưa có';
  // TVV: handle tg: prefix with display_name fallback (same as GVBB)
  const tvvDisplay = rolesInfo.tvv.length
    ? rolesInfo.tvv.map(t => (t.code && typeof t.code === 'string' && t.code.startsWith('tg:')) ? (t.displayName || t.code.replace('tg:','')) : getStaffLabel(t.code || '')).join(', ') : 'Chưa có';
  // GVBB: if staff_code starts with 'tg:' → show display_name (unregistered user)
  const gvbbDisplay = gvbbCode
    ? ((typeof gvbbCode === 'string' && gvbbCode.startsWith('tg:')) ? (rolesInfo.gvbbDisplayName || gvbbCode.replace('tg:','')) : getStaffLabel(gvbbCode))
    : 'Chưa có';
  const laDisplay = rolesInfo.la.length
    ? rolesInfo.la.map(t => (t.code && typeof t.code === 'string' && t.code.startsWith('tg:')) ? (t.displayName || t.code.replace('tg:','')) : getStaffLabel(t.code || '')).join(', ') : 'Chưa có';

  // Per-profile role of current user
  const isProfileNDD  = (p.ndd_staff_code === myCode2) || (rolesInfo.ndd === myCode2);
  const isProfileTVV  = rolesInfo.tvv.some(t => t.code === myCode2);
  const isProfileGVBB = rolesInfo.gvbb === myCode2;
  const isProfileLa   = rolesInfo.la.some(t => t.code === myCode2);
  const hasFullEdit   = hasPermission('edit_profile') || isProfileNDD;
  const canEditTV     = hasFullEdit || isProfileTVV;
  const canEditBB     = hasFullEdit || isProfileGVBB;
  const canAccessTuDuy = true;
  // Store for use in other functions
  window._profileRole = { isNDD: isProfileNDD, isTVV: isProfileTVV, isGVBB: isProfileGVBB, isLa: isProfileLa, hasFullEdit, canEditTV, canEditBB };
  window._rolesDisplay = { ndd: nddDisplay, tvv: tvvDisplay, gvbb: gvbbDisplay, la: laDisplay };

  // Warning: phase tu_van/BB/center but no real Telegram group
  const bbNoGroupWarning = ['tu_van','bb','center'].includes(ph) && !hasRealBBGroup
    ? `<div onclick="showGroupConnectGuide()" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;padding:4px 10px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.35);border-radius:6px;font-size:11px;color:var(--red);font-weight:600;cursor:pointer;">
        ⚠️ Chưa kết nối Group <span style="opacity:0.5;font-size:12px;">›</span>
       </div>` : '';

  const canToggleStatus = hasFullEdit || isProfileNDD;
  const statusBtn = canToggleStatus
    ? `<span onclick="event.stopPropagation();toggleFruitStatus('${p.id}','${fStatus}')" style="cursor:pointer;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${statusBg};color:white;">${statusText}</span>`
    : `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${statusBg};color:white;">${statusText}</span>`;
  const reasonHtml = (isInactive && p.dropout_reason)
    ? `<div style="font-size:10px;color:var(--red);padding:4px 8px;background:rgba(248,113,113,0.1);border-radius:4px;margin-top:4px;"><b>Lý do:</b> ${p.dropout_reason}</div>` : '';

  // KT toggle: NDD, GVBB hoặc full edit
  const isKT = p.is_kt_opened === true;
  const showKT = ['bb', 'center', 'completed'].includes(ph);
  const canToggleKT = (hasFullEdit || isProfileGVBB) && !isInactive;
  const ktHtml = showKT
    ? `<span ${canToggleKT ? `onclick="event.stopPropagation();toggleKTStatus('${p.id}', ${!isKT})"` : ''} style="${canToggleKT?'':'opacity:0.6;'}cursor:${canToggleKT?'pointer':'default'};font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;">${isKT ? '📖 Đã mở KT' : '📕 Chưa mở KT'}</span>`
    : '';

  // ĐK Center tag: show when milestone dky_center exists AND phase BB/center/completed
  const showDKCenter = window._hasDKCenter && ['bb', 'center', 'completed'].includes(ph);
  const dkCenterHtml = showDKCenter
    ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;background:#22c55e;color:white;">📋 ĐK Center</span>`
    : '';

  // Avatar: animated style system
  const avatarRaw = p.avatar_color || '';
  const canEditColor = hasFullEdit || isProfileNDD;
  const avatarLetter = getNameInitial(p.full_name);
  const avatarHtml = typeof renderAnimatedAvatar === 'function'
    ? renderAnimatedAvatar(avatarLetter, avatarRaw, 'md')
    : `<div style="width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,var(--accent),#ec4899);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:white;">${avatarLetter}</div>`;
  const avatarClick = canEditColor ? `onclick="openAvatarStylePicker('${p.id}','${encodeURIComponent(avatarRaw)}')"` : '';

  // Khoá/Mở Khai Giảng - Tag Semester
  const semName = p.semester_id ? ((typeof allSemesters !== 'undefined' && allSemesters && typeof allSemesters.find === 'function') ? (allSemesters.find(s => s.id === p.semester_id)?.name || 'Kỳ ẩn') : 'Kỳ ẩn') : 'Chưa có kỳ (Kỳ cũ)';
  const canEditSem = hasPermission('edit_profile') || hasPermission('manage_semester') || isProfileNDD;
  const semTag = `<span ${canEditSem ? `onclick="event.stopPropagation();promptChangeSemester('${p.id}', '${p.semester_id||''}')" style="cursor:pointer;"` : 'style="opacity:0.8;"'} class="semester-badge" style="font-size:10px; padding:2px 8px; border-radius:10px;" title="Nhấn để Đổi Khai Giảng cho Trái này">📅 ${semName}</span>`;

  // ONE unified card with premium layout
  // TVV progressive visibility rows
  let tvvTimelineRowsHtml = `
    <!-- TVV Row 1 -->
    <div onclick="promptEditTVVSession('${p.id}', 1, '${tvv1Code||''}')" 
         style="cursor:pointer; padding:6px 10px; border-radius:8px; transition:all 0.2s; display:flex; align-items:center; justify-content:space-between; gap:8px;
                ${tvv1Code ? 'background:rgba(124,106,247,0.04); border:1px solid rgba(124,106,247,0.25);' : 'background:transparent; border:1px dashed var(--border); opacity:0.85;'}"
         onmouseover="this.style.transform='translateY(-0.5px)'; this.style.borderColor='var(--accent)'" onmouseout="this.style.transform='none'; this.style.borderColor='${tvv1Code ? 'rgba(124,106,247,0.25)' : 'var(--border)'}'">
      <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
        <span style="font-size:9.5px; color:var(--text3); font-weight:800; text-transform:uppercase; background:var(--surface2); padding:2px 6px; border-radius:4px; flex-shrink:0;">Lần 1</span>
        <div style="font-size:12px; font-weight:700; color:var(--text1); white-space:normal; word-break:break-word; line-height:1.4; flex:1;" title="${tvv1Display}">
          ${tvv1Display}
        </div>
        ${tvv1 ? `<span style="font-size:8.5px; color:var(--text3); background:var(--surface2); padding:1px 4px; border-radius:3px; font-weight:600; opacity:0.85; flex-shrink:0; max-width:100px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">🛠️ ${tvv1.tool || 'Enneagram'}</span>` : ''}
      </div>
      <div style="display:flex; align-items:center; flex-shrink:0;">
        ${tvv1Code ? '<span style="color:var(--accent); font-size:9px; font-weight:800; display:flex; align-items:center; gap:4px;">🟢 <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--accent);">Đã có</span></span>' : '<span style="color:var(--text3); font-size:9px; display:flex; align-items:center; gap:4px;">⚪ <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--text3);">Chưa có</span></span>'}
      </div>
    </div>
  `;

  if (tvv2) {
    tvvTimelineRowsHtml += `
      <!-- TVV Row 2 -->
      <div onclick="promptEditTVVSession('${p.id}', 2, '${tvv2Code||''}')" 
           style="cursor:pointer; padding:6px 10px; border-radius:8px; transition:all 0.2s; display:flex; align-items:center; justify-content:space-between; gap:8px;
                  ${tvv2Code ? 'background:rgba(124,106,247,0.04); border:1px solid rgba(124,106,247,0.25);' : 'background:transparent; border:1px dashed var(--border); opacity:0.85;'}"
           onmouseover="this.style.transform='translateY(-0.5px)'; this.style.borderColor='var(--accent)'" onmouseout="this.style.transform='none'; this.style.borderColor='${tvv2Code ? 'rgba(124,106,247,0.25)' : 'var(--border)'}'">
        <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
          <span style="font-size:9.5px; color:var(--text3); font-weight:800; text-transform:uppercase; background:var(--surface2); padding:2px 6px; border-radius:4px; flex-shrink:0;">Lần 2</span>
          <div style="font-size:12px; font-weight:700; color:var(--text1); white-space:normal; word-break:break-word; line-height:1.4; flex:1;" title="${tvv2Display}">
            ${tvv2Display}
          </div>
          ${tvv2 ? `<span style="font-size:8.5px; color:var(--text3); background:var(--surface2); padding:1px 4px; border-radius:3px; font-weight:600; opacity:0.85; flex-shrink:0; max-width:100px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">🛠️ ${tvv2.tool || 'Enneagram'}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; flex-shrink:0;">
          ${tvv2Code ? '<span style="color:var(--accent); font-size:9px; font-weight:800; display:flex; align-items:center; gap:4px;">🟢 <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--accent);">Đã có</span></span>' : '<span style="color:var(--text3); font-size:9px; display:flex; align-items:center; gap:4px;">⚪ <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--text3);">Chưa có</span></span>'}
        </div>
      </div>
    `;
  }

  if (tvv3) {
    tvvTimelineRowsHtml += `
      <!-- TVV Row 3 -->
      <div onclick="promptEditTVVSession('${p.id}', 3, '${tvv3Code||''}')" 
           style="cursor:pointer; padding:6px 10px; border-radius:8px; transition:all 0.2s; display:flex; align-items:center; justify-content:space-between; gap:8px;
                  ${tvv3Code ? 'background:rgba(124,106,247,0.04); border:1px solid rgba(124,106,247,0.25);' : 'background:transparent; border:1px dashed var(--border); opacity:0.85;'}"
           onmouseover="this.style.transform='translateY(-0.5px)'; this.style.borderColor='var(--accent)'" onmouseout="this.style.transform='none'; this.style.borderColor='${tvv3Code ? 'rgba(124,106,247,0.25)' : 'var(--border)'}'">
        <div style="display:flex; align-items:center; gap:8px; min-width:0; flex:1;">
          <span style="font-size:9.5px; color:var(--text3); font-weight:800; text-transform:uppercase; background:var(--surface2); padding:2px 6px; border-radius:4px; flex-shrink:0;">Lần 3</span>
          <div style="font-size:12px; font-weight:700; color:var(--text1); white-space:normal; word-break:break-word; line-height:1.4; flex:1;" title="${tvv3Display}">
            ${tvv3Display}
          </div>
          ${tvv3 ? `<span style="font-size:8.5px; color:var(--text3); background:var(--surface2); padding:1px 4px; border-radius:3px; font-weight:600; opacity:0.85; flex-shrink:0; max-width:100px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">🛠️ ${tvv3.tool || 'Enneagram'}</span>` : ''}
        </div>
        <div style="display:flex; align-items:center; flex-shrink:0;">
          ${tvv3Code ? '<span style="color:var(--accent); font-size:9px; font-weight:800; display:flex; align-items:center; gap:4px;">🟢 <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--accent);">Đã có</span></span>' : '<span style="color:var(--text3); font-size:9px; display:flex; align-items:center; gap:4px;">⚪ <span style="font-size:8px; font-weight:600; text-transform:uppercase; color:var(--text3);">Chưa có</span></span>'}
        </div>
      </div>
    `;
  }

  document.getElementById('profileSummaryCard').innerHTML = `
    <div style="background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:12px 16px; box-shadow:0 4px 20px rgba(0,0,0,0.03); display:flex; flex-direction:column; gap:10px; position:relative; overflow:hidden;">
      <!-- Premium card gradient background reflection -->
      <div style="position:absolute; top:-50px; right:-50px; width:150px; height:150px; background:radial-gradient(circle, rgba(124,106,247,0.1) 0%, transparent 70%); pointer-events:none;"></div>
      
      <!-- Top section: avatar + name + status badges -->
      <div class="profile-summary-header" style="display:flex; align-items:center; gap:12px; position:relative; width:100%;">
        <div style="cursor:${canEditColor?'pointer':'default'}; flex-shrink:0;" ${avatarClick}>
          ${avatarHtml}
        </div>
        <div class="profile-summary-header-info" style="flex:1; min-width:0; padding-right:76px !important;">
          <div style="font-size:16px; font-weight:700; margin-bottom:3px; color:var(--text1); word-break:break-word; line-height:1.2; letter-spacing:-0.3px;">${p.full_name}</div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            ${statusBtn}
            <span style="font-size:10px; font-weight:700; padding:2px 8px; border-radius:10px; background:${PHASE_COLORS[ph]}; color:white; box-shadow:0 2px 6px rgba(0,0,0,0.08);">${PHASE_LABELS[ph]||ph}</span>
            ${ktHtml}
            ${dkCenterHtml}
            ${semTag}
            ${p.birth_year ? `<span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:6px; background:var(--surface2); color:var(--text2);">${p.birth_year}${p.gender ? ' · '+p.gender : ''}</span>` : (p.gender ? `<span style="font-size:10px; font-weight:600; padding:2px 6px; border-radius:6px; background:var(--surface2); color:var(--text2);">${p.gender}</span>` : '')}
          </div>
          ${reasonHtml}
          ${bbNoGroupWarning}
        </div>
        <div class="profile-summary-actions" style="position:absolute; top:0; right:0; display:flex; gap:6px; margin:0;">
          <button data-share-id="${p.id}" data-share-name="${(p.full_name||'').replace(/"/g,'&quot;')}" onclick="shareProfile(this.dataset.shareId, this.dataset.shareName)" title="Chia sẻ hồ sơ" style="
            width:30px; height:30px; border-radius:50%; border:1px solid var(--border);
            background:var(--accent); color:white; cursor:pointer;
            display:flex; align-items:center; justify-content:center; transition:all 0.2s; padding:0; box-shadow:0 3px 10px rgba(124, 106, 247, 0.2);
            " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          <button id="profileRefreshBtn" onclick="refreshProfileInPlace()" title="Đồng bộ dữ liệu mới nhất" style="
            width:30px; height:30px; border-radius:50%; border:1px solid var(--border);
            background:var(--surface2); color:var(--text2); font-size:13px; cursor:pointer;
            display:flex; align-items:center; justify-content:center; transition:all 0.2s; padding:0;
            " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">🔄</button>
        </div>
      </div>

      <!-- Middle: GVBB & NDD elegantly grouped with Left-Border accent highlights -->
      <div class="profile-summary-grid" style="display:flex; flex-wrap:wrap; gap:10px; border-top:1px solid var(--border); padding-top:10px;">
        <!-- NDD Section -->
        <div class="profile-summary-col" style="border-left:3px solid var(--green); padding-left:8px; flex:1 0 180px; min-width:180px;">
          <div style="margin-bottom:4px;">
            <span style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; background:rgba(34,197,94,0.12); color:#22c55e; padding:1px 6px; border-radius:4px; display:inline-block; border:1px solid rgba(34,197,94,0.2);">NDD</span>
          </div>
          <div style="font-size:12px; font-weight:700; color:var(--text1); white-space:normal; word-break:break-word; line-height:1.4;">
            ${nddCode ? `<span onclick="showStaffCard('${nddCode}')" style="cursor:pointer; color:var(--accent); text-decoration:underline dotted;" title="Xem hồ sơ TĐ">${nddDisplay}</span>` : `<span style="color:var(--text3);">${nddDisplay||'Chưa có'}</span>`}
          </div>
        </div>

        <!-- GVBB Section -->
        <div class="profile-summary-col" style="border-left:3px solid var(--accent); padding-left:8px; position:relative; flex:1 0 180px; min-width:180px;">
          <div style="margin-bottom:4px; display:flex; align-items:center; gap:6px;">
            <span style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; background:rgba(99,102,241,0.12); color:var(--accent); padding:1px 6px; border-radius:4px; display:inline-block; border:1px solid rgba(99,102,241,0.2);">GVBB</span>
            ${hasFullEdit && ['tu_van','bb','center','completed'].includes(ph) ? `<span onclick="event.stopPropagation();promptEditRole('${p.id}','gvbb')" style="cursor:pointer; font-size:9px; opacity:0.8; transition:all 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="Đổi GVBB">✏️</span>` : ''}
          </div>
          <div style="font-size:12px; font-weight:700; color:var(--text1); white-space:normal; word-break:break-word; line-height:1.4;">
            ${gvbbCode ? (gvbbCode.startsWith('tg:') ? `<span style="color:var(--text1);" title="Ngoài hệ thống">${gvbbDisplay}</span>` : `<span onclick="showStaffCard('${gvbbCode}')" style="cursor:pointer; color:var(--accent); text-decoration:underline dotted;" title="Xem hồ sơ TĐ">${gvbbDisplay}</span>`) : `<span style="color:var(--text3);">${gvbbDisplay||'Chưa có'}</span>`}
          </div>
        </div>
      </div>

      <!-- Bottom: TVV timeline vertical stack -->
      <div style="border-top:1px solid var(--border); padding-top:10px; display:flex; flex-direction:column; gap:6px;">
        <div style="margin-bottom:2px;">
          <span style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; background:rgba(168,85,247,0.12); color:#a855f7; padding:1px 6px; border-radius:4px; display:inline-block; border:1px solid rgba(168,85,247,0.2);">TVV</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${tvvTimelineRowsHtml}
        </div>
      </div>

      <!-- Bottom: Lá (Support) section -->
      <div style="border-top:1px solid var(--border); padding-top:10px; display:flex; flex-direction:column; gap:4px;">
        <div style="margin-bottom:2px;">
          <span style="font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:0.5px; background:rgba(20,184,166,0.12); color:#14b8a6; padding:1px 6px; border-radius:4px; display:inline-block; border:1px solid rgba(20,184,166,0.2);">Lá</span>
        </div>
        <div>
          ${renderRoleBadges(p.id, 'la', rolesInfo.la, hasFullEdit)}
        </div>
      </div>

      <!-- Latest Activity Footer -->
      ${latestInfo ? `
        <div style="border-top:1px solid var(--border); padding-top:8px; display:flex; align-items:flex-start; gap:8px; font-size:10px; color:var(--accent); font-weight:600; flex-wrap:wrap;">
          <span style="white-space:nowrap;">⏱️ Hoạt động gần nhất:</span>
          <span style="flex:1; min-width:120px; white-space:normal; word-break:break-word; line-height:1.4;">${latestInfo}</span>
        </div>
      ` : ''}

      <!-- Hapja view button -->
      <div id="hapjaViewBtnContainer" style="display:none;border-top:1px solid var(--border);padding-top:8px;"></div>
    </div>
  `;

  // ── Async: check if profile has approved Hapja ──
  (async () => {
    try {
      const hapjaRes = await sbFetch(`/rest/v1/check_hapja?profile_id=eq.${p.id}&status=eq.approved&select=id&limit=1&order=created_at.desc`);
      const hapjaRows = await hapjaRes.json();
      const container = document.getElementById('hapjaViewBtnContainer');
      if (container && hapjaRows && hapjaRows.length > 0) {
        container.style.display = 'block';
        container.innerHTML = `<button class="pf-hapja-btn" onclick="event.stopPropagation();openHapjaDetail('${hapjaRows[0].id}')">📋 Xem phiếu Hapja đã duyệt</button>`;
      }
    } catch(e) { /* silent */ }
  })();

  // Tab TV: hiện khi có TVV, bất kể phase (vì Chốt TV có thể xảy ra ở phase Chakki)
  const tabTV = document.getElementById('tabTV');
  const tabBB = document.getElementById('tabBB');
  const tabMM = document.getElementById('tabMap');
  const showTabTV = canEditTV && !!tvvCode;
  if (tabTV) tabTV.style.display = showTabTV ? '' : 'none';
  if (tabBB) tabBB.style.display = (canEditBB && ['tu_van','bb','center','completed'].includes(ph)) ? '' : 'none';
  const tabBTVN = document.getElementById('tabBTVN');
  if (tabBTVN) tabBTVN.style.display = (canEditBB && ['tu_van','bb','center','completed'].includes(ph)) ? '' : 'none';
  if (tabMM) tabMM.style.display = canAccessTuDuy ? '' : 'none';
  // Hỗ trợ BB sub-tab: only from tu_van phase
  const mmBtnCollect = document.getElementById('mmBtnCollect');
  if (mmBtnCollect) mmBtnCollect.style.display = ['tu_van','bb','center','completed'].includes(ph) ? '' : 'none';
  // Default strategy sub-tab + reset
  if (canAccessTuDuy) {
    _mmCurrentType = 'strategy';
    document.querySelectorAll('#mindmapTab .chip').forEach(c => c.classList.remove('active'));
    const strategyBtn = document.getElementById('mmBtnStrategy');
    if (strategyBtn) strategyBtn.classList.add('active');
    const strategyEl = document.getElementById('strategyContent');
    const mmEl = document.getElementById('mmContent');
    const chatEl = document.getElementById('aiChatCard');
    const resetBtn = document.getElementById('mmResetBtn');
    if (strategyEl) strategyEl.style.display = 'block';
    if (mmEl) mmEl.style.display = 'none';
    if (chatEl) chatEl.style.display = 'none';
    if (resetBtn) resetBtn.style.display = 'none';
  }
  // Sinka tab: hiện khi phase tu_van (đã lập group TV/BB) trở lên
  const tabSinka = document.getElementById('tabSinka');
  const canAccessSinka = (hasFullEdit || isProfileGVBB || isProfileNDD) && ['tu_van','bb','center','completed','dk_center','tv_group','bb_group'].includes(ph);
  if (tabSinka) tabSinka.style.display = canAccessSinka ? '' : 'none';
  clearFormFields();
  loadInfoSheet(p.id);
  loadJourney(p.id, ph);
  loadRecords(p.id, 'tu_van', 'tvList', 'tvCount');
  loadRecords(p.id, 'bien_ban', 'bbList', 'bbCount');
  loadRecords(p.id, 'btvn', 'btvnList', 'btvnCount');
  loadNotes(p.id);
  // Sinka: lazy-load khi mở tab (trigger trong switchFormTab)

  // ── Smart default tab theo phase ──────────────────────────────────────────
  let defaultTabId = initialTabId || 'journeyTab';    // mặc định Giai đoạn
  let defaultTabEl = null;

  if (!initialTabId) {
    if (['tu_van_hinh','chakki','new'].includes(ph) && showTabTV) {
      // Có TVV → mở tab TV để viết báo cáo
      defaultTabId = 'tuVan';
    } else if (ph === 'tu_van' && canEditBB) {
      // Đã vào Group TV (phase 3) → mở BB
      defaultTabId = 'bienBan';
    }
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
    if (defaultTabId === 'chatTab') {
      if (typeof markChatAsRead === 'function') markChatAsRead(p.id);
      if (typeof loadProfileChat === 'function') loadProfileChat(p.id);
    }
  } else {
    // Fallback: Giai đoạn
    const journeyTabEl = [...document.querySelectorAll('#profileTabs .form-tab')]
      .find(t => t.getAttribute('onclick')?.includes('journeyTab'));
    if (journeyTabEl) journeyTabEl.classList.add('active');
    document.getElementById('journeyTab')?.classList.add('active');
  }
  
  // Show/hide delete button at bottom of infoSheet
  const delBtn = document.getElementById('deleteProfileBtn');
  if (delBtn) delBtn.style.display = (hasPermission('edit_profile') && !window.isGuestMode) ? 'block' : 'none';

  // Hide add buttons if dropout
  document.querySelectorAll('.add-record-btn').forEach(b => {
      if (isInactive) b.style.display = 'none';
      else b.style.display = '';
  });

  // Update chat tab badge (Mới / @)
  if (typeof updateChatTabBadge === 'function') {
    updateChatTabBadge();
  }
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
  ['t2_ho_ten','t2_gioi_tinh','t2_nam_sinh','t2_nghe_nghiep','t2_thoi_gian_lam_viec','t2_sdt','t2_dia_chi','t2_ky_khai_giang','t2_khung_ranh','t2_so_thich','t2_tinh_cach','t2_du_dinh','t2_chuyen_cu','t2_nguoi_than','t2_nguoi_quan_trong','t2_quan_diem','t2_concept','t2_luu_y'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['chips_ton_giao','chips_hon_nhan','chips_quan_he_ndd','chips_khong_gian_song'].forEach(clearChips);
  // Clear Sinka fields
  if (typeof SINKA_FIELDS !== 'undefined') SINKA_FIELDS.forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  // Reset ĐK BB sub-tab to Thẻ HV + clear fields
  if (typeof switchSinkaSubtab === 'function') switchSinkaSubtab('sinka');
  ['dkbb_ho_ten','dkbb_to_ndd','dkbb_id_ndd','dkbb_to_gvbb','dkbb_id_gvbb','dkbb_giai_doan','dkbb_trang_thai','dkbb_muc_tieu','dkbb_quan_he','dkbb_do_tuoi','dkbb_ton_giao','dkbb_noi_o','dkbb_nghe_nghiep','dkbb_ngay_hoc_dau','dkbb_so_lan_gd','dkbb_ngay_mo_kt','dkbb_tuan_chuyen','dkbb_ly_do','dkbb_tong_buoi','dkbb_buoi_kt'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
  // Reset strategy
  if (typeof _strategyLoaded !== 'undefined') { _strategyLoaded = false; _strategyData = {}; }
}


// Info sheet (Phiếu Thông tin - stored in form_hanh_chinh)
async function loadInfoSheet(profileId) {
  try {
    // Fetch form_hanh_chinh + hapja cùng lúc — không cần đợi nhau
    const [infoRes, hjRes] = await Promise.all([
      sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=*`),
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}&status=eq.approved&select=data&limit=1`)
    ]);
    const data = await infoRes.json();
    const hjRows = await hjRes.json();
    const d = (data.length > 0 && data[0].data) ? data[0].data : {};
    // Store for mindmap use
    window._currentInfoSheet = {
      gioi_tinh: d.t2_gioi_tinh, nam_sinh: d.t2_nam_sinh, nghe_nghiep: d.t2_nghe_nghiep,
      ton_giao: d.t2_ton_giao, hon_nhan: d.t2_hon_nhan, dia_chi: d.t2_dia_chi,
      ky_khai_giang: d.t2_ky_khai_giang, tinh_cach: d.t2_tinh_cach, so_thich: d.t2_so_thich,
      du_dinh: d.t2_du_dinh, nguoi_quan_trong: d.t2_nguoi_quan_trong,
      quan_diem: d.t2_quan_diem, sdt: d.t2_sdt,
      chuyen_cu: d.t2_chuyen_cu, nguoi_than: d.t2_nguoi_than, luu_y: d.t2_luu_y,
      khong_gian_song: d.t2_khong_gian_song, quan_he_ndd: d.t2_quan_he_ndd,
      sk_concept_thuoc_linh: d.sk_concept_thuoc_linh,
      sk_tin_than_linh: d.sk_tin_than_linh,
      sk_ly_do_center: d.sk_ly_do_center,
      sk_chien_luoc_concept: d.sk_chien_luoc_concept,
      sk_moi_nguy_hiem: d.sk_moi_nguy_hiem,
      sk_so_lan_bb: d.sk_so_lan_bb
    };
    Object.entries(d).forEach(([key, val]) => { if (typeof val === 'string') { const el=document.getElementById(key); if(el) el.value=val; } });
    if (d.t2_ton_giao) setChipValues('chips_ton_giao', d.t2_ton_giao);
    if (d.t2_hon_nhan) setChipValues('chips_hon_nhan', d.t2_hon_nhan);
    if (d.t2_quan_he_ndd) setChipValues('chips_quan_he_ndd', d.t2_quan_he_ndd);
    if (d.t2_khong_gian_song) setChipValues('chips_khong_gian_song', d.t2_khong_gian_song);

    // Pre-fill fields 19, 21, 22 từ Hapja/profile nếu chưa có
    const p = allProfiles.find(x => x.id === profileId);
    // Field 8: Kỳ khai giảng — from profiles.semester_id → allSemesters
    if (!d.t2_ky_khai_giang && p?.semester_id && typeof allSemesters !== 'undefined') {
      const sem = allSemesters.find(s => s.id === p.semester_id);
      if (sem?.name) {
        const semFmt = typeof formatSemesterMonth === 'function' ? formatSemesterMonth(sem.name) : sem.name;
        const kkgEl = document.getElementById('t2_ky_khai_giang');
        if (kkgEl) kkgEl.value = semFmt;
      }
    }
    // Field 22: NDD phụ trách — from profile
    if (!d.t2_ndd && p?.ndd_staff_code) {
      const nddEl = document.getElementById('t2_ndd');
      if (nddEl) nddEl.value = typeof getStaffLabel === 'function' ? getStaffLabel(p.ndd_staff_code) : p.ndd_staff_code;
    }
    // Pre-fill fields 19, 21 từ hjRows đã fetch song song ở trên
    if (hjRows.length > 0) {
      const hd = hjRows[0].data || {};
      if (!d.t2_hinh_thuc && hd.hinh_thuc) { const htEl = document.getElementById('t2_hinh_thuc'); if (htEl) htEl.value = hd.hinh_thuc; }
      if (!d.t2_ngay_chakki && hd.ngay_chakki) { const ckEl = document.getElementById('t2_ngay_chakki'); if (ckEl) ckEl.value = hd.ngay_chakki; }
    }
    if (typeof adjustAllTextareaHeights === 'function') {
      setTimeout(adjustAllTextareaHeights, 50);
    }
    // Snapshot for unsaved changes detection
    setTimeout(function() {
      if (typeof DirtyFormGuard !== 'undefined') DirtyFormGuard.snapshot('thongTinTab');
    }, 100);
  } catch(e) { console.warn('loadInfoSheet:', e); }
}
async function saveInfoSheet() {
  const data = {};
  ['t2_ho_ten','t2_gioi_tinh','t2_nam_sinh','t2_nghe_nghiep','t2_thoi_gian_lam_viec','t2_sdt','t2_dia_chi','t2_ky_khai_giang','t2_khung_ranh','t2_so_thich','t2_tinh_cach','t2_du_dinh','t2_chuyen_cu','t2_nguoi_than','t2_nguoi_quan_trong','t2_quan_diem','t2_concept','t2_luu_y','t2_hinh_thuc','t2_ket_noi','t2_ngay_chakki','t2_ndd','t2_ghi_chu'].forEach(id=>{ data[id]=document.getElementById(id)?.value||''; });
  data.t2_ton_giao = getChipValues('chips_ton_giao');
  data.t2_hon_nhan = getChipValues('chips_hon_nhan');
  data.t2_quan_he_ndd = getChipValues('chips_quan_he_ndd');
  data.t2_khong_gian_song = getChipValues('chips_khong_gian_song');
  try {
    // 0. Preserve existing sk_* (Sinka) keys — fetch current data and merge
    let existingData = {};
    try {
      const exRes = await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}&select=data`);
      const exRows = await exRes.json();
      existingData = exRows?.[0]?.data || {};
    } catch(e) {}
    // Keep all sk_* keys from existing data
    Object.keys(existingData).forEach(k => {
      if (k.startsWith('sk_') && !(k in data)) data[k] = existingData[k];
    });
    // 1. Save info sheet (with sk_* preserved)
    await sbFetch('/rest/v1/form_hanh_chinh', { method: 'POST', headers: { 'Prefer': 'resolution=merge-duplicates' }, body: JSON.stringify({ profile_id: currentProfileId, data: data }) });

    // 1b. Refresh _currentInfoSheet so mindmap "Thông tin cơ bản" uses fresh data
    window._currentInfoSheet = {
      gioi_tinh: data.t2_gioi_tinh, nam_sinh: data.t2_nam_sinh, nghe_nghiep: data.t2_nghe_nghiep,
      ton_giao: data.t2_ton_giao, hon_nhan: data.t2_hon_nhan, dia_chi: data.t2_dia_chi,
      ky_khai_giang: data.t2_ky_khai_giang, tinh_cach: data.t2_tinh_cach, so_thich: data.t2_so_thich,
      du_dinh: data.t2_du_dinh, nguoi_quan_trong: data.t2_nguoi_quan_trong,
      quan_diem: data.t2_quan_diem, sdt: data.t2_sdt,
      chuyen_cu: data.t2_chuyen_cu, nguoi_than: data.t2_nguoi_than, luu_y: data.t2_luu_y,
      khong_gian_song: data.t2_khong_gian_song, quan_he_ndd: data.t2_quan_he_ndd,
      que_quan: data.t2_que_quan,
      sk_concept_thuoc_linh: existingData.sk_concept_thuoc_linh,
      sk_tin_than_linh: existingData.sk_tin_than_linh,
      sk_ly_do_center: existingData.sk_ly_do_center,
      sk_chien_luoc_concept: existingData.sk_chien_luoc_concept,
      sk_moi_nguy_hiem: existingData.sk_moi_nguy_hiem,
      sk_so_lan_bb: existingData.sk_so_lan_bb
    };
    // Also invalidate AI mindmap cache so "Hỗ trợ BB" re-generates with new data
    if (typeof _mmCache !== 'undefined' && currentProfileId) delete _mmCache[currentProfileId];
    // Re-render mindmap if currently viewing info tab
    if (typeof _mmCurrentType !== 'undefined' && _mmCurrentType === 'info' && typeof renderMindmap === 'function') renderMindmap();

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
        const statusLabel = fStatus === 'dropout' ? '🔴 Drop-out' : fStatus === 'pause' ? '⏸️ Pause' : '🟢 Alive';
        // Update just the name+meta in the card without full reload
        const nameEl = document.querySelector('#profileSummaryCard [data-field="name"]');
        if (nameEl) nameEl.textContent = p.full_name;
        // Trigger full re-render of summary card
        openProfile(p);
      }
      // 4. Refresh profile list
      filterProfiles();
    }

    // 5. Update local t2_values & sync Ngày Chakki with Hapja record & Timeline
    const idx = allProfiles.findIndex(x => x.id === currentProfileId);
    if (idx >= 0) {
      if (!allProfiles[idx].t2_values) allProfiles[idx].t2_values = {};
      Object.assign(allProfiles[idx].t2_values, data);
    }
    if (data.t2_ngay_chakki) {
      try {
        const hjRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.hapja&select=id,data`);
        const hjRows = await hjRes.json();
        if (hjRows && hjRows.length > 0) {
          const hjObj = hjRows[0];
          const hjData = hjObj.data || {};
          hjData.ngay_chakki = data.t2_ngay_chakki;
          await sbFetch(`/rest/v1/profile_records?id=eq.${hjObj.id}`, { method: 'PATCH', body: JSON.stringify({ data: hjData }) });
        }
      } catch(e) {}
      if (typeof loadJourney === 'function') loadJourney(currentProfileId);
    }

    showToast('✅ Đã lưu Phiếu Thông tin!');
    if (typeof DirtyFormGuard !== 'undefined') DirtyFormGuard.snapshot('thongTinTab');
    // Auto-sync form changes to Google Sheets
    if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(currentProfileId);
  } catch { showToast('❌ Lỗi khi lưu'); }
}

// ── Copy info sheet to clipboard (formatted for Telegram) ──
function copyInfoSheet() {
  const v = id => document.getElementById(id)?.value?.trim() || '';
  const chipVal = id => { try { return getChipValues(id)?.join(', ') || ''; } catch(e) { return ''; } };
  const p = allProfiles.find(x => x.id === currentProfileId);
  const name = v('t2_ho_ten') || p?.full_name || '';
  // Get current semester label
  const semLabel = (typeof currentSemesterId !== 'undefined' && currentSemesterId && typeof allSemesters !== 'undefined')
    ? (allSemesters.find(s => s.id === currentSemesterId)?.name || '') : '';
  // Format date for copy — DD.MM.YYYY or Shin XX.MM.DD
  const fmtDate = val => {
    if (!val) return '';
    if (typeof val === 'string' && val.startsWith('Shin')) return val;
    const m = String(val).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
    if (m) {
      return `${String(m[3]).padStart(2, '0')}.${String(m[2]).padStart(2, '0')}.${m[1]}`;
    }
    try {
      const d = new Date(val);
      if (isNaN(d)) return String(val);
      const pad = n => String(n).padStart(2, '0');
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    } catch { return String(val); }
  };
  
  const fields = [
    { l: 'Họ tên', v: name },
    { l: 'Giới tính', v: v('t2_gioi_tinh') },
    { l: 'Năm sinh', v: v('t2_nam_sinh') },
    { l: 'Nghề nghiệp', v: v('t2_nghe_nghiep') },
    { l: 'Thời gian làm việc', v: v('t2_thoi_gian_lam_viec') },
    { l: 'SĐT', v: v('t2_sdt') },
    { l: 'Địa chỉ', v: v('t2_dia_chi') },
    { l: semLabel ? `Kỳ khai giảng (${semLabel})` : 'Kỳ khai giảng', v: v('t2_ky_khai_giang') },
    { l: 'Khung rảnh', v: v('t2_khung_ranh') },
    { l: 'Sở thích', v: v('t2_so_thich') },
    { l: 'Tính cách', v: v('t2_tinh_cach') },
    { l: 'Dự định', v: v('t2_du_dinh') },
    { l: 'Chuyện cũ', v: v('t2_chuyen_cu') },
    { l: 'Người thân', v: v('t2_nguoi_than') },
    { l: 'Người quan trọng', v: v('t2_nguoi_quan_trong') },
    { l: 'Quan điểm', v: v('t2_quan_diem') },
    { l: 'Concept / Vỏ bọc', v: v('t2_concept') },
    { l: 'Lưu ý', v: v('t2_luu_y') },
    { l: 'Hình thức tiếp cận', v: v('t2_hinh_thuc') },
    { l: 'Kết nối', v: v('t2_ket_noi') },
    { l: 'Ngày Chakki', v: fmtDate(v('t2_ngay_chakki')) },
    { l: 'NDD phụ trách', v: v('t2_ndd') },
    { l: 'Ghi chú NDD', v: v('t2_ghi_chu') },
  ];

  let text = `📋 PHIẾU THÔNG TIN\n🍎 ${name}\n━━━━━━━━━━━━━━━━━━━━━\n\n`;
  fields.forEach((f, i) => {
    text += `${i + 1}. ${f.l}: ${f.v || '—'}\n`;
  });
  copyToClipboard(text.trim());
}

async function openRecord(recordId, type) {
  // Fetch full record from server
  const res = await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}&select=*`);
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
  if (window.isGuestMode) { if (typeof showToast === 'function') showToast('🔒 Chế độ xem — không thể xoá'); return; }
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
      sbFetch(`/rest/v1/profile_records?profile_id=eq.${profileId}`, { method: 'DELETE' }),
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
    // Sync: remove from Google Sheet
    if (typeof deleteFromSheet === 'function') deleteFromSheet(profileId);
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
          <input type="text" id="shareStaffSearch" placeholder="Tìm mã JD hoặc tên..." oninput="_searchShareStaff(this.value)"
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

async function _copyProfileDeepLink(profileId) {
  const link = `https://t.me/quanlyhcm_bot/app?startapp=${profileId}`;
  const displayName = (window._shareProfileName || 'Hồ sơ trái quả').trim();
  const htmlContent = `<a href="${link}">🍎 ${displayName}</a>`;
  const plainContent = `🍎 ${displayName}\n${link}`;
  let copied = false;

  // Method 1: ClipboardItem API (desktop — preserves HTML hyperlink)
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([plainContent], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob })
      ]);
      copied = true;
    } catch(e) {
      // ClipboardItem bị chặn hoặc Permission denied → tiếp tục fallback
    }
  }

  // Method 2: navigator.clipboard.writeText (simpler, wider support)
  if (!copied && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(plainContent);
      copied = true;
    } catch(e) {}
  }

  // Method 3: execCommand with contentEditable (mobile — rich text)
  if (!copied) {
    try {
      const el = document.createElement('div');
      el.contentEditable = 'true';
      el.innerHTML = htmlContent;
      el.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
      document.body.appendChild(el);
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      copied = document.execCommand('copy');
      sel.removeAllRanges();
      el.remove();
    } catch(e) {}
  }

  // Method 4: plain text textarea fallback
  if (!copied) {
    try {
      const ta = document.createElement('textarea');
      ta.value = plainContent;
      ta.style.cssText = 'position:fixed;left:-9999px;';
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      ta.remove();
    } catch(e) {}
  }

  // Always show feedback
  if (copied) {
    showToast('📋 Đã sao chép: ' + displayName);
  } else {
    showToast('⚠️ Không thể copy, hãy copy thủ công');
    // Select text in input for manual copy
    const inp = document.getElementById('shareDeepLinkInput');
    if (inp) { inp.select(); inp.focus(); }
  }
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

// ============ GROUP CONNECT GUIDE ============
function showGroupConnectGuide() {
  let existing = document.getElementById('groupConnectGuideModal');
  if (existing) existing.remove();

  const p = allProfiles.find(x => x.id === currentProfileId);
  const pName = p?.full_name || 'trái quả';
  const hasGVBB = !!(p?.gvbb_staff_code || window._rolesDisplay?.gvbb !== '—');

  const modal = document.createElement('div');
  modal.id = 'groupConnectGuideModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML = `
    <div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -8px 40px rgba(0,0,0,0.3);max-height:85vh;overflow-y:auto;">
      <div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 14px;"></div>
      <div style="font-size:16px;font-weight:700;margin-bottom:4px;">📋 Hướng dẫn kết nối Group Telegram</div>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;">Cho hồ sơ: <b>${pName}</b></div>

      <div style="display:flex;flex-direction:column;gap:12px;">
        <!-- Step 1 -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">1</span>
            <span style="font-size:13px;font-weight:600;">Tạo Group Telegram</span>
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;padding-left:32px;">
            Mở Telegram → New Group → đặt tên (VD: "BB - ${pName}") → thêm <b>@quanlyhcm_bot</b> vào Group.
          </div>
        </div>

        <!-- Step 2 -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">2</span>
            <span style="font-size:13px;font-weight:600;">Cho bot quyền Admin</span>
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;padding-left:32px;">
            Vào Group Settings → chọn bot → Promote to Admin → bật <b>tất cả quyền</b> → Done.
          </div>
        </div>

        <!-- Step 3 -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">3</span>
            <span style="font-size:13px;font-weight:600;">Gõ lệnh <code>/start</code></span>
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;padding-left:32px;">
            Trong Group chat, gõ <code>/start</code> → Bot sẽ hiện menu → chọn <b>"🔗 Gắn hồ sơ trái quả"</b>.
          </div>
        </div>

        <!-- Step 4 -->
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:24px;height:24px;border-radius:50%;background:var(--accent);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">4</span>
            <span style="font-size:13px;font-weight:600;">Chọn hồ sơ để gắn</span>
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;padding-left:32px;">
            Bot sẽ hiện danh sách hồ sơ của bạn → nhấn chọn <b>"${pName}"</b> → Group sẽ tự động kết nối.
          </div>
        </div>

        ${!hasGVBB ? `
        <!-- Step 5: GVBB -->
        <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.3);border-radius:12px;padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="width:24px;height:24px;border-radius:50%;background:var(--red);color:white;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;">5</span>
            <span style="font-size:13px;font-weight:600;color:var(--red);">⚠️ Cần xác nhận GVBB</span>
          </div>
          <div style="font-size:12px;color:var(--text2);line-height:1.5;padding-left:32px;">
            Hồ sơ này <b>chưa có GVBB</b>. Sau khi gắn Group, trong Group chat chọn <b>"👤 Xác nhận GVBB"</b> để ghi nhận GVBB phụ trách.<br>
            <span style="font-size:11px;color:var(--text3);">Nếu GVBB không có mã JD trong hệ thống, bot sẽ tự nhận diện qua Telegram ID.</span>
          </div>
        </div>
        ` : ''}
      </div>

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);line-height:1.5;">
        💡 <b>Mẹo:</b> Sau khi kết nối, nhấn nút 🔄 trên hồ sơ để đồng bộ dữ liệu Group mới nhất.
      </div>

      <button onclick="document.getElementById('groupConnectGuideModal').remove()"
        style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;margin-top:12px;">Đóng</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Inline edit TVV/GVBB role ──
async function promptEditRole(profileId, roleType) {
  const label = roleType === 'tvv' ? 'TVV' : 'GVBB';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:16px;padding:24px;min-width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text1,#333);">✏️ Đổi ${label}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Nhập mã TĐ hoặc tên ${label} mới:</div>
    <input type="text" id="_editRoleInput" data-list="staffSuggest" placeholder="Mã TĐ hoặc tên..."
      style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface2,#f5f5f5);color:var(--text1,#333);font-size:14px;"/>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
      <button id="_editRoleCancel" style="padding:8px 16px;border-radius:8px;background:var(--surface2,#eee);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:13px;cursor:pointer;">Hủy</button>
      <button id="_editRoleSave" style="padding:8px 16px;border-radius:8px;background:var(--accent,#3b82f6);border:none;color:white;font-size:13px;font-weight:600;cursor:pointer;">Lưu</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#_editRoleCancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#_editRoleSave').onclick = async () => {
    const raw = document.getElementById('_editRoleInput').value.trim();
    if (!raw) { showToast('⚠️ Nhập tên hoặc mã TĐ'); return; }
    try {
      // Parse code first (handles "ABC - Name" datalist format), then check registration
      const parsedCode = getStaffCodeFromInput('_editRoleInput');
      const registered = isStaffRegistered(parsedCode);
      const staffCode = registered ? parsedCode : `tg:${raw}`;
      const displayName = registered ? null : raw;
      if (!registered) {
        const ok = typeof showConfirmAsync === 'function'
          ? await showConfirmAsync(`⚠️ "${raw}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục?`)
          : confirm(`⚠️ "${raw}" chưa đăng ký.\n\nVẫn tiếp tục?`);
        if (!ok) return;
      }
      // Find or create fruit_group
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id`);
      const fgs = await fgRes.json();
      let fgId = fgs[0]?.id;
      if (!fgId) {
        const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
          telegram_group_id: null, profile_id: profileId, level: 'tu_van'
        })});
        fgId = (await newFgRes.json())[0]?.id;
      }
      if (!fgId) { showToast('❌ Lỗi tạo group'); return; }
      // Delete old role of same type from ALL fruit_groups for this profile
      const allFgIds = fgs.map(fg => fg.id).filter(Boolean);
      for (const gid of allFgIds) {
        await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=eq.${gid}&role_type=eq.${roleType}`, { method:'DELETE' });
      }
      // Insert new role
      const roleData = { fruit_group_id: fgId, staff_code: staffCode, role_type: roleType, assigned_by: getEffectiveStaffCode() };
      if (displayName) roleData.display_name = displayName;
      const insertRes = await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify(roleData) });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('Role insert failed:', errText);
        showToast('❌ Lỗi lưu role'); return;
      }
      overlay.remove();
      showToast(`✅ Đã đổi ${label}`);
      // Clear GET cache to prevent stale data on refresh
      if (typeof _getCache !== 'undefined') _getCache.clear();
      await _refreshCurrentProfile();
    } catch(e) { showToast('❌ Lỗi'); console.error(e); }
  };
}

// ── Render Premium Dynamic Multi-Role Badges ──
function renderRoleBadges(profileId, roleType, rolesList, hasFullEdit) {
  const addLabel = roleType === 'tvv' ? 'Thêm TVV' : 'Thêm Lá';
  if (!rolesList || rolesList.length === 0) {
    return `<span style="color:var(--text3); font-style:italic;">Chưa phân vai</span> ${hasFullEdit ? `<span onclick="event.stopPropagation();promptAddRole('${profileId}','${roleType}')" style="cursor:pointer;font-size:11px;color:var(--accent);font-weight:700;margin-left:6px;" title="${addLabel}">➕ Thêm</span>` : ''}`;
  }
  
  const badgesHtml = rolesList.map(r => {
    const isTemp = r.code && typeof r.code === 'string' && r.code.startsWith('tg:');
    const displayName = isTemp ? (r.displayName || r.code.replace('tg:','')) : getStaffLabel(r.code || '');
    const titleText = isTemp ? 'Ngoài hệ thống (Tạm)' : 'Xem hồ sơ TĐ';
    const clickAction = isTemp ? '' : `onclick="event.stopPropagation();showStaffCard('${r.code}')" style="cursor:pointer;color:var(--accent);text-decoration:underline dotted;"`;
    
    return `
      <span class="role-pill" style="display:inline-flex; align-items:center; background:var(--surface2); border:1px solid var(--border); border-radius:12px; padding:2px 8px; font-size:11px; margin-right:4px; margin-bottom:4px; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <span ${clickAction} title="${titleText}" style="font-weight:600;">${displayName}</span>
        ${hasFullEdit ? `<span onclick="event.stopPropagation();deleteRoleById('${r.id}')" style="cursor:pointer;margin-left:6px;color:var(--red);font-weight:bold;font-size:11px; opacity:0.75;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.75'" title="Xoá vai trò này">✕</span>` : ''}
      </span>
    `;
  }).join('');
  
  const addBtnHtml = hasFullEdit ? `<span onclick="event.stopPropagation();promptAddRole('${profileId}','${roleType}')" style="cursor:pointer;font-size:11px;color:var(--accent);font-weight:700;margin-left:4px;display:inline-flex;align-items:center;gap:2px;" title="${addLabel}">➕ Thêm</span>` : '';
  
  return `<div style="display:inline-flex; flex-wrap:wrap; align-items:center;">${badgesHtml}${addBtnHtml}</div>`;
}

// ── Delete Role Record directly by ID ──
async function deleteRoleById(roleId) {
  const ok = typeof showConfirmAsync === 'function'
    ? await showConfirmAsync('❓ Bạn có chắc chắn muốn xoá vai trò này khỏi hồ sơ?')
    : confirm('❓ Bạn có chắc chắn muốn xoá vai trò này khỏi hồ sơ?');
  if (!ok) return;
  
  try {
    const res = await sbFetch(`/rest/v1/fruit_roles?id=eq.${roleId}`, { method: 'DELETE' });
    if (!res.ok) {
      showToast('❌ Lỗi xoá vai trò');
      return;
    }
    showToast('✅ Đã xoá vai trò');
    if (typeof _getCache !== 'undefined') _getCache.clear();
    await _refreshCurrentProfile();
  } catch(e) {
    console.error(e);
    showToast('❌ Lỗi xoá vai trò');
  }
}

// ── Interactive Modal to Add new TVV or Lá ──
async function promptAddRole(profileId, roleType) {
  const label = roleType === 'tvv' ? 'TVV' : 'Lá (Người hỗ trợ)';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:16px;padding:24px;min-width:300px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text1,#333);">➕ Thêm ${label}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Nhập mã TĐ hoặc tên ${roleType === 'tvv' ? 'TVV' : 'Lá'} mới:</div>
    <input type="text" id="_addRoleInput" data-list="staffSuggest" placeholder="Mã TĐ hoặc tên..."
      style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface2,#f5f5f5);color:var(--text1,#333);font-size:14px;"/>
    <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
      <button id="_addRoleCancel" style="padding:8px 16px;border-radius:8px;background:var(--surface2,#eee);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:13px;cursor:pointer;">Hủy</button>
      <button id="_addRoleSave" style="padding:8px 16px;border-radius:8px;background:var(--accent,#3b82f6);border:none;color:white;font-size:13px;font-weight:600;cursor:pointer;">Thêm</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  
  // Focus the input
  setTimeout(() => {
    const inp = document.getElementById('_addRoleInput');
    if (inp) inp.focus();
  }, 100);

  overlay.querySelector('#_addRoleCancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  overlay.querySelector('#_addRoleSave').onclick = async () => {
    const raw = document.getElementById('_addRoleInput').value.trim();
    if (!raw) { showToast('⚠️ Nhập tên hoặc mã TĐ'); return; }
    try {
      const parsedCode = getStaffCodeFromInput('_addRoleInput');
      const registered = isStaffRegistered(parsedCode);
      const staffCode = registered ? parsedCode : `tg:${raw}`;
      const displayName = registered ? null : raw;
      if (!registered) {
        const ok = typeof showConfirmAsync === 'function'
          ? await showConfirmAsync(`⚠️ "${raw}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục?`)
          : confirm(`⚠️ "${raw}" chưa đăng ký.\n\nVẫn tiếp tục?`);
        if (!ok) return;
      }
      // Find or create fruit_group
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id`);
      const fgs = await fgRes.json();
      let fgId = fgs[0]?.id;
      if (!fgId) {
        const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
          telegram_group_id: null, profile_id: profileId, level: 'tu_van'
        })});
        fgId = (await newFgRes.json())[0]?.id;
      }
      if (!fgId) { showToast('❌ Lỗi tạo group'); return; }
      
      // Check if duplicate role already exists
      const checkRes = await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=eq.${fgId}&role_type=eq.${roleType}&staff_code=eq.${staffCode}`);
      const checks = await checkRes.json();
      if (checks && checks.length > 0) {
        showToast(`⚠️ Nhân sự này đã có vai trò ${roleType === 'tvv' ? 'TVV' : 'Lá'}`);
        return;
      }

      // Insert new role
      const roleData = { fruit_group_id: fgId, staff_code: staffCode, role_type: roleType, assigned_by: getEffectiveStaffCode() };
      if (displayName) roleData.display_name = displayName;
      const insertRes = await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify(roleData) });
      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('Role insert failed:', errText);
        showToast('❌ Lỗi lưu role'); return;
      }
      overlay.remove();
      showToast(`✅ Đã thêm ${roleType === 'tvv' ? 'TVV' : 'Lá'}`);
      if (typeof _getCache !== 'undefined') _getCache.clear();
      await _refreshCurrentProfile();
    } catch(e) { showToast('❌ Lỗi'); console.error(e); }
  };
}

// ── Inline TVV Editor for Timeline Sessions ──
async function promptEditTVVSession(profileId, sessionNumber, currentTvvCode) {
  if (!currentTvvCode || !currentTvvCode.trim()) {
    showToast(`⚠️ Cần Chốt TV lần ${sessionNumber} trong tab Giai đoạn trước!`);
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
  
  const currentLabel = currentTvvCode ? getStaffLabel(currentTvvCode) : '';
  
  overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:16px;padding:24px;min-width:320px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
    <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text1,#333);display:flex;align-items:center;gap:6px;">🗣️ TVV Lần ${sessionNumber}</div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:8px;">Chọn hoặc nhập mã TVV mới:</div>
    <input type="text" id="_editTvvInput" data-list="staffSuggest" placeholder="Mã TĐ hoặc tên..." value="${currentTvvCode ? `${currentTvvCode}${currentLabel ? ' — ' + currentLabel : ''}` : ''}"
      style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface2,#f5f5f5);color:var(--text1,#333);font-size:14px;outline:none;"/>
    <div style="display:flex;gap:8px;margin-top:18px;justify-content:flex-end;">
      <button id="_editTvvCancel" style="padding:8px 16px;border-radius:8px;background:var(--surface2,#eee);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:13px;cursor:pointer;">Hủy</button>
      <button id="_editTvvSave" style="padding:8px 16px;border-radius:8px;background:var(--accent,#3b82f6);border:none;color:white;font-size:13px;font-weight:600;cursor:pointer;">Lưu thay đổi</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  
  setTimeout(() => {
    const inp = document.getElementById('_editTvvInput');
    if (inp) {
      inp.focus();
      if (typeof initComboboxes === 'function') initComboboxes();
    }
  }, 100);

  overlay.querySelector('#_editTvvCancel').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  
  overlay.querySelector('#_editTvvSave').onclick = async () => {
    const raw = document.getElementById('_editTvvInput').value.trim();
    const saveBtn = overlay.querySelector('#_editTvvSave');
    saveBtn.disabled = true;
    saveBtn.textContent = '⌛ Đang lưu...';
    
    try {
      let staffCode = null;
      if (raw) {
        const parsedCode = getStaffCodeFromInput('_editTvvInput');
        const registered = isStaffRegistered(parsedCode);
        staffCode = registered ? parsedCode : raw;
        
        if (!registered) {
          const ok = typeof showConfirmAsync === 'function'
            ? await showConfirmAsync(`⚠️ "${raw}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục?`)
            : confirm(`⚠️ "${raw}" chưa đăng ký.\n\nVẫn tiếp tục?`);
          if (!ok) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Lưu thay đổi';
            return;
          }
        }
      }
      
      // Check if session exists
      const checkRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&session_number=eq.${sessionNumber}&select=id`);
      const checks = await checkRes.json();
      
      if (checks && checks.length > 0) {
        // PATCH
        const sessId = checks[0].id;
        await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessId}`, {
          method: 'PATCH',
          body: JSON.stringify({ tvv_staff_code: staffCode })
        });
      } else {
        showToast(`⚠️ Cần Chốt TV lần ${sessionNumber} trong tab Giai đoạn trước!`);
        overlay.remove();
        return;
      }
      
      // Sync permissions trigger
      if (typeof syncTVVRolesFromSessions === 'function') {
        await syncTVVRolesFromSessions(profileId);
      }
      
      overlay.remove();
      showToast('✅ Đã cập nhật TVV');
      
      if (typeof _getCache !== 'undefined') _getCache.clear();
      await _refreshCurrentProfile();
    } catch(e) {
      showToast('❌ Lỗi lưu TVV');
      console.error(e);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu thay đổi';
    }
  };
}
window.promptEditTVVSession = promptEditTVVSession;
