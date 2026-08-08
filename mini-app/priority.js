// ============ PRIORITY TASKS MODULE ============

const PRIORITY_ICONS = {
  duyet_hapja:  '🍎',
  ngu_dong:     '😴',  // Auto-detect: dormant fruit
  thieu_vai_tro:'🔵',  // Auto-detect: missing TVV/GVBB
  sinka_chua_hoan_thien: '📝',
  chot_tv_1:    '🔴',  // Chốt TV lần 1 → vào Chakki
  viet_bc_tv:   '🟠',
  lap_group:    '🎓',  // Lập Group TV-BB → vào giai đoạn Tư Vấn
  viet_bc_bb:   '🟢'
};
const PRIORITY_GROUP_LABELS = {
  duyet_hapja:  'Duyệt Check Hapja',
  ngu_dong:     'Trái ngủ đông',
  thieu_vai_tro:'Thiếu vai trò TVV/GVBB',
  sinka_chua_hoan_thien: 'Thẻ học viên (Sinka) chưa hoàn thiện (<60%)',
  chot_tv_1:    'Cần chuẩn bị TV lần 1',
  viet_bc_tv:   'Cần viết Báo cáo TV',
  lap_group:    'Cần Lập Group TV-BB',
  viet_bc_bb:   'Cần viết Báo cáo BB'
};
const PRIORITY_ORDER = [
  'duyet_hapja',
  'ngu_dong',
  'thieu_vai_tro',
  'sinka_chua_hoan_thien',
  'chot_tv_1',
  'viet_bc_tv',
  'lap_group',
  'viet_bc_bb'
];

function getPrioritySettings() {
  const defaults = {
    dormantDays: 7,
    enabledTypes: {
      duyet_hapja: true,
      ngu_dong: true,
      thieu_vai_tro: true,
      sinka_chua_hoan_thien: true,
      chot_tv_1: true,
      viet_bc_tv: true,
      lap_group: true,
      viet_bc_bb: true
    }
  };
  try {
    const saved = localStorage.getItem('cj_priority_settings');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        dormantDays: typeof parsed.dormantDays === 'number' ? parsed.dormantDays : 7,
        enabledTypes: { ...defaults.enabledTypes, ...parsed.enabledTypes }
      };
    }
  } catch(e) {}
  return defaults;
}

function savePrioritySettings(settings) {
  try {
    localStorage.setItem('cj_priority_settings', JSON.stringify(settings));
  } catch(e) {}
}

let _priorityFilter = 'personal'; // 'personal' | 'unit'

function getSeenAutoPriorities() {
  try {
    const saved = localStorage.getItem('cj_seen_auto_priorities');
    return saved ? JSON.parse(saved) : [];
  } catch(e) { return []; }
}

function toggleSeenAutoPriority(taskId) {
  try {
    let list = getSeenAutoPriorities();
    const idx = list.indexOf(taskId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(taskId);
    }
    localStorage.setItem('cj_seen_auto_priorities', JSON.stringify(list));
  } catch(e) {}
}

