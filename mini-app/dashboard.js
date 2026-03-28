// Phase display constants (shared across dashboard)
const PHASE_LABELS = {new:'🟡 Chakki',chakki:'🟡 Chakki',tu_van:'💬 TV',bb:'🎓 BB',center:'🏛️ Center',completed:'✅'};
const PHASE_COLORS = {new:'#f59e0b',chakki:'#f59e0b',tu_van:'var(--accent)',bb:'var(--green)',center:'#8b5cf6',completed:'var(--green)'};

// ============ DASHBOARD ============
async function loadDashboard() {
  try {
    const pos = getCurrentPosition();
    const scope = getScope();
    const myCode = getEffectiveStaffCode();

    // ── Determine unit scope: collect staff codes in my managed unit ──
    let unitLabel = '';
    let unitStaffCodes = []; // all staff_code in my unit
    if (scope === 'system') {
      unitLabel = 'Toàn hệ thống';
      unitStaffCodes = allStaff.map(s => s.staff_code);
    } else if (scope === 'area') {
      // Manager of Area (YJYN) or specialist with area scope
      const myArea = (structureData||[]).find(a => a.yjyn_staff_code === myCode);
      if (myArea) {
        unitLabel = 'Khu vực: ' + myArea.name;
        (myArea.org_groups||[]).forEach(g => {
          (g.teams||[]).forEach(t => { (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)); });
        });
      } else {
        // Specialist with area scope — find area containing my team
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
      }
    } else if (scope === 'group') {
      // Manage a Group
      for (const a of (structureData||[])) {
        const myGrp = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (myGrp) {
          unitLabel = 'Nhóm: ' + myGrp.name;
          unitStaffCodes.push(myGrp.tjn_staff_code); // Add TJN
          (myGrp.teams||[]).forEach(t => { 
            if (t.gyjn_staff_code) unitStaffCodes.push(t.gyjn_staff_code);
            if (t.bgyjn_staff_code) unitStaffCodes.push(t.bgyjn_staff_code);
            (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)); 
          });
          break;
        }
      }
    } else if (scope === 'team') {
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          const myTeam = (g.teams||[]).find(t => t.gyjn_staff_code === myCode || t.bgyjn_staff_code === myCode || (t.staff||[]).some(m => m.staff_code === myCode));
          if (myTeam) {
            unitLabel = 'Tổ: ' + myTeam.name;
            (myTeam.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code));
            break;
          }
        }
        if (unitLabel) break;
      }
    }
    // Deduplicate
    unitStaffCodes = [...new Set(unitStaffCodes)];

    // ── SECTION 1: ĐƠN VỊ ──
    const semName = currentSemesterId ? (allSemesters.find(s => s.id === currentSemesterId)?.name || '') : '';
    const semLabel = semName ? ` · ${semName}` : '';
    document.getElementById('dashUnitTitle').textContent = '🏢 ' + (unitLabel || 'Đơn vị') + semLabel;
    let unitFruits = 0, unitGroups = 0, unitHapja = 0, unitRoles = [];
    let approvedHapjaList = [], tvvFruits = [], gvbbFruits = [], bbGroups = [], centerFruits = [];
    let waitTVFruits = [], phaseTVFruits = [], phaseBBFruits = [], phaseBBGroups = [];
    // Semester filter helper (appends &semester_id=eq.xxx when a semester is selected)
    const semF = currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';
    // Set of profile IDs in current semester (for in-memory filtering of roles)
    const semProfileIds = currentSemesterId
      ? new Set(allProfiles.filter(p => p.semester_id === currentSemesterId).map(p => p.id))
      : null; // null means "show all"
    const inSem = (pid) => semProfileIds === null || semProfileIds.has(pid);

    if (unitStaffCodes.length > 0) {
      const codeFilter = unitStaffCodes.map(c => `"${c}"`).join(',');
      const urRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=in.(${codeFilter})&select=*,fruit_groups(profile_id,telegram_group_id,telegram_group_title,level,profiles(full_name,phase,ndd_staff_code,fruit_status,is_kt_opened),fruit_roles(staff_code,role_type))`);
      const allUnitRoles = await urRes.json();
      // Apply semester filter to unit roles
      unitRoles = allUnitRoles.filter(r => inSem(r.fruit_groups?.profile_id));
      unitFruits = new Set(unitRoles.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size;
      // Approved Hapja by unit members (filtered by semester)
      const ahRes = await sbFetch(`/rest/v1/check_hapja?status=eq.approved&created_by=in.(${codeFilter})&select=*&order=created_at.desc${semF}`);
      approvedHapjaList = await ahRes.json();
      // Get all UNIQUE profiles that belong to the unit
      const unitProfilesMap = new Map();
      unitRoles.forEach(r => {
        const p = r.fruit_groups?.profiles;
        const pid = r.fruit_groups?.profile_id;
        if (p && pid && p.fruit_status !== 'dropout') {
          if (!unitProfilesMap.has(pid)) {
            unitProfilesMap.set(pid, { profile: p, role: r });
          } else {
            const existing = unitProfilesMap.get(pid).role;
            if (r.role_type === 'ndd' && existing.role_type !== 'ndd') {
              unitProfilesMap.set(pid, { profile: p, role: r });
            }
          }
        }
      });
      const myUnitProfiles = Array.from(unitProfilesMap.values());
      
      // ═══ TÍCH LUỸ (cumulative — ever reached that phase) ═══
      // Trái TV: phase in tu_van, bb, center, completed
      tvvFruits = myUnitProfiles.filter(x => ['tu_van','bb','center','completed'].includes(x.profile.phase)).map(x => x.role);
      // Trái BB: phase in bb, center, completed
      gvbbFruits = myUnitProfiles.filter(x => ['bb','center','completed'].includes(x.profile.phase)).map(x => x.role);
      // Trái Center: phase in center, completed
      centerFruits = myUnitProfiles.filter(x => ['center','completed'].includes(x.profile.phase)).map(x => x.role);

      // ═══ THEO GIAI ĐOẠN (current phase only) ═══
      // Chờ TV: phase is chakki or new (approved hapja but not yet TV)
      waitTVFruits = myUnitProfiles.filter(x => ['new','chakki'].includes(x.profile.phase)).map(x => x.role);
      // Trái TV (current): phase = tu_van
      phaseTVFruits = myUnitProfiles.filter(x => x.profile.phase === 'tu_van').map(x => x.role);
      // Trái BB (current): phase = bb
      phaseBBFruits = myUnitProfiles.filter(x => x.profile.phase === 'bb').map(x => x.role);

      // BB groups (real telegram group) — for cumulative
      const bbSeen = new Set();
      unitRoles.forEach(r => {
        const fg = r.fruit_groups || {};
        const isRealGroup = fg.telegram_group_id && fg.telegram_group_id > -1000000000000;
        if (unitStaffCodes.includes(r.staff_code) && isRealGroup && fg.level === 'bb' && !bbSeen.has(r.fruit_group_id)) {
          bbSeen.add(r.fruit_group_id);
          bbGroups.push(r);
        }
      });
      // BB groups — for current phase (only bb phase profiles)
      const bbSeenPhase = new Set();
      unitRoles.forEach(r => {
        const fg = r.fruit_groups || {};
        const p = fg.profiles;
        const isRealGroup = fg.telegram_group_id && fg.telegram_group_id > -1000000000000;
        if (unitStaffCodes.includes(r.staff_code) && isRealGroup && fg.level === 'bb' && p && p.phase === 'bb' && !bbSeenPhase.has(r.fruit_group_id)) {
          bbSeenPhase.add(r.fruit_group_id);
          phaseBBGroups.push(r);
        }
      });
      // Pending hapja for section below
      const uhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter})&select=*&order=created_at.desc&limit=20${semF}`);
      unitHapja = (await uhRes.json()).length;
    }
    // Store for popup use
    window._unitApprovedHapja = approvedHapjaList;
    window._unitTvvFruits = tvvFruits;
    window._unitGvbbFruits = gvbbFruits;
    window._unitBbGroups = bbGroups;
    window._unitCenterFruits = centerFruits;
    window._unitWaitTV = waitTVFruits;
    window._unitPhaseTVFruits = phaseTVFruits;
    window._unitPhaseBBFruits = phaseBBFruits;
    window._unitPhaseBBGroups = phaseBBGroups;

    // Info descriptions for each metric
    const infoDescs = {
      hapja_cum: 'Tổng số Trái đã được duyệt Hapja (tích luỹ)',
      tv_cum: 'Số Trái đã và đang đạt giai đoạn Tư Vấn (TV) trở lên',
      bb_cum: 'Số Trái đã và đang đạt giai đoạn Biến Bản (BB) trở lên',
      bbg_cum: 'Số Trái đã và đang được gắn Group BB',
      center_cum: 'Số Trái đã vào giai đoạn Chốt Center trở lên',
      wait_tv: 'Trái đã duyệt Hapja nhưng chưa Chốt TV',
      tv_phase: 'Trái đang ở giai đoạn Tư Vấn hiện tại',
      bb_phase: 'Trái đang ở giai đoạn Biến Bản hiện tại',
      bbg_phase: 'Trái đang ở giai đoạn BB và có Group BB',
      center_phase: 'Trái đã vào giai đoạn Center'
    };
    function infoBtn(key) {
      return `<span class="info-badge" onclick="event.stopPropagation();alert('${infoDescs[key]}')" title="${infoDescs[key]}">i</span>`;
    }
    function infoBtnLeft(key) {
      return `<span class="info-badge info-badge-left" onclick="event.stopPropagation();alert('${infoDescs[key]}')" title="${infoDescs[key]}">i</span>`;
    }

    // Save mode state
    if (!window._dashMode) window._dashMode = 'cumulative';
    const mode = window._dashMode;

    function renderDashMetrics(m) {
      const isCum = m === 'cumulative';
      const metricsEl = document.getElementById('dashUnitMetrics');
      metricsEl.innerHTML = `
        <div class="dash-mode-toggle">
          <button class="dash-mode-btn ${isCum ? 'active' : ''}" onclick="window._dashMode='cumulative';renderDashMetrics('cumulative')">📊 Tích luỹ</button>
          <button class="dash-mode-btn ${!isCum ? 'active' : ''}" onclick="window._dashMode='phase';renderDashMetrics('phase')">📋 Theo giai đoạn</button>
        </div>
        <div class="dash-grid-5">
          <div class="dash-center-circle" onclick="showUnitPopup('center')">
            <div class="num">${centerFruits.length}</div>
            <div class="lbl">🏛️ Center</div>
          </div>
          <div class="dash-stat accent" style="cursor:pointer;" onclick="showUnitPopup(${isCum ? "'hapja'" : "'wait_tv'"})">
            ${infoBtnLeft(isCum ? 'hapja_cum' : 'wait_tv')}
            <div class="num">${isCum ? approvedHapjaList.length : waitTVFruits.length}</div>
            <div class="lbl">${isCum ? '🍎 Trái Hapja' : '⏳ Chờ TV'}</div>
          </div>
          <div class="dash-stat yellow" style="cursor:pointer;" onclick="showUnitPopup(${isCum ? "'tvv'" : "'tvv_phase'"})">
            ${infoBtn(isCum ? 'tv_cum' : 'tv_phase')}
            <div class="num">${isCum ? tvvFruits.length : phaseTVFruits.length}</div>
            <div class="lbl">💬 Trái TV</div>
          </div>
          <div class="dash-stat green" style="cursor:pointer;" onclick="showUnitPopup(${isCum ? "'gvbb'" : "'gvbb_phase'"})">
            ${infoBtnLeft(isCum ? 'bb_cum' : 'bb_phase')}
            <div class="num">${isCum ? gvbbFruits.length : phaseBBFruits.length}</div>
            <div class="lbl">🎓 Trái BB</div>
          </div>
          <div class="dash-stat pink" style="cursor:pointer;" onclick="showUnitPopup(${isCum ? "'bbgroup'" : "'bbgroup_phase'"})">
            ${infoBtn(isCum ? 'bbg_cum' : 'bbg_phase')}
            <div class="num">${isCum ? bbGroups.length : phaseBBGroups.length}</div>
            <div class="lbl">👥 Group BB</div>
          </div>
        </div>`;
    }
    window.renderDashMetrics = renderDashMetrics;
    renderDashMetrics(mode);

    // Pre-fetch latest records AND sessions per profile — both needed for latestActivityLabel()
    const allPids = [...new Set(unitRoles.map(r => r.fruit_groups?.profile_id).filter(Boolean))];
    const recordMap = {}, sessionMap = {};
    if (allPids.length > 0) {
      const idsStr = allPids.map(id=>`"${id}"`).join(',');
      try {
        const [rRes, sRes] = await Promise.all([
          sbFetch(`/rest/v1/records?profile_id=in.(${idsStr})&record_type=not.in.(mo_kt,note,ai_mindmap,ai_chat)&select=profile_id,record_type,content,created_at&order=created_at.desc`),
          sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${idsStr})&select=profile_id,session_number,tool,created_at&order=created_at.desc`)
        ]);
        const recs = await rRes.json(); recs.forEach(r => { if (!recordMap[r.profile_id]) recordMap[r.profile_id] = r; });
        const ss   = await sRes.json(); ss.forEach(s =>   { if (!sessionMap[s.profile_id]) sessionMap[s.profile_id] = s; });
      } catch(e) {}
    }
    // Helper: render fruit cards for a list of staff_codes
    function fruitCardsForCodes(codes) {
      const seen = new Set();
      const matching = unitRoles.filter(r => {
        const pid = r.fruit_groups?.profile_id;
        const p = r.fruit_groups?.profiles;
        if (!pid || !codes.includes(r.staff_code) || seen.has(pid)) return false;
        if (p?.fruit_status === 'dropout') return false; // Filter out drop-outs from tracking
        seen.add(pid); return true;
      });
      if (!matching.length) return '';
      return matching.map(r => {
        const p = r.fruit_groups?.profiles;
        const pid = r.fruit_groups?.profile_id;
        const name = p?.full_name || 'N/A';
        const ph = p?.phase || 'chakki';
        const allR = r.fruit_groups?.fruit_roles || [];
        const ndd = allR.find(x=>x.role_type==='ndd')?.staff_code || p?.ndd_staff_code || '—';
        const tvv = allR.filter(x=>x.role_type==='tvv').map(x=>x.staff_code).join(', ') || '—';
        const gvbb = allR.find(x=>x.role_type==='gvbb')?.staff_code || '—';
        const latest = latestActivityLabel(recordMap[pid], sessionMap[pid]);
        const fStatus = p?.fruit_status || 'alive';
        const sDot = fStatus === 'dropout' ? '🔴' : '🟢';
        
        const isKT = p?.is_kt_opened;
        const showKT = ['bb', 'center', 'completed'].includes(ph);
        const ktLabel = showKT ? `<span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;margin-left:4px;">${isKT ? '📖 Đã mở KT' : '📕 Chưa mở KT'}</span>` : '';
        
        const fullP = allProfiles.find(x => x.id === pid) || p;
        return renderProfileCard(fullP, {
          profileId: pid,
          ndd: ndd !== '—' ? ndd : '',
          tvv: tvv !== '—' ? tvv : '',
          gvbb: gvbb !== '—' ? gvbb : '',
          latestActivity: latest
        });
      }).join('');
    }

    // ── Sub-unit breakdown (for managers) ──
    const subEl = document.getElementById('dashSubUnits');
    let subHtml = '';
    function countForCodes(codes) {
      const fr = unitRoles.filter(r => codes.includes(r.staff_code));
      // Only count Alive fruits (exclude dropout)
      const alivePids = new Set(
        fr.filter(r => r.fruit_groups?.profiles?.fruit_status !== 'dropout')
          .map(r => r.fruit_groups?.profile_id).filter(Boolean)
      );
      return {
        td: codes.length,
        fruits: alivePids.size,
        groups: new Set(fr.map(r => r.fruit_group_id)).size,
      };
    }
    if (['system','area'].includes(scope)) {
      const myAreas = scope === 'system' ? (structureData||[]) :
        (structureData||[]).filter(a => a.yjyn_staff_code === myCode || scope === 'area');
      myAreas.forEach(a => {
        const sortedGroups = (a.org_groups||[]).slice().sort((a,b) => (a.name||'').localeCompare(b.name||'','vi',{numeric:true}));
        sortedGroups.forEach(g => {
          const gCodes = [];
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => gCodes.push(m.staff_code)));
          const gS = countForCodes(gCodes);
          const gid = 'subgrp_' + g.id;
          subHtml += `<div style="margin-bottom:6px;">
            <div class="subunit-group-hd" onclick="document.getElementById('${gid}').style.display=document.getElementById('${gid}').style.display==='none'?'block':'none'">
              <div style="font-weight:700;font-size:13px;">👥 ${g.name}</div>
              <div style="display:flex;gap:12px;font-size:11px;color:var(--text2);">
                <span>${gS.td} TĐ</span><span style="color:var(--accent);font-weight:700;">${gS.fruits} 🍎</span>
              </div>
            </div>
            <div id="${gid}" style="display:none;padding-left:12px;">`;
          const sortedTeams = (g.teams||[]).slice().sort((a,b) => (a.name||'').localeCompare(b.name||'','vi',{numeric:true}));
          sortedTeams.forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            const tS = countForCodes(tCodes);
            const tid = 'subteam_' + t.id;
            subHtml += `<div style="margin:4px 0;">
              <div class="subunit-team-hd" onclick="document.getElementById('${tid}').style.display=document.getElementById('${tid}').style.display==='none'?'block':'none'">
                <div style="font-size:12px;font-weight:600;">📌 ${t.name}</div>
                <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);">
                  <span>${tS.td} TĐ</span><span style="color:var(--green);font-weight:700;">${tS.fruits} 🍎</span>
                </div>
              </div>
              <div id="${tid}" style="display:none;padding-left:12px;">${fruitCardsForCodes(tCodes)}</div>
            </div>`;
          });
          subHtml += '</div></div>';
        });
      });
    } else if (scope === 'group') {
      for (const a of (structureData||[])) {
        const myGrp = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (myGrp) {
          const sortedTeams2 = (myGrp.teams||[]).slice().sort((a,b) => (a.name||'').localeCompare(b.name||'','vi',{numeric:true}));
          sortedTeams2.forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            const tS = countForCodes(tCodes);
            const tid = 'subteam_' + t.id;
            subHtml += `<div style="margin-bottom:4px;">
              <div onclick="document.getElementById('${tid}').style.display=document.getElementById('${tid}').style.display==='none'?'block':'none'" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);">
                <div style="font-size:13px;font-weight:700;">📌 ${t.name}</div>
                <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);">
                  <span>${tS.td} TĐ</span><span style="color:var(--accent);">${tS.fruits} 🍎</span>
                </div>
              </div>
              <div id="${tid}" style="display:none;padding-left:12px;">${fruitCardsForCodes(tCodes)}</div>
            </div>`;
          });
          break;
        }
      }
    }
    subEl.innerHTML = subHtml ? `<div class="section-header" style="margin-top:8px;margin-bottom:6px;"><div class="section-title" style="font-size:13px;">📊 Đơn vị cấp dưới</div></div>${subHtml}` : '';

    // Remove old separate unit fruit list
    const unitListEl = document.getElementById('dashUnitList');
    unitListEl.innerHTML = '';

    // ── HAPJA (filter by unit scope + semester) ──
    const canApprove = hasPermission('approve_hapja');
    let hapjaQuery = `/rest/v1/check_hapja?status=eq.pending&select=*&order=created_at.desc&limit=20${semF}`;
    if (canApprove && unitStaffCodes.length > 0 && scope !== 'system') {
      const codeFilter2 = unitStaffCodes.map(c => `"${c}"`).join(',');
      hapjaQuery = `/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter2})&select=*&order=created_at.desc&limit=20${semF}`;
    } else if (!canApprove && myCode) {
      hapjaQuery += `&created_by=eq.${myCode}`;
    }
    const hRes = await sbFetch(hapjaQuery);
    const hapjas = await hRes.json();
    document.getElementById('dashHapjaTitle').textContent = '📋 Check Hapja đang chờ';
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
    let myRoles = [], myHapja = 0;
    if (myCode) {
      // Fetch all roles I have, with full profile data + all roles of those profiles (for TVV/GVBB display)
      const rRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=eq.${myCode}&select=*,fruit_groups(id,profile_id,telegram_group_title,level,profiles(id,full_name,phone_number,phase,is_kt_opened,fruit_status,birth_year,dropout_reason,gender,avatar_color),fruit_roles(staff_code,role_type))`);
      const allMyRoles = await rRes.json();
      // Apply semester filter to personal roles
      myRoles = allMyRoles.filter(r => inSem(r.fruit_groups?.profile_id));
      const mhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=eq.${myCode}&select=id${semF}`);
      myHapja = (await mhRes.json()).length;
    }
    const nddRoles = myRoles.filter(r => r.role_type === 'ndd');
    const tvvRoles = myRoles.filter(r => r.role_type === 'tvv');
    const gvbbRoles = myRoles.filter(r => r.role_type === 'gvbb');
    // Count unique profiles per role
    const countUniq = arr => new Set(arr.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size;
    document.getElementById('dashPersonalMetrics').innerHTML = `
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:var(--accent);">${countUniq(nddRoles)}</div><div class="lbl">Trái NDD</div></div>
        <div class="dash-stat"><div class="num" style="color:var(--green);">${countUniq(tvvRoles)}</div><div class="lbl">Trái TV</div></div>
      </div>
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:#f59e0b;">${countUniq(gvbbRoles)}</div><div class="lbl">Trái BB</div></div>
        <div class="dash-stat"><div class="num" style="color:var(--text2);">${myHapja}</div><div class="lbl">Hapja tôi tạo</div></div>
      </div>`;

    // ── NDD DETAIL LIST ──
    const listEl = document.getElementById('dashMyList');
    document.getElementById('dashMyListTitle').textContent = '🍎 Trái tôi làm NDD';
    if (nddRoles.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text2);font-size:13px;">Chưa có trái nào</div>';
    } else {
      // Supplement recordMap + sessionMap with NDD-only profile IDs not yet fetched
      const nddProfileIds = [...new Set(nddRoles.map(r=>r.fruit_groups?.profile_id).filter(Boolean))];
      const missingIds = nddProfileIds.filter(id => !recordMap[id] && !sessionMap[id]);
      if (missingIds.length > 0) {
        const ids = missingIds.map(id=>`"${id}"`).join(',');
        try {
          const [recRes, sRes2] = await Promise.all([
            sbFetch(`/rest/v1/records?profile_id=in.(${ids})&record_type=not.in.(mo_kt,note,ai_mindmap,ai_chat)&select=profile_id,record_type,content,created_at&order=created_at.desc`),
            sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${ids})&select=profile_id,session_number,tool,created_at&order=created_at.desc`)
          ]);
          const recs2 = await recRes.json(); recs2.forEach(r => { if (!recordMap[r.profile_id]) recordMap[r.profile_id] = r; });
          const ss2   = await sRes2.json(); ss2.forEach(s =>   { if (!sessionMap[s.profile_id]) sessionMap[s.profile_id] = s; });
        } catch(e) { console.warn('Supplement fetch:', e); }
      }
      const seenP = new Set();
      listEl.innerHTML = nddRoles.filter(r => {
        const pid = r.fruit_groups?.profile_id;
        const p = r.fruit_groups?.profiles;
        if (!pid || seenP.has(pid)) return false;
        if (p?.fruit_status === 'dropout') return false; // Filter out drop-outs from tracking
        seenP.add(pid); return true;
      }).map(r => {
        const p = r.fruit_groups?.profiles;
        const name = p?.full_name || 'N/A';
        const pid = r.fruit_groups?.profile_id;
        const ph = p?.phase || 'new';
        const phaseLabel = PHASE_LABELS[ph]||ph;
        const phaseColor = PHASE_COLORS[ph]||'#f59e0b';
        
        const isKT = p?.is_kt_opened;
        const showKT = ['bb', 'center', 'completed'].includes(ph);
        const ktLabel = showKT ? `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;margin-left:4px;">${isKT ? '📖 Đã mở KT' : '📕 Chưa mở KT'}</span>` : '';

        // Caregivers from all roles of this fruit_group
        const allRolesInGroup = r.fruit_groups?.fruit_roles || [];
        const tvvList = allRolesInGroup.filter(x=>x.role_type==='tvv').map(x=>x.staff_code).join(', ');
        const gvbbList = allRolesInGroup.filter(x=>x.role_type==='gvbb').map(x=>x.staff_code).join(', ');
        // Latest activity — unified via latestActivityLabel()
        const latestActivity = latestActivityLabel(recordMap[pid], sessionMap[pid]);
        // Use full profile from allProfiles cache if available (has all fields)
        const fullP = allProfiles.find(x => x.id === pid) || p;
        return renderProfileCard(fullP, {
          profileId: pid,
          ndd: fullP?.ndd_staff_code || '',
          tvv: tvvList,
          gvbb: gvbbList,
          latestActivity: latestActivity
        });
      }).join('');
    }

    // TVV / GVBB summary (compact)
    const myListEl = document.getElementById('dashMyList');
    if (tvvRoles.length > 0 || gvbbRoles.length > 0) {
      const seen2 = new Set();
      const otherItems = [...tvvRoles, ...gvbbRoles].filter(r => {
        const pid = r.fruit_groups?.profile_id;
        const p = r.fruit_groups?.profiles;
        if (!pid || seen2.has(pid)) return false;
        if (p?.fruit_status === 'dropout') return false; 
        seen2.add(pid); return true;
      }).map(r => {
        const p = r.fruit_groups?.profiles;
        const name = p?.full_name || 'N/A';
        const role = {ndd:'NDD',tvv:'💬 TVV',gvbb:'🎓 GVBB',la:'Lá'}[r.role_type]||r.role_type;
        const ph = p?.phase || 'new';
        const isKT = p?.is_kt_opened;
        const showKT = ['bb', 'center', 'completed'].includes(ph);
        const ktLabel = showKT ? `<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;background:${isKT ? 'var(--green)' : '#f59e0b'};color:white;margin-right:6px;">${isKT ? '📖 KT' : '📕 Chưa KT'}</span>` : '';
        const fullP2 = allProfiles.find(x => x.id === r.fruit_groups?.profile_id) || p;
        const roleBadge = `<span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:var(--surface2);color:var(--text2);margin-left:6px;">${role}</span>`;
        return renderProfileCard(fullP2, { profileId: r.fruit_groups?.profile_id, extraBadges: roleBadge });
      }).join('');
      if (otherItems) myListEl.innerHTML += `<div class="section-header" style="margin-top:12px;margin-bottom:6px;"><div class="section-title" style="font-size:13px;">💬 TVV & 🎓 GVBB</div></div>${otherItems}`;
    }
  } catch(e) {
    console.error('Dashboard error:', e);
    // Clear any stuck loading states
    const stuck = ['dashHapjaList','dashMyList','dashUnitList','dashSubUnits','dashNDDList'];
    stuck.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">⚠️ Không tải được dữ liệu</div>';
    });
    // Also clear metrics areas
    const metricsEl = document.getElementById('dashUnitMetrics');
    const personalEl = document.getElementById('dashPersonalMetrics');
    if (metricsEl && !metricsEl.innerHTML.trim()) metricsEl.innerHTML = '';
    if (personalEl && !personalEl.innerHTML.trim()) personalEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">⚠️ Không tải được dữ liệu</div>';
  }
}

