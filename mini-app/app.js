const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtem9vbWVreXZsbHNncHBndnh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyODg3MjcsImV4cCI6MjA4ODg2NDcyN30.TJ1BPyG8IlnxPSClIlJoOCpYUMhHHBmyL3cKFoXBJBY';
const tg = window.Telegram?.WebApp;

let currentProfileId = null, currentRecordType = null;
let allProfiles = [], allStaff = [], myStaff = null;

const POS_LABELS = { td:'TĐ', bgyjn:'BGYJN (Tổ phó)', gyjn:'GYJN (Tổ trưởng)', sgn_jondo:'SGN Jondo', ggn_chakki:'GGN Chakki', ggn_jondo:'GGN Jondo', tjn:'TJN', yjyn:'YJYN', admin:'Admin' };
function getPositionName(p) { return POS_LABELS[p] || p || 'TĐ'; }
function getBadgeClass(p) {
  if (!p) return 'role-default';
  if (p==='admin'||p==='yjyn') return 'role-admin';
  if (p==='tjn'||p==='gyjn') return 'role-ndd';
  if (['ggn_jondo','ggn_chakki','sgn_jondo'].includes(p)) return 'role-tvv';
  return 'role-default';
}

// Helpers
function getChipValues(id) { const el=document.getElementById(id); if(!el) return []; return Array.from(el.querySelectorAll('.chip.selected')).map(c=>c.textContent.trim()); }
function setChipValues(id, vals) { const el=document.getElementById(id); if(!el||!vals) return; el.querySelectorAll('.chip').forEach(c=>{ vals.includes(c.textContent.trim()) ? c.classList.add('selected') : c.classList.remove('selected'); }); }
function clearChips(id) { const el=document.getElementById(id); if(el) el.querySelectorAll('.chip').forEach(c=>c.classList.remove('selected')); }
function toggleChip(el) { el.classList.toggle('selected'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function showToast(msg) { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2500); }

async function sbFetch(path, opts={}) {
  return fetch(SUPABASE_URL + path, { ...opts, headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json', 'Prefer': opts.method==='POST'?'return=representation':undefined, ...opts.headers } });
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', async () => {
  if (tg) { tg.ready(); tg.expand(); }
  await loadStaffInfo();
  await Promise.all([loadProfiles(), loadDashboard(), loadStaff()]);
});

async function loadStaffInfo() {
  const userId = tg?.initDataUnsafe?.user?.id;
  if (!userId) {
    document.getElementById('staffBadge').textContent = 'Demo';
    myStaff = { staff_code: 'DEMO', position: 'admin', full_name: 'Demo Admin' };
    document.getElementById('viewAsBar').classList.add('active');
    applyPermissions();
    return;
  }
  try {
    const res = await sbFetch(`/rest/v1/staff?telegram_id=eq.${userId}&select=*`);
    const data = await res.json();
    if (data.length > 0) {
      myStaff = data[0];
      document.getElementById('staffBadge').textContent = `${myStaff.staff_code} \u00b7 ${getPositionName(myStaff.position)}`;
      if (myStaff.position === 'admin') {
        document.getElementById('viewAsBar').classList.add('active');
      }
      const allRes = await sbFetch('/rest/v1/staff?select=full_name,staff_code');
      const allS = await allRes.json();
      const dl = document.getElementById('staffSuggest');
      if (dl) dl.innerHTML = allS.map(s=>`<option value="${s.full_name} (${s.staff_code})">`).join('');
    }
  } catch {}
  applyPermissions();
}

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const pos = getCurrentPosition();
    const myCode = getEffectiveStaffCode();

    // ── Determine unit scope: collect staff codes in my managed unit ──
    let unitLabel = '';
    let unitStaffCodes = []; // all staff_code in my unit
    if (pos === 'admin') {
      unitLabel = 'Toàn hệ thống';
      unitStaffCodes = allStaff.map(s => s.staff_code);
    } else if (pos === 'yjyn') {
      // Manage whole Area
      const myArea = (structureData||[]).find(a => a.yjyn_staff_code === myCode);
      if (myArea) {
        unitLabel = 'Khu vực: ' + myArea.name;
        (myArea.org_groups||[]).forEach(g => {
          (g.teams||[]).forEach(t => { (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)); });
        });
      }
    } else if (pos === 'tjn') {
      // Manage a Group
      for (const a of (structureData||[])) {
        const myGrp = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (myGrp) {
          unitLabel = 'Nhóm: ' + myGrp.name;
          (myGrp.teams||[]).forEach(t => { (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)); });
          break;
        }
      }
    } else if (['gyjn','bgyjn'].includes(pos)) {
      // Manage a Team
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          const myTeam = (g.teams||[]).find(t => t.gyjn_staff_code === myCode || t.bgyjn_staff_code === myCode);
          if (myTeam) {
            unitLabel = 'Tổ: ' + myTeam.name;
            (myTeam.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code));
            break;
          }
        }
        if (unitLabel) break;
      }
    } else if (['ggn_jondo','ggn_chakki','sgn_jondo'].includes(pos)) {
      // GGN/SGN → see whole Area scope
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          for (const t of (g.teams||[])) {
            if ((t.staff||[]).some(m => m.staff_code === myCode)) {
              unitLabel = 'Khu vực: ' + a.name;
              (a.org_groups||[]).forEach(g2 => {
                (g2.teams||[]).forEach(t2 => { (t2.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)); });
              });
              break;
            }
          }
          if (unitLabel) break;
        }
        if (unitLabel) break;
      }
    } else {
      // TĐ → see their own Team
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          for (const t of (g.teams||[])) {
            if ((t.staff||[]).some(m => m.staff_code === myCode)) {
              unitLabel = 'Tổ: ' + t.name;
              (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code));
              break;
            }
          }
          if (unitLabel) break;
        }
        if (unitLabel) break;
      }
    }
    // Deduplicate
    unitStaffCodes = [...new Set(unitStaffCodes)];

    // ── SECTION 1: ĐƠN VỊ ──
    document.getElementById('dashUnitTitle').textContent = '🏢 ' + (unitLabel || 'Đơn vị');
    let unitFruits = 0, unitGroups = 0, unitHapja = 0, unitRoles = [];
    if (unitStaffCodes.length > 0) {
      const codeFilter = unitStaffCodes.map(c => `"${c}"`).join(',');
      const urRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=in.(${codeFilter})&select=*,fruit_groups(profile_id,telegram_group_title,level,profiles(full_name))`);
      unitRoles = await urRes.json();
      unitFruits = new Set(unitRoles.map(r => r.fruit_groups?.profile_id)).size;
      unitGroups = new Set(unitRoles.map(r => r.fruit_group_id)).size;
      const uhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter})&select=*&order=created_at.desc&limit=20`);
      unitHapja = (await uhRes.json()).length;
    }
    const unitStaffCount = unitStaffCodes.length;
    document.getElementById('dashUnitMetrics').innerHTML = `
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num">${unitStaffCount}</div><div class="lbl">TĐ</div></div>
        <div class="dash-stat"><div class="num">${unitFruits}</div><div class="lbl">Trái quả</div></div>
      </div>
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:var(--green);">${unitGroups}</div><div class="lbl">Group</div></div>
        <div class="dash-stat"><div class="num" style="color:var(--yellow);">${unitHapja}</div><div class="lbl">Hapja chờ</div></div>
      </div>`;

    // ── Sub-unit breakdown (for managers) ──
    const subEl = document.getElementById('dashSubUnits');
    let subHtml = '';
    function countForCodes(codes) {
      const fr = unitRoles.filter(r => codes.includes(r.staff_code));
      return {
        td: codes.length,
        fruits: new Set(fr.map(r => r.fruit_groups?.profile_id)).size,
        groups: new Set(fr.map(r => r.fruit_group_id)).size,
      };
    }
    if (['admin','yjyn','ggn_jondo','ggn_chakki','sgn_jondo'].includes(pos)) {
      // Show breakdown by Group → Team
      const myAreas = pos === 'admin' ? (structureData||[]) :
        (structureData||[]).filter(a => a.yjyn_staff_code === myCode || ['ggn_jondo','ggn_chakki','sgn_jondo'].includes(pos));
      myAreas.forEach(a => {
        (a.org_groups||[]).forEach(g => {
          const gCodes = [];
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => gCodes.push(m.staff_code)));
          const gS = countForCodes(gCodes);
          const gid = 'subgrp_' + g.id;
          subHtml += `<div style="margin-bottom:4px;">
            <div onclick="document.getElementById('${gid}').style.display=document.getElementById('${gid}').style.display==='none'?'block':'none'" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);">
              <div style="font-weight:700;font-size:13px;">👥 ${g.name}</div>
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text2);">
                <span>${gS.td} TĐ</span><span style="color:var(--accent);">${gS.fruits} 🍎</span><span style="color:var(--green);">${gS.groups} 💬</span>
              </div>
            </div>
            <div id="${gid}" style="display:none;padding-left:16px;">`;
          (g.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            const tS = countForCodes(tCodes);
            subHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-left:3px solid var(--accent);margin:4px 0;border-radius:0 var(--radius-sm) var(--radius-sm) 0;background:var(--surface);">
              <div style="font-size:12px;font-weight:600;">📌 ${t.name}</div>
              <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);">
                <span>${tS.td} TĐ</span><span style="color:var(--accent);">${tS.fruits} 🍎</span><span style="color:var(--green);">${tS.groups} 💬</span>
              </div>
            </div>`;
          });
          subHtml += '</div></div>';
        });
      });
    } else if (pos === 'tjn') {
      // Show breakdown by Team only
      for (const a of (structureData||[])) {
        const myGrp = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (myGrp) {
          (myGrp.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            const tS = countForCodes(tCodes);
            subHtml += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:4px;">
              <div style="font-size:13px;font-weight:700;">📌 ${t.name}</div>
              <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);">
                <span>${tS.td} TĐ</span><span style="color:var(--accent);">${tS.fruits} 🍎</span><span style="color:var(--green);">${tS.groups} 💬</span>
              </div>
            </div>`;
          });
          break;
        }
      }
    }
    subEl.innerHTML = subHtml ? `<div class="section-header" style="margin-top:8px;margin-bottom:6px;"><div class="section-title" style="font-size:13px;">📊 Đơn vị cấp dưới</div></div>${subHtml}` : '';

    // Unit fruit list
    const unitListEl = document.getElementById('dashUnitList');
    if (unitRoles.length === 0) {
      unitListEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px;">Chưa có trái quả trong đơn vị</div>';
    } else {
      const seen = new Set();
      unitListEl.innerHTML = unitRoles.filter(r => {
        const pid = r.fruit_groups?.profile_id;
        if (!pid || seen.has(pid)) return false;
        seen.add(pid); return true;
      }).slice(0, 8).map(r => {
        const name = r.fruit_groups?.profiles?.full_name || 'N/A';
        const lvl2 = r.fruit_groups?.level || 'tu_van';
        return `<div class="dash-list-item" style="cursor:pointer;" onclick="openProfileById('${r.fruit_groups?.profile_id}')"><div class="dash-dot ${lvl2==='bb'?'bb':'tv'}"></div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${lvl2==='bb'?'BB':'Tư vấn'}</div></div><div class="profile-arrow">\u203a</div></div>`;
      }).join('');
    }

    // ── HAPJA (all visible based on permission) ──
    const canApprove = ['admin','yjyn','ggn_jondo'].includes(pos);
    let hapjaQuery = '/rest/v1/check_hapja?status=eq.pending&select=*&order=created_at.desc&limit=20';
    if (!canApprove && myCode) hapjaQuery += `&created_by=eq.${myCode}`;
    const hRes = await sbFetch(hapjaQuery);
    const hapjas = await hRes.json();
    document.getElementById('dashHapjaTitle').textContent = canApprove ? '📋 Cần duyệt Hapja' : '📋 Hapja của tôi';
    const hList = document.getElementById('dashHapjaList');
    if (hapjas.length === 0) {
      hList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px;">Không có phiếu chờ duyệt</div>';
    } else {
      hList.innerHTML = hapjas.map(h => {
        const date = new Date(h.created_at).toLocaleDateString('vi-VN');
        return `<div class="dash-list-item" style="cursor:pointer;" onclick="openHapjaDetail('${h.id}')"><div class="dash-dot pending"></div><div class="profile-info"><div class="profile-name">${h.full_name}</div><div class="profile-meta">\ud83d\udcc6 ${date} \u00b7 NDD: ${h.data?.ndd_staff_code||h.created_by}</div></div><div class="profile-arrow">\u203a</div></div>`;
      }).join('');
    }

    // ── SECTION 2: CÁ NHÂN ──
    let myRoles = [], myFruits = 0, myGroups = 0, myHapja = 0;
    if (myCode) {
      const rRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=eq.${myCode}&select=*,fruit_groups(profile_id,telegram_group_title,level,profiles(full_name))`);
      myRoles = await rRes.json();
      myFruits = myRoles.length;
      myGroups = new Set(myRoles.map(r => r.fruit_group_id)).size;
      const mhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=eq.${myCode}&select=id`);
      myHapja = (await mhRes.json()).length;
    }
    document.getElementById('dashPersonalMetrics').innerHTML = `
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num">${myFruits}</div><div class="lbl">Trái tôi chăm</div></div>
        <div class="dash-stat"><div class="num">${myGroups}</div><div class="lbl">Group tham gia</div></div>
      </div>
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:var(--accent);">${myHapja}</div><div class="lbl">Hapja tôi tạo</div></div>
      </div>`;
    // Personal fruit list
    const listEl = document.getElementById('dashMyList');
    if (myRoles.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px;">Chưa được gắn vai trò nào</div>';
    } else {
      listEl.innerHTML = myRoles.map(r => {
        const name = r.fruit_groups?.profiles?.full_name || 'N/A';
        const role = {ndd:'NDD',tvv:'TVV',gvbb:'GVBB',la:'Lá'}[r.role_type] || r.role_type;
        const lvl2 = r.fruit_groups?.level || 'tu_van';
        return `<div class="dash-list-item" style="cursor:pointer;" onclick="openProfileById('${r.fruit_groups?.profile_id}')"><div class="dash-dot ${lvl2==='bb'?'bb':'tv'}"></div><div class="profile-info"><div class="profile-name">${name}</div><div class="profile-meta">${role} \u00b7 ${lvl2==='bb'?'BB':'Tư vấn'}</div></div><div class="profile-arrow">\u203a</div></div>`;
      }).join('');
    }
  } catch(e) { console.error('Dashboard error:', e); }
}

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
  el.innerHTML = profiles.map(p => `
    <div class="profile-card" onclick="openProfileById('${p.id}')">
      <div class="avatar">${(p.full_name||'?')[0]}</div>
      <div class="profile-info">
        <div class="profile-name">${p.full_name}</div>
        <div class="profile-meta"><span class="status-dot status-active"></span>${p.phone_number||'Chưa có SĐT'}</div>
      </div>
      <div class="profile-arrow">›</div>
    </div>
  `).join('');
}
function filterProfiles() { const q=document.getElementById('searchInput').value.toLowerCase(); renderProfiles(allProfiles.filter(p=>p.full_name.toLowerCase().includes(q)||(p.phone_number||'').includes(q))); }

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
  clearFormFields();
  loadCover(p);
  loadInfoSheet(p.id);
  loadRecords(p.id, 'tu_van', 'tvList', 'tvCount');
  loadRecords(p.id, 'bien_ban', 'bbList', 'bbCount');
  // Reset tabs
  document.querySelectorAll('.form-tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('.form-card').forEach((c,i)=>c.classList.toggle('active',i===0));
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
let currentRecordId = null;
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

// ============ NAVIGATION ============
function backToList() {
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'unit';
  ['tab-unit','tab-personal','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+activeTab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (activeTab==='unit'||activeTab==='personal')?'flex':'none';
  currentProfileId = null;
}
function switchFormTab(el, cardId) {
  document.querySelectorAll('.form-tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.querySelectorAll('.form-card').forEach(c=>c.classList.remove('active')); document.getElementById(cardId).classList.add('active');
}
function switchMainTab(el, tab) {
  document.querySelectorAll('#mainTabBar .tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  ['tab-unit','tab-personal','tab-staff','tab-structure'].forEach(t=>document.getElementById(t).style.display='none');
  document.getElementById('tab-'+tab).style.display = 'block';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fabBtn').style.display = (tab==='unit'||tab==='personal') ? 'flex' : 'none';
  if (tab==='unit') { loadDashboard(); loadProfiles(); }
  if (tab==='personal') loadDashboard();
  if (tab==='staff') loadStaff();
  if (tab==='structure') loadStructure();
}

// ============ CHECK HAPJA ============
function canCreateHapja(pos) { return ['admin','yjyn','tjn','gyjn','bgyjn','ggn_jondo','ggn_chakki'].includes(pos); }
function openCheckHapjaModal() {
  const pos = getCurrentPosition();
  if (!canCreateHapja(pos)) { showToast('\u26d4 Ch\u1ee9c v\u1ee5 kh\u00f4ng \u0111\u01b0\u1ee3c t\u1ea1o Hapja'); return; }
  document.getElementById('checkHapjaModal').classList.add('open');
  // Populate NDD select with staff codes
  const sel = document.getElementById('hj_ndd');
  if (sel && allStaff.length) {
    sel.innerHTML = '<option value="">Ch\u1ecdn NDD...</option>' + allStaff.map(s=>`<option value="${s.staff_code}">${s.full_name} (${s.staff_code})</option>`).join('');
  }
}
async function saveCheckHapja() {
  const fullName = document.getElementById('hj_hoten')?.value?.trim();
  if (!fullName) { showToast('\u26a0\ufe0f Nh\u1eadp h\u1ecd t\u00ean tr\u00e1i (m\u1ee5c 1)'); return; }
  const data = {
    full_name: fullName,
    data: {
      ndd_staff_code: getStaffCodeFromInput('hj_ndd') || '',
      ngay_chakki: document.getElementById('hj_ngay')?.value || '',
      concept: document.getElementById('hj_concept')?.value || '',
      hinh_thuc: getChipValues('chips_hj_hinh_thuc'),
      than_thiet: getChipValues('chips_hj_than_thiet'),
      noi_o: document.getElementById('hj_noi_o')?.value || '',
      nghe_nghiep: document.getElementById('hj_nghe')?.value || '',
      tinh_cach: document.getElementById('hj_tinh_cach')?.value || '',
      ket_noi: getChipValues('chips_hj_ket_noi'),
      tg_ranh: document.getElementById('hj_tg_ranh')?.value || '',
      than_tinh: getChipValues('chips_hj_than_tinh'),
      hoan_canh: document.getElementById('hj_hoan_canh')?.value || '',
      hoc_ki: document.getElementById('hj_hoc_ki')?.value || '',
      noi_lo: document.getElementById('hj_noi_lo')?.value || '',
      sdt: document.getElementById('hj_sdt')?.value || ''
    },
    status: 'pending',
    created_by: getEffectiveStaffCode() || 'unknown'
  };
  try {
    await sbFetch('/rest/v1/check_hapja', { method: 'POST', headers: {'Prefer':'return=representation'}, body: JSON.stringify(data) });
    closeModal('checkHapjaModal');
    showToast('\u2705 \u0110\u00e3 g\u1eedi Check Hapja!');
    ['hj_ngay','hj_concept','hj_hoten','hj_noi_o','hj_nghe','hj_tinh_cach','hj_tg_ranh','hj_hoan_canh','hj_hoc_ki','hj_noi_lo','hj_sdt'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
    document.getElementById('hj_ndd').selectedIndex = 0;
    ['chips_hj_hinh_thuc','chips_hj_than_thiet','chips_hj_ket_noi','chips_hj_than_tinh'].forEach(clearChips);
    loadDashboard();
  } catch(e) { showToast('\u274c L\u1ed7i khi g\u1eedi'); console.error(e); }
}
async function openHapjaDetail(id) {
  try {
    const hRes = await sbFetch(`/rest/v1/check_hapja?id=eq.${id}&select=*`);
    const hapjas = await hRes.json();
    if (!hapjas.length) { showToast('⚠️ Không tìm thấy phiếu'); return; }
    const h = hapjas[0];
    const d = h.data || {};
    const date = new Date(h.created_at).toLocaleDateString('vi-VN');
    const pos = getCurrentPosition();
    const canApprove = ['admin','yjyn','ggn_jondo'].includes(pos) && h.status === 'pending';
    const body = document.getElementById('hapjaDetailBody');
    const fields = [
      ['Họ tên', h.full_name],
      ['NDD', d.ndd_staff_code || h.created_by],
      ['Ngày Chakki', d.ngay_chakki],
      ['Concept', d.concept],
      ['Hình thức', Array.isArray(d.hinh_thuc) ? d.hinh_thuc.join(', ') : d.hinh_thuc],
      ['Mức thân thiết', Array.isArray(d.than_thiet) ? d.than_thiet.join(', ') : d.than_thiet],
      ['Nơi ở', d.noi_o],
      ['Nghề nghiệp', d.nghe_nghiep],
      ['Tính cách', d.tinh_cach],
      ['Kết nối', Array.isArray(d.ket_noi) ? d.ket_noi.join(', ') : d.ket_noi],
      ['Thời gian rảnh', d.tg_ranh],
      ['Thân tình', Array.isArray(d.than_tinh) ? d.than_tinh.join(', ') : d.than_tinh],
      ['Hoàn cảnh', d.hoan_canh],
      ['Học kì', d.hoc_ki],
      ['Nỗi lo', d.noi_lo],
      ['SĐT', d.sdt],
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
    if (canApprove) {
      actions.innerHTML = `
        <button onclick="approveHapja('${h.id}')" style="flex:1;padding:12px;border-radius:var(--radius-sm);border:none;background:var(--green);color:white;font-size:14px;font-weight:700;cursor:pointer;">✅ Duyệt</button>
        <button onclick="rejectHapja('${h.id}')" style="flex:1;padding:12px;border-radius:var(--radius-sm);border:none;background:var(--red);color:white;font-size:14px;font-weight:700;cursor:pointer;">❌ Từ chối</button>`;
    } else {
      actions.innerHTML = '';
    }
    document.getElementById('hapjaDetailModal').classList.add('open');
  } catch(e) { showToast('❌ Lỗi tải phiếu'); console.error(e); }
}
async function approveHapja(id) {
  try {
    const hRes = await sbFetch(`/rest/v1/check_hapja?id=eq.${id}&select=*`);
    const hapjas = await hRes.json();
    if (!hapjas.length || hapjas[0].status !== 'pending') { showToast('⚠️ Phiếu đã xử lý'); return; }
    const h = hapjas[0];
    const pRes = await sbFetch('/rest/v1/profiles', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ full_name: h.full_name, birth_year: h.birth_year, gender: h.gender, created_by: h.created_by }) });
    const newProfile = await pRes.json();
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: 'approved', approved_by: getEffectiveStaffCode(), approved_at: new Date().toISOString(), profile_id: newProfile?.[0]?.id }) });
    showToast('✅ Đã duyệt! Hồ sơ Trái quả đã được tạo.');
    closeModal('hapjaDetailModal');
    loadDashboard(); loadProfiles();
  } catch(e) { showToast('❌ Lỗi khi duyệt'); console.error(e); }
}
async function rejectHapja(id) {
  try {
    await sbFetch(`/rest/v1/check_hapja?id=eq.${id}`, { method:'PATCH', body: JSON.stringify({ status: 'rejected', approved_by: getEffectiveStaffCode(), approved_at: new Date().toISOString() }) });
    showToast('❌ Đã từ chối phiếu.');
    closeModal('hapjaDetailModal');
    loadDashboard();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
async function deleteProfile() {
  if (!currentProfileId || !confirm('Xác nhận xoá hồ sơ?')) return;
  try {
    await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}`, {method:'DELETE'});
    await sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${currentProfileId}`, {method:'DELETE'});
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {method:'DELETE'});
    showToast('✅ Đã xoá!'); backToList(); await loadProfiles();
  } catch { showToast('❌ Lỗi'); }
}
async function deleteRecord(id, type) {
  if (!confirm('Xoá phiếu này?')) return;
  try {
    await sbFetch(`/rest/v1/records?id=eq.${id}`, {method:'DELETE'});
    showToast('✅ Đã xoá!');
    if (type==='tu_van') loadRecords(currentProfileId,'tu_van','tvList','tvCount');
    else loadRecords(currentProfileId,'bien_ban','bbList','bbCount');
  } catch { showToast('❌ Lỗi'); }
}