async function loadPriority() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  const listEl = document.getElementById('priorityList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">⌛ Đang tải...</div>';

  try {
    const settings = getPrioritySettings();
    const seenAuto = getSeenAutoPriorities();

    // Get all staff in my managed scope (including GVBB from fruit_roles)
    const scopeCodes = typeof getMyManagedStaffCodes === 'function' ? await getMyManagedStaffCodes() : [myCode];
    const codesStr = scopeCodes.join(',');

    // === Parallel fetch ===
    const nowIso = new Date().toISOString();
    const [hapjaRes, tasksRes] = await Promise.all([
      // "Duyệt Hapja": visible to anyone with approve_hapja permission
      (hasPermission('approve_hapja') && settings.enabledTypes['duyet_hapja'])
        ? sbFetch(`/rest/v1/check_hapja?status=in.(pending,revision_submitted)&select=id,full_name,created_by,created_at,data,status&order=created_at.asc`)
        : Promise.resolve(null),
      // Priority tasks — only show if visible_at has passed (or is null)
      sbFetch(`/rest/v1/priority_tasks?staff_code=in.(${codesStr})&is_completed=eq.false&or=(visible_at.is.null,visible_at.lte.${encodeURIComponent(nowIso)})&select=*&order=created_at.desc`)
    ]);

    const pendingHapjas = hapjaRes ? await hapjaRes.json() : [];
    const tasks = await tasksRes.json();

    const allItems = [];

    // 1. Duyệt Hapja — direct from check_hapja table
    if (settings.enabledTypes['duyet_hapja'] && pendingHapjas.length > 0) {
      pendingHapjas.forEach(h => {
        const id = `duyet_hapja_${h.id}`;
        allItems.push({
          id: id,
          profile_id: null,
          task_type: 'duyet_hapja',
          title: h.full_name,
          meta: `NDD: ${h.data?.ndd_staff_code || h.created_by}`,
          is_seen: seenAuto.includes(id),
          created_at: h.created_at,
          deadline: null,
          hapja_id: h.id,
          created_by: h.created_by,
          ndd_staff_code: h.data?.ndd_staff_code || null
        });
      });
    }

    // 2. DB priority tasks
    tasks.forEach(t => {
      if (!settings.enabledTypes[t.task_type]) return; // Skip if disabled
      allItems.push({
        id: String(t.id),
        profile_id: t.profile_id,
        task_type: t.task_type,
        title: t.title || 'N/A',
        meta: null,
        is_seen: !!t.is_seen,
        created_at: t.created_at,
        deadline: t.deadline,
        staff_code: t.staff_code
      });
    });

    // 3. Auto-detect: dormant, missing roles, sinka completeness
    try {
      const codeSet = new Set(scopeCodes);
      const nowMs = Date.now();
      const DAY_MS = 86400000;
      const PHASE_LABELS_P = { new: 'Mới', chakki: 'Chakki', tu_van_hinh: 'TV Hình', tu_van: 'Tư vấn', bb: 'BB', center: 'Center' };

      // Scan target profiles: those in managed scope OR where current user has a role
      const targetProfiles = (allProfiles || []).filter(p => {
        if (p.fruit_status === 'dropout' || p.fruit_status === 'pause') return false;
        if (p.ndd_staff_code && codeSet.has(p.ndd_staff_code)) return true;
        const isNdd = p.ndd_staff_code === myCode;
        const isTvv = p.tvv_staff_code && p.tvv_staff_code.split(',').map(x => x.trim()).includes(myCode);
        const isGvbb = p.gvbb_staff_code && p.gvbb_staff_code.split(',').map(x => x.trim()).includes(myCode);
        return isNdd || isTvv || isGvbb;
      });

      if (targetProfiles.length > 0) {
        const pids = targetProfiles.map(p => p.id);
        const pidsIn = pids.map(id => `"${id}"`).join(',');
        
        // Parallel fetch of records, sessions, and Sinka (form_hanh_chinh)
        const [recsRes, sessRes, fhcRes] = await Promise.all([
          sbFetch(`/rest/v1/records?profile_id=in.(${pidsIn})&select=profile_id,created_at&order=created_at.desc`),
          sbFetch(`/rest/v1/consultation_sessions?profile_id=in.(${pidsIn})&select=profile_id,created_at&order=created_at.desc`),
          settings.enabledTypes['sinka_chua_hoan_thien']
            ? sbFetch(`/rest/v1/form_hanh_chinh?profile_id=in.(${pidsIn})&select=profile_id,data`)
            : Promise.resolve(null)
        ]);
        
        const recs = await recsRes.json();
        const sess = await sessRes.json();
        const fhc = fhcRes ? await fhcRes.json() : [];

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

        // Gather candidates for role checking
        const tvvCandidates = [];
        const gvbbCandidates = [];

        targetProfiles.forEach(p => {
          const pid = p.id;
          const lastAct = actMap[pid] || (p.created_at ? new Date(p.created_at).getTime() : 0);
          const daysSince = lastAct ? Math.floor((nowMs - lastAct) / DAY_MS) : 999;

          // 😴 Dormant: > dormantDays
          if (settings.enabledTypes['ngu_dong'] && daysSince > settings.dormantDays) {
            const taskId = `auto_nd_${pid}`;
            allItems.push({
              id: taskId,
              profile_id: pid,
              task_type: 'ngu_dong',
              title: p.full_name,
              meta: `${daysSince} ngày không hoạt động · ${PHASE_LABELS_P[p.phase] || p.phase}`,
              is_seen: seenAuto.includes(taskId),
              created_at: new Date(lastAct).toISOString(),
              deadline: null,
              _auto: true
            });
          }

          // Role candidates for verification
          if (settings.enabledTypes['thieu_vai_tro']) {
            if (!p.tvv_staff_code && !['new', 'chakki'].includes(p.phase)) {
              tvvCandidates.push(p);
            }
            if (!p.gvbb_staff_code && ['tu_van', 'bb', 'center'].includes(p.phase)) {
              gvbbCandidates.push(p);
            }
          }

          // 📝 Sinka Incomplete: if in tu_van, bb, center phase
          if (settings.enabledTypes['sinka_chua_hoan_thien'] && ['tu_van', 'bb', 'center'].includes(p.phase)) {
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
              const taskId = `auto_sk_${pid}`;
              allItems.push({
                id: taskId,
                profile_id: pid,
                task_type: 'sinka_chua_hoan_thien',
                title: `${p.full_name} — Thẻ HV chưa hoàn thiện`,
                meta: `Đã điền ${filledCount}/${SINKA_CORE_FIELDS.length} trường core (${pct}%) · GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                is_seen: seenAuto.includes(taskId),
                created_at: p.created_at,
                deadline: null,
                _auto: true
              });
            }
          }
        });

        // Batch-verify missing TVV/GVBB roles against Supabase
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

            // TVV checks
            tvvCandidates.forEach(p => {
              if (!roleMap[p.id]?.has('tvv')) {
                const taskId = `auto_tvv_${p.id}`;
                allItems.push({
                  id: taskId,
                  profile_id: p.id,
                  task_type: 'thieu_vai_tro',
                  title: `${p.full_name} — chưa có TVV`,
                  meta: `GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                  is_seen: seenAuto.includes(taskId),
                  created_at: p.created_at,
                  deadline: null,
                  _auto: true
                });
              }
            });

            // GVBB checks
            gvbbCandidates.forEach(p => {
              if (!roleMap[p.id]?.has('gvbb')) {
                const taskId = `auto_gvbb_${p.id}`;
                allItems.push({
                  id: taskId,
                  profile_id: p.id,
                  task_type: 'thieu_vai_tro',
                  title: `${p.full_name} — chưa có GVBB`,
                  meta: `GĐ: ${PHASE_LABELS_P[p.phase] || p.phase}`,
                  is_seen: seenAuto.includes(taskId),
                  created_at: p.created_at,
                  deadline: null,
                  _auto: true
                });
              }
            });
          } catch(e) { console.warn('Role verify fail:', e); }
        }
      }
    } catch(e) { console.warn('Priority auto-detect:', e); }

    // === Classify into Personal vs Unit ===
    const personalItems = [];
    const unitItems = [];

    allItems.forEach(item => {
      item.is_personal = checkIfItemPersonal(item, myCode);
      if (item.is_personal) {
        personalItems.push(item);
      } else {
        unitItems.push(item);
      }
    });

    const unseenPersonalCount = personalItems.filter(i => !i.is_seen).length;
    const unseenUnitCount = unitItems.filter(i => !i.is_seen).length;
    const overallUnseenCount = unseenPersonalCount + unseenUnitCount;

    // === Update Tab Badge ===
    updatePriorityBadge(overallUnseenCount);

    // === Build Settings Panel UI ===
    const isSettingsOpen = !!window._prioritySettingsOpen;
    let settingsHtml = `
      <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); margin-bottom:12px; padding:12px; box-sizing:border-box; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="togglePrioritySettingsPanel()">
          <span style="font-size:12.5px; font-weight:700; color:var(--text); display:flex; align-items:center; gap:6px;">⚙️ Cá nhân hóa bộ lọc Ưu tiên</span>
          <span id="prioritySettingsArrow" style="font-size:11px; color:var(--text3); transition:transform 0.2s; transform:${isSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)'};">▼</span>
        </div>
        <div id="prioritySettingsContent" style="display:${isSettingsOpen ? 'block' : 'none'}; margin-top:12px; border-top:1px solid var(--border); padding-top:12px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
            <label style="font-size:12px; font-weight:600; color:var(--text2); flex:1;">😴 Số ngày để tính là Trái ngủ đông:</label>
            <input type="number" id="priority_dormant_days" min="1" max="90" value="${settings.dormantDays}" onchange="updatePriorityDormantDaysSetting(this.value)" style="width:60px; padding:4px 6px; border:1px solid var(--border); border-radius:6px; background:var(--surface2); color:var(--text); text-align:center; font-weight:600; font-size:12px; outline:none;" />
          </div>
          <div style="font-size:11px; font-weight:700; color:var(--text3); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">Hiển thị các loại việc Ưu tiên:</div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
    `;

    Object.keys(PRIORITY_GROUP_LABELS).forEach(k => {
      const isChecked = settings.enabledTypes[k] ? 'checked' : '';
      const label = PRIORITY_GROUP_LABELS[k];
      const icon = PRIORITY_ICONS[k];
      settingsHtml += `
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; color:var(--text2); cursor:pointer;">
          <input type="checkbox" data-type="${k}" ${isChecked} onchange="togglePriorityTypeSetting('${k}', this.checked)" style="width:14px; height:14px; accent-color:var(--accent);" />
          <span>${icon} ${k === 'sinka_chua_hoan_thien' ? 'Sinka chưa xong' : label}</span>
        </label>
      `;
    });

    settingsHtml += `
          </div>
        </div>
      </div>
    `;

    // === Filter Pills UI ===
    const filterPillsHtml = `
      <div style="display:flex; gap:8px; margin-bottom:12px;">
        <button onclick="setPriorityFilter('personal')" style="
          flex: 1; padding: 10px; border-radius: 12px; border: 1px solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          background: ${_priorityFilter === 'personal' ? 'var(--accent)' : 'var(--surface)'};
          color: ${_priorityFilter === 'personal' ? 'white' : 'var(--text2)'};
          display: flex; align-items: center; justify-content: center; gap: 6px;
        ">
          👤 Cá nhân ${unseenPersonalCount > 0 ? `<span style="background: ${_priorityFilter === 'personal' ? 'rgba(255,255,255,0.25)' : '#ef4444'}; color: white; font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 10px;">${unseenPersonalCount}</span>` : ''}
        </button>
        <button onclick="setPriorityFilter('unit')" style="
          flex: 1; padding: 10px; border-radius: 12px; border: 1px solid var(--border); font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
          background: ${_priorityFilter === 'unit' ? 'var(--accent)' : 'var(--surface)'};
          color: ${_priorityFilter === 'unit' ? 'white' : 'var(--text2)'};
          display: flex; align-items: center; justify-content: center; gap: 6px;
        ">
          🏢 Đơn vị ${unseenUnitCount > 0 ? `<span style="background: ${_priorityFilter === 'unit' ? 'rgba(255,255,255,0.25)' : '#ef4444'}; color: white; font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 10px;">${unseenUnitCount}</span>` : ''}
        </button>
      </div>
    `;

    const activeItems = _priorityFilter === 'personal' ? personalItems : unitItems;

    if (activeItems.length === 0) {
      listEl.innerHTML = settingsHtml + filterPillsHtml + '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tốt lắm!</div><div class="empty-sub">Không có việc ưu tiên trong mục này</div></div>';
      if (typeof markFresh === 'function') markFresh('priority');
      return;
    }

    // Group active items for display
    const groups = {};
    activeItems.forEach(item => {
      if (!groups[item.task_type]) groups[item.task_type] = [];
      groups[item.task_type].push(item);
    });

    // === Render List ===
    let html = settingsHtml + filterPillsHtml;
    PRIORITY_ORDER.forEach(type => {
      if (!settings.enabledTypes[type]) return; // Skip disabled
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

        let clickAction = `handlePriorityClick('${t.id}','${t.profile_id}','${t.task_type}')`;
        if (type === 'duyet_hapja') {
          clickAction = `openHapjaDetail('${t.hapja_id}');markPriorityItemSeen('${t.id}',null,'duyet_hapja')`;
        }

        html += `<div class="priority-item ${unseenCls} ${overdueCls}" onclick="${clickAction}" style="
          display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px; border-radius: 12px; margin-bottom: 8px; transition: all 0.2s; border: 1px solid var(--border); background: var(--surface);
          opacity: ${t.is_seen ? '0.65' : '1'};
        ">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0;">
            <div class="priority-item-dot" style="
              width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
              background: ${
                type==='duyet_hapja'?'#f97316':
                type==='ngu_dong'?'#ef4444':
                type==='thieu_vai_tro'?'#3b82f6':
                type==='sinka_chua_hoan_thien'?'#a855f7':
                type==='chot_tv_1'?'#ef4444':
                type==='viet_bc_tv'?'#f97316':
                type==='lap_group'?'#8b5cf6':'#22c55e'
              }
            "></div>
            <div style="flex: 1; min-width: 0;">
              <div class="priority-item-name" style="font-size: 13.5px; font-weight: 600; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.title}</div>
              <div class="priority-item-meta" style="font-size: 11px; color: var(--text3); margin-top: 3px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                ${t.meta || timeAgo}${deadlineStr ? ` · ${deadlineStr}` : ''}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
            <!-- Quick action button -->
            ${type === 'viet_bc_tv' ? `
              <button onclick="event.stopPropagation(); openBaoCaoTVFromPriority('${t.profile_id}')" style="
                padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text2); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;
              ">
                📝 Báo cáo
              </button>
            ` : ''}
            ${type === 'viet_bc_bb' ? `
              <button onclick="event.stopPropagation(); openBaoCaoBBFromPriority('${t.profile_id}')" style="
                padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text2); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;
              ">
                📝 Báo cáo
              </button>
            ` : ''}
            ${type === 'duyet_hapja' ? `
              <button onclick="event.stopPropagation(); openHapjaDetail('${t.hapja_id}'); markPriorityItemSeen('${t.id}',null,'duyet_hapja')" style="
                padding: 5px 10px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface2); color: var(--text2); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;
              ">
                📋 Xem/Duyệt
              </button>
            ` : ''}

            <!-- Seen eye toggle -->
            <button onclick="event.stopPropagation(); togglePriorityItemSeen('${t.id}', '${t.profile_id}', '${t.task_type}')" style="
              background: none; border: none; font-size: 15px; cursor: pointer; padding: 4px 8px; display: flex; align-items: center; justify-content: center;
              opacity: ${t.is_seen ? '0.4' : '1'};
              color: ${t.is_seen ? 'var(--text3)' : 'var(--accent)'};
            " title="${t.is_seen ? 'Đánh dấu chưa xem' : 'Đánh dấu đã xem'}">
              👁️
            </button>
          </div>
        </div>`;
      });

      html += '</div>';
    });

    listEl.innerHTML = html;
    if (typeof markFresh === 'function') markFresh('priority');

  } catch(e) {
    console.error('loadPriority:', e);
    listEl.innerHTML = '<div class="empty-state"><div class="empty-sub">❌ Lỗi tải</div></div>';
  }
}

