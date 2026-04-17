// ============ STAFF ============
async function loadStaff() {
  try {
    const res = await sbFetch('/rest/v1/staff?select=*&order=staff_code.asc');
    allStaff = await res.json();
    renderStaff(allStaff);
    markFresh('staff');
  } catch { document.getElementById('staffList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Lỗi tải</div></div>'; }
}
function renderStaff(list) {
  const el = document.getElementById('staffList');
  document.getElementById('staffCount').textContent = list.length + ' TĐ';
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Chưa có TĐ</div></div>'; return; }
  const canDelete = hasPermission('manage_structure');
  el.innerHTML = list.map(s => {
    const name = s.nickname || s.full_name || s.staff_code;
    const subName = s.nickname && s.full_name ? `<span style="color:var(--text3);font-size:11px;">(${s.full_name})</span>` : '';
    const botStatus = s.telegram_id
      ? '<span style="color:#22c55e;font-size:11px;font-weight:600;">🟢 Đã kết nối</span>'
      : '<span style="color:var(--text3);font-size:11px;">🔴 Chưa kết nối</span>';
    const teamName = getStaffTeamName(s.staff_code);
    const deleteBtn = canDelete ? `<button onclick="event.stopPropagation();deleteStaffFromList('${s.staff_code}')" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:4px;opacity:0.6;" title="Xoá TĐ khỏi hệ thống">🗑</button>` : '';
    return `
    <div class="staff-card" style="display:flex;align-items:center;gap:10px;">
      <div class="staff-avatar">${getNameInitial(name)}</div>
      <div class="profile-info" style="flex:1;min-width:0;">
        <div class="profile-name">${name} ${subName} <span style="color:var(--text3);font-size:12px;">(${s.staff_code})</span></div>
        <div class="profile-meta" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
          <span class="staff-role-badge ${getBadgeClass(s.position)}">${getPositionName(s.position)}</span>
          ${s.specialist_position ? `<span class="staff-role-badge role-tvv">${getPositionName(s.specialist_position)}</span>` : ''}
          ${teamName ? `<span style="font-size:11px;color:var(--text3);">📁 ${teamName}</span>` : ''}
          ${botStatus}
        </div>
      </div>
      ${deleteBtn}
    </div>`;
  }).join('');
}

function getStaffTeamName(code) {
  for (const a of (structureData||[])) {
    for (const g of (a.org_groups||[])) {
      for (const t of (g.teams||[])) {
        if ((t.staff||[]).some(s => s.staff_code === code)) return t.name;
      }
    }
  }
  return '';
}

function filterStaff() { const q=document.getElementById('staffSearchInput').value.toLowerCase(); renderStaff(allStaff.filter(s=>(s.full_name||'').toLowerCase().includes(q)||s.staff_code.toLowerCase().includes(q)||(s.nickname||'').toLowerCase().includes(q)||(s.position||'').includes(q))); }

function openAddStaffModal() {
  document.getElementById('addStaffModal').classList.add('open');
  document.getElementById('new_staff_codes').value = '';
}

async function addStaffBulk() {
  const raw = document.getElementById('new_staff_codes').value.trim();
  if (!raw) { showToast('⚠️ Nhập ít nhất 1 mã JD'); return; }
  // Parse lines, trim, filter empty, uppercase
  const codes = raw.split(/[\n,;]+/).map(c => c.trim().toUpperCase()).filter(Boolean);
  if (!codes.length) { showToast('⚠️ Nhập ít nhất 1 mã JD'); return; }
  // Validate format
  const invalid = codes.filter(c => !/^\d{3,6}-.+$/.test(c));
  if (invalid.length) { showToast('⚠️ Sai định dạng: ' + invalid.join(', ') + '\nCần dạng: 000xxx-ABC'); return; }
  // Check dups
  const existing = codes.filter(c => allStaff.some(s => s.staff_code === c));
  if (existing.length) { showToast('⚠️ Đã tồn tại: ' + existing.join(', ')); return; }
  // Bulk insert
  const btn = document.querySelector('#addStaffModal .save-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Đang thêm...'; }
  try {
    const body = codes.map(c => ({ staff_code: c, full_name: null, position: 'td' }));
    const res = await sbFetch('/rest/v1/staff', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify(body) });
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }
    closeModal('addStaffModal');
    showToast(`✅ Đã thêm ${codes.length} TĐ!`);
    await loadStaff();
  } catch(e) { showToast('❌ Lỗi: ' + (e.message||'')); console.error(e); }
  if (btn) { btn.disabled = false; btn.textContent = '➕ Thêm TĐ'; }
}

