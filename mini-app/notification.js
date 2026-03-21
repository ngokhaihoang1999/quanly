// ============ NOTIFICATION MODULE ============
let notifPanelOpen = false;
let _notifPrefsCache = null;

// ─── PANEL ────────────────────────────────────────────────────────────────────
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
        <div style="display:flex;align-items:center;gap:6px;">
          <button onclick="markAllRead()" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;font-weight:600;padding:4px;">Đọc hết</button>
          <button onclick="openNotifSettings()" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;padding:4px;" title="Cài đặt">⚙️</button>
          <button onclick="toggleNotifPanel()" style="background:none;border:none;color:var(--text3);font-size:16px;cursor:pointer;padding:4px;">✕</button>
        </div>
      </div>
      <div class="notif-panel-body" id="notifPanelBody"></div>
    `;
    document.body.appendChild(panel);
    // Close on outside click
    document.addEventListener('click', (e) => {
      const p = document.getElementById('notifPanel');
      const bell = document.getElementById('notifBell');
      if (p && notifPanelOpen && !p.contains(e.target) && !bell?.contains(e.target)) {
        notifPanelOpen = false;
        p.classList.remove('open');
      }
    });
  }
  if (notifPanelOpen) { panel.classList.add('open'); loadNotifications(); }
  else panel.classList.remove('open');
}

async function loadNotifications() {
  const myCode = getEffectiveStaffCode();
  const body = document.getElementById('notifPanelBody');
  if (!body || !myCode) return;
  body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">⌛ Đang tải...</div>';
  try {
    const res = await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&channel=eq.app&order=created_at.desc&limit=50`);
    const notifs = await res.json();
    if (!Array.isArray(notifs) || notifs.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Chưa có thông báo nào</div>';
      return;
    }
    body.innerHTML = notifs.map(n => {
      const timeAgo = getTimeAgo(n.created_at);
      const icon = getNotifIcon(n.event_type);
      const unreadCls = !n.is_read ? 'notif-unread' : '';
      const clickFn = n.profile_id
        ? `openProfileById('${n.profile_id}');toggleNotifPanel();markNotifRead('${n.id}')`
        : `markNotifRead('${n.id}')`;
      return `<div class="notif-item ${unreadCls}" onclick="${clickFn}">
        <div class="notif-icon">${icon}</div>
        <div class="notif-content">
          <div class="notif-title">${n.title}</div>
          ${n.body ? `<div class="notif-body">${n.body}</div>` : ''}
          <div class="notif-time">${timeAgo}</div>
        </div>
        ${!n.is_read ? '<div class="notif-dot"></div>' : ''}
      </div>`;
    }).join('');
  } catch(e) {
    body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">❌ Lỗi tải thông báo</div>';
    console.error('loadNotifications:', e);
  }
}

async function loadNotifCount() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  try {
    const res = await sbFetch(
      `/rest/v1/notifications?recipient_staff_code=eq.${myCode}&channel=eq.app&is_read=eq.false&select=id`,
      { headers: { 'Prefer': 'count=exact' } }
    );
    const cr = res.headers?.get('content-range') || '';
    const count = parseInt(cr.split('/')[1] || '0') || 0;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? '' : 'none';
    }
  } catch(e) {}
}