function checkIfItemPersonal(item, myCode) {
  if (item.task_type === 'duyet_hapja') {
    const creator = item.created_by || '';
    const ndd = item.ndd_staff_code || '';
    if (creator === myCode || ndd === myCode) {
      return true;
    }
    return false;
  }

  if (item.profile_id) {
    const p = allProfiles.find(x => x.id === item.profile_id);
    if (p) {
      const isNdd = p.ndd_staff_code === myCode;
      const isTvv = p.tvv_staff_code && p.tvv_staff_code.split(',').map(x => x.trim()).includes(myCode);
      const isGvbb = p.gvbb_staff_code && p.gvbb_staff_code.split(',').map(x => x.trim()).includes(myCode);

      if (isNdd && ['chot_tv_1', 'lap_group', 'thieu_vai_tro', 'ngu_dong'].includes(item.task_type)) {
        return true;
      }
      if (isGvbb && ['viet_bc_bb', 'ngu_dong', 'sinka_chua_hoan_thien'].includes(item.task_type)) {
        return true;
      }
      if (isTvv && ['viet_bc_tv', 'ngu_dong'].includes(item.task_type)) {
        return true;
      }
    }
  } else if (item.staff_code) {
    return item.staff_code === myCode;
  }
  return false;
}

function setPriorityFilter(filterVal) {
  _priorityFilter = filterVal;
  loadPriority();
}

