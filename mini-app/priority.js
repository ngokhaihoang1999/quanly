// ============ PRIORITY TASKS MODULE ============

const PRIORITY_ICONS = {
  overdue_alarms: '⏰',
  duyet_hapja:  '🍎',
  ngu_dong:     '😴',  // Auto-detect: dormant fruit
  thieu_vai_tro:'🔵',  // Auto-detect: missing TVV/GVBB
  sinka_chua_hoan_thien: '📝',
  ket_phase:    '⏳',  // Auto-detect: stuck in phase
  chot_tv_1:    '🔴',  // Chốt TV lần 1 → vào Chakki
  chot_tv_hinh: '🖼️', // Chốt TV lần 2+ → vào TV Hình
  viet_bc_tv:   '🟠',
  lap_group:    '🎓',  // Lập Group TV-BB → vào giai đoạn Tư Vấn
  hoc_bb:       '🟢',
  viet_bc_bb:   '🟢'
};
const PRIORITY_GROUP_LABELS = {
  overdue_alarms: 'Nhắc nhở & Báo thức quá hạn',
  duyet_hapja:  'Duyệt Check Hapja',
  ngu_dong:     'Trái ngủ đông (>14 ngày)',
  thieu_vai_tro:'Thiếu vai trò TVV/GVBB',
  sinka_chua_hoan_thien: 'Thẻ học viên (Sinka) chưa hoàn thiện (<60%)',
  ket_phase:    'Kẹt giai đoạn (>30 ngày)',
  chot_tv_1:    'Cần chuẩn bị TV lần 1',
  chot_tv_hinh: 'Cần Chốt TV Hình (lần 2+)',
  viet_bc_tv:   'Cần viết Báo cáo TV',
  lap_group:    'Cần Lập Group TV-BB',
  hoc_bb:       'Cần học BB',
  viet_bc_bb:   'Cần viết Báo cáo BB'
};
const PRIORITY_ORDER = [
  'overdue_alarms',
  'duyet_hapja',
  'ngu_dong',
  'thieu_vai_tro',
  'sinka_chua_hoan_thien',
  'ket_phase',
  'chot_tv_1',
  'chot_tv_hinh',
  'viet_bc_tv',
  'lap_group',
  'viet_bc_bb',
  'hoc_bb'
];


