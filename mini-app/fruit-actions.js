// ============ FRUIT STATUS + KT TOGGLE + UNIT POPUP + AVATAR + SEMESTER UI ============
// Extracted from core.js — Profile action dialogs
// Depends on: sbFetch, showConfirm, showConfirmAsync, showToast, allProfiles, allStaff, allSemesters

// ── Unit Popup ──
function showUnitPopup(type) {
  const d = window._unitPopupData || {};
  let title = '', items = [];

  function makeProfileItem(x, extraMeta) {
    const p = x.profile;
    const pid = x.role?.fruit_groups?.profile_id;
    if (!p || !pid) return '';
    const ph = p.phase || 'chakki';
    const phLabel = PHASE_LABELS[ph] || ph;
    const phColor = PHASE_COLORS[ph] || '#888';
    return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;"
      onclick="openProfileById('${pid}');closeModal('unitPopupModal')">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <div style="font-weight:700;font-size:13px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.full_name || '---'}</div>
        <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${phColor};color:white;white-space:nowrap;">${phLabel}</span>
      </div>
      ${extraMeta ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;">${extraMeta}</div>` : ''}
    </div>`;
  }

  function makeHapjaItem(h) {
    return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:6px;"
      onclick="${h.profile_id ? `openProfileById('${h.profile_id}');closeModal('unitPopupModal')` : ''}">
      <div style="font-weight:700;font-size:13px;">${h.full_name || '???'}</div>
      <div style="font-size:11px;color:var(--text2);">NDD: ${h.data?.ndd_staff_code || h.created_by} · ${shinDate(h.created_at)}</div>
    </div>`;
  }

  if (type === 'hapja') {
    title = '🍎 Trái Hapja (đã duyệt)';
    const hapjaSource = (d.cumHapja?.length ? d.cumHapja : null)
      || window._approvedHapjaList || [];
    items = hapjaSource.map(makeHapjaItem);
  } else if (type === 'chakki') {
    title = '🟡 Chakki (đang ở giai đoạn Chakki)';
    items = (d.phChakki || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'tvhinh') {
    title = '🖼️ TV Hình (tích luỹ — đã lên TV Hình trở lên)';
    items = (d.cumTVHinh || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'tvhinh_phase') {
    title = '🖼️ TV Hình (đang ở giai đoạn TV Hình)';
    items = (d.phTVHinh || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'grouptv') {
    title = '💬 Group TV (tích luỹ — đã lên Group TV trở lên)';
    items = (d.cumGroupTV || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'grouptv_phase') {
    title = '💬 Group TV (đang ở giai đoạn Tư Vấn)';
    items = (d.phGroupTV || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'groupbb') {
    title = '🎓 Group BB (tích luỹ — đã lên BB trở lên)';
    items = (d.cumGroupBB || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'groupbb_phase') {
    title = '🎓 Group BB (đang ở giai đoạn BB)';
    items = (d.phGroupBB || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else if (type === 'center') {
    const isCum = window._dashMode === 'cumulative';
    title = isCum ? '🏛️ Center (tích luỹ)' : '🏛️ Center (đang ở giai đoạn Center)';
    items = (isCum ? d.cumCenter : d.phCenter || []).map(x => makeProfileItem(x, 'NDD: ' + (x.profile.ndd_staff_code || '---')));
  } else {
    const legacyMap = {
      wait_tv: window._unitWaitTV,
      tvv: window._unitTvvFruits,
      gvbb: window._unitGvbbFruits,
    };
    title = type;
    const list = legacyMap[type] || [];
    items = list.map(r => {
      const pid = r.fruit_groups?.profile_id;
      const fullP = allProfiles.find(x => x.id === pid) || r.fruit_groups?.profiles;
      return renderProfileCard ? renderProfileCard(fullP, {
        extraMeta: 'TĐ: ' + r.staff_code,
        clickFn: `openProfileById('${pid}');closeModal('unitPopupModal')`
      }) : '';
    });
  }

  document.getElementById('unitPopupTitle').textContent = title;
  document.getElementById('unitPopupBody').innerHTML = items.length
    ? items.join('')
    : '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có dữ liệu</div>';
  document.getElementById('unitPopupModal').classList.add('open');
}

// ── Avatar Color ──
const AVATAR_GRADIENT_PRESETS = [
  { label: 'Tím Hồng',   val: 'linear-gradient(135deg,#6366f1,#ec4899)' },
  { label: 'Xanh Cyan',  val: 'linear-gradient(135deg,#3b82f6,#06b6d4)' },
  { label: 'Xanh Lá',    val: 'linear-gradient(135deg,#10b981,#3b82f6)' },
  { label: 'Cam Đỏ',     val: 'linear-gradient(135deg,#f97316,#ef4444)' },
  { label: 'Tím Xanh',   val: 'linear-gradient(135deg,#8b5cf6,#3b82f6)' },
  { label: 'Hồng Cam',   val: 'linear-gradient(135deg,#ec4899,#f59e0b)' },
  { label: 'Xanh Vàng',  val: 'linear-gradient(135deg,#10b981,#84cc16)' },
  { label: 'Hoàng Hôn',  val: 'linear-gradient(135deg,#f97316,#eab308)' },
  { label: 'Đại Dương',  val: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' },
  { label: 'Hoa Đào',    val: 'linear-gradient(135deg,#ef4444,#ec4899)' },
  { label: 'Bầu Trời',   val: 'linear-gradient(135deg,#38bdf8,#818cf8)' },
  { label: 'Rừng Xanh',  val: 'linear-gradient(135deg,#166534,#15803d)' },
];


async function changeAvatarColor(profileId, gradient) {
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: 'PATCH',
      body: JSON.stringify({ avatar_color: gradient })
    });
    const p = allProfiles.find(x => x.id === profileId);
    if (p) p.avatar_color = gradient;
    if (typeof _refreshCurrentProfile === 'function') _refreshCurrentProfile();
    else if (typeof loadDashboard === 'function') loadDashboard();
    showToast('✅ Đã đổi màu avatar');
  } catch(e) { console.error('changeAvatarColor:', e); showToast('❌ Lỗi đổi màu'); }
}

// ── Kỳ Khai Giảng (Semester) UI ──
async function promptChangeSemester(profileId, currentSemId) {
  if (!allSemesters || allSemesters.length === 0) return;
  const opts = '<option value="">(Không có kỳ / Gỡ kỳ)</option>' + allSemesters.map(s => `<option value="${s.id}" ${s.id === currentSemId ? 'selected' : ''}>${s.name}</option>`).join('');
  const msg = `<div style="text-align:left;">
      <b>Chuyển Khai Giảng cho trái quả này?</b><br><br>
      Dữ liệu trên dashboard tích luỹ/giai đoạn của kỳ cũ sẽ giảm, và kỳ mới sẽ tăng.<br><br>
      <select id="moveSemSelect" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);">${opts}</select>
    </div>`;
  const confirm = await showConfirmAsync(msg);
  if (!confirm) return;
  
  const moveSel = document.getElementById('moveSemSelect');
  if (!moveSel) return;
  const newSem = moveSel.value || null;
  if (newSem === currentSemId) return;

  try {
    const semVal = newSem ? newSem : null;
    await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, { method: 'PATCH', body: JSON.stringify({ semester_id: semVal }) });
    await sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}`, { method: 'PATCH', body: JSON.stringify({ semester_id: semVal }) });
    showToast('✅ Đã chuyển Khai Giảng');
    
    if (typeof loadProfiles === 'function') await loadProfiles();
    if (typeof loadDashboard === 'function') await loadDashboard();
    
    if (currentProfileId === profileId) {
      if (typeof refreshProfileInPlace === 'function') refreshProfileInPlace();
    }
  } catch(e) {
    showToast('❌ Lỗi đổi Khai Giảng');
    console.error(e);
  }
}

// ── Fruit Status Toggle (3-way: alive / pause / dropout) ──
async function toggleFruitStatus(profileId, current) {
  const newStatus = await new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--surface);border-radius:16px;padding:20px;min-width:260px;max-width:320px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    box.innerHTML = `<div style="font-weight:700;font-size:14px;margin-bottom:16px;color:var(--text1);">Chuyển trạng thái</div>`;
    const options = [
      { val: 'alive',   label: '🟢 Alive',    color: 'var(--green)', bg: 'rgba(52,211,153,0.12)' },
      { val: 'pause',   label: '⏸️ Pause',    color: '#9ca3af',       bg: 'rgba(156,163,175,0.12)' },
      { val: 'dropout', label: '🔴 Drop-out', color: 'var(--red)',    bg: 'rgba(248,113,113,0.12)' }
    ];
    options.forEach(o => {
      const isCurrent = o.val === current;
      const btn = document.createElement('button');
      btn.textContent = isCurrent ? `${o.label} (hiện tại)` : o.label;
      btn.disabled = isCurrent;
      btn.style.cssText = `display:block;width:100%;padding:10px;margin-bottom:8px;border-radius:10px;border:1.5px solid ${isCurrent ? o.color : 'var(--border)'};background:${isCurrent ? o.bg : 'var(--bg2)'};color:${o.color};font-size:13px;font-weight:700;cursor:${isCurrent ? 'default' : 'pointer'};opacity:${isCurrent ? '0.5' : '1'};`;
      if (!isCurrent) btn.onclick = () => { overlay.remove(); resolve(o.val); };
      box.appendChild(btn);
    });
    const cancel = document.createElement('button');
    cancel.textContent = 'Huỷ';
    cancel.style.cssText = 'display:block;width:100%;padding:8px;border:none;background:transparent;color:var(--text3);font-size:12px;cursor:pointer;margin-top:4px;';
    cancel.onclick = () => { overlay.remove(); resolve(null); };
    box.appendChild(cancel);
    overlay.appendChild(box);
    overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
    document.body.appendChild(overlay);
  });
  if (!newStatus || newStatus === current) return;

  const label = newStatus === 'dropout' ? 'Drop-out' : newStatus === 'pause' ? 'Pause' : 'Alive';

  let reason = '';
  if (newStatus === 'dropout' || newStatus === 'pause') {
    reason = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
      const box = document.createElement('div');
      box.style.cssText = 'background:var(--bg1,#fff);border-radius:16px;padding:20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
      const statusLabel = newStatus === 'dropout' ? 'Drop-out' : 'Pause';
      const color = newStatus === 'dropout' ? 'var(--red,#ef4444)' : '#f59e0b';
      box.innerHTML = `
        <div style="font-size:15px;font-weight:700;color:${color};margin-bottom:12px;">${newStatus === 'dropout' ? '🔴' : '⏸️'} Lý do ${statusLabel}</div>
        <div class="field-group" style="margin-bottom:10px;">
          <label style="font-size:12px;">Lý do chính</label>
          <input type="text" id="_reason_input" list="datalist_dropout_reasons" placeholder="Chọn hoặc nhập lý do..." autocomplete="off" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;" />
        </div>
        <div class="field-group" style="margin-bottom:14px;">
          <label style="font-size:12px;">Chi tiết bổ sung</label>
          <textarea id="_reason_detail" placeholder="Ghi thêm chi tiết (nếu có)..." style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px;font-size:13px;resize:vertical;min-height:60px;"></textarea>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button id="_reason_cancel" style="padding:8px 16px;border-radius:10px;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:12px;font-weight:600;cursor:pointer;">Huỷ</button>
          <button id="_reason_ok" style="padding:8px 16px;border-radius:10px;background:${color};border:none;color:white;font-size:12px;font-weight:700;cursor:pointer;">Xác nhận</button>
        </div>`;
      overlay.appendChild(box);
      document.body.appendChild(overlay);
      setTimeout(() => box.querySelector('#_reason_input')?.focus(), 100);
      box.querySelector('#_reason_cancel').onclick = () => { overlay.remove(); resolve(null); };
      box.querySelector('#_reason_ok').onclick = () => {
        const main = box.querySelector('#_reason_input')?.value?.trim() || '';
        const detail = box.querySelector('#_reason_detail')?.value?.trim() || '';
        overlay.remove();
        resolve(detail ? `${main} — ${detail}` : main);
      };
      overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(null); } };
    });
    if (reason === null) return;
  }

  if (!await showConfirmAsync(`Chuyển trạng thái trái quả thành "${label}"?`)) return;
  try {
    const patchBody = { fruit_status: newStatus };
    if (newStatus === 'dropout' || newStatus === 'pause') patchBody.dropout_reason = reason;
    else patchBody.dropout_reason = null;

    const patchRes = await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(patchBody)
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('PATCH failed:', patchRes.status, errText);
      showToast('❌ Lỗi cập nhật: ' + (errText || patchRes.status));
      return;
    }

    let updatedProfile = null;
    try {
      const patchData = await patchRes.json();
      if (Array.isArray(patchData) && patchData[0]) updatedProfile = patchData[0];
    } catch(e) {}

    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) {
      if (updatedProfile) {
        allProfiles[idx] = updatedProfile;
      } else {
        allProfiles[idx].fruit_status = newStatus;
        allProfiles[idx].dropout_reason = patchBody.dropout_reason;
      }
      if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(profileId);
      openProfile(allProfiles[idx]);
    }

    try {
      const recType = newStatus === 'dropout' ? 'drop_out' : newStatus === 'pause' ? 'pause' : 'alive';
      const _cn = newStatus === 'dropout' ? { reason: reason || 'Không có lý do' }
               : newStatus === 'pause'   ? { reason: reason || 'Tạm dừng' }
               : { note: 'Chuyển lại trạng thái Alive' };
      await sbFetch('/rest/v1/records', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ profile_id: profileId, record_type: recType, content: _cn })
      });
    } catch(err) { console.warn('Fail to record status change', err); }

    showToast(`✅ Đã chuyển sang ${label}`);
    if ((newStatus === 'dropout' || newStatus === 'pause') && typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
      const notifType = newStatus === 'dropout' ? 'drop_out' : 'pause';
      const icon = newStatus === 'dropout' ? '🔴' : '⏸️';
      const pName = allProfiles.find(x => x.id === profileId)?.full_name || '';
      const stakeholders = await getProfileStakeholders(profileId);
      createNotification(stakeholders, notifType, `${icon} ${label}`, pName + (reason ? ` — ${reason}` : ''), profileId);
    }
    filterProfiles();
    loadDashboard();
  } catch(e) { showToast('❌ Lỗi: ' + e.message); console.error('toggleFruitStatus:', e); }
}

// ── KT Toggle ──
window._currentKTProfileId = null;

async function toggleKTStatus(profileId, newState) {
  const p = allProfiles.find(x => x.id === profileId);
  if (!p) return;
  const myCode = getEffectiveStaffCode();
  const pos = getCurrentPosition();
  
  let hasPerm = false;
  if (hasPermission('toggle_kt')) hasPerm = true;
  if (!hasPerm && p.ndd_staff_code === myCode) hasPerm = true;
  if (!hasPerm) {
    try {
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
      const fgData = await fgRes.json();
      if (fgData && fgData[0]) {
        if (fgData[0].fruit_roles.some(r => r.role_type === 'gvbb' && r.staff_code === myCode)) {
          hasPerm = true;
        }
      }
    } catch(e) {}
  }
  
  if (!hasPerm) {
    showToast('⚠️ Không có quyền thay đổi trạng thái KT.');
    return;
  }
  
  if (!newState) {
    if (!await showConfirmAsync('Hủy trạng thái Đã mở KT? Sự kiện Mở KT trên Dòng thời gian cũng sẽ bị xóa.')) return;
    executeKTToggle(profileId, false, null);
  } else {
    window._currentKTProfileId = profileId;
    try {
      const bRes = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.bien_ban&select=content`);
      const bbs = await bRes.json();
      const buois = bbs.map(b => b.content?.buoi_thu).filter(Boolean).map(x => parseInt(x)).sort((a,b) => a-b);
      
      let opts = buois.map(b => `<option value="${b}">Báo cáo BB buổi ${b}</option>`).join('');
      if (!opts) opts = `<option value="">Chưa có Báo cáo BB nào</option>`;
      
      const html = `
        <div class="field-group">
          <label>Mở KT ở buổi BB thứ mấy?</label>
          <select id="kt_buoi_select" style="padding:10px; width:100%; border-radius:6px; border:1px solid var(--border);">${opts}</select>
          <div style="font-size:11px; color:var(--text3); margin-top:8px;">* Nếu không thấy thứ tự buổi bạn cần, xin hãy cập nhật thêm Báo Cáo BB.</div>
        </div>
      `;
      document.getElementById('ktModalBody').innerHTML = html;
      document.getElementById('ktModal').classList.add('open');
      document.getElementById('ktConfirmBtn').onclick = () => {
         const val = document.getElementById('kt_buoi_select').value;
         if (!val) return showToast('Vui lòng chọn hoặc tạo báo cáo BB trước.');
         closeModal('ktModal');
         executeKTToggle(profileId, true, val);
      };
    } catch(e) {
      console.error(e); showToast('❌ Lỗi tải danh sách Báo cáo BB.');
    }
  }
}

async function executeKTToggle(profileId, newState, buoiThu) {
  try {
    const myCode = getEffectiveStaffCode();
    
    if (newState) {
      const postRes = await sbFetch('/rest/v1/records', {
         method: 'POST',
         headers: { 'Prefer': 'return=representation' },
         body: JSON.stringify({
            profile_id: profileId,
            record_type: 'mo_kt',
            content: { buoi_thu: parseInt(buoiThu) }
         })
      });
      const postData = await postRes.text();
      if (!postRes.ok) {
        showToast('❌ Lỗi tạo sự kiện Mở KT: ' + postData);
        return;
      }
      
      const patchRes = await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_kt_opened: true })
      });
      
      showToast('✅ Đã xác nhận Mở KT!');
    } else {
      await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.mo_kt`, { method: 'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${profileId}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_kt_opened: false })
      });
      showToast('✅ Đã hủy Mở KT!');
    }
    
    const idx = allProfiles.findIndex(x => x.id === profileId);
    if (idx >= 0) allProfiles[idx].is_kt_opened = newState;
    
    if (typeof _refreshCurrentProfile === 'function' && window.currentProfileId === profileId) {
       _refreshCurrentProfile();
    } else {
       filterProfiles(); loadDashboard();
    }
  } catch(e) { showToast('❌ Lỗi: ' + e.message); console.error('executeKTToggle:', e); }
}