function openBaoCaoTVFromPriority(profileId) {
  if (!profileId) return;
  openProfileById(profileId);
  setTimeout(() => {
    openBaoCaoTV();
  }, 350);
}

function openBaoCaoBBFromPriority(profileId) {
  if (!profileId) return;
  openProfileById(profileId);
  setTimeout(() => {
    openAddRecordModal('bien_ban');
  }, 350);
}

async function togglePriorityItemSeen(taskId, profileId, taskType) {
  if (taskType === 'duyet_hapja' || String(taskId).startsWith('auto_')) {
    let list = getSeenAutoPriorities();
    const idx = list.indexOf(taskId);
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.push(taskId);
    }
    localStorage.setItem('cj_seen_auto_priorities', JSON.stringify(list));
    loadPriority();
  } else {
    try {
      const res = await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}&select=is_seen`);
      const data = await res.json();
      if (data && data.length > 0) {
        const newSeen = !data[0].is_seen;
        await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_seen: newSeen })
        });
      }
      loadPriority();
    } catch(e) {
      console.warn('togglePriorityItemSeen:', e);
    }
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

function togglePrioritySettingsPanel() {
  const content = document.getElementById('prioritySettingsContent');
  const arrow = document.getElementById('prioritySettingsArrow');
  if (!content || !arrow) return;
  const isOpen = content.style.display === 'block';
  content.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  window._prioritySettingsOpen = !isOpen;
}

function updatePriorityDormantDaysSetting(val) {
  const days = parseInt(val) || 7;
  const settings = getPrioritySettings();
  settings.dormantDays = days;
  savePrioritySettings(settings);
  loadPriority();
}

function togglePriorityTypeSetting(type, checked) {
  const settings = getPrioritySettings();
  settings.enabledTypes[type] = checked;
  savePrioritySettings(settings);
  loadPriority();
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

async function markPriorityItemSeen(taskId, profileId, taskType) {
  if (taskType === 'duyet_hapja' || String(taskId).startsWith('auto_')) {
    let list = getSeenAutoPriorities();
    if (!list.includes(taskId)) {
      list.push(taskId);
      localStorage.setItem('cj_seen_auto_priorities', JSON.stringify(list));
    }
    loadPriority();
  } else {
    try {
      await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`, {
        method: 'PATCH', body: JSON.stringify({ is_seen: true })
      });
      loadPriority();
    } catch(e) { console.warn('markPriorityItemSeen:', e); }
  }
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
