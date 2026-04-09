// ============ STAFF ============
async function loadStaff() {
  try {
    const res = await sbFetch('/rest/v1/staff?select=*&order=created_at.desc');
    allStaff = await res.json();
    renderStaff(allStaff);
    markFresh('staff');
  } catch { document.getElementById('staffList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Lỗi tải</div></div>'; }
}
function renderStaff(list) {
  const el = document.getElementById('staffList');
  document.getElementById('staffCount').textContent = list.length + ' TĐ';
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Chưa có TĐ</div></div>'; return; }
  el.innerHTML = list.map(s => {
    const displayName = s.nickname ? `${s.nickname} <span style="color:var(--text3);font-size:11px;">(${s.full_name})</span>` : s.full_name;
    const metaLine2 = [
      s.gender || null,
      s.birth_year ? `${s.birth_year}` : null,
      s.telegram_id ? '🟢 Đã kết nối' : '⚪ Chưa kết nối'
    ].filter(Boolean).join(' · ');
    return `
    <div class="staff-card">
      <div class="staff-avatar">${(s.nickname||s.full_name||'?')[0]}</div>
      <div class="profile-info">
        <div class="profile-name">${displayName} <span style="color:var(--text3);font-size:12px;">(${s.staff_code})</span></div>
        <div class="profile-meta">
          <span class="staff-role-badge ${getBadgeClass(s.position)}">${getPositionName(s.position)}</span>
          ${s.specialist_position ? `<span class="staff-role-badge role-tvv">${getPositionName(s.specialist_position)}</span>` : ''}
          ${metaLine2}
        </div>
        ${s.bio ? `<div style="font-size:11px;color:var(--text2);margin-top:3px;font-style:italic;">${s.bio}</div>` : ''}
      </div>
    </div>`;
  }).join('');
}
function filterStaff() { const q=document.getElementById('staffSearchInput').value.toLowerCase(); renderStaff(allStaff.filter(s=>s.full_name.toLowerCase().includes(q)||s.staff_code.toLowerCase().includes(q)||(s.position||'').includes(q))); }
function openAddStaffModal() {
  // Populate position dropdowns dynamically from allPositions
  const posSel = document.getElementById('new_staff_position');
  if (posSel) {
    posSel.innerHTML = getManagementPositions().map(p =>
      `<option value="${p.code}">${p.name}</option>`
    ).join('');
  }
  const specSel = document.getElementById('new_staff_specialist');
  if (specSel) {
    let h = '<option value="">Không</option>';
    h += getSpecialistPositions().map(p =>
      `<option value="${p.code}">${p.name}</option>`
    ).join('');
    specSel.innerHTML = h;
  }
  document.getElementById('addStaffModal').classList.add('open');
}
async function addStaff() {
  const name = document.getElementById('new_staff_name').value.trim();
  const code = document.getElementById('new_staff_code').value.trim();
  if (!name||!code) { showToast('⚠️ Nhập họ tên và mã TĐ'); return; }
  const specialistVal = document.getElementById('new_staff_specialist')?.value || '';
  try {
    await sbFetch('/rest/v1/staff', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ full_name: name, staff_code: code, position: document.getElementById('new_staff_position').value, specialist_position: specialistVal || null, phone: document.getElementById('new_staff_phone').value.trim()||null, email: document.getElementById('new_staff_email').value.trim()||null }) });
    closeModal('addStaffModal'); showToast('✅ Đã đăng ký!');
    ['new_staff_name','new_staff_code','new_staff_phone','new_staff_email'].forEach(id=>document.getElementById(id).value='');
    await loadStaff();
  } catch { showToast('❌ Lỗi'); }
}

