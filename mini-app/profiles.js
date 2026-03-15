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
    const isDropout = p.fruit_status === 'dropout';
    const statusColor = isDropout ? 'var(--red)' : 'var(--green)';
    const statusLabel = isDropout ? 'Drop-out' : 'Alive';
    // Drop-out: show phone number | Alive: show birth_year
    const metaExtra = isDropout
      ? (p.dropout_reason || '')
      : (p.birth_year || '');
    return `
    <div class="profile-card" onclick="openProfileById('${p.id}')">
      <div class="avatar">${(p.full_name||'?')[0]}</div>
      <div class="profile-info">
        <div class="profile-name">${p.full_name}</div>
        <div class="profile-meta"><span class="status-dot" style="background:${statusColor};"></span>${statusLabel}${metaExtra ? ' · ' + metaExtra : ''}</div>
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


  const ph = p.phase || 'chakki';
  const fStatus = p.fruit_status || 'alive';
  const statusBg = fStatus === 'dropout' ? 'var(--red)' : 'var(--green)';
  const statusText = fStatus === 'dropout' ? '🔴 Drop-out' : '🟢 Alive';
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
  const nddDisplay = p.ndd_staff_code || rolesInfo.ndd || '—';
  const tvvDisplay = rolesInfo.tvv.length ? rolesInfo.tvv.join(', ') : '—';
  const gvbbDisplay = rolesInfo.gvbb || '—';

  // Warning: BB phase but no real Telegram group
  const bbNoGroupWarning = ['bb','center'].includes(ph) && !hasRealBBGroup
    ? `<div style="display:flex;align-items:center;gap:6px;margin-top:6px;padding:5px 10px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.35);border-radius:6px;font-size:11px;color:var(--red);font-weight:600;">
        ⚠️ Chưa tạo Group BB
       </div>` : '';

  // Latest activity
  let latestInfo = '';
  try {
    const [rRes, sRes] = await Promise.all([
      sbFetch(`/rest/v1/records?profile_id=eq.${p.id}&select=record_type,content,created_at&order=created_at.desc&limit=1`),
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${p.id}&select=session_number,tool,created_at&order=created_at.desc&limit=1`)
    ]);
    latestInfo = latestActivityLabel((await rRes.json())[0]||null, (await sRes.json())[0]||null);
  } catch(e) {}

    const canToggleStatus = pos2 === 'admin' || nddDisplay === myCode2 || ['gyjn','bgyjn'].includes(pos2);
  const statusBtn = canToggleStatus
    ? `<span onclick="event.stopPropagation();toggleFruitStatus('${p.id}','${fStatus}')" style="cursor:pointer;font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>`
    : `<span style="font-size:11px;font-weight:700;padding:4px 12px;border-radius:12px;background:${statusBg};color:white;">${statusText}</span>`;
  const reasonHtml = (fStatus==='dropout' && p.dropout_reason)
    ? `<div style="font-size:11px;color:var(--red);padding:4px 8px;background:rgba(248,113,113,0.1);border-radius:4px;margin-top:4px;"><b>Lý do:</b> ${p.dropout_reason}</div>` : '';

  const isKT = p.is_kt_opened === true;
  const showKT = ['bb', 'center', 'completed'].includes(ph);
  const ktHtml = showKT
    ? `<span onclick="event.stopPropagation();toggleKTStatus('${p.id}', ${!isKT})" style="cursor:pointer;font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;">${isKT ? '🔓 Đã mở KT' : '🔒 Chưa mở KT'}</span>`
    : '';

  // ONE unified card
  document.getElementById('profileSummaryCard').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--surface) 0%,var(--surface2) 100%);border:1px solid var(--border);border-radius:var(--radius);padding:18px 16px;">
      <!-- Top: avatar + name + badges -->
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,var(--accent),#ec4899);display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;flex-shrink:0;box-shadow:0 4px 16px rgba(124,106,247,0.3);">${(p.full_name||'?')[0]}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:18px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.full_name}</div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
            ${statusBtn}
            <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:${PHASE_COLORS[ph]};color:white;">${PHASE_LABELS[ph]||ph}</span>
            ${ktHtml}
            ${p.birth_year ? `<span style="font-size:11px;color:var(--text2);">${p.birth_year}${p.gender ? ' · '+p.gender : ''}</span>` : (p.gender ? `<span style="font-size:11px;color:var(--text2);">${p.gender}</span>` : '')}
          </div>
          ${reasonHtml}
          ${bbNoGroupWarning}
        </div>
      </div>
      <!-- Bottom: roles grid + latest -->
      <div style="border-top:1px solid var(--border);padding-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:5px 12px;font-size:12px;">
        <div><span style="color:var(--text3);">NDD:</span> <b>${nddDisplay}</b></div>
        <div><span style="color:var(--text3);">TVV:</span> <b>${tvvDisplay}</b></div>
        <div><span style="color:var(--text3);">GVBB:</span> <b>${gvbbDisplay}</b></div>
        ${latestInfo ? `<div style="color:var(--accent);font-size:11px;">⏱ ${latestInfo}</div>` : '<div></div>'}
      </div>
      ${hasRealBBGroup && ['bb','center','completed'].includes(ph) ? `
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
  document.querySelectorAll('#profileTabs .form-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('.form-card').forEach((c)=>c.classList.remove('active'));
  document.getElementById('infoSheet')?.classList.add('active');
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