// ============ ADD RECORD MODAL ============
function openAddRecordModal(type, existingContent = null) {
  currentRecordType = type;
  if (!existingContent) currentRecordId = null; // new record
  const isTV = type==='tu_van';
  document.getElementById('recordModalTitle').textContent = existingContent
    ? (isTV ? '✏️ Chỉnh sửa Báo cáo Tư vấn' : '✏️ Chỉnh sửa Báo cáo BB')
    : (isTV ? '💬 Báo cáo Tư vấn' : '📝 Báo cáo BB');
  const body = document.getElementById('recordModalBody');
  const c = existingContent || {};
  if (isTV) {
    body.innerHTML = `
      <div class="field-group"><label>Lần thứ</label><input type="text" id="rm_lan_thu" placeholder="1, 2, 3..." value="${c.lan_thu||''}"/></div>
      <div class="field-group"><label>Tên công cụ tư vấn</label><input type="text" id="rm_ten_cong_cu" placeholder="DISC, Enneagram, MBTI..." value="${c.ten_cong_cu||''}"/></div>
      <div class="field-group"><label>Kết quả test công cụ</label><textarea id="rm_ket_qua_test" placeholder="...">${c.ket_qua_test||''}</textarea></div>
      <div class="field-group"><label>Vấn đề / Nhu cầu / Thông tin khai thác được</label><textarea id="rm_van_de" style="min-height:100px;" placeholder="...">${c.van_de||''}</textarea></div>
      <div class="field-group"><label>Phản hồi / Cảm nhận của trái sau tư vấn</label><textarea id="rm_phan_hoi" placeholder="...">${c.phan_hoi||''}</textarea></div>
      <div class="field-group"><label>Điểm hái trái</label><textarea id="rm_diem_hai" placeholder="...">${c.diem_hai||''}</textarea></div>
      <div class="field-group"><label>Đề xuất của TVV</label><textarea id="rm_de_xuat" placeholder="...">${c.de_xuat||''}</textarea></div>`;
  } else {
    body.innerHTML = `
      <div class="field-group"><label>Buổi thứ</label><input type="text" id="rm_buoi_thu" placeholder="1, 2, 3..." value="${c.buoi_thu||''}"/></div>
      <div class="field-group"><label>Nội dung buổi học</label><textarea id="rm_noi_dung" style="min-height:100px;" placeholder="...">${c.noi_dung||''}</textarea></div>
      <div class="field-group"><label>Phản ứng của HS trong và sau buổi học</label><textarea id="rm_phan_ung" placeholder="...">${c.phan_ung||''}</textarea></div>
      <div class="field-group"><label>Khai thác mới về HS</label><textarea id="rm_khai_thac" placeholder="...">${c.khai_thac||''}</textarea></div>
      <div class="field-group"><label>Tương tác với HS đáng chú ý</label><textarea id="rm_tuong_tac" placeholder="...">${c.tuong_tac||''}</textarea></div>
      <div class="field-group"><label>Đề xuất hướng chăm sóc tiếp theo</label><textarea id="rm_de_xuat_cs" placeholder="...">${c.de_xuat_cs||''}</textarea></div>
      <div class="field-group"><label>Buổi gặp tiếp theo</label><input type="text" id="rm_buoi_tiep" placeholder="DD/MM/YYYY HH:mm" value="${c.buoi_tiep||''}"/></div>
      <div class="field-group"><label>Nội dung buổi tiếp theo</label><textarea id="rm_noi_dung_tiep" placeholder="...">${c.noi_dung_tiep||''}</textarea></div>`;
  }
  document.getElementById('addRecordModal').classList.add('open');
}
async function saveRecord() {
  const isTV = currentRecordType==='tu_van';
  let data = {};
  if (isTV) {
    data = {
      lan_thu:       document.getElementById('rm_lan_thu')?.value,
      ten_cong_cu:   document.getElementById('rm_ten_cong_cu')?.value,
      ket_qua_test:  document.getElementById('rm_ket_qua_test')?.value,
      van_de:        document.getElementById('rm_van_de')?.value,
      phan_hoi:      document.getElementById('rm_phan_hoi')?.value,
      diem_hai:      document.getElementById('rm_diem_hai')?.value,
      de_xuat:       document.getElementById('rm_de_xuat')?.value,
    };
  } else {
    data = {
      buoi_thu:      document.getElementById('rm_buoi_thu')?.value,
      noi_dung:      document.getElementById('rm_noi_dung')?.value,
      phan_ung:      document.getElementById('rm_phan_ung')?.value,
      khai_thac:     document.getElementById('rm_khai_thac')?.value,
      tuong_tac:     document.getElementById('rm_tuong_tac')?.value,
      de_xuat_cs:    document.getElementById('rm_de_xuat_cs')?.value,
      buoi_tiep:     document.getElementById('rm_buoi_tiep')?.value,
      noi_dung_tiep: document.getElementById('rm_noi_dung_tiep')?.value,
    };
  }
  try {
    if (currentRecordId) {
      // Edit existing
      await sbFetch(`/rest/v1/records?id=eq.${currentRecordId}`, { method:'PATCH', body: JSON.stringify({ content: data }) });
      showToast('✅ Đã cập nhật phiếu!');
    } else {
      // Create new
      await sbFetch('/rest/v1/records', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ profile_id: currentProfileId, record_type: currentRecordType, content: data }) });
      showToast('✅ Đã thêm!');
    }
    closeModal('addRecordModal');
    currentRecordId = null;
    if (isTV) loadRecords(currentProfileId,'tu_van','tvList','tvCount');
    else loadRecords(currentProfileId,'bien_ban','bbList','bbCount');
  } catch { showToast('❌ Lỗi'); }
}

