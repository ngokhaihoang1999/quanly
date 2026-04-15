// ============ REPORTS – Báo cáo Số liệu Truyền đạo ============
// Visible for GYJN+ (scope >= team)
// Uses existing data: allProfiles, allStaff, structureData, sbFetch

// Cache fetched data so sub-unit dropdown can re-render without re-fetch
let _rptCache = null;

async function loadReports() {
  const el = document.getElementById('reportContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px;">⏳ Đang phân tích dữ liệu...</div>';

  try {
    const pos = getCurrentPosition();
    const scope = getScope();
    const myCode = getEffectiveStaffCode();
    const semF = currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';

    // ── Build structure tree for scope ──
    let scopeUnits = []; // {label, codes[]}
    let scopeLabel = '';
    let allScopeCodes = [];

    if (scope === 'system') {
      scopeLabel = 'Toàn hệ thống';
      allScopeCodes = allStaff.map(s => s.staff_code);
      // Sub-units: each area
      (structureData||[]).forEach(a => {
        const codes = [];
        (a.org_groups||[]).forEach(g => (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => codes.push(m.staff_code))));
        scopeUnits.push({ type: 'area', label: a.name, codes });
        (a.org_groups||[]).forEach(g => {
          const gCodes = [];
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => gCodes.push(m.staff_code)));
          scopeUnits.push({ type: 'group', label: `  └ ${g.name}`, codes: gCodes });
          (g.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            scopeUnits.push({ type: 'team', label: `      └ ${t.name}`, codes: tCodes });
          });
        });
      });
    } else if (scope === 'area') {
      let myArea = (structureData||[]).find(a => a.yjyn_staff_code === myCode);
      if (!myArea) {
        for (const a of (structureData||[])) {
          for (const g of (a.org_groups||[])) {
            if ((g.teams||[]).some(t => (t.staff||[]).some(m => m.staff_code === myCode))) { myArea = a; break; }
          }
          if (myArea) break;
        }
      }
      if (myArea) {
        scopeLabel = myArea.name;
        (myArea.org_groups||[]).forEach(g => (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => allScopeCodes.push(m.staff_code))));
        // Sub-units: each group + team
        (myArea.org_groups||[]).forEach(g => {
          const gCodes = [];
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => gCodes.push(m.staff_code)));
          scopeUnits.push({ type: 'group', label: g.name, codes: gCodes });
          (g.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            scopeUnits.push({ type: 'team', label: `  └ ${t.name}`, codes: tCodes });
          });
        });
      }
    } else if (scope === 'group') {
      for (const a of (structureData||[])) {
        const g = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (g) {
          scopeLabel = g.name;
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => allScopeCodes.push(m.staff_code)));
          // Sub-units: each team
          (g.teams||[]).forEach(t => {
            const tCodes = (t.staff||[]).map(m => m.staff_code);
            scopeUnits.push({ type: 'team', label: t.name, codes: tCodes });
          });
          break;
        }
      }
    } else {
      // team scope (GYJN/BGYJN)
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          const t = (g.teams||[]).find(t => t.gyjn_staff_code === myCode || t.bgyjn_staff_code === myCode || (t.staff||[]).some(m => m.staff_code === myCode));
          if (t) {
            scopeLabel = t.name;
            (t.staff||[]).forEach(m => allScopeCodes.push(m.staff_code));
            break;
          }
        }
        if (scopeLabel) break;
      }
    }
    allScopeCodes = [...new Set(allScopeCodes)];

    // ── Fetch data in parallel ──
    const codeFilter = allScopeCodes.length > 0 ? allScopeCodes.map(c => `"${c}"`).join(',') : '';
    const [rolesRes, hapjaRes, recordsRes, sessionsRes] = await Promise.all([
      codeFilter ? sbFetch(`/rest/v1/fruit_roles?staff_code=in.(${codeFilter})&select=staff_code,role_type,fruit_groups(profile_id,profiles(full_name,phase,fruit_status,is_kt_opened,created_at,ndd_staff_code,dropout_reason))`) : Promise.resolve({ json: () => [] }),
      codeFilter ? sbFetch(`/rest/v1/check_hapja?created_by=in.(${codeFilter})&select=id,status,created_at,created_by${semF}`) : Promise.resolve({ json: () => [] }),
      codeFilter ? sbFetch(`/rest/v1/records?select=profile_id,record_type,created_at&record_type=in.(tu_van,bien_ban,mo_kt,chot_bb,chot_center)&order=created_at.desc`) : Promise.resolve({ json: () => [] }),
      codeFilter ? sbFetch(`/rest/v1/consultation_sessions?select=profile_id,session_number,created_at&order=created_at.desc`) : Promise.resolve({ json: () => [] }),
    ]);

    const allRoles = codeFilter ? await rolesRes.json() : [];
    const allHapja = codeFilter ? await hapjaRes.json() : [];
    const allRecords = codeFilter ? await recordsRes.json() : [];
    const allSessions = codeFilter ? await sessionsRes.json() : [];

    // Build records/sessions maps
    const recMap = {};
    allRecords.forEach(r => { if (!recMap[r.profile_id]) recMap[r.profile_id] = []; recMap[r.profile_id].push(r); });
    const sessMap = {};
    allSessions.forEach(s => { if (!sessMap[s.profile_id]) sessMap[s.profile_id] = []; sessMap[s.profile_id].push(s); });

    // Build full profile map from roles
    const profileMap = new Map();
    allRoles.forEach(r => {
      if (r.role_type !== 'ndd') return;
      const p = r.fruit_groups?.profiles;
      const pid = r.fruit_groups?.profile_id;
      if (!p || !pid) return;
      if (currentSemesterId) {
        const pFull = allProfiles.find(x => x.id === pid);
        if (pFull && pFull.semester_id !== currentSemesterId) return;
      }
      if (!profileMap.has(pid)) {
        profileMap.set(pid, { ...p, id: pid, ndd: r.staff_code });
      }
    });

    // Cache data
    _rptCache = { allRoles, allHapja, recMap, sessMap, profileMap, scopeLabel, scopeUnits, allScopeCodes };

    // Render with all codes (no sub-filter)
    _renderReports(el, null);

  } catch (e) {
    console.error('Reports error:', e);
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;font-size:13px;">❌ Lỗi tải báo cáo: ' + e.message + '</div>';
  } finally {
    markFresh('reports');
  }
}