async function deleteStaffFromList(staffCode) {
  const staff = allStaff.find(s => s.staff_code === staffCode);
  const name = staff?.full_name || staffCode;
  const profileCount = (allProfiles || []).filter(p => p.ndd_staff_code === staffCode).length;
  let warn = '';
  if (profileCount > 0) warn = `\n⚠️ TĐ này đang quản lý ${profileCount} hồ sơ trái quả.`;
  if (staff?.team_id) warn += `\n📁 TĐ đang thuộc tổ.`;
  if (!await showConfirmAsync(`Xóa vĩnh viễn TĐ "${staffCode}"?\n${name}${warn}\n\nThao tác không thể hoàn tác!`)) return;
  try {
    const sc = encodeURIComponent(staffCode);
    // 1. Clear structural role refs (YJYN, TJN, GYJN, BGYJN, created_by)
    for (const a of (structureData||[])) {
      const aUp = {};
      if (a.yjyn_staff_code === staffCode) aUp.yjyn_staff_code = null;
      if (a.created_by === staffCode) aUp.created_by = null;
      if (Object.keys(aUp).length) await sbFetch(`/rest/v1/areas?id=eq.${a.id}`, { method:'PATCH', body: JSON.stringify(aUp) });
      for (const g of (a.org_groups||[])) {
        const gUp = {};
        if (g.tjn_staff_code === staffCode) gUp.tjn_staff_code = null;
        if (g.created_by === staffCode) gUp.created_by = null;
        if (Object.keys(gUp).length) await sbFetch(`/rest/v1/org_groups?id=eq.${g.id}`, { method:'PATCH', body: JSON.stringify(gUp) });
        for (const t of (g.teams||[])) {
          const tUp = {};
          if (t.gyjn_staff_code === staffCode) tUp.gyjn_staff_code = null;
          if (t.bgyjn_staff_code === staffCode) tUp.bgyjn_staff_code = null;
          if (t.created_by === staffCode) tUp.created_by = null;
          if (Object.keys(tUp).length) await sbFetch(`/rest/v1/teams?id=eq.${t.id}`, { method:'PATCH', body: JSON.stringify(tUp) });
        }
      }
    }
    // 2. Clear fruit_roles (staff_code + assigned_by)
    await sbFetch(`/rest/v1/fruit_roles?staff_code=eq.${sc}`, { method:'DELETE' });
    await sbFetch(`/rest/v1/fruit_roles?assigned_by=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ assigned_by: null }) });
    // 3. Clear profiles
    await sbFetch(`/rest/v1/profiles?ndd_staff_code=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ ndd_staff_code: null }) });
    await sbFetch(`/rest/v1/profiles?gvbb_staff_code=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ gvbb_staff_code: null }) });
    // 4. Clear check_hapja (created_by is NOT NULL FK — must DELETE, not PATCH null)
    await sbFetch(`/rest/v1/check_hapja?created_by=eq.${sc}`, { method:'DELETE' });
    await sbFetch(`/rest/v1/check_hapja?approved_by=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ approved_by: null }) });
    await sbFetch(`/rest/v1/check_hapja?feedback_by=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ feedback_by: null }) });
    // 5. Clear consultation_sessions (tvv_staff_code FK + created_by text)
    await sbFetch(`/rest/v1/consultation_sessions?tvv_staff_code=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ tvv_staff_code: null }) });
    await sbFetch(`/rest/v1/consultation_sessions?created_by=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ created_by: null }) });
    // 5b. Clear records.created_by (text field, no FK but still references)
    await sbFetch(`/rest/v1/records?created_by=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ created_by: null }) });
    // 6. Clear calendar_events + priority_tasks
    await sbFetch(`/rest/v1/calendar_events?staff_code=eq.${sc}`, { method:'DELETE' });
    await sbFetch(`/rest/v1/priority_tasks?staff_code=eq.${sc}`, { method:'DELETE' });
    // 7. Clear notifications + preferences
    await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${sc}`, { method:'DELETE' });
    await sbFetch(`/rest/v1/notifications?source_staff_code=eq.${sc}`, { method:'DELETE' });
    await sbFetch(`/rest/v1/notification_preferences?staff_code=eq.${sc}`, { method:'DELETE' });
    // 8. Detach from team
    await sbFetch(`/rest/v1/staff?staff_code=eq.${sc}`, { method:'PATCH', body: JSON.stringify({ team_id: null }) });
    // 9. Delete staff record
    const res = await sbFetch(`/rest/v1/staff?staff_code=eq.${sc}`, { method:'DELETE', headers: { 'Prefer': 'return=representation' } });
    const deleted = await res.json();
    if (!Array.isArray(deleted) || deleted.length === 0) {
      // Try to get the actual error from Supabase
      console.error('Delete staff response:', deleted);
      throw new Error('Không xoá được — có thể còn ràng buộc dữ liệu khác. Mở Console (F12) xem chi tiết.');
    }
    showToast('✅ Đã xóa TĐ ' + staffCode);
    allStaff = allStaff.filter(s => s.staff_code !== staffCode);
    renderStaff(allStaff);
    await loadStructure();
  } catch(e) { showToast('❌ Lỗi xoá: ' + (e.message||'')); console.error('deleteStaffFromList:', e); }
}