// ============ STAFF ============
async function loadStaff() {
  try {
    const res = await sbFetch('/rest/v1/staff?select=*&order=created_at.desc');
    allStaff = await res.json();
    renderStaff(allStaff);
  } catch { document.getElementById('staffList').innerHTML = '<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-title">Lỗi tải</div></div>'; }
}
function renderStaff(list) {
  const el = document.getElementById('staffList');
  document.getElementById('staffCount').textContent = list.length + ' TĐ';
  if (!list.length) { el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">Chưa có TĐ</div></div>'; return; }
  el.innerHTML = list.map(s => `
    <div class="staff-card">
      <div class="staff-avatar">${(s.full_name||'?')[0]}</div>
      <div class="profile-info">
        <div class="profile-name">${s.full_name} <span style="color:var(--text3);font-size:12px;">(${s.staff_code})</span></div>
        <div class="profile-meta">
          <span class="staff-role-badge ${getBadgeClass(s.position)}">${getPositionName(s.position)}</span>
          ${s.telegram_id ? '🟢 Đã kết nối' : '⚪ Chưa kết nối'}
        </div>
      </div>
    </div>
  `).join('');
}
function filterStaff() { const q=document.getElementById('staffSearchInput').value.toLowerCase(); renderStaff(allStaff.filter(s=>s.full_name.toLowerCase().includes(q)||s.staff_code.toLowerCase().includes(q)||(s.position||'').includes(q))); }
function openAddStaffModal() { document.getElementById('addStaffModal').classList.add('open'); }
async function addStaff() {
  const name = document.getElementById('new_staff_name').value.trim();
  const code = document.getElementById('new_staff_code').value.trim();
  if (!name||!code) { showToast('⚠️ Nhập họ tên và mã TĐ'); return; }
  try {
    await sbFetch('/rest/v1/staff', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ full_name: name, staff_code: code, position: document.getElementById('new_staff_position').value, phone: document.getElementById('new_staff_phone').value.trim()||null, email: document.getElementById('new_staff_email').value.trim()||null }) });
    closeModal('addStaffModal'); showToast('✅ Đã đăng ký!');
    ['new_staff_name','new_staff_code','new_staff_phone','new_staff_email'].forEach(id=>document.getElementById(id).value='');
    await loadStaff();
  } catch { showToast('❌ Lỗi'); }
}

