// ============ PRIORITY TASKS MODULE ============

const PRIORITY_ICONS = {
  chot_tv_1: '🔴', viet_bc_tv: '🟠', hoc_bb: '🟢', viet_bc_bb: '🟢', duyet_hapja: '📋'
};
const PRIORITY_GROUP_LABELS = {
  chot_tv_1: 'Cần Chốt TV',
  viet_bc_tv: 'Cần viết Báo cáo TV',
  hoc_bb: 'Cần học BB',
  viet_bc_bb: 'Cần viết Báo cáo BB',
  duyet_hapja: 'Duyệt Check Hapja'
};
const PRIORITY_ORDER = ['duyet_hapja', 'chot_tv_1', 'viet_bc_tv', 'viet_bc_bb', 'hoc_bb'];

async function loadPriority() {
  const myCode = getEffectiveStaffCode();
  const listEl = document.getElementById('priorityList');
  if (!listEl) return;
  
  try {
    const res = await sbFetch(`/rest/v1/priority_tasks?staff_code=eq.${myCode}&is_completed=eq.false&select=*,profiles:profile_id(full_name,phase)&order=created_at.desc`);
    const tasks = await res.json();
    
    if (tasks.length === 0) {
      listEl.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><div class="empty-title">Tốt lắm!</div><div class="empty-sub">Không có việc ưu tiên cần xử lý</div></div>';
      return;
    }
    
    // Group by task_type
    const groups = {};
    tasks.forEach(t => {
      if (!groups[t.task_type]) groups[t.task_type] = [];
      groups[t.task_type].push(t);
    });
    
    let html = '';
    PRIORITY_ORDER.forEach(type => {
      const items = groups[type];
      if (!items || items.length === 0) return;
      
      const icon = PRIORITY_ICONS[type] || '⚡';
      const label = PRIORITY_GROUP_LABELS[type] || type;
      
      html += `<div class="priority-group">
        <div class="priority-group-header">
          <span>${icon} ${label}</span>
          <span class="priority-count">${items.length}</span>
        </div>`;
      
      items.forEach(t => {
        const pName = t.profiles?.full_name || 'N/A';
        const timeAgo = getTimeAgo(t.created_at);
        const deadlineStr = t.deadline ? formatDeadline(t.deadline) : '';
        const seenCls = t.is_seen ? 'priority-seen' : '';
        
        html += `<div class="priority-item ${seenCls}" onclick="handlePriorityClick('${t.id}', '${t.profile_id}', '${t.task_type}')">
          <div class="priority-item-main">
            <div class="priority-item-name">${pName}</div>
            <div class="priority-item-meta">${timeAgo}${deadlineStr ? ` · ⏰ ${deadlineStr}` : ''}</div>
          </div>
          <div class="priority-item-actions">
            ${!t.is_seen ? `<button onclick="event.stopPropagation();markTaskSeen('${t.id}')" class="priority-seen-btn" title="Đã xem">👁</button>` : ''}
          </div>
        </div>`;
      });
      
      html += '</div>';
    });
    
    listEl.innerHTML = html;
  } catch(e) {
    console.error('loadPriority:', e);
    listEl.innerHTML = '<div class="empty-state"><div class="empty-sub">Lỗi tải</div></div>';
  }
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  
  if (diff < 0) {
    const overdue = Math.abs(Math.floor(diff / 3600000));
    return `🔴 Quá hạn ${overdue}h`;
  }
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `⏰ Còn ${Math.floor(diff/60000)} phút`;
  if (hours < 24) return `Còn ${hours}h`;
  return d.toLocaleDateString('vi-VN');
}

async function handlePriorityClick(taskId, profileId, taskType) {
  // Mark as seen
  await markTaskSeen(taskId);
  // Navigate to the profile
  if (profileId) openProfileById(profileId);
}

async function markTaskSeen(taskId) {
  try {
    await sbFetch(`/rest/v1/priority_tasks?id=eq.${taskId}`, { method: 'PATCH', body: JSON.stringify({ is_seen: true }) });
    loadPriority();
  } catch(e) {}
}

// ============ AUTO-CREATE PRIORITY TASKS ============

async function createPriorityTask(staffCode, profileId, taskType, title, deadline) {
  try {
    // Check if task already exists (avoid duplicates)
    const checkRes = await sbFetch(`/rest/v1/priority_tasks?staff_code=eq.${staffCode}&profile_id=eq.${profileId}&task_type=eq.${taskType}&is_completed=eq.false&select=id&limit=1`);
    const existing = await checkRes.json();
    if (existing.length > 0) return; // already exists
    
    await sbFetch('/rest/v1/priority_tasks', { method: 'POST', body: JSON.stringify({
      staff_code: staffCode, profile_id: profileId, task_type: taskType,
      title, deadline: deadline || null
    })});
  } catch(e) { console.warn('createPriorityTask:', e); }
}

async function completePriorityTask(profileId, taskType) {
  try {
    await sbFetch(`/rest/v1/priority_tasks?profile_id=eq.${profileId}&task_type=eq.${taskType}&is_completed=eq.false`, {
      method: 'PATCH', body: JSON.stringify({ is_completed: true })
    });
  } catch(e) { console.warn('completePriorityTask:', e); }
}
