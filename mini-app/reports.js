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
  const alive = profiles.filter(p => p.fruit_status !== 'dropout');
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
  console.log('[RPT v11] Rendering:', activeLabel, 'profiles:', total, 'alive:', alive.length, 'drop:', dropouts.length);
  // Debug: log each dropout phase
  dropouts.forEach(d => console.log('[RPT] dropout:', d.full_name, 'phase:', d.phase, 'idx:', phaseIdx(d.phase)));

  html += `<div style="margin-bottom:16px;">
    <div style="font-size:15px;font-weight:700;margin-bottom:4px;">📊 Báo cáo · ${activeLabel || 'Đơn vị'}</div>
    <div style="font-size:11px;color:var(--text2);margin-bottom:6px;">Kỳ: ${semName} · ${total} hồ sơ · ${alive.length} alive · ${dropouts.length} dropout</div>`;
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

  alive.forEach(p => {
    const recs = recMap[p.id] || [];
    const sess = sessMap[p.id] || [];
    const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(s => new Date(s.created_at).getTime())];
    const lastActivity = allDates.length > 0 ? Math.max(...allDates) : (p.created_at ? new Date(p.created_at).getTime() : 0);
    const daysSince = lastActivity ? Math.floor((now - lastActivity) / DAY) : 999;

    if (daysSince > 14) {
      warnings.push({ type: 'dormant', severity: 'red', label: `🔴 ${p.full_name} — ${daysSince} ngày không hoạt động`, profile: p, days: daysSince });
    }
    if (!['center','completed'].includes(p.phase)) {
      const createdTime = p.created_at ? new Date(p.created_at).getTime() : 0;
      const daysSinceCreated = createdTime ? Math.floor((now - createdTime) / DAY) : 0;
      if (daysSinceCreated > 30 && daysSince > 14) {
        warnings.push({ type: 'stuck', severity: 'yellow', label: `🟡 ${p.full_name} — kẹt giai đoạn ${PHASE_LABELS[p.phase]||p.phase} > 30 ngày`, profile: p });
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
      warnings.push({ type: 'no_tvv', severity: 'blue', label: `🔵 ${p.full_name} — chưa có TVV`, profile: p });
    }
    if (!hasGVBB && ['tu_van','bb','center'].includes(p.phase)) {
      warnings.push({ type: 'no_gvbb', severity: 'blue', label: `🔵 ${p.full_name} — chưa có GVBB`, profile: p });
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

  // ═══════════════════════════════════════════════════
  // MODULE 2: PHỄU CHUYỂN ĐỔI
  // ═══════════════════════════════════════════════════
  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">🔄 PHỄU CHUYỂN ĐỔI</div>
    <div>`;

  if (total === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có dữ liệu</div>';
  } else {
    PHASES_ORDER.forEach((phase, i) => {
      const isLast = i === PHASES_ORDER.length - 1;
      // Everyone who reached at least this phase
      const aliveReached = alive.filter(p => phaseIdx(p.phase) >= i).length;
      const dropReached = dropouts.filter(p => phaseIdx(p.phase) >= i).length;
      const phaseTotal = aliveReached + dropReached;

      // Split alive into: passed (moved beyond) vs staying (at exactly this phase)
      const alivePassed = isLast ? 0 : alive.filter(p => phaseIdx(p.phase) > i).length;
      const aliveStaying = alive.filter(p => phaseIdx(p.phase) === i).length;
      // Dropout at exactly this phase
      const dropHere = dropouts.filter(p => phaseIdx(p.phase) === i).length;
      // Dropout that passed through (reached higher phases before dropping)
      const dropPassed = dropReached - dropHere;

      // Green = passed (alive + dropout that moved beyond)
      const greenCount = alivePassed + dropPassed;
      // Yellow = alive staying at this phase
      const yellowCount = aliveStaying;
      // Red = dropped out at exactly this phase
      const redCount = dropHere;

      const greenPct = phaseTotal > 0 ? Math.round(greenCount / phaseTotal * 100) : 0;
      const yellowPct = phaseTotal > 0 ? Math.round(yellowCount / phaseTotal * 100) : 0;
      const redPct = phaseTotal > 0 ? Math.round(redCount / phaseTotal * 100) : 0;
      const barWidthPct = total > 0 ? Math.max(Math.round(phaseTotal / total * 100), phaseTotal > 0 ? 8 : 0) : 0;

      html += `<div class="rpt-funnel-row">
        <div class="rpt-funnel-label">${funnelLabels[i]}</div>
        <div class="rpt-funnel-bar-wrap">
          <div class="rpt-funnel-split" style="width:${barWidthPct}%;">
            ${greenCount > 0 ? `<div class="rpt-funnel-passed" style="width:${greenPct}%;"><span>${greenCount}</span></div>` : ''}
            ${yellowCount > 0 ? `<div class="rpt-funnel-current" style="width:${yellowPct}%;"><span>${yellowCount}</span></div>` : ''}
            ${redCount > 0 ? `<div class="rpt-funnel-drop" style="width:${redPct}%;"><span>${redCount}</span></div>` : ''}
          </div>
        </div>
        <div class="rpt-funnel-num">${phaseTotal}</div>
      </div>`;
    });
    html += `<div style="margin-top:10px;display:flex;gap:10px;font-size:10px;font-weight:600;flex-wrap:wrap;">
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span> Đã chuyển tiếp</span>
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Đang ở GĐ này</span>
      <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span> Drop-out tại GĐ này</span>
    </div>`;
  }
  html += '</div></div>';

  // ═══════════════════════════════════════════════════
  // MODULE 3: XU HƯỚNG THEO KỲ
  // ═══════════════════════════════════════════════════
  const semesters = (allSemesters || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const semIds = semesters.map(s => s.id);
  const semLabels = semesters.map(s => s.name || '?');

  // Count profiles per semester that reached each phase
  function countBySem(minIdx) {
    return semIds.map(sid => {
      return profiles.filter(p => {
        const pFull = allProfiles.find(x => x.id === p.id);
        return (pFull?.semester_id === sid) && phaseIdx(p.phase) >= minIdx;
      }).length;
    });
  }

  const trendLines = [
    { label: 'Hapja', data: countBySem(0), color: '#f59e0b' },
    { label: 'TV Hình', data: countBySem(1), color: '#ef4444' },
    { label: 'TV', data: countBySem(2), color: '#6366f1' },
    { label: 'BB', data: countBySem(3), color: '#22c55e' },
    { label: 'Center', data: countBySem(4), color: '#8b5cf6' },
  ];

  html += `<div class="rpt-section">
    <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">📈 XU HƯỚNG THEO KỲ</div>
    <div>`;

  if (semesters.length === 0) {
    html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có kỳ khai giảng</div>';
  } else {
    const W = 300, H = 150, PAD_L = 30, PAD_R = 10, PAD_T = 20, PAD_B = 28;
    const chartW = W - PAD_L - PAD_R;
    const chartH = H - PAD_T - PAD_B;
    const maxVal = Math.max(...trendLines.flatMap(l => l.data), 1);
    const n = semIds.length;

    function getX(i) { return PAD_L + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW); }
    function getY(v) { return PAD_T + chartH - (v / maxVal) * chartH; }

    let svg = '';
    // Grid
    for (let g = 0; g <= 4; g++) {
      const y = PAD_T + (g / 4) * chartH;
      const val = Math.round(maxVal * (1 - g / 4));
      svg += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
      svg += `<text x="${PAD_L - 4}" y="${y + 3}" text-anchor="end" fill="var(--text3)" font-size="8" font-weight="600">${val}</text>`;
    }
    // X labels
    semLabels.forEach((lbl, i) => {
      svg += `<text x="${getX(i)}" y="${H - 4}" text-anchor="middle" fill="var(--text2)" font-size="8" font-weight="700">${lbl}</text>`;
    });
    // Build collision map to offset overlapping dots
    const dotPositions = {}; // key = `semIdx_value` => count
    trendLines.forEach((line, li) => {
      line.data.forEach((v, si) => {
        const key = `${si}_${v}`;
        if (!dotPositions[key]) dotPositions[key] = [];
        dotPositions[key].push(li);
      });
    });

    // Lines + dots
    trendLines.forEach((line, li) => {
      if (n === 1) {
        const key = `0_${line.data[0]}`;
        const group = dotPositions[key];
        const offsetIdx = group.indexOf(li);
        const offsetY = group.length > 1 ? (offsetIdx - (group.length - 1) / 2) * 10 : 0;
        const cx = getX(0);
        const cy = getY(line.data[0]) + offsetY;
        svg += `<circle cx="${cx}" cy="${cy}" r="4" fill="${line.color}" opacity="0.9"/>`;
        if (line.data[0] > 0) svg += `<text x="${cx + 8}" y="${cy + 3}" fill="${line.color}" font-size="8" font-weight="700">${line.data[0]}</text>`;
      } else {
        const points = line.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
        svg += `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
        line.data.forEach((v, i) => {
          const key = `${i}_${v}`;
          const group = dotPositions[key];
          const offsetIdx = group.indexOf(li);
          const offsetY = group.length > 1 ? (offsetIdx - (group.length - 1) / 2) * 8 : 0;
          const cy = getY(v) + offsetY;
          svg += `<circle cx="${getX(i)}" cy="${cy}" r="3" fill="${line.color}"/>`;
          if (v > 0) svg += `<text x="${getX(i)}" y="${cy - 5}" text-anchor="middle" fill="${line.color}" font-size="7" font-weight="700">${v}</text>`;
        });
      }
    });

    html += `<div class="rpt-trend-card">
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${svg}</svg>
      <div class="rpt-legend">
        ${trendLines.map(l => `<span class="rpt-legend-item"><span class="rpt-legend-dot" style="background:${l.color};"></span>${l.label}</span>`).join('')}
      </div>
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
    if (p.fruit_status === 'dropout') { s.dropout++; }
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
      const uAlive = uProfiles.filter(p => p.fruit_status !== 'dropout');
      const uDrop = uProfiles.filter(p => p.fruit_status === 'dropout');
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