// ============ STRUCTURE ============
let structureData = [];
async function loadStructure() {
  try {
    const res = await sbFetch('/rest/v1/areas?select=*,org_groups(*,teams(*,staff:staff!staff_team_id_fkey(*)))&order=name');
    structureData = await res.json();
    const el = document.getElementById('structureTree');
    const pos = getCurrentPosition();
    const myCode = getEffectiveStaffCode();
    const isAdmin = pos === 'admin';
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
              html += `<div class="tree-node" style="margin-left:76px;padding:5px 10px;font-size:12px;border-left:2px dashed var(--border);"><span style="color:var(--text2);">👤 ${m.staff_code}</span>${posBadge}</div>`;
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
  } catch(e) { console.error(e); document.getElementById('structureTree').innerHTML = '<div class="empty-state">L\u1ed7i t\u1ea3i</div>'; }
}
function populateStaffSelect(selId, ph) {
  let s = document.getElementById(selId);
  if(!s) return;
  // Create global datalist once
  if (!document.getElementById('globalStaffDatalist')) {
    const dl = document.createElement('datalist');
    dl.id = 'globalStaffDatalist';
    document.body.appendChild(dl);
  }
  const dl = document.getElementById('globalStaffDatalist');
  dl.innerHTML = allStaff.map(x=>`<option value="${x.staff_code} - ${x.full_name}"></option>`).join('');

  if (s.tagName === 'SELECT') {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = s.id;
    inp.className = s.className;
    inp.style.cssText = s.style.cssText;
    inp.placeholder = ph || 'Nh\u1eadp T\u0110 k\u00ecm ki\u1ebfm...';
    inp.setAttribute('list', 'globalStaffDatalist');
    if(s.onchange) inp.onchange = s.onchange;
    s.parentNode.replaceChild(inp, s);
  } else {
    s.placeholder = ph || 'Nh\u1eadp mã h\u1eb7c t\u00ean T\u0110...';
  }
}
function getStaffCodeFromInput(id) {
  const el = document.getElementById(id);
  if (!el || !el.value) return null;
  return el.value.split(' - ')[0].trim() || null;
}
function setStaffInputValue(id, code) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!code) { el.value = ''; return; }
  const s = allStaff.find(x => x.staff_code === code);
  el.value = s ? `${s.staff_code} - ${s.full_name}` : code;
}
function openAddAreaModal() {
  document.getElementById('structureModalTitle').textContent = '\ud83c\udfe2 Th\u00eam Khu v\u1ef1c';
  document.getElementById('struct_name').value = '';
  document.getElementById('struct_type').value = 'area';
  document.getElementById('struct_parent_wrap').style.display = 'none';
  document.getElementById('struct_manager_wrap').style.display = 'block';
  document.getElementById('struct_manager_label').textContent = 'Ch\u1ec9 \u0111\u1ecbnh YJYN';
  populateStaffSelect('struct_manager','Ch\u1ecdn YJYN...');
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
  document.getElementById('struct_manager_wrap').style.display = 'block';
  document.getElementById('struct_manager_label').textContent = 'Ch\u1ec9 \u0111\u1ecbnh TJN';
  populateStaffSelect('struct_manager','Ch\u1ecdn TJN...');
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
  document.getElementById('struct_manager_wrap').style.display = 'block';
  document.getElementById('struct_manager_label').textContent = 'GYJN (T\u1ed5 tr\u01b0\u1edfng)';
  populateStaffSelect('struct_manager','Ch\u1ecdn GYJN...');
  document.getElementById('struct_manager2_wrap').style.display = 'block';
  populateStaffSelect('struct_manager2','Ch\u1ecdn BGYJN...');
  document.getElementById('structureModal').classList.add('open');
}
async function saveStructure() {
  const name = document.getElementById('struct_name').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Nh\u1eadp t\u00ean'); return; }
  const type = document.getElementById('struct_type').value;
  const parentId = document.getElementById('struct_parent').value;
  const mgr = getStaffCodeFromInput('struct_manager');
  const mgr2 = getStaffCodeFromInput('struct_manager2');

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
  if (type==='area') { endpoint='/rest/v1/areas'; body={name, yjyn_staff_code:mgr||null}; }
  else if (type==='group') { endpoint='/rest/v1/org_groups'; body={name, area_id:parentId, tjn_staff_code:mgr||null}; }
  else { endpoint='/rest/v1/teams'; body={name, group_id:parentId, gyjn_staff_code:mgr||null, bgyjn_staff_code:mgr2||null}; }
  
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
    document.getElementById('edit_mgr1_label').textContent = 'GYJN (T\u1ed5 tr\u01b0\u1edfng)';
    populateStaffSelect('edit_mgr1', 'Ch\u1ecdn GYJN...');
    setStaffInputValue('edit_mgr1', item.gyjn_staff_code);
    document.getElementById('edit_mgr2_wrap').style.display = 'block';
    document.getElementById('edit_mgr2_label').textContent = 'BGYJN (T\u1ed5 ph\u00f3)';
    populateStaffSelect('edit_mgr2', 'Ch\u1ecdn BGYJN...');
    setStaffInputValue('edit_mgr2', item.bgyjn_staff_code);
  }
  document.getElementById('edit_mgr1_wrap').style.display = 'block';
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
  const canAssignPos = ['admin','yjyn'].includes(pos);
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
    listEl.innerHTML = members.map(m => {
      let effectivePos = m.position || 'td';
      if (parentArea && m.staff_code === parentArea.yjyn_staff_code) effectivePos = 'yjyn';
      if (parentGroup && m.staff_code === parentGroup.tjn_staff_code) effectivePos = 'tjn';
      if (m.staff_code === teamItem.gyjn_staff_code) effectivePos = 'gyjn';
      if (m.staff_code === teamItem.bgyjn_staff_code) effectivePos = 'bgyjn';
      const posBadge = `<span class="staff-role-badge ${getBadgeClass(effectivePos)}" style="font-size:9px;padding:1px 6px;">${getPositionName(effectivePos)}</span>`;
      const assignHtml = canAssignPos ? `
        <select onchange="assignMemberPos('${m.staff_code}',this.value)" style="padding:2px 6px;font-size:11px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);cursor:pointer;">
          <option value="td" ${effectivePos==='td'?'selected':''}>T\u0110</option>
          <option value="ggn_jondo" ${effectivePos==='ggn_jondo'?'selected':''}>GGN Jondo</option>
          <option value="ggn_chakki" ${effectivePos==='ggn_chakki'?'selected':''}>GGN Chakki</option>
          <option value="sgn_jondo" ${effectivePos==='sgn_jondo'?'selected':''}>SGN Jondo</option>
          <option value="bgyjn" ${effectivePos==='bgyjn'?'selected':''}>BGYJN</option>
          <option value="gyjn" ${effectivePos==='gyjn'?'selected':''}>GYJN</option>
        </select>` : '';
      return `
      <div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);">
        <div style="flex:1;min-width:0;">
          <div style="font-size:13px;font-weight:600;">${m.staff_code} ${posBadge}</div>
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
  document.getElementById(dListId).innerHTML = allStaff.filter(s => !memberCodes.includes(s.staff_code)).map(s => `<option value="${s.staff_code} - ${s.full_name}"></option>`).join('');
  if (addSel.tagName === 'SELECT') {
    const inp = document.createElement('input'); inp.type='text'; inp.id=addSel.id; inp.className=addSel.className; inp.style.cssText=addSel.style.cssText; inp.placeholder='Ch\u1ecdn T\u0110 k\u00ecm ki\u1ebfm...'; inp.setAttribute('list', dListId);
    addSel.parentNode.replaceChild(inp, addSel);
  } else { addSel.value = ''; }
}
async function updateStructure() {
  const id = document.getElementById('edit_struct_id').value;
  const type = document.getElementById('edit_struct_type').value;
  const name = document.getElementById('edit_struct_name').value.trim();
  if (!name) { showToast('\u26a0\ufe0f Nh\u1eadp t\u00ean'); return; }
  const mgr = getStaffCodeFromInput('edit_mgr1');
  const mgr2 = getStaffCodeFromInput('edit_mgr2');
  const tables = {area:'areas', group:'org_groups', team:'teams'};
  let body = { name };
  if (type==='area') body.yjyn_staff_code = mgr||null;
  else if (type==='group') body.tjn_staff_code = mgr||null;
  else { body.gyjn_staff_code = mgr||null; body.bgyjn_staff_code = mgr2||null; }
  try {
    await sbFetch(`/rest/v1/${tables[type]}?id=eq.${id}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify(body) });
    // Auto-add GYJN/BGYJN as team members
    if (type==='team') {
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
  if (!confirm(`X\u00f3a ${labels[type]} "${name}"?\nT\u1ea5t c\u1ea3 d\u1eef li\u1ec7u b\u00ean trong s\u1ebd b\u1ecb x\u00f3a!`)) return;
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
    await sbFetch(`/rest/v1/staff?staff_code=eq.${code}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify({team_id:teamId}) });
    showToast('\u2705 \u0110\u00e3 th\u00eam');
    // Reload data and refresh member list
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}
async function removeMemberFromTeam(staffCode) {
  if (!confirm('G\u1ee1 th\u00e0nh vi\u00ean n\u00e0y kh\u1ecfi t\u1ed5?')) return;
  const teamId = document.getElementById('edit_struct_id').value;
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${staffCode}`, { method:'PATCH', headers:{'Prefer':'return=representation'}, body:JSON.stringify({team_id:null}) });
    showToast('\u2705 \u0110\u00e3 g\u1ee1');
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}
async function assignMemberPos(staffCode, newPos) {
  try {
    await sbFetch(`/rest/v1/staff?staff_code=eq.${staffCode}`, { method:'PATCH', body: JSON.stringify({ position: newPos }) });
    showToast(`\u2705 \u0110\u00e3 ch\u1ec9 \u0111\u1ecbnh ${getPositionName(newPos)} cho ${staffCode}`);
    const teamId = document.getElementById('edit_struct_id').value;
    await loadStructure();
    const item = findStructItem('team', teamId);
    if (item) renderTeamMembers(item);
    await loadStaff();
  } catch(e) { showToast('\u274c L\u1ed7i'); console.error(e); }
}

