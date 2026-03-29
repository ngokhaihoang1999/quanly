// Phase display constants (shared across dashboard)
const PHASE_LABELS = {new:'🟡 Chakki',chakki:'🟡 Chakki',tu_van_hinh:'🖼️ TV Hình',tu_van:'💬 Tư Vấn',bb:'🎓 BB',center:'🏛️ Center',completed:'✅'};
const PHASE_COLORS = {new:'#f59e0b',chakki:'#f59e0b',tu_van_hinh:'#ef4444',tu_van:'var(--accent)',bb:'var(--green)',center:'#8b5cf6',completed:'var(--green)'};

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
    let unitFruits = 0, unitHapja = 0, unitRoles = [];
    let approvedHapjaList = [];
    // Semester filter helper (appends &semester_id=eq.xxx when a semester is selected)
    const semF = currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';
    // Set of profile IDs in current semester (for in-memory filtering of roles)
    const semProfileIds = currentSemesterId
      ? new Set(allProfiles.filter(p => p.semester_id === currentSemesterId).map(p => p.id))
      : null; // null means "show all"
    const inSem = (pid) => semProfileIds === null || semProfileIds.has(pid);

    // ALL profiles in unit (Alive + Dropout) — used for cumulative metrics
    const unitProfilesMapAll = new Map();
    // Alive-only profiles map — used for phase metrics
    const unitProfilesMapAlive = new Map();

    if (unitStaffCodes.length > 0) {
      const codeFilter = unitStaffCodes.map(c => `"${c}"`).join(',');
      const urRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=in.(${codeFilter})&select=*,fruit_groups(profile_id,telegram_group_id,telegram_group_title,level,profiles(full_name,phase,ndd_staff_code,fruit_status,is_kt_opened),fruit_roles(staff_code,role_type))`);
      const allUnitRoles = await urRes.json();
      // Apply semester filter to unit roles
      unitRoles = allUnitRoles.filter(r => inSem(r.fruit_groups?.profile_id));
      unitFruits = new Set(unitRoles.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size;

      // Approved Hapja by unit members (filtered by semester) — used for Hapja cumulative metric
      const ahRes = await sbFetch(`/rest/v1/check_hapja?status=eq.approved&created_by=in.(${codeFilter})&select=*&order=created_at.desc${semF}`);
      approvedHapjaList = await ahRes.json();

      // Build profile maps (All = Alive+Dropout, Alive = only alive)
      unitRoles.forEach(r => {
        const p = r.fruit_groups?.profiles;
        const pid = r.fruit_groups?.profile_id;
        if (!p || !pid) return;
        // ALL map (Alive + Dropout)
        if (!unitProfilesMapAll.has(pid)) {
          unitProfilesMapAll.set(pid, { profile: p, role: r });
        } else {
          const ex = unitProfilesMapAll.get(pid).role;
          if (r.role_type === 'ndd' && ex.role_type !== 'ndd') unitProfilesMapAll.set(pid, { profile: p, role: r });
        }
        // ALIVE-ONLY map
        if (p.fruit_status !== 'dropout') {
          if (!unitProfilesMapAlive.has(pid)) {
            unitProfilesMapAlive.set(pid, { profile: p, role: r });
          } else {
            const ex = unitProfilesMapAlive.get(pid).role;
            if (r.role_type === 'ndd' && ex.role_type !== 'ndd') unitProfilesMapAlive.set(pid, { profile: p, role: r });
          }
        }
      });

      // Pending hapja for section below
      const uhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter})&select=*&order=created_at.desc&limit=20${semF}`);
      unitHapja = (await uhRes.json()).length;
    }

    const myUnitProfilesAll   = Array.from(unitProfilesMapAll.values());
    const myUnitProfilesAlive = Array.from(unitProfilesMapAlive.values());

    // ── Helper: check if a profile entry belongs to scope A or B ──
    // A: NDD role belongs to unitStaffCodes
    // B: NDD NOT in unit, but TVV or GVBB is in unit
    function isInScopeA(x) {
      const allRoles = x.role?.fruit_groups?.fruit_roles || [];
      const nddCode = allRoles.find(r => r.role_type === 'ndd')?.staff_code || x.profile.ndd_staff_code;
      return unitStaffCodes.includes(nddCode);
    }
    function isInScopeB(x) {
      const allRoles = x.role?.fruit_groups?.fruit_roles || [];
      const nddCode = allRoles.find(r => r.role_type === 'ndd')?.staff_code || x.profile.ndd_staff_code;
      if (unitStaffCodes.includes(nddCode)) return false; // belongs to A
      return allRoles.some(r => ['tvv','gvbb'].includes(r.role_type) && unitStaffCodes.includes(r.staff_code));
    }

    // ── Info descriptions ──
    const infoDescs = {
      hapja_cum:   'Tổng số Trái đã được duyệt Hapja (tích luỹ, tính cả Drop-out)',
      tvh_cum:     'Số Trái đã đạt giai đoạn Tư Vấn Hình trở lên (tích luỹ, tính cả Drop-out)',
      grptv_cum:   'Số Group TV (telegram) đã kết nối bot (tích luỹ, tính cả Drop-out)',
      grpbb_cum:   'Số Trái đã vào giai đoạn BB / Đã mở KT (tích luỹ, tính cả Drop-out)',
      center_cum:  'Số Trái đã vào giai đoạn Center (tích luỹ, tính cả Drop-out)',
      chakki_ph:   'Trái đang ở giai đoạn Chakki (đã duyệt Hapja nhưng chưa lên TV Hình)',
      tvh_ph:      'Trái đang ở giai đoạn TV Hình (chốt TV lần 2 nhưng chưa lên Group TV)',
      grptv_ph:    'Trái đang ở giai đoạn Tư Vấn / Group TV (chưa mở KT)',
      grpbb_ph:    'Trái đang ở giai đoạn BB / đã mở Kinh Thánh',
      center_ph:   'Trái đang ở giai đoạn Center',
    };
    function infoBtn(key) {
      return `<span class="info-badge" onclick="event.stopPropagation();alert('${infoDescs[key]}')" title="${infoDescs[key]}">i</span>`;
    }
    function infoBtnLeft(key) {
      return `<span class="info-badge info-badge-left" onclick="event.stopPropagation();alert('${infoDescs[key]}')" title="${infoDescs[key]}">i</span>`;
    }

    // Save mode state
    if (!window._dashMode) window._dashMode = 'cumulative';
    if (!window._dashScopeMode) window._dashScopeMode = 'A';

    function renderDashMetrics() {
      const isCum  = window._dashMode === 'cumulative';
      const isA    = window._dashScopeMode === 'A';
      const scopeFn = isA ? isInScopeA : isInScopeB;

      // ═══ TÍCH LUỸ (Alive + Dropout) ═══
      // 1. Hapja (chỉ A mới tính từ approved hapja; B không có hapja riêng — hiển thị 0)
      const cumHapja = isA ? approvedHapjaList : [];
      // 2. TV Hình+ (arrived tu_van_hinh or beyond)
      const cumTVHinh = myUnitProfilesAll.filter(scopeFn)
        .filter(x => ['tu_van_hinh','tu_van','bb','center','completed'].includes(x.profile.phase));
      // 3. Group TV — profile đã tới phase tu_van trở lên
      const cumGroupTV = myUnitProfilesAll.filter(scopeFn)
        .filter(x => ['tu_van','bb','center','completed'].includes(x.profile.phase));
      // 4. Group BB / Đã mở KT (phase bb trở lên)
      const cumGroupBB = myUnitProfilesAll.filter(scopeFn)
        .filter(x => ['bb','center','completed'].includes(x.profile.phase));
      // 5. Center
      const cumCenter = myUnitProfilesAll.filter(scopeFn)
        .filter(x => ['center','completed'].includes(x.profile.phase));

      // ═══ THEO GIAI ĐOẠN (chỉ Alive) ═══
      // 1. Chakki: new/chakki
      const phChakki  = myUnitProfilesAlive.filter(scopeFn)
        .filter(x => ['new','chakki'].includes(x.profile.phase));
      // 2. TV Hình: tu_van_hinh
      const phTVHinh  = myUnitProfilesAlive.filter(scopeFn)
        .filter(x => x.profile.phase === 'tu_van_hinh');
      // 3. Group TV: tu_van
      const phGroupTV = myUnitProfilesAlive.filter(scopeFn)
        .filter(x => x.profile.phase === 'tu_van');
      // 4. Group BB: bb
      const phGroupBB = myUnitProfilesAlive.filter(scopeFn)
        .filter(x => x.profile.phase === 'bb');
      // 5. Center: center/completed
      const phCenter  = myUnitProfilesAlive.filter(scopeFn)
        .filter(x => ['center','completed'].includes(x.profile.phase));

      // Store for popup
      window._unitPopupData = {
        cumHapja, cumTVHinh, cumGroupTV, cumGroupBB, cumCenter,
        phChakki, phTVHinh, phGroupTV, phGroupBB, phCenter
      };

      const metricsEl = document.getElementById('dashUnitMetrics');
      metricsEl.innerHTML = `
        <div style="display:flex;gap:6px;margin-bottom:6px;">
          <div class="dash-mode-toggle" style="margin-bottom:0;flex:1;">
            <button class="dash-mode-btn ${isA ? 'active' : ''}" onclick="window._dashScopeMode='A';renderDashMetrics()">👤 NDD trong ĐV (A)</button>
            <button class="dash-mode-btn ${!isA ? 'active' : ''}" onclick="window._dashScopeMode='B';renderDashMetrics()">🤝 Hỗ trợ TV/BB (B)</button>
          </div>
        </div>
        <div class="dash-mode-toggle">
          <button class="dash-mode-btn ${isCum ? 'active' : ''}" onclick="window._dashMode='cumulative';renderDashMetrics()">📊 Tích luỹ (ALL)</button>
          <button class="dash-mode-btn ${!isCum ? 'active' : ''}" onclick="window._dashMode='phase';renderDashMetrics()">📋 Giai đoạn (Alive)</button>
        </div>
        <div class="dash-grid-5">
          <div class="dash-center-circle" onclick="showUnitPopup('center')">
            <div class="num">${isCum ? cumCenter.length : phCenter.length}</div>
            <div class="lbl">🏛️ Center</div>
          </div>
          <div class="dash-stat accent" style="cursor:pointer;" onclick="showUnitPopup('${isCum ? 'hapja' : 'chakki'}')">
            ${infoBtnLeft(isCum ? 'hapja_cum' : 'chakki_ph')}
            <div class="num">${isCum ? cumHapja.length : phChakki.length}</div>
            <div class="lbl">${isCum ? '🍎 Trái Hapja' : '🟡 Chakki'}</div>
          </div>
          <div class="dash-stat yellow" style="cursor:pointer;" onclick="showUnitPopup('${isCum ? 'tvhinh' : 'tvhinh_phase'}')">
            ${infoBtn(isCum ? 'tvh_cum' : 'tvh_ph')}
            <div class="num">${isCum ? cumTVHinh.length : phTVHinh.length}</div>
            <div class="lbl">🖼️ TV Hình</div>
          </div>
          <div class="dash-stat" style="cursor:pointer;border-top-color:var(--accent);" onclick="showUnitPopup('${isCum ? 'grouptv' : 'grouptv_phase'}')">
            ${infoBtnLeft(isCum ? 'grptv_cum' : 'grptv_ph')}
            <div class="num" style="color:var(--accent);">${isCum ? cumGroupTV.length : phGroupTV.length}</div>
            <div class="lbl">💬 Group TV</div>
          </div>
          <div class="dash-stat green" style="cursor:pointer;" onclick="showUnitPopup('${isCum ? 'groupbb' : 'groupbb_phase'}')">
            ${infoBtn(isCum ? 'grpbb_cum' : 'grpbb_ph')}
            <div class="num">${isCum ? cumGroupBB.length : phGroupBB.length}</div>
            <div class="lbl">🎓 Group BB</div>
          </div>
        </div>`;
    }
    window.renderDashMetrics = renderDashMetrics;
    renderDashMetrics();


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
      // Chỉ đếm hồ sơ Alive mà NDD trực thuộc codes (không tính TVV/GVBB từ đơn vị khác)
      const fr = unitRoles.filter(r => r.role_type === 'ndd' && codes.includes(r.staff_code));
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
    let myRoles = [];
    if (myCode) {
      // Fetch all roles I have, with full profile data + all roles of those profiles (for TVV/GVBB display)
      const rRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=eq.${myCode}&select=*,fruit_groups(id,profile_id,telegram_group_title,level,profiles(id,full_name,phone_number,phase,is_kt_opened,fruit_status,birth_year,dropout_reason,gender,avatar_color),fruit_roles(staff_code,role_type))`);
      const allMyRoles = await rRes.json();
      // Apply semester filter to personal roles (includes Alive + Dropout)
      myRoles = allMyRoles.filter(r => inSem(r.fruit_groups?.profile_id));
    }
    const nddRoles = myRoles.filter(r => r.role_type === 'ndd');
    const tvvRoles = myRoles.filter(r => r.role_type === 'tvv');
    const gvbbRoles = myRoles.filter(r => r.role_type === 'gvbb');
    // Count unique profiles per role (Alive + Dropout)
    const countUniq = arr => new Set(arr.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size;
    // Total profiles I manage (union of NDD + TVV + GVBB, deduplicated)
    const allManagedPids = new Set([
      ...nddRoles.map(r => r.fruit_groups?.profile_id),
      ...tvvRoles.map(r => r.fruit_groups?.profile_id),
      ...gvbbRoles.map(r => r.fruit_groups?.profile_id),
    ].filter(Boolean));
    document.getElementById('dashPersonalMetrics').innerHTML = `
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:var(--accent);">${countUniq(nddRoles)}</div><div class="lbl">Trái NDD</div></div>
        <div class="dash-stat"><div class="num" style="color:var(--green);">${countUniq(tvvRoles)}</div><div class="lbl">Trái TV</div></div>
      </div>
      <div class="dash-card-row">
        <div class="dash-stat"><div class="num" style="color:#f59e0b;">${countUniq(gvbbRoles)}</div><div class="lbl">Trái BB</div></div>
        <div class="dash-stat"><div class="num" style="color:#8b5cf6;">${allManagedPids.size}</div><div class="lbl">Tổng được Quản lý</div></div>
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
        if (!pid || seenP.has(pid)) return false;
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
        if (!pid || seen2.has(pid)) return false;
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
  } finally {
    // GUARANTEE: After loadDashboard completes (success or error), any element still
    // showing "Đang tải..." means it was never updated — replace with empty/error state
    const LOADING_MARKER = 'Đang tải';
    [
      { id: 'dashHapjaList', fallback: '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">Không có phiếu chờ duyệt</div>' },
      { id: 'dashMyList',    fallback: '<div style="text-align:center;padding:12px;color:var(--text3);font-size:13px;">Chưa có dữ liệu</div>' },
    ].forEach(({ id, fallback }) => {
      const el = document.getElementById(id);
      if (el && el.textContent.includes(LOADING_MARKER)) el.innerHTML = fallback;
    });
  }
}