async function markNotifRead(id) {
  try {
    await sbFetch(`/rest/v1/notifications?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    loadNotifCount();
    // Also refresh panel if open
    const body = document.getElementById('notifPanelBody');
    if (body) {
      const item = body.querySelector(`[onclick*="${id}"]`);
      if (item) { item.classList.remove('notif-unread'); const dot = item.querySelector('.notif-dot'); if (dot) dot.remove(); }
    }
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
  } catch(e) { showToast('❌ Lỗi'); }
}

function getNotifIcon(type) {
  const icons = {
    hapja_created:'🍎', hapja_approved:'✅', hapja_rejected:'❌',
    chot_tv:'📅', bc_tv:'📝', chot_bb:'🎓', bc_bb:'📋',
    mo_kt:'📖', drop_out:'🔴', chot_center:'🏛️', reminder:'⏰'
  };
  return icons[type] || '🔔';
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}

// ─── CREATE NOTIFICATIONS ──────────────────────────────────────────────────────
const ALL_EVENT_TYPES = [
  'hapja_created','hapja_approved','hapja_rejected',
  'chot_tv','bc_tv','chot_bb','bc_bb','mo_kt','drop_out','chot_center','reminder'
];

async function getMyPrefs() {
  if (_notifPrefsCache) return _notifPrefsCache;
  const myCode = getEffectiveStaffCode();
  try {
    const res = await sbFetch(`/rest/v1/notification_preferences?staff_code=eq.${myCode}&select=*&limit=1`);
    const rows = await res.json();
    if (rows.length > 0) {
      _notifPrefsCache = rows[0];
    } else {
      // Default: app=all, chat=none
      _notifPrefsCache = { app_events: ALL_EVENT_TYPES, chat_events: [] };
    }
  } catch(e) {
    _notifPrefsCache = { app_events: ALL_EVENT_TYPES, chat_events: [] };
  }
  return _notifPrefsCache;
}

async function createNotification(recipients, eventType, title, bodyText, profileId) {
  if (!recipients || recipients.length === 0) return;
  const myCode = getEffectiveStaffCode();
  const unique = [...new Set(recipients.filter(r => r))];

  for (const staffCode of unique) {
    try {
      // Get prefs for this recipient (use default if not fetched)
      // For simplicity: always create app notification, check only for own prefs
      await sbFetch('/rest/v1/notifications', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          recipient_staff_code: staffCode,
          event_type: eventType,
          title: title,
          body: bodyText || null,
          profile_id: profileId || null,
          source_staff_code: myCode || null,
          channel: 'app',
          is_read: false
        })
      });
    } catch(e) {
      console.error('createNotification fail for', staffCode, ':', e);
    }
  }
  // Refresh count if we're a recipient
  if (unique.includes(myCode)) loadNotifCount();
  else loadNotifCount(); // refresh anyway in case recipient is current user
}

// Find all staff who can approve hapjas (query DB directly — reliable)
async function getApproverCodes() {
  try {
    // Get positions with approve_hapja permission
    const posRes = await sbFetch('/rest/v1/positions?select=code,permissions');
    const positions = await posRes.json();
    const approverPosCodes = (positions || [])
      .filter(p => {
        const perms = Array.isArray(p.permissions) ? p.permissions : (p.permissions || '').split(',');
        return perms.includes('approve_hapja');
      })
      .map(p => p.code);
    if (approverPosCodes.length === 0) return [];
    // Get staff in those positions
    const staffRes = await sbFetch(`/rest/v1/staff?position=in.(${approverPosCodes.join(',')})&select=staff_code`);
    const staffRows = await staffRes.json();
    return (staffRows || []).map(s => s.staff_code).filter(Boolean);
  } catch(e) {
    console.warn('getApproverCodes fail:', e);
    return [];
  }
}

// Get all staff involved with a profile (NDD, TVV, GVBB)
async function getProfileStakeholders(profileId) {
  const codes = new Set();
  const p = (allProfiles || []).find(x => x.id === profileId);
  if (p?.ndd_staff_code) codes.add(p.ndd_staff_code);
  try {
    const res = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
    const fgs = await res.json();
    (fgs || []).forEach(fg => (fg.fruit_roles || []).forEach(r => { if (r.staff_code) codes.add(r.staff_code); }));
  } catch(e) {}
  return [...codes];
}

// ─── NOTIFICATION SETTINGS ─────────────────────────────────────────────────────
const NOTIF_EVENT_LABELS = {
  hapja_created:  { label: 'Phiếu Hapja mới',      icon: '🍎' },
  hapja_approved: { label: 'Hapja được duyệt',      icon: '✅' },
  hapja_rejected: { label: 'Hapja bị từ chối',      icon: '❌' },
  chot_tv:        { label: 'Chốt TV',               icon: '📅' },
  bc_tv:          { label: 'Báo cáo TV mới',        icon: '📝' },
  chot_bb:        { label: 'Chốt BB',               icon: '🎓' },
  bc_bb:          { label: 'Báo cáo BB mới',        icon: '📋' },
  mo_kt:          { label: 'Mở KT',                 icon: '📖' },
  drop_out:       { label: 'Drop-out',              icon: '🔴' },
  chot_center:    { label: 'Chốt Center',           icon: '🏛️' },
  reminder:       { label: 'Nhắc nhở lịch',         icon: '⏰' },
};

async function openNotifSettings() {
  // Close notif panel first
  notifPanelOpen = false;
  const panel = document.getElementById('notifPanel');
  if (panel) panel.classList.remove('open');

  // Ensure modal exists
  let modal = document.getElementById('notifSettingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notifSettingsModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeModal('notifSettingsModal'); };
    modal.innerHTML = `
      <div class="modal" style="max-height:85vh;">
        <div class="modal-handle"></div>
        <div class="modal-title">⚙️ Cài đặt thông báo</div>
        <div id="notifSettingsBody"></div>
        <button class="save-btn" onclick="saveNotifSettings()">💾 Lưu cài đặt</button>
      </div>`;
    document.body.appendChild(modal);
  }

  // Load current prefs
  _notifPrefsCache = null;
  const prefs = await getMyPrefs();
  const appSet  = new Set(prefs.app_events  || ALL_EVENT_TYPES);
  const chatSet = new Set(prefs.chat_events || []);

  const body = document.getElementById('notifSettingsBody');
  body.innerHTML = `
    <div style="margin-bottom:12px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);border:1px solid var(--border);font-size:12px;color:var(--text2);">
      📱 <b>Trong App</b>: Hiện trong danh sách 🔔 — Mặc định <b>bật hết</b><br>
      💬 <b>Qua Chat</b>: Bot gửi tin nhắn Telegram trực tiếp — Mặc định <b>tắt hết</b>
    </div>
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;margin-bottom:6px;padding:0 4px;">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;">Loại thông báo</div>
      <div style="font-size:11px;font-weight:700;color:var(--accent);text-align:center;min-width:44px;">App</div>
      <div style="font-size:11px;font-weight:700;color:var(--green);text-align:center;min-width:44px;">Chat</div>
    </div>
    ${ALL_EVENT_TYPES.map(type => {
      const info = NOTIF_EVENT_LABELS[type] || { label: type, icon: '🔔' };
      const appOn  = appSet.has(type);
      const chatOn = chatSet.has(type);
      return `<div style="display:grid;grid-template-columns:1fr auto auto;gap:6px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border);">
        <div><span style="margin-right:6px;">${info.icon}</span><span style="font-size:13px;">${info.label}</span></div>
        <div style="text-align:center;">
          <label class="notif-toggle" style="min-width:44px;">
            <input type="checkbox" id="nset_app_${type}" ${appOn ? 'checked' : ''}>
            <span class="notif-toggle-slider"></span>
          </label>
        </div>
        <div style="text-align:center;">
          <label class="notif-toggle" style="min-width:44px;">
            <input type="checkbox" id="nset_chat_${type}" ${chatOn ? 'checked' : ''}>
            <span class="notif-toggle-slider notif-toggle-chat"></span>
          </label>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:12px;margin-bottom:4px;">
      <button onclick="setAllNotifPrefs(true,false)" style="flex:1;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text2);font-size:12px;cursor:pointer;">App bật hết ✅</button>
      <button onclick="setAllNotifPrefs(false,true)" style="flex:1;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text2);font-size:12px;cursor:pointer;">Tắt hết 🔕</button>
    </div>`;

  modal.classList.add('open');
}

function setAllNotifPrefs(appOn, chatOn) {
  ALL_EVENT_TYPES.forEach(type => {
    const appEl  = document.getElementById(`nset_app_${type}`);
    const chatEl = document.getElementById(`nset_chat_${type}`);
    if (appEl)  appEl.checked  = appOn;
    if (chatEl) chatEl.checked = chatOn;
  });
}

async function saveNotifSettings() {
  const myCode = getEffectiveStaffCode();
  const appEvents  = ALL_EVENT_TYPES.filter(t => document.getElementById(`nset_app_${t}`)?.checked);
  const chatEvents = ALL_EVENT_TYPES.filter(t => document.getElementById(`nset_chat_${t}`)?.checked);
  try {
    // Upsert preference
    await sbFetch('/rest/v1/notification_preferences', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ staff_code: myCode, app_events: appEvents, chat_events: chatEvents })
    });
    _notifPrefsCache = { app_events: appEvents, chat_events: chatEvents };
    showToast('✅ Đã lưu cài đặt');
    closeModal('notifSettingsModal');
  } catch(e) { showToast('❌ Lỗi lưu'); console.error(e); }
}

// ─── AUTO-REFRESH ─────────────────────────────────────────────────────────────
setInterval(loadNotifCount, 30000);