async function loadPriority() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  const listEl = document.getElementById('priorityList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">⌛ Đang tải...</div>';

  try {
    // Get all staff in my managed scope (including GVBB from fruit_roles)
    const scopeCodes = typeof getMyManagedStaffCodes === 'function' ? await getMyManagedStaffCodes() : [myCode];
    const codesStr = scopeCodes.join(',');

    // === Parallel fetch ===
    const nowIso = new Date().toISOString();
    const [hapjaRes, tasksRes, calAlarmsRes, noteAlarmsRes] = await Promise.all([
      // "Duyệt Hapja": visible to anyone with approve_hapja permission
      hasPermission('approve_hapja')
        ? sbFetch(`/rest/v1/check_hapja?status=in.(pending,revision_submitted)&select=id,full_name,created_by,created_at,data,status&order=created_at.asc`)
        : Promise.resolve(null),
      // Priority tasks — only show if visible_at has passed (or is null)
      // Note: encode ISO timestamp to avoid URL issues with colons
      sbFetch(`/rest/v1/priority_tasks?staff_code=in.(${codesStr})&is_completed=eq.false&or=(visible_at.is.null,visible_at.lte.${encodeURIComponent(nowIso)})&select=*&order=created_at.desc`),
      // Calendar alarms
      sbFetch(`/rest/v1/calendar_events?staff_code=eq.${myCode}&reminder_at=lte.${encodeURIComponent(nowIso)}&reminder_sent=eq.false&select=id,title,event_date,event_time,profile_id,reminder_at`),
      // Personal notes alarms
      sbFetch(`/rest/v1/personal_notes?owner_staff_code=eq.${encodeURIComponent(myCode)}&reminder_at=lte.${encodeURIComponent(nowIso)}&reminder_sent=eq.false&select=id,title,content,cal_date,reminder_at`)
    ]);

    const pendingHapjas = hapjaRes ? await hapjaRes.json() : [];
    const tasks = await tasksRes.json();
    const calAlarms = calAlarmsRes.ok ? await calAlarmsRes.json() : [];
    const noteAlarms = noteAlarmsRes.ok ? await noteAlarmsRes.json() : [];

    // === Build groups ===
    const groups = {};

    // Group 0: Nhắc nhở & Báo thức quá hạn (overdue_alarms)
    const alarmsList = [];
    (calAlarms || []).forEach(ev => {
      const timeStr = ev.event_time ? ev.event_time.substring(0, 5) : '';
      alarmsList.push({
        id: `alarm_cal_${ev.id}`,
        profile_id: ev.profile_id || null,
        task_type: 'overdue_alarms',
        title: `⏰ Lịch hẹn: ${ev.title}`,
        meta: `Lịch ngày ${ev.event_date} ${timeStr ? 'lúc ' + timeStr : ''}`,
        is_seen: false,
        created_at: ev.reminder_at || nowIso,
        deadline: null,
        alarm_type: 'calendar',
        alarm_id: ev.id,
        event_date: ev.event_date
      });
    });
    (noteAlarms || []).forEach(n => {
      const noteTitle = n.title || (n.content || '').substring(0, 40) || 'Ghi chú không tiêu đề';
      alarmsList.push({
        id: `alarm_note_${n.id}`,
        profile_id: null,
        task_type: 'overdue_alarms',
        title: `📝 Nhắc nhở: ${noteTitle}`,
        meta: n.cal_date ? `Lịch ngày ${n.cal_date}` : 'Ghi chú cá nhân',
        is_seen: false,
        created_at: n.reminder_at || nowIso,
        deadline: null,
        alarm_type: 'note',
        alarm_id: n.id
      });
    });
    if (alarmsList.length > 0) {
      groups['overdue_alarms'] = alarmsList;
    }

    // Group 1: Duyệt Hapja — direct from check_hapja table
    if (pendingHapjas.length > 0) {
      groups['duyet_hapja'] = pendingHapjas.map(h => ({
        id: h.id,
        profile_id: null,
        task_type: 'duyet_hapja',
        title: h.full_name,
        meta: `NDD: ${h.data?.ndd_staff_code || h.created_by}`,
        is_seen: false,
        created_at: h.created_at,
        deadline: null,
        hapja_id: h.id
      }));
    }

    // Groups 2-5: from priority_tasks table
    tasks.forEach(t => {
      if (!groups[t.task_type]) groups[t.task_type] = [];
      const pName = t.title || 'N/A';
      groups[t.task_type].push({
        id: t.id,
        profile_id: t.profile_id,
        task_type: t.task_type,
        title: pName,
        meta: null,
        is_seen: t.is_seen,
        created_at: t.created_at,
        deadline: t.deadline
      });
    });

    // === Auto-detect: dormant, stuck, missing roles, sinka completeness ===
    // Uses cached allProfiles (loaded by profiles.js) — NO extra API calls for profile/role data
    try {
      const codeSet = new Set(scopeCodes);
      const nowMs = Date.now();
      const DAY_MS = 86400000;
      const PHASE_LABELS_P = { new: 'Mới', chakki: 'Chakki', tu_van_hinh: 'TV Hình', tu_van: 'Tư vấn', bb: 'BB', center: 'Center' };

      // Only lightweight queries: latest activity per profile (records + sessions) + sinka data
      // Use allProfiles for profile data (already in memory)
      const myProfiles = (allProfiles || []).filter(p =>
        p.ndd_staff_code && codeSet.has(p.ndd_staff_code) && p.fruit_status !== 'dropout' && p.fruit_status !== 'pause'
      );

      if (myProfiles.length > 0) {
        // Batch fetch last activity for these profiles AND their Sinka data
        const pids = myProfiles.map(p => p.id);
        const pidsIn = pids.map(id => `"${id}"`).join(',');
        const [recsRes, sessRes, fhcRes] = await Promise.all([
          sbFetch(`/rest/v1/records?profile_id=in.(${pidsIn})&select=profile_id,created_at&order=created_at.desc`),
          sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${pidsIn})&select=profile_id,created_at&order=created_at.desc`),
          sbFetch(`/rest/v1/form_hanh_chinh?profile_id=in.(${pidsIn})&select=profile_id,data`)
        ]);
        const recs = await recsRes.json();
        const sess = await sessRes.json();
        const fhc = await fhcRes.json();

        // Build activity map
        const actMap = {};
        recs.forEach(r => { const t = new Date(r.created_at).getTime(); if (!actMap[r.profile_id] || t > actMap[r.profile_id]) actMap[r.profile_id] = t; });
        sess.forEach(s => { const t = new Date(s.created_at).getTime(); if (!actMap[s.profile_id] || t > actMap[s.profile_id]) actMap[s.profile_id] = t; });

        // Build Sinka map
        const fhcMap = {};
        (fhc || []).forEach(row => { fhcMap[row.profile_id] = row.data || {}; });

        const SINKA_CORE_FIELDS = [
          'sk_ndd_ten_bo_kv_sdt', 'sk_ndd_ma_dinh_danh', 'sk_moi_quan_he', 'sk_concept_thuoc_the',
          'sk_ten_gt_tuoi', 'sk_so_thich_sdt', 'sk_ngay_sinh', 'sk_dia_chi', 'sk_noi_lam_viec', 'sk_hon_nhan',
          'sk_thanh_vien_gd', 'sk_qua_trinh_truong_thanh', 'sk_enneagram_mbti', 'sk_ton_giao', 'sk_ly_do_theo_dao',
          'sk_gvbb_ten', 'sk_so_lan_bb', 'sk_ly_do_center', 'sk_8_9_thang', 'sk_thu_gio_hoc', 'sk_bao_an_ai_biet'
        ];

        myProfiles.forEach(p => {
          const pid = p.id;
          const lastAct = actMap[pid] || (p.created_at ? new Date(p.created_at).getTime() : 0);
          const daysSince = lastAct ? Math.floor((nowMs - lastAct) / DAY_MS) : 999;
          const createdMs = p.created_at ? new Date(p.created_at).getTime() : 0;
          const daysCreated = createdMs ? Math.floor((nowMs - createdMs) / DAY_MS) : 0;

          // 😴 Dormant: >14 days no activity
          if (daysSince > 14) {
            if (!groups['ngu_dong']) groups['ngu_dong'] = [];
            groups['ngu_dong'].push({
              id: `auto_nd_${pid}`, profile_id: pid, task_type: 'ngu_dong',
              title: p.full_name, meta: `${daysSince} ngày không hoạt động · ${PHASE_LABELS_P[p.phase] || p.phase}`,
              is_seen: true, created_at: new Date(lastAct).toISOString(), deadline: null, _auto: true
            });
          }

          // 🔵 Missing TVV/GVBB: verify against fruit_roles (cache may be stale)
          // Collect candidates first, verify in batch below
          if (!p.tvv_staff_code && !['new', 'chakki'].includes(p.phase)) {
            if (!groups['_tvv_check']) groups['_tvv_check'] = [];
            groups['_tvv_check'].push(p);
          }
          if (!p.gvbb_staff_code && ['tu_van', 'bb', 'center'].includes(p.phase)) {
            const hasHocBBTask = tasks.some(t => t.profile_id === pid && t.task_type === 'hoc_bb');
            if (!hasHocBBTask) {
              if (!groups['_gvbb_check']) groups['_gvbb_check'] = [];
              groups['_gvbb_check'].push(p);
            }
          }

          // 📝 Sinka Incomplete: if in tu_van, bb, center phase
          if (['tu_van', 'bb', 'center'].includes(p.phase)) {
            const sData = fhcMap[pid] || {};
            let filledCount = 0;
            SINKA_CORE_FIELDS.forEach(f => {
              const val = (sData[f] || '').trim();
              if (val && val !== '—' && val !== '-') {
                filledCount++;
              }
            });
            const pct = Math.round((filledCount / SINKA_CORE_FIELDS.length) * 100);
            if (pct < 60) {
              if (!groups['sinka_chua_hoan_thien']) groups['sinka_chua_hoan_thien'] = [];
              groups['sinka_chua_hoan_thien'].push({
                id: `auto_sk_${pid}`, profile_id: pid, task_type: 'sinka_chua_hoan_thien',
                title: `${p.full_name} — Thẻ HV chưa hoàn thiện`,
                meta: `Đã điền ${filledCount}/${SINKA_CORE_FIELDS.length} trường core (${pct}%) · GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                is_seen: true, created_at: p.created_at, deadline: null, _auto: true
              });
            }
          }

          // ⏳ Stuck: >30 days same phase & >14 days no activity
          if (!['center', 'completed'].includes(p.phase) && daysCreated > 30 && daysSince > 14) {
            if (!groups['ket_phase']) groups['ket_phase'] = [];
            groups['ket_phase'].push({
              id: `auto_kp_${pid}`, profile_id: pid, task_type: 'ket_phase',
              title: p.full_name, meta: `Kẹt ${PHASE_LABELS_P[p.phase] || p.phase} > 30 ngày`,
              is_seen: true, created_at: p.created_at, deadline: null, _auto: true
            });
          }
        });
      }

      // Batch-verify missing TVV/GVBB against DB fruit_roles
      const tvvCandidates = groups['_tvv_check'] || [];
      const gvbbCandidates = groups['_gvbb_check'] || [];
      const allCandidatePids = [...new Set([...tvvCandidates, ...gvbbCandidates].map(p => p.id))];
      if (allCandidatePids.length > 0) {
        try {
          const idsStr = allCandidatePids.map(id => `"${id}"`).join(',');
          const frRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=in.(${idsStr})&select=profile_id,fruit_roles(role_type)`);
          const frData = await frRes.json();
          // Build role sets per profile
          const roleMap = {};
          (frData || []).forEach(fg => {
            const pid = fg.profile_id;
            if (!roleMap[pid]) roleMap[pid] = new Set();
            (fg.fruit_roles || []).forEach(r => roleMap[pid].add(r.role_type));
          });
          // Only flag truly missing TVV
          tvvCandidates.forEach(p => {
            if (!roleMap[p.id]?.has('tvv')) {
              if (!groups['thieu_vai_tro']) groups['thieu_vai_tro'] = [];
              groups['thieu_vai_tro'].push({
                id: `auto_tvv_${p.id}`, profile_id: p.id, task_type: 'thieu_vai_tro',
                title: `${p.full_name} — chưa có TVV`, meta: `GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                is_seen: true, created_at: p.created_at, deadline: null, _auto: true
              });
            }
          });
          // Only flag truly missing GVBB
          gvbbCandidates.forEach(p => {
            if (!roleMap[p.id]?.has('gvbb')) {
              if (!groups['thieu_vai_tro']) groups['thieu_vai_tro'] = [];
              groups['thieu_vai_tro'].push({
                id: `auto_gvbb_${p.id}`, profile_id: p.id, task_type: 'thieu_vai_tro',
                title: `${p.full_name} — chưa có GVBB`, meta: `GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                is_seen: true, created_at: p.created_at, deadline: null, _auto: true
              });
            }
          });
        } catch(e) { console.warn('Role verify fail:', e); }
      }
      delete groups['_tvv_check'];
      delete groups['_gvbb_check'];
    } catch(e) { console.warn('Priority auto-detect:', e); }

    // Check if nothing
    const totalCount = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
    if (totalCount === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tốt lắm!</div><div class="empty-sub">Không có việc ưu tiên cần xử lý</div></div>';
      updatePriorityBadge(0);
      if (typeof markFresh === 'function') markFresh('priority');
      return;
    }

    // === Render ===
    let html = '';
    PRIORITY_ORDER.forEach(type => {
      const items = groups[type];
      if (!items || items.length === 0) return;

      const icon = PRIORITY_ICONS[type] || '⚡';
      const label = PRIORITY_GROUP_LABELS[type] || type;
      const unseenCount = items.filter(i => !i.is_seen).length;

      html += `<div class="priority-group">
        <div class="priority-group-header">
          <span>${icon} ${label}</span>
          <span class="priority-count">${items.length}${unseenCount > 0 ? ` · <span style="color:#fbbf24;font-size:10px;">${unseenCount} mới</span>` : ''}</span>
        </div>`;

      items.forEach(t => {
        const timeAgo = getTimeAgo(t.created_at);
        const deadlineStr = t.deadline ? formatDeadline(t.deadline) : '';
        const isOverdue = t.deadline && new Date(t.deadline) < new Date();
        const unseenCls = !t.is_seen ? 'priority-unseen' : '';
        const overdueCls = isOverdue ? 'priority-overdue' : '';

        let clickAction = '';
        if (type === 'duyet_hapja') {
          clickAction = `openHapjaDetail('${t.hapja_id}');markPriorityItemSeen('${t.id}',null,'duyet_hapja')`;
        } else if (type === 'overdue_alarms') {
          clickAction = `handleAlarmClick('${t.alarm_type}','${t.alarm_id}','${t.profile_id}','${t.event_date || ''}')`;
        } else {
          clickAction = `handlePriorityClick('${t.id}','${t.profile_id}','${t.task_type}')`;
        }

        html += `<div class="priority-item ${unseenCls} ${overdueCls}" onclick="${clickAction}">
          <div class="priority-item-dot" style="background:${
            type==='overdue_alarms'?'#ef4444':
            type==='duyet_hapja'?'#f97316':
            type==='ngu_dong'?'#ef4444':
            type==='thieu_vai_tro'?'#3b82f6':
            type==='sinka_chua_hoan_thien'?'#a855f7':
            type==='ket_phase'?'#f59e0b':
            type==='chot_tv_1'?'#ef4444':
            type==='chot_tv_hinh'?'#ef4444':
            type==='viet_bc_tv'?'#f97316':
            type==='lap_group'?'#8b5cf6':'#22c55e'
          }"></div>
          <div class="priority-item-main">
            <div class="priority-item-name">${t.title}</div>
            <div class="priority-item-meta">${t.meta || timeAgo}${deadlineStr ? ` · ${deadlineStr}` : ''}</div>
          </div>
          ${type === 'overdue_alarms' ? `
            <button onclick="event.stopPropagation();handleAlarmClick('${t.alarm_type}','${t.alarm_id}','${t.profile_id}','${t.event_date || ''}')" class="priority-seen-btn" title="Xem chi tiết" style="margin-right:6px;">👁️</button>
            <button onclick="completeAlarmTask('${t.alarm_type}','${t.alarm_id}', event)" class="priority-seen-btn" style="border-color:var(--green);color:var(--green);" title="Xử lý xong">✅</button>
          ` : !t.is_seen && type !== 'duyet_hapja' && !t._auto ? `
            <button onclick="event.stopPropagation();markPriorityItemSeen('${t.id}','${t.profile_id}','${t.task_type}')" class="priority-seen-btn" title="Đã xem">👁</button>
          ` : ''}
        </div>`;
      });

      html += '</div>';
    });

    listEl.innerHTML = html;
    updatePriorityBadge(totalCount);
    if (typeof markFresh === 'function') markFresh('priority');

  } catch(e) {
    console.error('loadPriority:', e);
    listEl.innerHTML = '<div class="empty-state"><div class="empty-sub">❌ Lỗi tải</div></div>';
  }
}

function updatePriorityBadge(count) {
  // Update the Priority tab label with a badge if there are items
  const priorityTab = document.querySelector('[data-tab="priority"]');
  if (!priorityTab) return;
  if (count > 0) {
    priorityTab.innerHTML = `⚡ Ưu tiên <span style="display:inline-block;background:#ef4444;color:white;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;vertical-align:middle;margin-left:2px;">${count > 99 ? '99+' : count}</span>`;
  } else {
    priorityTab.textContent = '⚡ Ưu tiên';
  }
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0) {
    const h = Math.abs(Math.floor(diff / 3600000));
    if (h < 24) return `🔴 Quá hạn ${h}h`;
    return `🔴 Quá hạn ${Math.floor(h/24)} ngày`;
  }
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `⏰ Còn ${Math.floor(diff/60000)} phút`;
  if (hours < 24) return `⏰ Còn ${hours}h`;
  return `📅 ${shinDate(d)}`;
}

async function handlePriorityClick(taskId, profileId, taskType) {
  await markPriorityItemSeen(taskId, profileId, taskType);
  if (profileId && profileId !== 'null') {
    openProfileById(profileId);
    if (taskType === 'sinka_chua_hoan_thien') {
      setTimeout(() => {
        const tabEl = document.getElementById('tabSinka');
        if (tabEl && typeof switchFormTab === 'function') {
          switchFormTab(tabEl, 'sinkaTab');
        }
      }, 300);
    }
  }
}

async function handleAlarmClick(alarmType, alarmId, profileId, eventDate) {
  if (alarmType === 'calendar') {
    const calTab = document.querySelector('[data-tab="calendar"]');
    if (calTab && typeof switchMainTab === 'function') {
      switchMainTab(calTab, 'calendar');
    }
    if (eventDate && typeof selectCalendarDate === 'function') {
      selectCalendarDate(eventDate);
    }
  } else if (alarmType === 'note') {
    const notesTab = document.querySelector('[data-tab="notes"]');
    if (notesTab && typeof switchMainTab === 'function') {
      switchMainTab(notesTab, 'notes');
    }
    if (typeof openEditNoteModal === 'function') {
      openEditNoteModal(alarmId);
    }
  } else if (profileId && profileId !== 'null') {
    openProfileById(profileId);
  }
}

async function completeAlarmTask(alarmType, alarmId, event) {
  if (event) event.stopPropagation();
  try {
    if (alarmType === 'calendar') {
      await sbFetch(`/rest/v1/calendar_events?id=eq.${alarmId}`, {
        method: 'PATCH', body: JSON.stringify({ reminder_sent: true })
      });
    } else if (alarmType === 'note') {
      await sbFetch(`/rest/v1/personal_notes?id=eq.${alarmId}`, {
        method: 'PATCH', body: JSON.stringify({ reminder_sent: true })
      });
    }
    showToast('✅ Đã hoàn thành nhắc nhở');
    loadPriority();
  } catch(e) {
    console.warn('completeAlarmTask failed:', e);
    showToast('❌ Lỗi xử lý nhắc nhở');
  }
}

async function markPriorityItemSeen(taskId, profileId, taskType) {
  if (taskType === 'duyet_hapja' || taskType === 'sinka_chua_hoan_thien' || taskType === 'overdue_alarms') return; // handled by custom open / not stored in priority_tasks
  try {
    await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`, {
      method: 'PATCH', body: JSON.stringify({ is_seen: true })
    });
    loadPriority(); // refresh to push seen items down
  } catch(e) { console.warn('markPriorityItemSeen:', e); }
}

// ============ AUTO-CREATE PRIORITY TASKS ============
async function createPriorityTask(staffCode, profileId, taskType, title, deadline, visibleAt) {
  if (!staffCode) return;
  try {
    // Avoid duplicates
    const checkRes = await sbFetch(`/rest/v1/priority_tasks?staff_code=eq.${staffCode}&profile_id=eq.${profileId}&task_type=eq.${taskType}&is_completed=eq.false&select=id&limit=1`);
    const existing = await checkRes.json();
    if (existing.length > 0) {
      // Update deadline or visible_at if changed
      const patch = {};
      if (deadline) patch.deadline = deadline;
      if (visibleAt) patch.visible_at = visibleAt;
      if (Object.keys(patch).length) {
        await sbFetch(`/rest/v1/priority_tasks?id=eq.${existing[0].id}`, {
          method: 'PATCH', body: JSON.stringify(patch)
        });
      }
      return;
    }
    await sbFetch('/rest/v1/priority_tasks', {
      method: 'POST', body: JSON.stringify({
        staff_code: staffCode, profile_id: profileId,
        task_type: taskType, title,
        deadline: deadline || null,
        visible_at: visibleAt || null
      })
    });
    loadPriority(); // refresh badge
  } catch(e) { console.warn('createPriorityTask:', e); }
}

async function completePriorityTask(profileId, taskType) {
  try {
    await sbFetch(`/rest/v1/priority_tasks?profile_id=eq.${profileId}&task_type=eq.${taskType}&is_completed=eq.false`, {
      method: 'PATCH', body: JSON.stringify({ is_completed: true })
    });
    loadPriority();
  } catch(e) { console.warn('completePriorityTask:', e); }
}

// Smart refresh: only run loadPriority when priority tab is active
setInterval(() => {
  const tab = document.querySelector('#mainTabBar .tab.active')?.dataset?.tab;
  const pinned = typeof _isTabPinned === 'function' && _isTabPinned('priority');
  if ((tab === 'priority' || pinned) && typeof loadPriority === 'function') loadPriority();
}, 120000); // 2 min — less aggressive

// ============ CLIENT-SIDE REMINDER POLLING ============
// Since there's no server cron, check for due reminders from the client
async function checkDueReminders() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  try {
    const now = new Date().toISOString();

    // 1. Check calendar event alarms (all overdue, not just 5min window)
    const res = await sbFetch(
      `/rest/v1/calendar_events?staff_code=eq.${myCode}&reminder_at=lte.${encodeURIComponent(now)}&reminder_sent=eq.false&select=id,title,event_date,event_time,profile_id&limit=10`
    );
    if (res.ok) {
      const events = await res.json();
      for (const ev of (events || [])) {
        const timeStr = ev.event_time ? ev.event_time.substring(0, 5) : '';

        // Show dramatic alarm overlay (in-app)
        if (typeof showAlarmOverlay === 'function') {
          showAlarmOverlay(ev.title, ev.event_date, timeStr, 'event');
        } else {
          showToast(`⏰ Nhắc: ${ev.title}${timeStr ? ' lúc ' + timeStr : ''}`, 6000);
        }

        // Create in-app notification
        if (typeof createNotification === 'function') {
          createNotification(
            [myCode], 'reminder',
            `⏰ ${ev.title}`,
            timeStr ? `Lúc ${timeStr} ngày ${ev.event_date}` : `Ngày ${ev.event_date}`,
            ev.profile_id || null
          );
        }

        // Mark as sent to avoid re-triggering
        await sbFetch(`/rest/v1/calendar_events?id=eq.${ev.id}`, {
          method: 'PATCH', body: JSON.stringify({ reminder_sent: true })
        });
      }
    }

    // 2. Check personal_notes alarms (all overdue)
    const noteRes = await sbFetch(
      `/rest/v1/personal_notes?owner_staff_code=eq.${encodeURIComponent(myCode)}&reminder_at=lte.${encodeURIComponent(now)}&reminder_sent=eq.false&select=id,title,content,cal_date&limit=10`
    );
    if (noteRes.ok) {
      const notes = await noteRes.json();
      for (const note of (notes || [])) {
        const noteTitle = note.title || (note.content || '').substring(0, 40);

        // Show dramatic alarm overlay
        if (typeof showAlarmOverlay === 'function') {
          showAlarmOverlay(noteTitle, note.cal_date || '', '', 'note');
        } else {
          showToast(`📝 Nhắc ghi chú: ${noteTitle}`, 6000);
        }

        // Create in-app notification
        if (typeof createNotification === 'function') {
          createNotification(
            [myCode], 'reminder',
            `📝 ${noteTitle}`,
            note.cal_date ? `Ngày ${note.cal_date}` : 'Ghi chú cá nhân',
            null
          );
        }

        // Mark as sent
        await sbFetch(`/rest/v1/personal_notes?id=eq.${note.id}`, {
          method: 'PATCH', body: JSON.stringify({ reminder_sent: true })
        });
      }
    }
  } catch (e) { console.warn('checkDueReminders:', e); }
}

