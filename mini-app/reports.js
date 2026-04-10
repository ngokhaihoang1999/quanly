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
        const convRate = i > 0 && funnelData[i-1].count > 0 ? Math.round(d.count / funnelData[i-1].count * 100) : 100;
        // Dropout at this phase
        const phaseKey = PHASES_ORDER[i];
        const doAtPhase = dropouts.filter(p => p.phase === phaseKey || (phaseKey === 'chakki' && (p.phase === 'new' || p.phase === 'chakki'))).length;
        const doPct = funnelData[i].count > 0 ? Math.round(doAtPhase / (funnelData[i].count + doAtPhase) * 100) : 0;
        html += `<div class="rpt-funnel-row">
          <div class="rpt-funnel-label">${funnelLabels[i]}</div>
          <div class="rpt-funnel-bar-wrap">
            <div class="rpt-funnel-bar" style="width:${d.pct}%;background:${funnelColors[i]};"></div>
          </div>
          <div class="rpt-funnel-num">${d.count} <span style="color:var(--text3);font-size:10px;">(${d.pct}%)</span></div>
          <div class="rpt-funnel-conv">${i > 0 ? `↓${convRate}%` : ''}</div>
        </div>
        ${doAtPhase > 0 ? `<div class="rpt-funnel-dropout">💔 Drop-out tại giai đoạn này: ${doAtPhase} (${doPct}%)</div>` : ''}`;
      });
      // Total dropout
      const dropoutRate = total > 0 ? Math.round(dropouts.length / total * 100) : 0;
      html += `<div style="margin-top:10px;padding:8px 12px;background:rgba(239,68,68,0.08);border-radius:8px;font-size:12px;color:#ef4444;font-weight:600;">
        📉 Tổng rơi rụng: ${dropouts.length}/${total} (${dropoutRate}%)
      </div>`;
    }
    html += '</div></div>';

    // ═════════════════════════════════════════════════════
    // MODULE 3: XU HƯỚNG THEO THÁNG (6 tháng)
    // ═════════════════════════════════════════════════════
    const months = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: `T${d.getMonth()+1}` });
    }

    function countByMonth(items, dateField = 'created_at') {
      const counts = {};
      months.forEach(m => counts[m.key] = 0);
      items.forEach(item => {
        const d = item[dateField];
        if (!d) return;
        const key = d.substring(0, 7);
        if (counts[key] !== undefined) counts[key]++;
      });
      return months.map(m => counts[m.key]);
    }

    const approvedHapja = allHapja.filter(h => h.status === 'approved');
    const bbRecords = allRecords.filter(r => r.record_type === 'bien_ban');
    const moKtRecords = allRecords.filter(r => r.record_type === 'mo_kt');

    const trendSeries = [
      { label: '🍎 Hapja duyệt', data: countByMonth(approvedHapja), color: '#f59e0b' },
      { label: '📝 BC BB', data: countByMonth(bbRecords), color: '#22c55e' },
      { label: '📖 Mở KT', data: countByMonth(moKtRecords), color: '#6366f1' },
    ];

    html += `<div class="rpt-section">
      <div class="rpt-title" onclick="this.nextElementSibling.classList.toggle('rpt-hidden')">📈 XU HƯỚNG (3 tháng)</div>
      <div>`;

    trendSeries.forEach(series => {
      const max = Math.max(...series.data, 1);
      const total = series.data.reduce((a,b) => a+b, 0);
      html += `<div class="rpt-trend-card">
        <div class="rpt-trend-header">
          <span>${series.label}</span>
          <span class="rpt-trend-total" style="color:${series.color};">${total}</span>
        </div>
        <div class="rpt-bar-chart">
          ${series.data.map((val, i) => `
            <div class="rpt-bar-col">
              <div class="rpt-bar-val">${val}</div>
              <div class="rpt-bar" style="height:${Math.max(val/max*60, val > 0 ? 4 : 0)}px;background:${series.color};"></div>
              <div class="rpt-bar-label">${months[i].label}</div>
            </div>
          `).join('')}
        </div>
      </div>`;
    });

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