// ============ MODAL CLOSE ON OVERLAY CLICK ============
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('open');
  });
});

// ============ VIEW AS (Admin testing) ============
let viewAsPosition = null;
let viewAsRole = null;
let viewAsStaffCode = null;
function getCurrentPosition() { return viewAsPosition || myStaff?.position || 'td'; }
function getCurrentRole() { return viewAsRole; }
function getEffectiveStaffCode() { return viewAsStaffCode || myStaff?.staff_code; }
function getPosLevel(p) { return {td:0,bgyjn:1,gyjn:2,tjn:3,ggn_chakki:3,sgn_jondo:3,ggn_jondo:3,yjyn:4,admin:5}[p]||0; }

function populateViewAsDropdown() {
  const sel = document.getElementById('viewAsPos');
  if (!sel) return;
  let html = '<option value="">Ch\u1ee9c v\u1ee5: Ch\u00ednh m\u00ecnh</option>';
  html += '<option value="td">T\u0110 (chung)</option>';
  html += '<option value="sgn_jondo">SGN Jondo</option>';
  html += '<option value="ggn_chakki">GGN Chakki</option>';
  html += '<option value="ggn_jondo">GGN Jondo</option>';
  // From structure data
  (structureData||[]).forEach(a => {
    if (a.yjyn_staff_code) html += `<option value="yjyn|${a.yjyn_staff_code}">YJYN \u00b7 ${a.name}</option>`;
    (a.org_groups||[]).forEach(g => {
      if (g.tjn_staff_code) html += `<option value="tjn|${g.tjn_staff_code}">TJN \u00b7 ${a.name} > ${g.name}</option>`;
      (g.teams||[]).forEach(t => {
        if (t.gyjn_staff_code) html += `<option value="gyjn|${t.gyjn_staff_code}">GYJN \u00b7 ${a.name} > ${g.name} > ${t.name}</option>`;
        if (t.bgyjn_staff_code) html += `<option value="bgyjn|${t.bgyjn_staff_code}">BGYJN \u00b7 ${a.name} > ${g.name} > ${t.name}</option>`;
      });
    });
  });
  sel.innerHTML = html;
}