function _filterProfiles(subCodes) {
  if (!_rptCache) return [];
  const pm = _rptCache.profileMap;
  if (!subCodes) return Array.from(pm.values());
  const codeSet = new Set(subCodes);
  return Array.from(pm.values()).filter(p => codeSet.has(p.ndd));
}

function _switchReportUnit(val) {
  const el = document.getElementById('reportContent');
  if (!el || !_rptCache) return;
  _renderReports(el, val === '__all__' ? null : val);
}

function _renderReports(el, subUnitIdx) {
  if (!_rptCache) return;
  const { allRoles, allHapja, recMap, sessMap, profileMap, scopeLabel, scopeUnits, allScopeCodes } = _rptCache;

  // Determine which codes to use
  let activeCodes = null; // null = all
  let activeLabel = scopeLabel;
  if (subUnitIdx !== null && subUnitIdx !== undefined && scopeUnits[subUnitIdx]) {
    activeCodes = scopeUnits[subUnitIdx].codes;
    activeLabel = scopeUnits[subUnitIdx].label.trim().replace(/^└\s*/, '');
  }

  const profiles = _filterProfiles(activeCodes);
  const alive = profiles.filter(p => p.fruit_status !== 'dropout' && p.fruit_status !== 'pause');
  const paused = profiles.filter(p => p.fruit_status === 'pause');
  const dropouts = profiles.filter(p => p.fruit_status === 'dropout');

  const PHASES_ORDER = ['chakki', 'tu_van_hinh', 'tu_van', 'bb', 'center'];
  const PHASE_IDX = {};
  PHASES_ORDER.forEach((p, i) => PHASE_IDX[p] = i);
  PHASE_IDX['new'] = 0;
  PHASE_IDX['completed'] = 4;
  function phaseIdx(phase) { return PHASE_IDX[phase] !== undefined ? PHASE_IDX[phase] : 0; }

  const total = profiles.length;
  const semName = currentSemesterId ? (allSemesters.find(s => s.id === currentSemesterId)?.name || '') : 'Tất cả';
  const funnelColors = ['#f59e0b', '#ef4444', '#6366f1', '#22c55e', '#8b5cf6'];
  const funnelLabels = ['🍎 Hapja/Chakki', '🖼️ TV Hình+', '💬 Group TV+', '🎓 BB+', '🏛️ Center'];

  let html = '';

  // ── HEADER + DROPDOWN ──
  html += `<div style="margin-bottom:16px;">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px;">📊 Báo cáo · ${activeLabel || 'Đơn vị'}</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">Kỳ: ${semName} · ${total} hồ sơ · ${alive.length} alive${paused.length > 0 ? ` · ${paused.length} pause` : ''} · ${dropouts.length} dropout</div>`;
  if (scopeUnits.length > 0) {
    html += `<select id="rptUnitSelect" class="rpt-unit-select" onchange="_switchReportUnit(this.value)">
      <option value="__all__" ${subUnitIdx === null ? 'selected' : ''}>📍 ${scopeLabel} (tổng thể)</option>
      ${scopeUnits.map((u, i) => `<option value="${i}" ${subUnitIdx === i ? 'selected' : ''}>${u.type === 'area' ? '🏢' : u.type === 'group' ? '👥' : '🏠'} ${u.label}</option>`).join('')}
    </select>`;
  }
  html += '</div>';

  // ═══════════════════════════════════════════════════
  // MODULE 1: CẢNH BÁO SỚM
  // ═══════════════════════════════════════════════════
  const now = Date.now();
  const DAY = 86400000;
  const warnings = [];

  // Helper: get NDD name for a profile
  function nddName(p) {
    if (!p.ndd) return '';
    const staff = allStaff.find(x => x.staff_code === p.ndd);
    return staff ? (staff.nickname || staff.full_name || p.ndd) : p.ndd;
  }

  alive.forEach(p => {
    const recs = recMap[p.id] || [];
    const sess = sessMap[p.id] || [];
    const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(s => new Date(s.created_at).getTime())];
    const lastActivity = allDates.length > 0 ? Math.max(...allDates) : (p.created_at ? new Date(p.created_at).getTime() : 0);
    const daysSince = lastActivity ? Math.floor((now - lastActivity) / DAY) : 999;

    if (daysSince > 14) {
      warnings.push({ type: 'dormant', severity: 'red', label: `🔴 ${p.full_name} — ${daysSince} ngày không HĐ · NDD: ${nddName(p)}`, profile: p, days: daysSince });
    }
    if (!['center','completed'].includes(p.phase)) {
      const createdTime = p.created_at ? new Date(p.created_at).getTime() : 0;
      const daysSinceCreated = createdTime ? Math.floor((now - createdTime) / DAY) : 0;
      if (daysSinceCreated > 30 && daysSince > 14) {
        warnings.push({ type: 'stuck', severity: 'yellow', label: `🟡 ${p.full_name} — kẹt ${PHASE_LABELS[p.phase]||p.phase} >30d · NDD: ${nddName(p)}`, profile: p });
      }
    }
  });

  const pendingHapja = allHapja.filter(h => h.status === 'pending');
  pendingHapja.forEach(h => {
    const daysPending = Math.floor((now - new Date(h.created_at).getTime()) / DAY);
    if (daysPending > 7) {
      warnings.push({ type: 'hapja', severity: 'orange', label: `🟠 Hapja chờ ${daysPending} ngày (bởi ${h.created_by})` });
    }
  });

  alive.forEach(p => {
    const roles = allRoles.filter(r => r.fruit_groups?.profile_id === p.id);
    const hasTVV = roles.some(r => r.role_type === 'tvv');
    const hasGVBB = roles.some(r => r.role_type === 'gvbb');
    if (!hasTVV && !['new','chakki'].includes(p.phase)) {
      warnings.push({ type: 'no_tvv', severity: 'blue', label: `🔵 ${p.full_name} — chưa có TVV · NDD: ${nddName(p)}`, profile: p });
    }
    if (!hasGVBB && ['tu_van','bb','center'].includes(p.phase)) {
      warnings.push({ type: 'no_gvbb', severity: 'blue', label: `🔵 ${p.full_name} — chưa có GVBB · NDD: ${nddName(p)}`, profile: p });
    }
  });

  const sevOrder = { red: 0, orange: 1, yellow: 2, blue: 3 };
  warnings.sort((a, b) => (sevOrder[a.severity] || 9) - (sevOrder[b.severity] || 9));
  const redCount = warnings.filter(w => w.severity === 'red').length;
  const yellowCount = warnings.filter(w => w.severity === 'yellow' || w.severity === 'orange').length;
  const blueCount = warnings.filter(w => w.severity === 'blue').length;

  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">
      ⚠️ CẢNH BÁO SỚM
      <span class="rpt-badge ${warnings.length > 0 ? 'rpt-badge-red' : 'rpt-badge-green'}">${warnings.length}</span>
    </div>
    <div>`;
  if (warnings.length === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--green);font-size:13px;font-weight:600;">✅ Không có cảnh báo — tình hình ổn định!</div>';
  } else {
    html += `<div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
      ${redCount > 0 ? `<span class="rpt-chip rpt-chip-red">🔴 ${redCount} ngủ đông</span>` : ''}
      ${yellowCount > 0 ? `<span class="rpt-chip rpt-chip-yellow">🟡 ${yellowCount} cảnh báo</span>` : ''}
      ${blueCount > 0 ? `<span class="rpt-chip rpt-chip-blue">🔵 ${blueCount} thiếu vai trò</span>` : ''}
    </div>`;
    html += '<div class="rpt-warn-list">';
    warnings.slice(0, 15).forEach(w => {
      const onclick = w.profile ? `onclick="openProfileById('${w.profile.id}')"` : '';
      html += `<div class="rpt-warn-item rpt-warn-${w.severity}" ${onclick} style="${w.profile ? 'cursor:pointer;' : ''}">${w.label}</div>`;
    });
    if (warnings.length > 15) {
      html += `<div style="text-align:center;padding:8px;color:var(--text3);font-size:11px;">... và ${warnings.length - 15} cảnh báo khác</div>`;
    }
    html += '</div>';
  }
  html += '</div></div>';

  // ── Cross-semester Pause profiles (ONLY for team/Tổ scope) ──
  const scope = getScope();
  if (scope === 'team') {
    // Fetch ALL profiles (any semester) that are paused and belong to this team's NDD codes
    const teamCodes = activeCodes || allScopeCodes;
    const pausedCrossSem = (allProfiles || []).filter(p =>
      p.fruit_status === 'pause' && p.ndd_staff_code && teamCodes.includes(p.ndd_staff_code)
    );
    if (pausedCrossSem.length > 0) {
      html += `<div class="rpt-section">
        <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">
          ⏸️ HỒ SƠ PAUSE (xuyên kỳ)
          <span class="rpt-badge" style="background:rgba(156,163,175,0.2);color:#9ca3af;">${pausedCrossSem.length}</span>
        </div>
        <div>
          <div style="font-size:11px;color:var(--text3);margin-bottom:8px;">Trái quả đang Pause thuộc Tổ (định kỳ rà soát để Alive hoặc Drop-out)</div>
          <div class="rpt-warn-list">`;
      pausedCrossSem.forEach(p => {
        const semObj = (allSemesters || []).find(s => s.id === p.semester_id);
        const semLabel = semObj ? semObj.name : 'Chưa xác định';
        const reason = p.dropout_reason ? ` — ${p.dropout_reason}` : '';
        html += `<div class="rpt-warn-item" style="border-left:3px solid #9ca3af;cursor:pointer;" onclick="openProfileById('${p.id}')">
          ⏸️ ${p.full_name}${reason} · Kỳ: ${semLabel} · NDD: ${nddName(p)}
        </div>`;
      });
      html += '</div></div></div>';
    }
  }

  // ═══════════════════════════════════════════════════
  // MODULE 2: PHỄU CHUYỂN ĐỔI (clickable bars)
  // ═══════════════════════════════════════════════════
  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">🔄 PHỄU CHUYỂN ĐỔI</div>
    <div>`;

  if (total === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    // Pre-build profile lists per phase for click-to-view
    const _funnelProfiles = {};
    PHASES_ORDER.forEach((phase, i) => {
      _funnelProfiles[i] = {
        passed: alive.filter(p => !([PHASES_ORDER.length-1] === i) && phaseIdx(p.phase) > i),
        staying: alive.filter(p => phaseIdx(p.phase) === i),
        dropped: [...dropouts, ...paused].filter(p => phaseIdx(p.phase) === i)
      };
    });
    // Store for click handler
    window._funnelProfiles = _funnelProfiles;

    PHASES_ORDER.forEach((phase, i) => {
      const isLast = i === PHASES_ORDER.length - 1;
      const aliveReached = alive.filter(p => phaseIdx(p.phase) >= i).length;
      const dropReached = [...dropouts, ...paused].filter(p => phaseIdx(p.phase) >= i).length;
      const phaseTotal = aliveReached + dropReached;

      const alivePassed = isLast ? 0 : alive.filter(p => phaseIdx(p.phase) > i).length;
      const aliveStaying = alive.filter(p => phaseIdx(p.phase) === i).length;
      const dropHere = [...dropouts, ...paused].filter(p => phaseIdx(p.phase) === i).length;
      const dropPassed = dropReached - dropHere;

      const greenCount = alivePassed + dropPassed;
      const yellowCount2 = aliveStaying;
      const redCount2 = dropHere;

      const greenPct = phaseTotal > 0 ? Math.round(greenCount / phaseTotal * 100) : 0;
      const yellowPct = phaseTotal > 0 ? Math.round(yellowCount2 / phaseTotal * 100) : 0;
      const redPct2 = phaseTotal > 0 ? Math.round(redCount2 / phaseTotal * 100) : 0;
      const barWidthPct = total > 0 ? Math.max(Math.round(phaseTotal / total * 100), phaseTotal > 0 ? 8 : 0) : 0;

      html += `<div class="rpt-funnel-row">
        <div class="rpt-funnel-label">${funnelLabels[i]}</div>
        <div class="rpt-funnel-bar-wrap">
          <div class="rpt-funnel-split" style="width:${barWidthPct}%;">
            ${greenCount > 0 ? `<div class="rpt-funnel-passed" style="width:${greenPct}%;cursor:pointer;" onclick="_showFunnelList(${i},'passed')" title="Đã chuyển tiếp: ${greenCount}"><span>${greenCount}</span></div>` : ''}
            ${yellowCount2 > 0 ? `<div class="rpt-funnel-current" style="width:${yellowPct}%;cursor:pointer;" onclick="_showFunnelList(${i},'staying')" title="Đang ở đây: ${yellowCount2}"><span>${yellowCount2}</span></div>` : ''}
            ${redCount2 > 0 ? `<div class="rpt-funnel-drop" style="width:${redPct2}%;cursor:pointer;" onclick="_showFunnelList(${i},'dropped')" title="Drop-out: ${redCount2}"><span>${redCount2}</span></div>` : ''}
          </div>
        </div>
        <div class="rpt-funnel-num">${phaseTotal}</div>
      </div>`;
    });
    html += `<div style="margin-top:10px;display:flex;gap:10px;font-size:10px;font-weight:600;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span> Đã chuyển tiếp</span>
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Đang ở GĐ này</span>
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span> Drop-out tại GĐ này</span>
    </div>
    <div style="font-size:10px;color:var(--text3);margin-top:4px;">💡 Bấm vào mảng màu để xem danh sách hồ sơ</div>`;
  }
  html += '</div></div>';

  // ═══════════════════════════════════════════════════
  // MODULE 3: XU HƯỚNG THEO KỲ (fixed data + clean chart)
  // ═══════════════════════════════════════════════════
  const semesters = (allSemesters || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const semIds = semesters.map(s => s.id);
  const semLabels = semesters.map(s => s.name || '?');

  // Count ALL profiles (across semesters) per semester that reached each phase
  // Use allProfiles (full dataset) not profiles (current-semester filtered)
  function countAllBySem(minIdx) {
    return semIds.map(sid => {
      const semProfiles = (allProfiles || []).filter(p => p.semester_id === sid);
      // Filter by scope if not system
      const scopeFiltered = activeCodes
        ? semProfiles.filter(p => activeCodes.includes(p.ndd_staff_code))
        : (allScopeCodes.length > 0
          ? semProfiles.filter(p => allScopeCodes.includes(p.ndd_staff_code))
          : semProfiles);
      return scopeFiltered.filter(p => phaseIdx(p.phase || 'chakki') >= minIdx).length;
    });
  }

  const trendLines = [
    { label: 'Hapja', data: countAllBySem(0), color: '#f59e0b' },
    { label: 'TV Hình', data: countAllBySem(1), color: '#ef4444' },
    { label: 'TV', data: countAllBySem(2), color: '#6366f1' },
    { label: 'BB', data: countAllBySem(3), color: '#22c55e' },
    { label: 'Center', data: countAllBySem(4), color: '#8b5cf6' },
  ];

  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">📈 XU HƯỚNG THEO KỲ</div>
    <div>`;

  if (semesters.length === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có kỳ khai giảng</div>';
  } else {
    // Bigger chart with proper spacing
    const W = 360, H = 200, PAD_L = 36, PAD_R = 20, PAD_T = 24, PAD_B = 44;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const maxVal = Math.max(...trendLines.flatMap(l => l.data), 1);
    const n = semIds.length;

    function getX(i) { return PAD_L + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW); }
    function getY(v) { return PAD_T + chartH - (v / maxVal) * chartH; }

    let svg = '';

    // Background
    svg += `<rect x="${PAD_L}" y="${PAD_T}" width="${chartW}" height="${chartH}" fill="var(--surface2)" rx="4" opacity="0.3"/>`;

    // Grid lines + Y labels
    const gridLines = Math.min(maxVal, 5);
    for (let g = 0; g <= gridLines; g++) {
      const y = PAD_T + (g / gridLines) * chartH;
      const val = Math.round(maxVal * (1 - g / gridLines));
      svg += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4,3"/>`;
      svg += `<text x="${PAD_L - 6}" y="${y + 3}" text-anchor="end" fill="var(--text3)" font-size="9" font-weight="600">${val}</text>`;
    }

    // Vertical grid + X labels
    semLabels.forEach((lbl, i) => {
      const x = getX(i);
      svg += `<line x1="${x}" y1="${PAD_T}" x2="${x}" y2="${PAD_T + chartH}" stroke="var(--border)" stroke-width="0.3" stroke-dasharray="2,4"/>`;
      // Multi-line label if long
      const parts = lbl.split('/');
      if (parts.length === 2) {
        svg += `<text x="${x}" y="${H - PAD_B + 16}" text-anchor="middle" fill="var(--text2)" font-size="9" font-weight="700">${parts[0]}/</text>`;
        svg += `<text x="${x}" y="${H - PAD_B + 27}" text-anchor="middle" fill="var(--text2)" font-size="9" font-weight="700">${parts[1]}</text>`;
      } else {
        svg += `<text x="${x}" y="${H - PAD_B + 18}" text-anchor="middle" fill="var(--text2)" font-size="9" font-weight="700">${lbl}</text>`;
      }
    });

    // Build collision map for overlapping dots
    const dotMap = {};
    trendLines.forEach((line, li) => {
      line.data.forEach((v, si) => {
        const key = `${si}_${v}`;
        if (!dotMap[key]) dotMap[key] = [];
        dotMap[key].push(li);
      });
    });

    // Lines + dots with offset for overlapping values
    trendLines.forEach((line, li) => {
      // Draw polyline
      if (n > 1) {
        const points = line.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
        svg += `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
      }

      // Draw dots + labels
      line.data.forEach((v, si) => {
        const key = `${si}_${v}`;
        const group = dotMap[key];
        const offsetIdx = group.indexOf(li);
        // Offset overlapping dots horizontally instead of vertically for clarity
        const offsetX = group.length > 1 ? (offsetIdx - (group.length - 1) / 2) * 9 : 0;
        const cx = getX(si) + offsetX;
        const cy = getY(v);

        svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${line.color}" stroke="white" stroke-width="1.5"/>`;
        if (v > 0) {
          // Label above dot, offset if multiple
          const labelY = cy - 7 - (group.length > 1 ? offsetIdx * 0 : 0);
          svg += `<text x="${cx}" y="${labelY}" text-anchor="middle" fill="${line.color}" font-size="8" font-weight="800">${v}</text>`;
        }
      });
    });

    html += `<div class="rpt-trend-card">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${svg}</svg>
      <div class="rpt-legend">
        ${trendLines.map(l => `<span class="rpt-legend-item"><span class="rpt-legend-dot" style="background:${l.color};"></span>${l.label}</span>`).join('')}
      </div>
      <div style="font-size:10px;color:var(--text3);text-align:center;margin-top:4px;">Mỗi kỳ: số hồ sơ đạt đến giai đoạn tương ứng</div>
    </div>`;
  }
  html += '</div></div>';


  // ═══════════════════════════════════════════════════
  // MODULE 4: HOẠT ĐỘNG NDD
  // ═══════════════════════════════════════════════════
  const nddStats = {};
  profiles.forEach(p => {
    if (!p.ndd) return;
    if (!nddStats[p.ndd]) nddStats[p.ndd] = { code: p.ndd, alive: 0, dropout: 0, total: 0, phases: {}, dormant: 0 };
    const s = nddStats[p.ndd];
    s.total++;
    if (p.fruit_status === 'dropout' || p.fruit_status === 'pause') { s.dropout++; }
    else {
      s.alive++;
      const recs = recMap[p.id] || [];
      const sess = sessMap[p.id] || [];
      const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(r => new Date(r.created_at).getTime())];
      const lastAct = allDates.length > 0 ? Math.max(...allDates) : 0;
      if (lastAct && (now - lastAct) > 14 * DAY) s.dormant++;
      s.phases[p.phase] = (s.phases[p.phase] || 0) + 1;
    }
  });

  const nddList = Object.values(nddStats).sort((a, b) => b.alive - a.alive);

  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">
      👥 TỔNG QUAN HOẠT ĐỘNG NDD
      <span style="font-size:11px;font-weight:500;color:var(--text3);">(${nddList.length} NDD)</span>
    </div>
    <div>`;

  if (nddList.length === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    html += '<div class="rpt-ndd-table">';
    html += `<div class="rpt-ndd-header">
      <div class="rpt-ndd-name">NDD</div>
      <div class="rpt-ndd-num">Alive</div>
      <div class="rpt-ndd-num">Drop</div>
      <div class="rpt-ndd-num">😴</div>
      <div class="rpt-ndd-bar">Phân bố Phase</div>
    </div>`;

    nddList.forEach((s, idx) => {
      const staff = allStaff.find(x => x.staff_code === s.code);
      const name = staff ? (staff.nickname || staff.full_name || s.code) : s.code;
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';

      const phaseBar = PHASES_ORDER.map((ph, pi) => {
        const cnt = s.phases[ph] || (ph === 'chakki' ? (s.phases['new'] || 0) + (s.phases['chakki'] || 0) : 0);
        const pct = s.alive > 0 ? Math.round(cnt / s.alive * 100) : 0;
        return pct > 0 ? `<div style="width:${pct}%;background:${funnelColors[pi]};height:100%;border-radius:3px;" title="${PHASE_LABELS[ph]||ph}: ${cnt}"></div>` : '';
      }).join('');

      html += `<div class="rpt-ndd-row">
        <div class="rpt-ndd-name">${medal} ${name}</div>
        <div class="rpt-ndd-num" style="color:var(--green);font-weight:700;">${s.alive}</div>
        <div class="rpt-ndd-num" style="color:${s.dropout > 0 ? '#ef4444' : 'var(--text3)'};">${s.dropout}</div>
        <div class="rpt-ndd-num" style="color:${s.dormant > 0 ? '#f59e0b' : 'var(--text3)'};">${s.dormant}</div>
        <div class="rpt-ndd-bar"><div class="rpt-phase-bar">${phaseBar}</div></div>
      </div>`;
    });

    html += '</div>';
  }

  html += '</div></div>';

  // ═══════════════════════════════════════════════════
  // MODULE 5: SO SÁNH GIỮA CÁC ĐƠN VỊ
  // ═══════════════════════════════════════════════════
  // Only show at the "tổng thể" level when there are sub-units to compare
  // Compare only direct children (same type level)
  const compareType = scopeUnits.length > 0 ? scopeUnits[0].type : null;
  const compareUnits = scopeUnits.filter(u => u.type === compareType);
  const typeLabels = { area: 'Khu vực', group: 'Nhóm', team: 'Tổ' };

  if (subUnitIdx === null && compareUnits.length >= 2) {
    // Compute stats per unit
    const unitStats = compareUnits.map(u => {
      const codeSet = new Set(u.codes);
      const uProfiles = Array.from(profileMap.values()).filter(p => codeSet.has(p.ndd));
      const uAlive = uProfiles.filter(p => p.fruit_status !== 'dropout' && p.fruit_status !== 'pause');
      const uDrop = uProfiles.filter(p => p.fruit_status === 'dropout' || p.fruit_status === 'pause');
      const uDormant = uAlive.filter(p => {
        const recs = recMap[p.id] || [];
        const sess = sessMap[p.id] || [];
        const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(r => new Date(r.created_at).getTime())];
        const last = allDates.length > 0 ? Math.max(...allDates) : 0;
        return last && (now - last) > 14 * DAY;
      }).length;

      // Conversion: how many alive moved past chakki
      const converted = uAlive.filter(p => phaseIdx(p.phase) >= 2).length; // at least TV
      const convRate = uAlive.length > 0 ? Math.round(converted / uAlive.length * 100) : 0;

      return {
        label: u.label.trim().replace(/^└\s*/, ''),
        total: uProfiles.length,
        alive: uAlive.length,
        dropout: uDrop.length,
        dropPct: uProfiles.length > 0 ? Math.round(uDrop.length / uProfiles.length * 100) : 0,
        dormant: uDormant,
        convRate,
      };
    }).sort((a, b) => b.alive - a.alive);

    html += `<div class="rpt-section">
      <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">
        🏆 SO SÁNH ${(typeLabels[compareType] || 'Đơn vị').toUpperCase()}
        <span style="font-size:11px;font-weight:500;color:var(--text3);">(${compareUnits.length} ${typeLabels[compareType] || 'đơn vị'})</span>
      </div>
      <div>`;

    html += '<div class="rpt-compare-table">';
    html += `<div class="rpt-compare-header">
      <div class="rpt-compare-name">${typeLabels[compareType] || 'Đơn vị'}</div>
      <div class="rpt-compare-num">Tổng</div>
      <div class="rpt-compare-num">🟢</div>
      <div class="rpt-compare-num">🔴</div>
      <div class="rpt-compare-num">%Drop</div>
      <div class="rpt-compare-num">😴</div>
      <div class="rpt-compare-num">→TV%</div>
    </div>`;

    unitStats.forEach((s, idx) => {
      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '';
      const dropColor = s.dropPct > 30 ? '#ef4444' : s.dropPct > 15 ? '#f59e0b' : 'var(--green)';
      const convColor = s.convRate >= 50 ? 'var(--green)' : s.convRate >= 25 ? '#f59e0b' : '#ef4444';

      html += `<div class="rpt-compare-row">
        <div class="rpt-compare-name">${medal} ${s.label}</div>
        <div class="rpt-compare-num" style="font-weight:700;">${s.total}</div>
        <div class="rpt-compare-num" style="color:var(--green);font-weight:700;">${s.alive}</div>
        <div class="rpt-compare-num" style="color:${s.dropout > 0 ? '#ef4444' : 'var(--text3)'};">${s.dropout}</div>
        <div class="rpt-compare-num" style="color:${dropColor};font-weight:700;">${s.dropPct}%</div>
        <div class="rpt-compare-num" style="color:${s.dormant > 0 ? '#f59e0b' : 'var(--text3)'};">${s.dormant}</div>
        <div class="rpt-compare-num" style="color:${convColor};font-weight:700;">${s.convRate}%</div>
      </div>`;
    });

    html += '</div></div></div>';
  }

  el.innerHTML = html;
}

// ── Funnel click-to-view profile list ──
const FUNNEL_PHASE_LABELS = ['Hapja/Chakki', 'TV Hình+', 'Group TV+', 'BB+', 'Center'];
const FUNNEL_TYPE_LABELS = { passed: '✅ Đã chuyển tiếp', staying: '🟡 Đang ở giai đoạn', dropped: '🔴 Drop-out/Pause' };

function _showFunnelList(phaseIdx, type) {
  const fp = window._funnelProfiles;
  if (!fp || !fp[phaseIdx]) return;
  const profiles = fp[phaseIdx][type] || [];
  const title = `${FUNNEL_PHASE_LABELS[phaseIdx]} — ${FUNNEL_TYPE_LABELS[type] || type}`;

  if (profiles.length === 0) {
    showToast('Không có hồ sơ');
    return;
  }

  // Use recordModal to show the list
  document.getElementById('recordModalTitle').textContent = `📋 ${title} (${profiles.length})`;
  let listHtml = '<div style="display:flex;flex-direction:column;gap:6px;">';
  profiles.forEach(p => {
    const status = p.fruit_status === 'dropout' ? '🔴' : p.fruit_status === 'pause' ? '⏸️' : '🟢';
    const phase = (typeof PHASE_LABELS !== 'undefined' && PHASE_LABELS[p.phase]) || p.phase || 'chakki';
    const ndd = p.ndd || p.ndd_staff_code || '';
    const nddLabel = ndd ? (() => { const s = allStaff.find(x => x.staff_code === ndd); return s ? (s.nickname || s.full_name || ndd) : ndd; })() : '';
    listHtml += `<div onclick="closeModal('addRecordModal');openProfileById('${p.id}')"
      style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--surface2);border-radius:10px;cursor:pointer;border:1px solid var(--border);transition:background 0.15s;"
      onmouseover="this.style.background='var(--chip-bg)'" onmouseout="this.style.background='var(--surface2)'">
      <span style="font-size:14px;">${status}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.full_name || '?'}</div>
        <div style="font-size:10px;color:var(--text3);">${phase}${nddLabel ? ` · NDD: ${nddLabel}` : ''}</div>
      </div>
      <span style="font-size:11px;color:var(--text3);">›</span>
    </div>`;
  });
  listHtml += '</div>';

  document.getElementById('recordModalBody').innerHTML = listHtml;
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  document.getElementById('addRecordModal').classList.add('open');
}
