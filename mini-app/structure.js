// ============ STRUCTURE ============
async function loadStructure() {
  try {
    const res = await sbFetch('/rest/v1/areas?select=*,org_groups(*,teams(*,staff:staff!staff_team_id_fkey(*)))&order=name');
    structureData = await res.json();
    structureData.sort((a,b) => a.name.localeCompare(b.name, 'vi', {numeric:true}));
    structureData.forEach(a => {
      a.org_groups = (a.org_groups||[]).sort((x,y) => x.name.localeCompare(y.name, 'vi', {numeric:true}));
      a.org_groups.forEach(g => {
        g.teams = (g.teams||[]).sort((x,y) => x.name.localeCompare(y.name, 'vi', {numeric:true}));
        g.teams.forEach(t => {
          t.staff = (t.staff||[]).sort((m1, m2) => {
            let ep1 = m1.position||'td', ep2 = m2.position||'td';
            if (m1.staff_code===a.yjyn_staff_code) ep1='yjyn';
            if (m1.staff_code===g.tjn_staff_code) ep1='tjn';
            if (m1.staff_code===t.gyjn_staff_code) ep1='gyjn';
            if (m1.staff_code===t.bgyjn_staff_code) ep1='bgyjn';
            if (m2.staff_code===a.yjyn_staff_code) ep2='yjyn';
            if (m2.staff_code===g.tjn_staff_code) ep2='tjn';
            if (m2.staff_code===t.gyjn_staff_code) ep2='gyjn';
            if (m2.staff_code===t.bgyjn_staff_code) ep2='bgyjn';
            if (ep1==='gyjn' && ep2!=='gyjn') return -1;
            if (ep2==='gyjn' && ep1!=='gyjn') return 1;
            if (ep1==='bgyjn' && ep2!=='bgyjn') return -1;
            if (ep2==='bgyjn' && ep1!=='bgyjn') return 1;
            if (ep1!=='td' && ep2==='td') return -1;
            if (ep2!=='td' && ep1==='td') return 1;
            return m1.staff_code.localeCompare(m2.staff_code);
          });
        });
      });
    });
    if (typeof buildStaffUnitMap === 'function') buildStaffUnitMap(); // build unit lookup
    const el = document.getElementById('structureTree');
    const pos = getCurrentPosition();
    const myCode = getEffectiveStaffCode();
    const isAdmin = hasPermission('manage_structure');
    if (!structureData.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">\ud83c\udfe2</div><div class="empty-title">Ch\u01b0a c\u00f3</div><div class="empty-sub">B\u1ea5m + Khu v\u1ef1c</div></div>'; return; }
    let html = '<div class="tree-container">';
    structureData.forEach(a => {
      const aY = a.yjyn_staff_code ? '\ud83d\udc51 ' + a.yjyn_staff_code + ' <span class="staff-role-badge badge-yjyn" style="font-size:9px;padding:1px 6px;">YJYN</span>' : '';
      const canArea = isAdmin || (pos==='yjyn' && a.yjyn_staff_code===myCode);
      const aClick = canArea ? ` style="cursor:pointer" onclick="openEditStructModal('area','${a.id}')"` : '';
      html += `<div class="tree-node area"${aClick}><div><div class="tree-label">\ud83c\udfe2 ${a.name}${canArea?' \u270f\ufe0f':''}</div>${aY?`<div class="tree-manager">${aY}</div>`:''}</div><div class="tree-meta">Khu v\u1ef1c</div></div>`;
      (a.org_groups||[]).forEach(g => {
        const gT = g.tjn_staff_code ? '\ud83d\udc51 ' + g.tjn_staff_code + ' <span class="staff-role-badge badge-tjn" style="font-size:9px;padding:1px 6px;">TJN</span>' : '';
        const canGrp = canArea || (pos==='tjn' && g.tjn_staff_code===myCode);
        const gClick = canGrp ? ` style="cursor:pointer" onclick="openEditStructModal('group','${g.id}')"` : '';
        html += `<div class="tree-node group"${gClick}><div><div class="tree-label">\ud83d\udc65 ${g.name}${canGrp?' \u270f\ufe0f':''}</div>${gT?`<div class="tree-manager">${gT}</div>`:''}</div><div class="tree-meta">Nh\u00f3m</div></div>`;
        (g.teams||[]).forEach(t => {
          const tMArr = [];
          if (t.gyjn_staff_code) tMArr.push(t.gyjn_staff_code + ' <span class="staff-role-badge badge-gyjn" style="font-size:9px;padding:1px 6px;">GYJN</span>');
          if (t.bgyjn_staff_code) tMArr.push(t.bgyjn_staff_code + ' <span class="staff-role-badge badge-bgyjn" style="font-size:9px;padding:1px 6px;">BGYJN</span>');
          const tM = tMArr.join(', ');
          const members = t.staff||[];
          const canTeam = canGrp || (['gyjn','bgyjn'].includes(pos) && (t.gyjn_staff_code===myCode||t.bgyjn_staff_code===myCode));
          const tClick = canTeam ? ` style="cursor:pointer" onclick="openEditStructModal('team','${t.id}')"` : '';
          html += `<div class="tree-node team"${tClick}><div><div class="tree-label">\ud83d\udccc ${t.name}${canTeam?' \u270f\ufe0f':''}</div>${tM?`<div class="tree-manager">\ud83d\udc51 ${tM}</div>`:''}</div><div class="tree-meta">${members.length} TV</div></div>`;
          if (members.length) {
            members.forEach(m => {
              let ep = m.position || 'td';
              if (m.staff_code === a.yjyn_staff_code) ep = 'yjyn';
              if (m.staff_code === g.tjn_staff_code) ep = 'tjn';
              if (m.staff_code === t.gyjn_staff_code) ep = 'gyjn';
              if (m.staff_code === t.bgyjn_staff_code) ep = 'bgyjn';
              const posBadge = ep && ep !== 'td' ? `<span class="staff-role-badge ${getBadgeClass(ep)}" style="margin-left:6px;font-size:9px;padding:1px 6px;">${getPositionName(ep)}</span>` : '';
              const cmBadge = m.specialist_position
                ? `<span class="staff-role-badge" style="margin-left:4px;font-size:9px;padding:1px 5px;background:rgba(139,92,246,0.12);color:#7c3aed;border:1px solid rgba(139,92,246,0.25);">CM: ${getPositionName(m.specialist_position)}</span>`
                : '';
              html += `<div class="tree-node" style="margin-left:76px;padding:5px 10px;font-size:12px;border-left:2px dashed var(--border);"><span style="color:var(--text2);">👤 ${m.staff_code}</span>${posBadge}${cmBadge}</div>`;
            });
          }
        });
        if (canGrp) html += `<div class="tree-node group tree-add" onclick="openAddTeamModal('${g.id}')"><div class="tree-label">+ T\u1ed5</div></div>`;
      });
      if (canArea) html += `<div class="tree-node group tree-add" onclick="openAddGroupModal('${a.id}')"><div class="tree-label">+ Nh\u00f3m</div></div>`;
    });
    html += '</div>';
    el.innerHTML = html;
    populateViewAsDropdown();
    markFresh('structure');
  } catch(e) { console.error(e); document.getElementById('structureTree').innerHTML = '<div class="empty-state">L\u1ed7i t\u1ea3i</div>'; }
}
function populateStaffSelect(selId, ph) {
  let s = document.getElementById(selId);
  if(!s) return;
  s.value = '';
  s.placeholder = ph || 'Nhập mã hoặc tên TĐ...';
  s.setAttribute('data-list', 'staffSuggest');
}

function openAddAreaModal() {
  document.getElementById('structureModalTitle').textContent = '\ud83c\udfe2 Th\u00eam Khu v\u1ef1c';
  document.getElementById('struct_name').value = '';
  document.getElementById('struct_type').value = 'area';
  document.getElementById('struct_parent_wrap').style.display = 'none';
  document.getElementById('struct_manager_wrap').style.display = 'none';
  document.getElementById('struct_manager2_wrap').style.display = 'none';
  document.getElementById('structureModal').classList.add('open');
}
function openAddGroupModal(areaId) {
  document.getElementById('structureModalTitle').textContent = '\ud83d\udc65 Th\u00eam Nh\u00f3m';
  document.getElementById('struct_name').value = '';
  document.getElementById('struct_type').value = 'group';
  document.getElementById('struct_parent_wrap').style.display = 'block';
  document.getElementById('struct_parent_label').textContent = 'Thu\u1ed9c Khu v\u1ef1c';
  const sel = document.getElementById('struct_parent');
  sel.innerHTML = structureData.map(a => `<option value="${a.id}" ${a.id===areaId?'selected':''}>${a.name}</option>`).join('');
  document.getElementById('struct_manager_wrap').style.display = 'none';
  document.getElementById('struct_manager2_wrap').style.display = 'none';
  document.getElementById('structureModal').classList.add('open');
}
function openAddTeamModal(groupId) {
  document.getElementById('structureModalTitle').textContent = '\ud83d\udccc Th\u00eam T\u1ed5';
  document.getElementById('struct_name').value = '';
  document.getElementById('struct_type').value = 'team';
  document.getElementById('struct_parent_wrap').style.display = 'block';
  document.getElementById('struct_parent_label').textContent = 'Thu\u1ed9c Nh\u00f3m';
  const allGroups = structureData.flatMap(a => (a.org_groups||[]).map(g => ({...g, area: a.name})));
  const sel = document.getElementById('struct_parent');
  sel.innerHTML = allGroups.map(g => `<option value="${g.id}" ${g.id===groupId?'selected':''}>${g.name} (${g.area})</option>`).join('');
  document.getElementById('struct_manager_wrap').style.display = 'none';
  document.getElementById('struct_manager2_wrap').style.display = 'none';
  document.getElementById('structureModal').classList.add('open');
}
async function saveStructure() {
  const name = document.getElementById('struct_name').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Nh\u1eadp t\u00ean'); return; }
  const type = document.getElementById('struct_type').value;
  const parentId = document.getElementById('struct_parent').value;
  let mgr = getStaffCodeFromInput('struct_manager');
  let mgr2 = getStaffCodeFromInput('struct_manager2');
  if (type === 'team') { mgr = null; mgr2 = null; }

  // Check duplicate name
  if (type === 'area' && structureData.some(a => a.name.toLowerCase() === name.toLowerCase())) {
    showToast('\u26a0\ufe0f Khu v\u1ef1c "' + name + '" \u0111\u00e3 t\u1ed3n t\u1ea1i'); return;
  }
  if (type === 'group') {
    const parent = structureData.find(a => a.id === parentId);
    if (parent && (parent.org_groups||[]).some(g => g.name.toLowerCase() === name.toLowerCase())) {
      showToast('\u26a0\ufe0f Nh\u00f3m "' + name + '" \u0111\u00e3 t\u1ed3n t\u1ea1i'); return;
    }
  }
  if (type === 'team') {
    for (const a of structureData) {
      const parent = (a.org_groups||[]).find(g => g.id === parentId);
      if (parent && (parent.teams||[]).some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showToast('\u26a0\ufe0f T\u1ed5 "' + name + '" \u0111\u00e3 t\u1ed3n t\u1ea1i'); return;
      }
    }
  }

  let endpoint, body;
  if (type==='area') { endpoint='/rest/v1/areas'; body={name}; }
  else if (type==='group') { endpoint='/rest/v1/org_groups'; body={name, area_id:parentId}; }
  else { endpoint='/rest/v1/teams'; body={name, group_id:parentId}; }
  
  const saveBtn = document.querySelector('#structureModal .save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '\u23f3 \u0110ang t\u1ea1o...'; }

  try {
    const resp = await sbFetch(endpoint, { method:'POST', headers:{'Prefer':'return=representation'}, body:JSON.stringify(body) });
    const created = await resp.json();
    // Auto-add GYJN/BGYJN as team members
    if (type==='team' && created?.[0]?.id) {
      const tid = created[0].id;
      if (mgr) await sbFetch(`/rest/v1/staff?staff_code=eq.${mgr}&team_id=is.null`, { method:'PATCH', body:JSON.stringify({team_id:tid}) });
      if (mgr2) await sbFetch(`/rest/v1/staff?staff_code=eq.${mgr2}&team_id=is.null`, { method:'PATCH', body:JSON.stringify({team_id:tid}) });
    }
    closeModal('structureModal');
    showToast('\u2705 \u0110\u00e3 t\u1ea1o ' + name);
    loadStructure(); loadStaff();
  } catch(e) { 
    showToast('\u274c L\u1ed7i'); console.error(e); 
  } finally {
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '\ud83d\udcbe L\u01b0u'; }
  }
}

// ============ EDIT / DELETE STRUCTURE ============
function findStructItem(type, id) {
  for (const a of structureData) {
    if (type==='area' && a.id===id) return a;
    for (const g of (a.org_groups||[])) {
      if (type==='group' && g.id===id) return g;
      for (const t of (g.teams||[])) {
        if (type==='team' && t.id===id) return t;
      }
    }
  }
  return null;
}
function openEditStructModal(type, id) {
  const item = findStructItem(type, id);
  if (!item) return;
  document.getElementById('edit_struct_id').value = id;
  document.getElementById('edit_struct_type').value = type;
  document.getElementById('edit_struct_name').value = item.name;
  const labels = {area: '\ud83c\udfe2 Khu v\u1ef1c', group: '\ud83d\udc65 Nh\u00f3m', team: '\ud83d\udccc T\u1ed5'};
  document.getElementById('editStructTitle').textContent = '\u270f\ufe0f ' + labels[type] + ': ' + item.name;
  // Manager 1
  if (type==='area') {
    document.getElementById('edit_mgr1_label').textContent = 'YJYN';
    populateStaffSelect('edit_mgr1', 'Ch\u1ecdn YJYN...');
    setStaffInputValue('edit_mgr1', item.yjyn_staff_code);
    document.getElementById('edit_mgr2_wrap').style.display = 'none';
  } else if (type==='group') {
    document.getElementById('edit_mgr1_label').textContent = 'TJN';
    populateStaffSelect('edit_mgr1', 'Ch\u1ecdn TJN...');
    setStaffInputValue('edit_mgr1', item.tjn_staff_code);
    document.getElementById('edit_mgr2_wrap').style.display = 'none';
  } else {
    document.getElementById('edit_mgr1_wrap').style.display = 'none';
    document.getElementById('edit_mgr2_wrap').style.display = 'none';
  }
  
  if (type !== 'team') {
    document.getElementById('edit_mgr1_wrap').style.display = 'block';
  }

  // Members section (only for teams)
  const membersWrap = document.getElementById('edit_members_wrap');
  if (type==='team') {
    membersWrap.style.display = 'block';
    renderTeamMembers(item);
  } else {
    membersWrap.style.display = 'none';
  }
  document.getElementById('editStructModal').classList.add('open');
}
function renderTeamMembers(teamItem) {
  const members = teamItem.staff||[];
  const listEl = document.getElementById('edit_members_list');
  const pos = getCurrentPosition();
  const canAssignPos = hasPermission('assign_position');
  // Find parent area/group for YJYN/TJN cross-reference
  let parentArea = null, parentGroup = null;
  for (const a of (structureData||[])) {
    for (const g of (a.org_groups||[])) {
      for (const t of (g.teams||[])) {
        if (t.id === teamItem.id) { parentArea = a; parentGroup = g; break; }
      }
      if (parentGroup) break;
    }
    if (parentArea) break;
  }
  if (!members.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px;">Ch\u01b0a c\u00f3 th\u00e0nh vi\u00ean</div>';
  } else {
    members.sort((m1, m2) => {
      let ep1 = m1.position || 'td';
      let ep2 = m2.position || 'td';
      if (parentArea && m1.staff_code === parentArea.yjyn_staff_code) ep1 = 'yjyn';
      if (parentGroup && m1.staff_code === parentGroup.tjn_staff_code) ep1 = 'tjn';
      if (m1.staff_code === teamItem.gyjn_staff_code) ep1 = 'gyjn';
      if (m1.staff_code === teamItem.bgyjn_staff_code) ep1 = 'bgyjn';
      
      if (parentArea && m2.staff_code === parentArea.yjyn_staff_code) ep2 = 'yjyn';
      if (parentGroup && m2.staff_code === parentGroup.tjn_staff_code) ep2 = 'tjn';
      if (m2.staff_code === teamItem.gyjn_staff_code) ep2 = 'gyjn';
      if (m2.staff_code === teamItem.bgyjn_staff_code) ep2 = 'bgyjn';
      
      if (ep1 === 'gyjn' && ep2 !== 'gyjn') return -1;
      if (ep2 === 'gyjn' && ep1 !== 'gyjn') return 1;
      if (ep1 === 'bgyjn' && ep2 !== 'bgyjn') return -1;
      if (ep2 === 'bgyjn' && ep1 !== 'bgyjn') return 1;
      if (ep1 !== 'td' && ep2 === 'td') return -1;
      if (ep2 !== 'td' && ep1 === 'td') return 1;
      return m1.staff_code.localeCompare(m2.staff_code);
    });
    listEl.innerHTML = members.map(m => {
      let effectivePos = m.position || 'td';
      if (parentArea && m.staff_code === parentArea.yjyn_staff_code) effectivePos = 'yjyn';
      if (parentGroup && m.staff_code === parentGroup.tjn_staff_code) effectivePos = 'tjn';
      if (m.staff_code === teamItem.gyjn_staff_code) effectivePos = 'gyjn';
      if (m.staff_code === teamItem.bgyjn_staff_code) effectivePos = 'bgyjn';
      const posBadge = `<span class="staff-role-badge ${getBadgeClass(effectivePos)}" style="font-size:9px;padding:1px 6px;">${getPositionName(effectivePos)}</span>`;
      const cmBadge = m.specialist_position
        ? `<span class="staff-role-badge" style="font-size:9px;padding:1px 6px;margin-left:3px;background:rgba(139,92,246,0.15);color:#7c3aed;border:1px solid rgba(139,92,246,0.3);">CM: ${getPositionName(m.specialist_position)}</span>`
        : '';
      const assignHtml = canAssignPos ? `
        <div style="display:flex;gap:4px;margin-top:4px;">
          <select onchange="assignMemberPos('${m.staff_code}',this.value,'management')" style="padding:2px 6px;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;flex:1;">
            ${getManagementPositions().map(p => `<option value="${p.code}" ${effectivePos===p.code?'selected':''}>${p.name}</option>`).join('')}
          </select>
          <select onchange="assignMemberPos('${m.staff_code}',this.value,'specialist')" style="padding:2px 6px;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;flex:1;">
            <option value="">CM: Không</option>
            ${getSpecialistPositions().map(p => `<option value="${p.code}" ${m.specialist_position===p.code?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>` : '';
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${m.staff_code} ${posBadge}${cmBadge}</div>
          ${assignHtml}
        </div>
        <button onclick="removeMemberFromTeam('${m.staff_code}')" style="background:none;border:none;color:var(--red);font-size:16px;cursor:pointer;padding:2px;" title="G\u1ee1 kh\u1ecfi t\u1ed5">\u2716</button>
      </div>`;
    }).join('');
  }
  // Populate add-member dropdown with staff NOT already in this team
  const teamId = document.getElementById('edit_struct_id').value;
  const memberCodes = members.map(m => m.staff_code);
  let addSel = document.getElementById('edit_add_member');
  const dListId = 'teamAddDatalist';
  if (!document.getElementById(dListId)) { const dl = document.createElement('datalist'); dl.id = dListId; document.body.appendChild(dl); }
  document.getElementById(dListId).innerHTML = allStaff.filter(s => !memberCodes.includes(s.staff_code)).map(s => `<option value="${s.full_name} (${s.staff_code})"></option>`).join('');
  
  if (addSel) {
    addSel.value = '';
    addSel.setAttribute('data-list', dListId);
  }
}
async function updateStructure() {
  const id = document.getElementById('edit_struct_id').value;
  const type = document.getElementById('edit_struct_type').value;
  const name = document.getElementById('edit_struct_name').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Nh\u1eadp t\u00ean'); return; }
  let mgr = getStaffCodeFromInput('edit_mgr1');
  let mgr2 = getStaffCodeFromInput('edit_mgr2');
  const tables = {area:'areas', group:'org_groups', team:'teams'};
  const oldItem = findStructItem(type, id);
  
  if (type === 'team') {
    mgr = oldItem?.gyjn_staff_code || null;
    mgr2 = oldItem?.bgyjn_staff_code || null;
  }
  
  let body = { name };
  if (type==='area') body.yjyn_staff_code = mgr||null;
  else if (type==='group') body.tjn_staff_code = mgr||null;
  else { body.gyjn_staff_code = mgr||null; body.bgyjn_staff_code = mgr2||null; }
  try {
    await sbFetch(`/rest/v1/${tables[type]}?id=eq.${id}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify(body) });
    // Sync staff.position when structural managers change
    const syncMgr = async (oldCode, newCode, posCode) => {
      if (oldCode === (newCode||null)) return;
      if (oldCode && oldCode !== newCode) {
        const fallback = getHighestStructuralPosition(oldCode, type, id);
        await sbFetch(`/rest/v1/staff?staff_code=eq.${oldCode}`, { method:'PATCH', body: JSON.stringify({ position: fallback }) });
      }
      if (newCode) {
        await sbFetch(`/rest/v1/staff?staff_code=eq.${newCode}`, { method:'PATCH', body: JSON.stringify({ position: posCode }) });
      }
    };
    if (type === 'team' && oldItem) {
      await syncMgr(oldItem.gyjn_staff_code, mgr, 'gyjn');
      await syncMgr(oldItem.bgyjn_staff_code, mgr2, 'bgyjn');
    } else if (type === 'group' && oldItem) {
      await syncMgr(oldItem.tjn_staff_code, mgr, 'tjn');
    } else if (type === 'area' && oldItem) {
      await syncMgr(oldItem.yjyn_staff_code, mgr, 'yjyn');
    }
    // Auto-add GYJN/BGYJN as team members, and clear old GYJN/BGYJN's position to prevent duplicates
    if (type==='team') {
      // Clear old GYJN position if changing to someone else
      if (oldItem?.gyjn_staff_code && oldItem.gyjn_staff_code !== (mgr||null)) {
        await sbFetch(`/rest/v1/staff?staff_code=eq.${oldItem.gyjn_staff_code}&position=eq.gyjn`, { method:'PATCH', body:JSON.stringify({position:'td'}) });
      }
      // Clear old BGYJN position if changing to someone else
      if (oldItem?.bgyjn_staff_code && oldItem.bgyjn_staff_code !== (mgr2||null)) {
        await sbFetch(`/rest/v1/staff?staff_code=eq.${oldItem.bgyjn_staff_code}&position=eq.bgyjn`, { method:'PATCH', body:JSON.stringify({position:'td'}) });
      }
      if (mgr) await sbFetch(`/rest/v1/staff?staff_code=eq.${mgr}&team_id=is.null`, { method:'PATCH', body:JSON.stringify({team_id:id}) });
      if (mgr2) await sbFetch(`/rest/v1/staff?staff_code=eq.${mgr2}&team_id=is.null`, { method:'PATCH', body:JSON.stringify({team_id:id}) });
    }
    closeModal('editStructModal');
    showToast('\u2705 \u0110\u00e3 c\u1eadp nh\u1eadt');
    loadStructure(); loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}
async function deleteStructure() {
  const id = document.getElementById('edit_struct_id').value;
  const type = document.getElementById('edit_struct_type').value;
  const name = document.getElementById('edit_struct_name').value;
  const labels = {area:'Khu v\u1ef1c', group:'Nh\u00f3m', team:'T\u1ed5'};
  if (!await showConfirmAsync(`X\u00f3a ${labels[type]} "${name}"?\nT\u1ea5t c\u1ea3 d\u1eef li\u1ec7u b\u00ean trong s\u1ebd b\u1ecb x\u00f3a!`)) return;
  const tables = {area:'areas', group:'org_groups', team:'teams'};
  try {
    await sbFetch(`/rest/v1/${tables[type]}?id=eq.${id}`, { method:'DELETE' });
    closeModal('editStructModal');
    showToast('\u2705 \u0110\u00e3 x\u00f3a ' + name);
    loadStructure();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}

// ============ TEAM MEMBERS ============
async function addMemberToTeam() {
  const code = getStaffCodeFromInput('edit_add_member');
  if (!code) { showToast('\u26a0\ufe0f Ch\u1ecdn T\u0110'); return; }
  const teamId = document.getElementById('edit_struct_id').value;
  try {
    const staff = allStaff.find(s => s.staff_code === code);
    
    // If moving from another team, clean up their old roles in that team
    if (staff && staff.team_id && staff.team_id !== teamId) {
      const oldTeam = findStructItem('team', staff.team_id);
      if (oldTeam) {
        const up = {};
        let changedPos = false;
        if (oldTeam.gyjn_staff_code === code) { up.gyjn_staff_code = null; changedPos = true; }
        if (oldTeam.bgyjn_staff_code === code) { up.bgyjn_staff_code = null; changedPos = true; }
        
        if (Object.keys(up).length > 0) {
          await sbFetch(`/rest/v1/teams?id=eq.${staff.team_id}`, { method: 'PATCH', body: JSON.stringify(up) });
        }
        if (changedPos) {
          const fallback = getHighestStructuralPosition(code, 'team', staff.team_id);
          await sbFetch(`/rest/v1/staff?staff_code=eq.${code}`, { method:'PATCH', body: JSON.stringify({ position: fallback }) });
        }
      }
    }

    await sbFetch(`/rest/v1/staff?staff_code=eq.${code}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify({team_id:teamId}) });
    showToast('\u2705 \u0110\u00e3 th\u00eam');
    // Reload data and refresh member list
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
    
    // Clear the input
    const inputEl = document.getElementById('edit_add_member');
    if (inputEl) inputEl.value = '';
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}
async function removeMemberFromTeam(staffCode) {
  if (!await showConfirmAsync('G\u1ee1 th\u00e0nh vi\u00ean n\u00e0y kh\u1ecfi t\u1ed5?')) return;
  const teamId = document.getElementById('edit_struct_id').value;
  try {
    // 1. Remove from staff table
    await sbFetch(`/rest/v1/staff?staff_code=eq.${staffCode}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify({team_id:null}) });
    
    // 2. Clear structural roles if they held them in this team AND demote them
    const teamItem = findStructItem('team', teamId);
    if (teamItem) {
      const up = {};
      let changedPos = false;
      if (teamItem.gyjn_staff_code === staffCode) { up.gyjn_staff_code = null; changedPos = true; }
      if (teamItem.bgyjn_staff_code === staffCode) { up.bgyjn_staff_code = null; changedPos = true; }
      
      if (Object.keys(up).length > 0) {
        await sbFetch(`/rest/v1/teams?id=eq.${teamId}`, { method:'PATCH', body:JSON.stringify(up) });
      }
      if (changedPos) {
        const fallback = getHighestStructuralPosition(staffCode, 'team', teamId);
        await sbFetch(`/rest/v1/staff?staff_code=eq.${staffCode}`, { method:'PATCH', body: JSON.stringify({ position: fallback }) });
      }
    }
    
    showToast('\u2705 \u0110\u00e3 g\u1ee1');
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}
// Returns highest structural position a staff holds (excluding a specific unit being edited)
function getHighestStructuralPosition(staffCode, excludeType, excludeId) {
  for (const a of (structureData || [])) {
    if (a.yjyn_staff_code === staffCode && !(excludeType === 'area' && a.id === excludeId)) return 'yjyn';
  }
  for (const a of (structureData || [])) {
    for (const g of (a.org_groups || [])) {
      if (g.tjn_staff_code === staffCode && !(excludeType === 'group' && g.id === excludeId)) return 'tjn';
    }
  }
  for (const a of (structureData || [])) {
    for (const g of (a.org_groups || [])) {
      for (const t of (g.teams || [])) {
        if (t.gyjn_staff_code === staffCode && !(excludeType === 'team' && t.id === excludeId)) return 'gyjn';
        if (t.bgyjn_staff_code === staffCode && !(excludeType === 'team' && t.id === excludeId)) return 'bgyjn';
      }
    }
  }
  return 'td';
}

async function assignMemberPos(staffCode, newPos, posType) {
  try {
    const teamId = document.getElementById('edit_struct_id').value;

    if (posType === 'management') {
      const teamItem = findStructItem('team', teamId);
      let parentArea = null, parentGroup = null;
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          for (const t of (g.teams||[])) {
            if (t.id === teamId) { parentArea = a; parentGroup = g; }
          }
        }
      }

      // Structural column mapping
      const STRUCT_MAP = {
        yjyn:  { table: 'areas',      field: 'yjyn_staff_code',  unitId: parentArea?.id,  unitName: 'Khu v\u1ef1c', getHolder: function(){ return parentArea?.yjyn_staff_code; },  exType: 'area' },
        tjn:   { table: 'org_groups',  field: 'tjn_staff_code',   unitId: parentGroup?.id, unitName: 'Nh\u00f3m',    getHolder: function(){ return parentGroup?.tjn_staff_code; },  exType: 'group' },
        gyjn:  { table: 'teams',       field: 'gyjn_staff_code',  unitId: teamId,          unitName: 'T\u1ed5',      getHolder: function(){ return teamItem?.gyjn_staff_code; },   exType: 'team' },
        bgyjn: { table: 'teams',       field: 'bgyjn_staff_code', unitId: teamId,          unitName: 'T\u1ed5',      getHolder: function(){ return teamItem?.bgyjn_staff_code; },  exType: 'team' },
      };

      const sInfo = STRUCT_MAP[newPos];

      if (sInfo && sInfo.unitId) {
        const currentHolder = sInfo.getHolder();
        if (currentHolder && currentHolder !== staffCode) {
          const hn = allStaff.find(s => s.staff_code === currentHolder)?.full_name || currentHolder;
          if (!await showConfirmAsync('\u26a0\ufe0f M\u1ed7i ' + sInfo.unitName + ' ch\u1ec9 c\u00f3 1 ' + getPositionName(newPos) + '.\n\nHi\u1ec7n t\u1ea1i: ' + hn + ' (' + currentHolder + ')\n\u0110\u1ed5i sang ' + staffCode + '?')) return;
          const fallback = getHighestStructuralPosition(currentHolder, sInfo.exType, sInfo.unitId);
          await sbFetch('/rest/v1/staff?staff_code=eq.' + currentHolder, { method:'PATCH', body: JSON.stringify({ position: fallback }) });
        }
        await sbFetch('/rest/v1/' + sInfo.table + '?id=eq.' + sInfo.unitId, { method:'PATCH', body: JSON.stringify({ [sInfo.field]: staffCode }) });
      }

      // Clear old structural columns if this staff held different team role
      if (teamItem) {
        const teamUp = {};
        if (newPos !== 'gyjn' && teamItem.gyjn_staff_code === staffCode) teamUp.gyjn_staff_code = null;
        if (newPos !== 'bgyjn' && teamItem.bgyjn_staff_code === staffCode) teamUp.bgyjn_staff_code = null;
        if (Object.keys(teamUp).length > 0) {
          await sbFetch('/rest/v1/teams?id=eq.' + teamId, { method:'PATCH', body: JSON.stringify(teamUp) });
        }
      }
      // Clear same position from other units
      if (newPos === 'yjyn') {
        for (const a of (structureData||[])) {
          if (a.id !== parentArea?.id && a.yjyn_staff_code === staffCode) {
            await sbFetch('/rest/v1/areas?id=eq.' + a.id, { method:'PATCH', body: JSON.stringify({ yjyn_staff_code: null }) });
          }
        }
      }
      if (newPos === 'tjn') {
        for (const a of (structureData||[])) {
          for (const g of (a.org_groups||[])) {
            if (g.id !== parentGroup?.id && g.tjn_staff_code === staffCode) {
              await sbFetch('/rest/v1/org_groups?id=eq.' + g.id, { method:'PATCH', body: JSON.stringify({ tjn_staff_code: null }) });
            }
          }
        }
      }
      if (newPos === 'gyjn' || newPos === 'bgyjn') {
        const clearField = newPos + '_staff_code';
        for (const a of (structureData||[])) {
          for (const g of (a.org_groups||[])) {
            for (const t of (g.teams||[])) {
              if (t.id !== teamId && t[clearField] === staffCode) {
                await sbFetch('/rest/v1/teams?id=eq.' + t.id, { method:'PATCH', body: JSON.stringify({ [clearField]: null }) });
              }
            }
          }
        }
      }
    }

    const body = posType === 'specialist' ? { specialist_position: newPos || null } : { position: newPos };
    await sbFetch('/rest/v1/staff?staff_code=eq.' + staffCode, { method:'PATCH', body: JSON.stringify(body) });
    const label = posType === 'specialist' ? (newPos ? getPositionName(newPos) : 'Kh\u00f4ng') : getPositionName(newPos);
    showToast('\u2705 \u0110\u00e3 ch\u1ec9 \u0111\u1ecbnh ' + label + ' cho ' + staffCode);
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}

// ============ POSITION MANAGER ============
function openPositionManager() {
  showPositionList();
  document.getElementById('positionManagerModal').classList.add('open');
}
function showPositionList() {
  document.getElementById('positionListView').style.display = 'block';
  document.getElementById('positionFormView').style.display = 'none';
  const mgmtList = document.getElementById('posMgmtList');
  const specList = document.getElementById('posSpecList');
  const renderItem = p => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:4px;cursor:pointer;" onclick="openPositionForm('${p.id}')">
      <div style="width:12px;height:12px;border-radius:50%;background:${p.color||'#6b7280'};flex-shrink:0;"></div>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:600;">${p.name} <span style="color:var(--text3);font-size:11px;">(${p.code})</span></div>
        <div style="font-size:11px;color:var(--text2);">${SCOPE_LABELS[p.scope_level]||p.scope_level} \u00b7 L${p.level} \u00b7 ${(p.permissions||[]).length} quyền${p.is_system?' \u00b7 \ud83d\udd12 Hệ thống':''}</div>
      </div>
      <span style="color:var(--text3);">›</span>
    </div>`;
  mgmtList.innerHTML = getManagementPositions().map(renderItem).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px;">Không có</div>';
  specList.innerHTML = getSpecialistPositions().map(renderItem).join('') || '<div style="color:var(--text3);font-size:12px;padding:8px;">Không có</div>';
}
function openPositionForm(posId) {
  document.getElementById('positionListView').style.display = 'none';
  document.getElementById('positionFormView').style.display = 'block';
  // Render permission checkboxes
  const permEl = document.getElementById('pos_permissions');
  permEl.innerHTML = ALL_PERMISSION_KEYS.map(k =>
    `<label style="display:flex;align-items:center;gap:4px;font-size:12px;padding:4px;cursor:pointer;"><input type="checkbox" value="${k}" />${PERMISSION_LABELS[k]||k}</label>`
  ).join('');
  if (posId) {
    const p = allPositions.find(x => x.id === posId);
    if (!p) return;
    document.getElementById('pos_editing_id').value = p.id;
    document.getElementById('pos_code').value = p.code;
    document.getElementById('pos_code').disabled = true; // code đã tạo không đổi
    document.getElementById('pos_name').value = p.name;
    document.getElementById('pos_category').value = p.category;
    document.getElementById('pos_scope').value = p.scope_level;
    document.getElementById('pos_level').value = p.level;
    document.getElementById('pos_color').value = p.color || '#6b7280';
    // Check matching permissions
    permEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
      cb.checked = (p.permissions||[]).includes(cb.value);
    });
    document.getElementById('pos_delete_btn').style.display = p.is_system ? 'none' : 'block';
  } else {
    document.getElementById('pos_editing_id').value = '';
    document.getElementById('pos_code').value = '';
    document.getElementById('pos_code').disabled = false;
    document.getElementById('pos_name').value = '';
    document.getElementById('pos_category').value = 'management';
    document.getElementById('pos_scope').value = 'team';
    document.getElementById('pos_level').value = '10';
    document.getElementById('pos_color').value = '#6b7280';
    permEl.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
    document.getElementById('pos_delete_btn').style.display = 'none';
  }
}
async function savePosition() {
  const id = document.getElementById('pos_editing_id').value;
  const code = document.getElementById('pos_code').value.trim();
  const name = document.getElementById('pos_name').value.trim();
  if (!code || !name) { showToast('\u26a0\ufe0f Nhập mã code và tên'); return; }
  const perms = Array.from(document.getElementById('pos_permissions').querySelectorAll('input:checked')).map(cb => cb.value);
  const body = {
    code, name,
    category: document.getElementById('pos_category').value,
    scope_level: document.getElementById('pos_scope').value,
    level: parseInt(document.getElementById('pos_level').value) || 10,
    permissions: perms,
    color: document.getElementById('pos_color').value
  };
  try {
    if (id) {
      delete body.code; // không cập nhật code
      await sbFetch(`/rest/v1/positions?id=eq.${id}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify(body) });
    } else {
      await sbFetch('/rest/v1/positions', { method:'POST', headers:{'Prefer':'return=representation'}, body:JSON.stringify(body) });
    }
    showToast('\u2705 \u0110\u00e3 l\u01b0u Ch\u1ee9c v\u1ee5 "' + name + '"');
    await loadPositions();
    showPositionList();
  } catch(e) { showToast('\u274c L\u1ed7i l\u01b0u'); console.error(e); }
}
async function deletePosition() {
  const id = document.getElementById('pos_editing_id').value;
  const name = document.getElementById('pos_name').value;
  if (!id) return;
  if (!await showConfirmAsync(`Xóa Chức vụ "${name}"? Staff đang sử dụng sẽ cần được gán chức vụ khác.`)) return;
  try {
    await sbFetch(`/rest/v1/positions?id=eq.${id}`, { method:'DELETE' });
    showToast('\u2705 \u0110\u00e3 x\u00f3a');
    await loadPositions();
    showPositionList();
  } catch(e) { showToast('\u274c L\u1ed7i x\u00f3a'); console.error(e); }
}

// ============ ADMIN: ORPHAN STAFF ============
async function showStaffWithoutTeam() {
  if (!allStaff || allStaff.length === 0) return;
  const orphans = allStaff.filter(s => !s.team_id && s.position !== 'admin');
  
  if (orphans.length === 0) {
    await showConfirmAsync('Tất cả TĐ (trừ Admin) đều đã xếp vào cơ cấu.');
    return;
  }
  
  const content = orphans.map(s => {
    let posLabel = getPositionName(s.position || 'td');
    return `<div style="padding:4px 0;border-bottom:1px solid #eee;">• <b>${s.staff_code}</b> - ${s.full_name} <span class="staff-role-badge ${getBadgeClass(s.position||'td')}" style="font-size:9px;padding:1px 6px;">${posLabel}</span></div>`;
  }).join('');
  
  await showConfirmAsync(`<div style="font-weight:bold;margin-bottom:8px;font-size:14px;color:var(--red);">👥 TĐ CHƯA CÓ ĐƠN VỊ TỔ </div><div style="font-size:13px;line-height:1.6;max-height:60vh;overflow-y:auto;text-align:left;">${content}</div>`);
}
