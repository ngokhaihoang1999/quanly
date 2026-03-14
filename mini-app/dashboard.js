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
    let approvedHapjaList = [], tvvFruits = [], gvbbFruits = [], bbGroups = [];
    if (unitStaffCodes.length > 0) {
      const codeFilter = unitStaffCodes.map(c => `"${c}"`).join(',');
      const urRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=in.(${codeFilter})&select=*,fruit_groups(profile_id,telegram_group_title,level,profiles(full_name,phase,ndd_staff_code,fruit_status),fruit_roles(staff_code,role_type))`);
      unitRoles = await urRes.json();
      unitFruits = new Set(unitRoles.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size;
      // Approved Hapja by unit members
      const ahRes = await sbFetch(`/rest/v1/check_hapja?status=eq.approved&created_by=in.(${codeFilter})&select=*&order=created_at.desc`);
      approvedHapjaList = await ahRes.json();
      // TVV fruits (role_type=tvv by unit members)
      const tvvSeen = new Set();
      unitRoles.forEach(r => {
        if (r.role_type === 'tvv' && unitStaffCodes.includes(r.staff_code) && r.fruit_groups?.profile_id && !tvvSeen.has(r.fruit_groups.profile_id)) {
          tvvSeen.add(r.fruit_groups.profile_id);
          tvvFruits.push(r);
        }
      });
      // GVBB fruits (role_type=gvbb by unit members)
      const gvbbSeen = new Set();
      unitRoles.forEach(r => {
        if (r.role_type === 'gvbb' && unitStaffCodes.includes(r.staff_code) && r.fruit_groups?.profile_id && !gvbbSeen.has(r.fruit_groups.profile_id)) {
          gvbbSeen.add(r.fruit_groups.profile_id);
          gvbbFruits.push(r);
        }
      });
      // BB groups where NDD is a unit member
      const bbSeen = new Set();
      unitRoles.forEach(r => {
        if (r.role_type === 'ndd' && unitStaffCodes.includes(r.staff_code) && r.fruit_groups?.level === 'bb' && !bbSeen.has(r.fruit_group_id)) {
          bbSeen.add(r.fruit_group_id);
          bbGroups.push(r);
        }
      });
      // Pending hapja for section below
      const uhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter})&select=*&order=created_at.desc&limit=20`);
      unitHapja = (await uhRes.json()).length;
    }
    // Store for popup use
    window._unitApprovedHapja = approvedHapjaList;
    window._unitTvvFruits = tvvFruits;
    window._unitGvbbFruits = gvbbFruits;
    window._unitBbGroups = bbGroups;
    document.getElementById('dashUnitMetrics').innerHTML = `
      <div class="dash-card-row">
        <div class="dash-stat" style="cursor:pointer;" onclick="showUnitPopup('hapja')"><div class="num">${approvedHapjaList.length}</div><div class="lbl">Trái Hapja</div></div>
        <div class="dash-stat" style="cursor:pointer;" onclick="showUnitPopup('tvv')"><div class="num" style="color:var(--accent);">${tvvFruits.length}</div><div class="lbl">Trái TV</div></div>
      </div>
      <div class="dash-card-row">
        <div class="dash-stat" style="cursor:pointer;" onclick="showUnitPopup('gvbb')"><div class="num" style="color:var(--green);">${gvbbFruits.length}</div><div class="lbl">Trái BB</div></div>
        <div class="dash-stat" style="cursor:pointer;" onclick="showUnitPopup('bbgroup')"><div class="num" style="color:var(--yellow);">${bbGroups.length}</div><div class="lbl">Group BB</div></div>
      </div>`;

    // Pre-fetch latest sessions + records for all unit fruits
    const allPids = [...new Set(unitRoles.map(r => r.fruit_groups?.profile_id).filter(Boolean))];
    let sessionMap = {}, recordMap = {};
    if (allPids.length > 0) {
      const idsStr = allPids.map(id=>`"${id}"`).join(',');
      try {
        const sRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${idsStr})&select=*&order=session_number.desc`);
        const ss = await sRes.json();
        ss.forEach(s => { if (!sessionMap[s.profile_id]) sessionMap[s.profile_id] = s; });
        const rRes = await sbFetch(`/rest/v1/records?profile_id=in.(${idsStr})&select=*&order=created_at.desc`);
        const recs = await rRes.json();
        recs.forEach(r => { if (!recordMap[r.profile_id]) recordMap[r.profile_id] = r; });
      } catch(e) {}
    }
    const phMap = {new:'🟡 Chakki',chakki:'🟡 Chakki',tu_van:'💬 TV',bb:'🎓 BB',center:'🏛️ Center',completed:'✅'};
    const phColor = {new:'#f59e0b',chakki:'#f59e0b',tu_van:'var(--accent)',bb:'var(--green)',center:'#8b5cf6',completed:'var(--green)'};
    // Helper: render fruit cards for a list of staff_codes
    function fruitCardsForCodes(codes) {
      const seen = new Set();
      const matching = unitRoles.filter(r => {
        const pid = r.fruit_groups?.profile_id;
        if (!pid || !codes.includes(r.staff_code) || seen.has(pid)) return false;
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
        let latest = '';
        const lr = recordMap[pid], ls = sessionMap[pid];
        if (lr) { const isTV=lr.record_type==='tu_van'; const num=lr.content?.lan_thu||lr.content?.buoi_thu||''; latest=isTV?`TV lần ${num}`:`BB buổi ${num}`; }
        else if (ls) { latest = `Chốt TV lần ${ls.session_number}`; }
        const fStatus = p?.fruit_status || 'alive';
        const sDot = fStatus === 'dropout' ? '🔴' : '🟢';
        return `<div style="cursor:pointer;padding:10px 12px;background:var(--surface);border-radius:var(--radius-sm);border:1px solid var(--border);margin:4px 0;" onclick="openProfileById('${pid}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-weight:700;font-size:13px;">${sDot} ${name}</div>
            <span style="font-size:9px;font-weight:700;padding:2px 7px;border-radius:8px;background:${phColor[ph]};color:white;">${phMap[ph]||ph}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 8px;font-size:10px;color:var(--text2);">
            <div>NDD: <b style="color:var(--text);">${ndd}</b></div>
            <div>TVV: <b style="color:var(--text);">${tvv}</b></div>
            <div>GVBB: <b style="color:var(--text);">${gvbb}</b></div>
            ${latest ? `<div style="color:var(--accent);">⏱ ${latest}</div>` : ''}
          </div>
        </div>`;
      }).join('');
    }

    // ── Sub-unit breakdown (for managers) ──
    const subEl = document.getElementById('dashSubUnits');
    let subHtml = '';
    function countForCodes(codes) {
      const fr = unitRoles.filter(r => codes.includes(r.staff_code));
      return {
        td: codes.length,
        fruits: new Set(fr.map(r => r.fruit_groups?.profile_id).filter(Boolean)).size,
        groups: new Set(fr.map(r => r.fruit_group_id)).size,
      };
    }
    if (['admin','yjyn','ggn_jondo','ggn_chakki','sgn_jondo'].includes(pos)) {
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
                <span>${gS.td} TĐ</span><span style="color:var(--accent);">${gS.fruits} 🍎</span>
              </div>
            </div>
            <div id="${gid}" style="display:none;padding-left:16px;">`;
          (g.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            const tS = countForCodes(tCodes);
            const tid = 'subteam_' + t.id;
            subHtml += `<div style="margin:4px 0;">
              <div onclick="document.getElementById('${tid}').style.display=document.getElementById('${tid}').style.display==='none'?'block':'none'" style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-left:3px solid var(--accent);border-radius:0 var(--radius-sm) var(--radius-sm) 0;background:var(--surface);">
                <div style="font-size:12px;font-weight:600;">📌 ${t.name}</div>
                <div style="display:flex;gap:10px;font-size:11px;color:var(--text2);">
                  <span>${tS.td} TĐ</span><span style="color:var(--accent);">${tS.fruits} 🍎</span>
                </div>
              </div>
              <div id="${tid}" style="display:none;padding-left:12px;">${fruitCardsForCodes(tCodes)}</div>
            </div>`;
          });
          subHtml += '</div></div>';
        });
      });
    } else if (pos === 'tjn') {
      for (const a of (structureData||[])) {
        const myGrp = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (myGrp) {
          (myGrp.teams||[]).forEach(t => {
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

    // ── HAPJA (filter by unit scope) ──
    const canApprove = ['admin','yjyn','ggn_jondo','ggn_chakki'].includes(pos);
    let hapjaQuery = '/rest/v1/check_hapja?status=eq.pending&select=*&order=created_at.desc&limit=20';
    if (canApprove && unitStaffCodes.length > 0 && pos !== 'admin') {
      const codeFilter2 = unitStaffCodes.map(c => `"${c}"`).join(',');
      hapjaQuery = `/rest/v1/check_hapja?status=eq.pending&created_by=in.(${codeFilter2})&select=*&order=created_at.desc&limit=20`;
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
      const rRes = await sbFetch(`/rest/v1/fruit_roles?staff_code=eq.${myCode}&select=*,fruit_groups(id,profile_id,telegram_group_title,level,profiles(id,full_name,phone_number,phase),fruit_roles(staff_code,role_type))`);
      myRoles = await rRes.json();
      const mhRes = await sbFetch(`/rest/v1/check_hapja?status=eq.pending&created_by=eq.${myCode}&select=id`);
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
      // Fetch latest session for each NDD profile
      const nddProfileIds = [...new Set(nddRoles.map(r=>r.fruit_groups?.profile_id).filter(Boolean))];
      let sessionMap = {};
      let recordMap = {};
      if (nddProfileIds.length > 0) {
        const ids = nddProfileIds.map(id=>`"${id}"`).join(',');
        try {
          const sRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${ids})&select=*&order=session_number.desc`);
          const sessions = await sRes.json();
          sessions.forEach(s => { if (!sessionMap[s.profile_id]) sessionMap[s.profile_id] = s; });
          const recRes = await sbFetch(`/rest/v1/records?profile_id=in.(${ids})&select=*&order=created_at.desc`);
          const recs = await recRes.json();
          recs.forEach(r => { if (!recordMap[r.profile_id]) recordMap[r.profile_id] = r; });
        } catch(e) { console.warn('Session fetch:', e); }
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
        const phaseLabel = {new:'🟡 Chakki',chakki:'🟡 Chakki',tu_van:'💬 TV',bb:'🎓 BB',center:'🏛️ Center',completed:'✅'}[ph]||ph;
        const phaseColor = {new:'#f59e0b',chakki:'#f59e0b',tu_van:'var(--accent)',bb:'var(--green)',center:'#8b5cf6',completed:'var(--green)'}[ph]||'#f59e0b';
        // Caregivers from all roles of this fruit_group
        const allRolesInGroup = r.fruit_groups?.fruit_roles || [];
        const tvvList = allRolesInGroup.filter(x=>x.role_type==='tvv').map(x=>x.staff_code).join(', ');
        const gvbbList = allRolesInGroup.filter(x=>x.role_type==='gvbb').map(x=>x.staff_code).join(', ');
        // Latest activity
        const latestSess = sessionMap[pid];
        const latestRec = recordMap[pid];
        let latestActivity = '';
        if (latestSess) latestActivity = `Chốt TV lần ${latestSess.session_number} (${latestSess.tool||'—'})`;
        if (latestRec) {
          const isTV = latestRec.record_type === 'tu_van';
          const num = latestRec.content?.lan_thu || latestRec.content?.buoi_thu || '';
          const recLabel = isTV ? `BC TV lần ${num}` : `BC BB buổi ${num}`;
          if (!latestSess || new Date(latestRec.created_at) > new Date(latestSess.created_at)) {
            latestActivity = recLabel;
          }
        }
        return `<div style="cursor:pointer;padding:12px 14px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px;" onclick="openProfileById('${pid}')">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
            <div style="font-weight:700;font-size:14px;">${name}</div>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${phaseColor};color:white;">${phaseLabel}</span>
          </div>
          ${tvvList ? `<div style="font-size:11px;color:var(--text2);">💬 TVV: ${tvvList}</div>` : ''}
          ${gvbbList ? `<div style="font-size:11px;color:var(--text2);">🎓 GVBB: ${gvbbList}</div>` : ''}
          ${latestActivity ? `<div style="font-size:11px;color:var(--accent);margin-top:4px;">⏱ ${latestActivity}</div>` : ''}
          <div style="text-align:right;font-size:11px;color:var(--text3);margin-top:2px;">Bấm để xem hồ sơ ›</div>
        </div>`;
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
        const name = r.fruit_groups?.profiles?.full_name || 'N/A';
        const role = {ndd:'NDD',tvv:'💬 TVV',gvbb:'🎓 GVBB',la:'Lá'}[r.role_type]||r.role_type;
        return `<div style="cursor:pointer;display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:4px;" onclick="openProfileById('${r.fruit_groups?.profile_id}')">
          <div style="font-size:13px;font-weight:600;flex:1;">${name}</div>
          <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:8px;background:var(--surface2);color:var(--text2);">${role}</span>
          <span style="color:var(--text3);">›</span>
        </div>`;
      }).join('');
      if (otherItems) myListEl.innerHTML += `<div class="section-header" style="margin-top:12px;margin-bottom:6px;"><div class="section-title" style="font-size:13px;">💬 TVV & 🎓 GVBB</div></div>${otherItems}`;
    }
  } catch(e) { console.error('Dashboard error:', e); }
}

