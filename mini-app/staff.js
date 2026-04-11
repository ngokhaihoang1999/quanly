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
    const displayName = s.nickname ? `${s.nickname} <span style="color:var(--text3);font-size:11px;">(${s.full_name})</span>` : s.full_name;
    const botStatus = s.telegram_id
      ? '<span style="color:#22c55e;font-size:11px;font-weight:600;">🟢 Đã kết nối</span>'
      : '<span style="color:var(--text3);font-size:11px;">🔴 Chưa kết nối</span>';
    const teamName = getStaffTeamName(s.staff_code);
    const deleteBtn = canDelete ? `<button onclick="event.stopPropagation();deleteStaffFromList('${s.staff_code}')" style="background:none;border:none;color:var(--red);font-size:14px;cursor:pointer;padding:4px;opacity:0.6;" title="Xoá TĐ khỏi hệ thống">🗑</button>` : '';
    return `
    <div class="staff-card" style="display:flex;align-items:center;gap:10px;">
      <div class="staff-avatar">${(s.nickname||s.full_name||'?')[0]}</div>
      <div class="profile-info" style="flex:1;min-width:0;">
        <div class="profile-name">${displayName} <span style="color:var(--text3);font-size:12px;">(${s.staff_code})</span></div>
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

function filterStaff() { const q=document.getElementById('staffSearchInput').value.toLowerCase(); renderStaff(allStaff.filter(s=>s.full_name?.toLowerCase().includes(q)||s.staff_code.toLowerCase().includes(q)||(s.position||'').includes(q))); }

function openAddStaffModal() {
  document.getElementById('addStaffModal').classList.add('open');
  document.getElementById('new_staff_code').value = '';
  document.getElementById('new_staff_name').value = '';
  const tgEl = document.getElementById('new_staff_tg');
  if (tgEl) tgEl.value = '';
}

async function addStaff() {
  const name = document.getElementById('new_staff_name').value.trim();
  const code = document.getElementById('new_staff_code').value.trim();
  if (!name || !code) { showToast('⚠️ Nhập họ tên và mã TĐ'); return; }
  // Validate format
  if (!/^\d{3,6}-.+$/.test(code)) { showToast('⚠️ Mã TĐ phải có dạng: 000xxx-ABC'); return; }
  // Check dup
  if (allStaff.some(s => s.staff_code === code)) { showToast('⚠️ Mã "' + code + '" đã tồn tại!'); return; }
  const tgId = document.getElementById('new_staff_tg')?.value.trim() || null;
  try {
    const res = await sbFetch('/rest/v1/staff', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
      full_name: name, staff_code: code, position: 'td',
      telegram_id: tgId ? parseInt(tgId) : null
    })});
    if (!res.ok) { const e = await res.json(); throw new Error(e.message || 'Lỗi'); }
    closeModal('addStaffModal');
    showToast('✅ Đã tạo TĐ "' + code + '"!');
    await loadStaff();
  } catch(e) { showToast('❌ Lỗi: ' + (e.message||'')); console.error(e); }
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
    // Clear structural role references
    for (const a of (structureData||[])) {
      if (a.yjyn_staff_code === staffCode) await sbFetch(`/rest/v1/areas?id=eq.${a.id}`, { method:'PATCH', body: JSON.stringify({ yjyn_staff_code: null }) });
      for (const g of (a.org_groups||[])) {
        if (g.tjn_staff_code === staffCode) await sbFetch(`/rest/v1/org_groups?id=eq.${g.id}`, { method:'PATCH', body: JSON.stringify({ tjn_staff_code: null }) });
        for (const t of (g.teams||[])) {
          const up = {};
          if (t.gyjn_staff_code === staffCode) up.gyjn_staff_code = null;
          if (t.bgyjn_staff_code === staffCode) up.bgyjn_staff_code = null;
          if (Object.keys(up).length) await sbFetch(`/rest/v1/teams?id=eq.${t.id}`, { method:'PATCH', body: JSON.stringify(up) });
        }
      }
    }
    await sbFetch(`/rest/v1/staff?staff_code=eq.${encodeURIComponent(staffCode)}`, { method:'DELETE' });
    showToast('✅ Đã xóa TĐ ' + staffCode);
    await loadStaff();
    await loadStructure();
  } catch(e) { showToast('❌ Lỗi: ' + (e.message||'')); console.error(e); }
}
