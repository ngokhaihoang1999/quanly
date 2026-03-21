// ============ NOTIFICATION MODULE ============
let notifPanelOpen = false;
let notifPrefs = null;

function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;
  let panel = document.getElementById('notifPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    panel.innerHTML = `
      <div class="notif-panel-header">
        <span>🔔 Thông báo</span>
        <div style="display:flex;gap:6px;">
          <button onclick="markAllRead()" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;font-weight:600;">Đọc hết</button>
          <button onclick="openNotifSettings()" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;">⚙️</button>
          <button onclick="toggleNotifPanel()" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;">✕</button>
        </div>
      </div>
      <div class="notif-panel-body" id="notifPanelBody"></div>
    `;
    document.body.appendChild(panel);
  }
  if (notifPanelOpen) {
    panel.classList.add('open');
    loadNotifications();
  } else {
    panel.classList.remove('open');
  }
}

async function loadNotifications() {
  const myCode = getEffectiveStaffCode();
  const body = document.getElementById('notifPanelBody');
  if (!body) return;
  
  try {
    const res = await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&channel=eq.app&order=created_at.desc&limit=50`);
    const notifs = await res.json();
    
    if (notifs.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:13px;">Chưa có thông báo</div>';
      return;
    }
    
    body.innerHTML = notifs.map(n => {
      const timeAgo = getTimeAgo(n.created_at);
      const icon = getNotifIcon(n.event_type);
      const unread = !n.is_read ? 'notif-unread' : '';
      const clickAction = n.profile_id ? `openProfileById('${n.profile_id}');toggleNotifPanel();markNotifRead('${n.id}')` : `markNotifRead('${n.id}')`;
      return `<div class="notif-item ${unread}" onclick="${clickAction}">
        <div class="notif-icon">${icon}</div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          ${n.body ? `<div class="notif-body">${n.body}</div>` : ''}
          <div class="notif-time">${timeAgo}</div>
        </div>
      </div>`;
    }).join('');
  } catch(e) { console.error('loadNotifications:', e); }
}

async function loadNotifCount() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  try {
    const res = await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&channel=eq.app&is_read=eq.false&select=id`, { headers: { 'Prefer': 'count=exact' } });
    const count = parseInt(res.headers.get('content-range')?.split('/')[1] || '0');
    const badge = document.getElementById('notifBadge');
    if (badge) {
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = '';
      } else {
        badge.style.display = 'none';
      }
    }
  } catch(e) {}
}

async function markNotifRead(notifId) {
  try {
    await sbFetch(`/rest/v1/notifications?id=eq.${notifId}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    loadNotifCount();
  } catch(e) {}
}

async function markAllRead() {
  const myCode = getEffectiveStaffCode();
  try {
    await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&is_read=eq.false`, {
      method: 'PATCH', body: JSON.stringify({ is_read: true })
    });
    showToast('✅ Đã đọc tất cả');
    loadNotifications();
    loadNotifCount();
  } catch(e) {}
}

function getNotifIcon(type) {
  const map = {
    hapja_created: '🍎', hapja_approved: '✅', hapja_rejected: '❌',
    chot_tv: '📅', bc_tv: '📝', chot_bb: '🎓', bc_bb: '📋',
    mo_kt: '📖', drop_out: '🔴', chot_center: '🏛️', reminder: '⏰'
  };
  return map[type] || '🔔';
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ============ CREATE NOTIFICATIONS ============
async function createNotification(recipients, eventType, title, body, profileId) {
  const myCode = getEffectiveStaffCode();
  const uniqueRecipients = [...new Set(recipients.filter(r => r && r !== myCode))];
  
  for (const staffCode of uniqueRecipients) {
    try {
      // Always create app notification
      await sbFetch('/rest/v1/notifications', { method: 'POST', body: JSON.stringify({
        recipient_staff_code: staffCode, event_type: eventType,
        title, body, profile_id: profileId || null,
        source_staff_code: myCode, channel: 'app'
      })});
      
      // Check if user wants chat notification too
      // (for now skip chat — will be handled by bot cron)
    } catch(e) { console.warn('createNotification fail for', staffCode, e); }
  }
}

// Helper: get all staff involved with a profile (NDD, TVV, GVBB)
async function getProfileStakeholders(profileId) {
  const codes = new Set();
  const p = allProfiles.find(x => x.id === profileId);
  if (p?.ndd_staff_code) codes.add(p.ndd_staff_code);
  
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs || []).forEach(fg => (fg.fruit_roles || []).forEach(r => {
      if (r.staff_code) codes.add(r.staff_code);
    }));
  } catch(e) {}
  
  return [...codes];
}

function openNotifSettings() {
  showToast('⚙️ Cài đặt thông báo — sắp ra mắt');
  // TODO: implement notification preferences UI
}

// Auto-refresh notification count every 30 seconds
setInterval(() => { if (typeof loadNotifCount === 'function') loadNotifCount(); }, 30000);

// Load count on init (deferred)
setTimeout(() => { if (typeof loadNotifCount === 'function') loadNotifCount(); }, 2000);