// Check reminders every 60s
setInterval(checkDueReminders, 60000);
// Also check on app load (after a short delay to let auth settle)
setTimeout(checkDueReminders, 5000);

// ─── HELPER: cập nhật task chot_tv_1 khi TVV được bổ sung ───────────────────
// Gọi sau khi gán TVV vào hồ sơ, để cập nhật title task còn thiếu gì.
// Nếu đã CÓ TVV và ĐÃ có lịch hẹn → hoàn thành task (vì sẽ nhắc bằng calendar)
async function updateChotTV1Task(profileId, profileName, hasTvv, hasSchedule) {
  if (!profileId) return;
  try {
    // Kiểm tra task còn active không
    const res = await sbFetch(
      `/rest/v1/priority_tasks?profile_id=eq.${profileId}&task_type=eq.chot_tv_1&is_completed=eq.false&select=id,staff_code&limit=1`
    );
    const rows = await res.json();
    if (!rows || rows.length === 0) return; // task đã xong hoặc không tồn tại

    const taskId = rows[0].id;

    if (hasTvv && hasSchedule) {
      // Đầy đủ TVV + lịch → hoàn thành task (calendar event đã được tạo)
      await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`,
        { method: 'PATCH', body: JSON.stringify({ is_completed: true }) }
      );
    } else {
      // Cập nhật title theo thứ còn thiếu
      let newTitle;
      if (!hasTvv && !hasSchedule) {
        newTitle = `Cần tìm TVV và xếp lịch TV — ${profileName}`;
      } else if (!hasTvv) {
        newTitle = `Cần tìm TVV — ${profileName}`;
      } else {
        newTitle = `Cần xếp lịch TV lần 1 — ${profileName}`;
      }
      await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`,
        { method: 'PATCH', body: JSON.stringify({ title: newTitle }) }
      );
    }
    loadPriority();
  } catch(e) { console.warn('updateChotTV1Task:', e); }
}
