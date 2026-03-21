// ============ PRIORITY TASKS MODULE ============

const PRIORITY_ICONS = {
  duyet_hapja: '🍎',
  chot_tv_1: '🔴',
  viet_bc_tv: '🟠',
  hoc_bb: '🟢',
  viet_bc_bb: '🟢'
};
const PRIORITY_GROUP_LABELS = {
  duyet_hapja: 'Duyệt Check Hapja',
  chot_tv_1: 'Cần Chốt TV lần 1',
  viet_bc_tv: 'Cần viết Báo cáo TV',
  hoc_bb: 'Cần học BB',
  viet_bc_bb: 'Cần viết Báo cáo BB'
};
const PRIORITY_ORDER = ['duyet_hapja', 'chot_tv_1', 'viet_bc_tv', 'viet_bc_bb', 'hoc_bb'];

async function loadPriority() {
  const myCode = getEffectiveStaffCode();
  const listEl = document.getElementById('priorityList');
  if (!listEl) return;

  listEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">⌛ Đang tải...</div>';

  try {
    // Get all staff in my managed scope
    const scopeCodes = typeof getMyManagedStaffCodes === 'function' ? getMyManagedStaffCodes() : [myCode];
    const codesStr = scopeCodes.join(',');

    // === Parallel fetch ===
    const [hapjaRes, tasksRes] = await Promise.all([
      // "Duyệt Hapja": visible to anyone with approve_hapja permission
      hasPermission('approve_hapja')
        ? sbFetch(`/rest/v1/check_hapja?status=eq.pending&select=id,full_name,created_by,created_at,data&order=created_at.asc`)
        : Promise.resolve(null),
      // Priority tasks for entire managed scope
      sbFetch(`/rest/v1/priority_tasks?staff_code=in.(${codesStr})&is_completed=eq.false&select=*&order=created_at.desc`)
    ]);

    const pendingHapjas = hapjaRes ? await hapjaRes.json() : [];
    const tasks = await tasksRes.json();

    // === Build groups ===
    const groups = {};

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

    // Check if nothing
    const totalCount = Object.values(groups).reduce((sum, g) => sum + g.length, 0);
    if (totalCount === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tốt lắm!</div><div class="empty-sub">Không có việc ưu tiên cần xử lý</div></div>';
      updatePriorityBadge(0);
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
        } else {
          clickAction = `handlePriorityClick('${t.id}','${t.profile_id}','${t.task_type}')`;
        }

        html += `<div class="priority-item ${unseenCls} ${overdueCls}" onclick="${clickAction}">
          <div class="priority-item-dot" style="background:${type==='duyet_hapja'?'#f97316':type==='chot_tv_1'?'#ef4444':type==='viet_bc_tv'?'#f97316':'#22c55e'}"></div>
          <div class="priority-item-main">
            <div class="priority-item-name">${t.title}</div>
            <div class="priority-item-meta">${t.meta || timeAgo}${deadlineStr ? ` · ${deadlineStr}` : ''}</div>
          </div>
          ${!t.is_seen && type !== 'duyet_hapja' ? `<button onclick="event.stopPropagation();markPriorityItemSeen('${t.id}','${t.profile_id}','${t.task_type}')" class="priority-seen-btn" title="Đã xem">👁</button>` : ''}
        </div>`;
      });

      html += '</div>';
    });

    listEl.innerHTML = html;
    updatePriorityBadge(totalCount);

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
  return `📅 ${d.toLocaleDateString('vi-VN')}`;
}

async function handlePriorityClick(taskId, profileId, taskType) {
  await markPriorityItemSeen(taskId, profileId, taskType);
  if (profileId && profileId !== 'null') openProfileById(profileId);
}

async function markPriorityItemSeen(taskId, profileId, taskType) {
  if (taskType === 'duyet_hapja') return; // handled by hapja modal open
  try {
    await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`, {
      method: 'PATCH', body: JSON.stringify({ is_seen: true })
    });
    loadPriority(); // refresh to push seen items down
  } catch(e) { console.warn('markPriorityItemSeen:', e); }
}

// ============ AUTO-CREATE PRIORITY TASKS ============
async function createPriorityTask(staffCode, profileId, taskType, title, deadline) {
  if (!staffCode) return;
  try {
    // Avoid duplicates
    const checkRes = await sbFetch(`/rest/v1/priority_tasks?staff_code=eq.${staffCode}&profile_id=eq.${profileId}&task_type=eq.${taskType}&is_completed=eq.false&select=id&limit=1`);
    const existing = await checkRes.json();
    if (existing.length > 0) {
      // If deadline changed, update it
      if (deadline) {
        await sbFetch(`/rest/v1/priority_tasks?id=eq.${existing[0].id}`, {
          method: 'PATCH', body: JSON.stringify({ deadline })
        });
      }
      return;
    }
    await sbFetch('/rest/v1/priority_tasks', {
      method: 'POST', body: JSON.stringify({
        staff_code: staffCode, profile_id: profileId,
        task_type: taskType, title, deadline: deadline || null
      })
    });
    // Refresh priority if tab is open
    if (document.getElementById('tab-priority')?.style.display !== 'none') loadPriority();
    else loadPriority(); // still refresh badge
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

// Auto-refresh priority every 60s
setInterval(() => { if (typeof loadPriority === 'function') loadPriority(); }, 60000);
