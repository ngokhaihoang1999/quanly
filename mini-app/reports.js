// ============ REPORTS – Báo cáo Số liệu Truyền đạo ============
// Visible for GYJN+ (scope >= team)
// Uses existing data: allProfiles, allStaff, structureData, sbFetch

async function loadReports() {
  const el = document.getElementById('reportContent');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text2);font-size:13px;">⏳ Đang phân tích dữ liệu...</div>';

  try {
    const pos = getCurrentPosition();
    const scope = getScope();
    const myCode = getEffectiveStaffCode();
    const semF = currentSemesterId ? `&semester_id=eq.${currentSemesterId}` : '';

    // ── Collect staff codes in scope ──
    let unitStaffCodes = [];
    let unitLabel = '';
    if (scope === 'system') {
      unitLabel = 'Toàn hệ thống';
      unitStaffCodes = allStaff.map(s => s.staff_code);
    } else if (scope === 'area') {
      const myArea = (structureData||[]).find(a => a.yjyn_staff_code === myCode);
      if (myArea) {
        unitLabel = myArea.name;
        (myArea.org_groups||[]).forEach(g => (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code))));
      } else {
        for (const a of (structureData||[])) {
          for (const g of (a.org_groups||[])) {
            for (const t of (g.teams||[])) {
              if ((t.staff||[]).some(m => m.staff_code === myCode)) {
                unitLabel = a.name;
                (a.org_groups||[]).forEach(g2 => (g2.teams||[]).forEach(t2 => (t2.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code))));
                break;
              }
            }
            if (unitLabel) break;
          }
          if (unitLabel) break;
        }
      }
    } else if (scope === 'group') {
      for (const a of (structureData||[])) {
        const g = (a.org_groups||[]).find(g => g.tjn_staff_code === myCode);
        if (g) {
          unitLabel = g.name;
          (g.teams||[]).forEach(t => (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code)));
          break;
        }
      }
    } else {
      // team scope
      for (const a of (structureData||[])) {
        for (const g of (a.org_groups||[])) {
          const t = (g.teams||[]).find(t => t.gyjn_staff_code === myCode || t.bgyjn_staff_code === myCode || (t.staff||[]).some(m => m.staff_code === myCode));
          if (t) {
            unitLabel = t.name;
            (t.staff||[]).forEach(m => unitStaffCodes.push(m.staff_code));
            break;
          }
        }
        if (unitLabel) break;
      }
    }
    unitStaffCodes = [...new Set(unitStaffCodes)];

    // ── Fetch data in parallel ──
    const codeFilter = unitStaffCodes.length > 0 ? unitStaffCodes.map(c => `"${c}"`).join(',') : '';
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

    // Build unique profiles map (NDD scope A)
    const profileMap = new Map();
    allRoles.forEach(r => {
      if (r.role_type !== 'ndd') return;
      const p = r.fruit_groups?.profiles;
      const pid = r.fruit_groups?.profile_id;
      if (!p || !pid) return;
      // Semester filter
      if (currentSemesterId) {
        const pFull = allProfiles.find(x => x.id === pid);
        if (pFull && pFull.semester_id !== currentSemesterId) return;
      }
      if (!profileMap.has(pid)) {
        profileMap.set(pid, { ...p, id: pid, ndd: r.staff_code });
      }
    });
    const profiles = Array.from(profileMap.values());
    const alive = profiles.filter(p => p.fruit_status !== 'dropout');
    const dropouts = profiles.filter(p => p.fruit_status === 'dropout');

    // Build records map: profile_id -> [{record_type, created_at}]
    const recMap = {};
    allRecords.forEach(r => {
      if (!recMap[r.profile_id]) recMap[r.profile_id] = [];
      recMap[r.profile_id].push(r);
    });
    // Sessions map
    const sessMap = {};
    allSessions.forEach(s => {
      if (!sessMap[s.profile_id]) sessMap[s.profile_id] = [];
      sessMap[s.profile_id].push(s);
    });

    // ── Build HTML ──
    let html = '';
    const semName = currentSemesterId ? (allSemesters.find(s => s.id === currentSemesterId)?.name || '') : 'Tất cả';

    // HEADER
    html += `<div style="margin-bottom:16px;">
      <div style="font-size:15px;font-weight:700;margin-bottom:2px;">📊 Báo cáo · ${unitLabel || 'Đơn vị'}</div>
      <div style="font-size:11px;color:var(--text2);">Kỳ: ${semName} · ${profiles.length} hồ sơ · ${alive.length} alive · ${dropouts.length} dropout</div>
    </div>`;

    // ═════════════════════════════════════════════════════
    // MODULE 1: CẢNH BÁO SỚM
    // ═════════════════════════════════════════════════════
    const now = Date.now();
    const DAY = 86400000;
    const warnings = [];

    alive.forEach(p => {
      const recs = recMap[p.id] || [];
      const sess = sessMap[p.id] || [];
      const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(s => new Date(s.created_at).getTime())];
      const lastActivity = allDates.length > 0 ? Math.max(...allDates) : (p.created_at ? new Date(p.created_at).getTime() : 0);
      const daysSince = lastActivity ? Math.floor((now - lastActivity) / DAY) : 999;

      // Dormant: >14 days no activity
      if (daysSince > 14) {
        warnings.push({ type: 'dormant', severity: 'red', label: `🔴 ${p.full_name} — ${daysSince} ngày không hoạt động`, profile: p, days: daysSince });
      }

      // Stuck: >30 days same phase (except center)
      if (!['center','completed'].includes(p.phase)) {
        const createdTime = p.created_at ? new Date(p.created_at).getTime() : 0;
        const daysSinceCreated = createdTime ? Math.floor((now - createdTime) / DAY) : 0;
        if (daysSinceCreated > 30 && daysSince > 14) {
          warnings.push({ type: 'stuck', severity: 'yellow', label: `🟡 ${p.full_name} — kẹt giai đoạn ${PHASE_LABELS[p.phase]||p.phase} > 30 ngày`, profile: p });
        }
      }
    });

    // Pending hapja
    const pendingHapja = allHapja.filter(h => h.status === 'pending');
    pendingHapja.forEach(h => {
      const daysPending = Math.floor((now - new Date(h.created_at).getTime()) / DAY);
      if (daysPending > 7) {
        warnings.push({ type: 'hapja', severity: 'orange', label: `🟠 Hapja chờ ${daysPending} ngày (bởi ${h.created_by})` });
      }
    });

    // Missing roles
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

    // Sort: red > orange > yellow > blue
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
      <div class="${warnings.length === 0 ? '' : ''}">`;

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

    // ═════════════════════════════════════════════════════
    // MODULE 2: PHỄU CHUYỂN ĐỔI
    // ═════════════════════════════════════════════════════
    const PHASES_ORDER = ['chakki', 'tu_van_hinh', 'tu_van', 'bb', 'center'];
    const PHASE_IDX = {};
    PHASES_ORDER.forEach((p, i) => PHASE_IDX[p] = i);
    PHASE_IDX['new'] = 0;
    PHASE_IDX['completed'] = 4;

    function phaseReached(profilePhase) {
      return PHASE_IDX[profilePhase] !== undefined ? PHASE_IDX[profilePhase] : 0;
    }

    const total = profiles.length;
    const funnelData = PHASES_ORDER.map((phase, idx) => {
      const count = profiles.filter(p => phaseReached(p.phase) >= idx).length;
      return { phase, count, pct: total > 0 ? Math.round(count / total * 100) : 0 };
    });

    const funnelColors = ['#f59e0b', '#ef4444', '#6366f1', '#22c55e', '#8b5cf6'];
    const funnelLabels = ['🍎 Hapja/Chakki', '🖼️ TV Hình+', '💬 Group TV+', '🎓 BB+', '🏛️ Center'];

    html += `<div class="rpt-section">
      <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">🔄 PHỄU CHUYỂN ĐỔI</div>
      <div>`;

    if (total === 0) {
      html += '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">Chưa có dữ liệu</div>';
    } else {
      funnelData.forEach((d, i) => {
        const isLast = i === PHASES_ORDER.length - 1;

        // 🟢 Passed: alive profiles that moved BEYOND this phase
        const passed = isLast ? 0 : alive.filter(p => phaseReached(p.phase) > i).length;
        // 🟡 Current: alive profiles EXACTLY at this phase
        const current = alive.filter(p => phaseReached(p.phase) === i).length;
        // 🔴 Dropped: dropout profiles that REACHED at least this phase (phase >= i)
        const dropped = dropouts.filter(p => phaseReached(p.phase) >= i).length;

        const phaseTotal = passed + current + dropped;
        const passedPct = phaseTotal > 0 ? Math.round(passed / phaseTotal * 100) : 0;
        const currentPct = phaseTotal > 0 ? Math.round(current / phaseTotal * 100) : 0;
        const droppedPct = phaseTotal > 0 ? Math.round(dropped / phaseTotal * 100) : 0;
        const barWidthPct = total > 0 ? Math.round(phaseTotal / total * 100) : 0;

        html += `<div class="rpt-funnel-row">
          <div class="rpt-funnel-label">${funnelLabels[i]}</div>
          <div class="rpt-funnel-bar-wrap">
            <div class="rpt-funnel-split" style="width:${barWidthPct}%;">
              ${passed > 0 ? `<div class="rpt-funnel-passed" style="width:${passedPct}%;"><span>${passed}</span></div>` : ''}
              ${current > 0 ? `<div class="rpt-funnel-current" style="width:${currentPct}%;"><span>${current}</span></div>` : ''}
              ${dropped > 0 ? `<div class="rpt-funnel-drop" style="width:${droppedPct}%;"><span>${dropped}</span></div>` : ''}
            </div>
          </div>
          <div class="rpt-funnel-num">${phaseTotal}</div>
        </div>`;
      });
      // Legend
      html += `<div style="margin-top:10px;display:flex;gap:10px;font-size:10px;font-weight:600;flex-wrap:wrap;">
        <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#22c55e;"></span> Đã chuyển tiếp</span>
        <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span> Đang ở GĐ này</span>
        <span style="display:flex;align-items:center;gap:3px;"><span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span> Drop-out</span>
      </div>`;
    }
    html += '</div></div>';

    // ═════════════════════════════════════════════════════
    // MODULE 3: XU HƯỚNG THEO KỲ KHAI GIẢNG
    // ═════════════════════════════════════════════════════
    // Group profiles by semester
    const semesters = (allSemesters || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    const semIds = semesters.map(s => s.id);
    const semLabels = semesters.map(s => s.name || '?');

    // Count profiles reaching each phase per semester (cumulative)
    // Hapja = total profiles in that semester (every profile starts from Hapja)
    const allProfilesInScope = profiles; // already scoped
    function countBySem(minPhaseIdx) {
      return semIds.map(sid => allProfilesInScope.filter(p => {
        const pFull = allProfiles.find(x => x.id === p.id);
        return (pFull?.semester_id === sid) && (PHASE_IDX[p.phase] !== undefined ? PHASE_IDX[p.phase] >= minPhaseIdx : false);
      }).length);
    }
    // Hapja = all profiles in semester (phase >= 0, i.e. everyone)
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
      // SVG line chart
      const W = 300, H = 140, PAD_L = 30, PAD_R = 10, PAD_T = 15, PAD_B = 25;
      const chartW = W - PAD_L - PAD_R;
      const chartH = H - PAD_T - PAD_B;
      const maxVal = Math.max(...trendLines.flatMap(l => l.data), 1);
      const n = semIds.length;

      function getX(i) { return PAD_L + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW); }
      function getY(v) { return PAD_T + chartH - (v / maxVal) * chartH; }

      let svgContent = '';
      // Grid lines
      const gridSteps = 4;
      for (let g = 0; g <= gridSteps; g++) {
        const y = PAD_T + (g / gridSteps) * chartH;
        const val = Math.round(maxVal * (1 - g / gridSteps));
        svgContent += `<line x1="${PAD_L}" y1="${y}" x2="${W - PAD_R}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
        svgContent += `<text x="${PAD_L - 4}" y="${y + 3}" text-anchor="end" fill="var(--text3)" font-size="8" font-weight="600">${val}</text>`;
      }
      // X labels
      semLabels.forEach((lbl, i) => {
        const x = getX(i);
        svgContent += `<text x="${x}" y="${H - 4}" text-anchor="middle" fill="var(--text2)" font-size="8" font-weight="700">${lbl}</text>`;
      });
      // Lines + dots
      trendLines.forEach(line => {
        if (n === 1) {
          // Single point
          svgContent += `<circle cx="${getX(0)}" cy="${getY(line.data[0])}" r="4" fill="${line.color}" opacity="0.9"/>`;
          svgContent += `<text x="${getX(0) + 6}" y="${getY(line.data[0]) - 4}" fill="${line.color}" font-size="8" font-weight="700">${line.data[0]}</text>`;
        } else {
          // Polyline
          const points = line.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
          svgContent += `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`;
          // Dots + values
          line.data.forEach((v, i) => {
            svgContent += `<circle cx="${getX(i)}" cy="${getY(v)}" r="3" fill="${line.color}"/>`;
            if (v > 0) svgContent += `<text x="${getX(i)}" y="${getY(v) - 6}" text-anchor="middle" fill="${line.color}" font-size="7" font-weight="700">${v}</text>`;
          });
        }
      });

      html += `<div class="rpt-trend-card">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;">${svgContent}</svg>
        <div class="rpt-legend">
          ${trendLines.map(l => `<span class="rpt-legend-item"><span class="rpt-legend-dot" style="background:${l.color};"></span>${l.label}</span>`).join('')}
        </div>
      </div>`;
    }

    html += '</div></div>';

    // ═════════════════════════════════════════════════════
    // MODULE 4: HOẠT ĐỘNG NHÂN SỰ
    // ═════════════════════════════════════════════════════
    // Build per-NDD stats
    const nddStats = {};
    profiles.forEach(p => {
      if (!p.ndd) return;
      if (!nddStats[p.ndd]) nddStats[p.ndd] = { code: p.ndd, alive: 0, dropout: 0, total: 0, phases: {}, dormant: 0 };
      const s = nddStats[p.ndd];
      s.total++;
      if (p.fruit_status === 'dropout') { s.dropout++; }
      else {
        s.alive++;
        // Check dormant
        const recs = recMap[p.id] || [];
        const sess = sessMap[p.id] || [];
        const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(r => new Date(r.created_at).getTime())];
        const lastAct = allDates.length > 0 ? Math.max(...allDates) : 0;
        if (lastAct && (now - lastAct) > 14 * DAY) s.dormant++;
        // Phase count
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
        const convRate = s.total > 0 ? Math.round((s.alive / s.total) * 100) : 0;

        // Phase distribution mini-bar
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

    el.innerHTML = html;
  } catch (e) {
    console.error('Reports error:', e);
    el.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;font-size:13px;">❌ Lỗi tải báo cáo: ' + e.message + '</div>';
  } finally {
    markFresh('reports');
  }
}