function applyViewAs() {
  const raw = document.getElementById('viewAsPos').value;
  const selRole = document.getElementById('viewAsRole').value;
  if (raw && raw.includes('|')) {
    const [p, code] = raw.split('|');
    viewAsPosition = p;
    viewAsStaffCode = code;
  } else {
    viewAsPosition = raw || null;
    viewAsStaffCode = null;
  }
  viewAsRole = selRole || null;
  const pos = getCurrentPosition();
  const posLabel = getPositionName(pos);
  const roleLabel = selRole ? {ndd:'NDD',tvv:'TVV',gvbb:'GVBB',la:'L\u00e1'}[selRole] : '';
  const badge = document.getElementById('staffBadge');
  if (raw || selRole) {
    let txt = '\uD83D\uDC41 ' + posLabel;
    if (viewAsStaffCode) {
      const s = allStaff.find(x => x.staff_code === viewAsStaffCode);
      if (s) txt += ' (' + s.full_name + ')';
    }
    if (roleLabel) txt += ' + ' + roleLabel;
    badge.textContent = txt;
  } else {
    badge.textContent = `${myStaff?.staff_code||'---'} \u00b7 ${getPositionName(myStaff?.position)}`;
  }
  applyPermissions();
  if (raw || selRole) {
    let msg = '\uD83D\uDC41 ';
    if (raw) msg += posLabel;
    if (selRole) msg += (raw ? ' + ' : '') + roleLabel;
    showToast(msg);
  }
}
function resetViewAs() {
  document.getElementById('viewAsPos').value = '';
  document.getElementById('viewAsRole').value = '';
  applyViewAs();
  showToast('\u2705 Reset v\u1ec1 Admin');
}
function applyPermissions() {
  const pos = getCurrentPosition();
  const lvl = getPosLevel(pos);
  const role = getCurrentRole();
  // Tab Cơ cấu: visible for all
  const structTab = document.querySelector('[data-tab="structure"]');
  if (structTab) structTab.style.display = '';
  // "+ Khu vực" button: Admin only
  const btnAddArea = document.getElementById('btnAddArea');
  if (btnAddArea) btnAddArea.style.display = pos==='admin' ? '' : 'none';
  // FAB: only for those who can create Hapja
  const fabBtn = document.getElementById('fabBtn');
  const activeTab = document.querySelector('#mainTabBar .tab.active')?.dataset.tab || 'dashboard';
  if (fabBtn) fabBtn.style.display = (canCreateHapja(pos) && (activeTab==='dashboard'||activeTab==='profiles')) ? 'flex' : 'none';
  // Reload structure tree to update inline add buttons
  if (document.getElementById('tab-structure').style.display !== 'none') loadStructure();
}

// ============ THEME TOGGLE ============
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  document.getElementById('themeToggle').textContent = isLight ? '\uD83C\uDF19' : '\u2600\uFE0F';
  localStorage.setItem('cj_theme', isLight ? 'dark' : 'light');
}
// Restore saved theme
(function() {
  const saved = localStorage.getItem('cj_theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = '\u2600\uFE0F';
  }
})();