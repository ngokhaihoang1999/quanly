// ============ NOTIFICATION MODULE ============
let notifPanelOpen = false;
let _notifPrefsCache = null;

// ─── PANEL ────────────────────────────────────────────────────────────────────
function toggleNotifPanel() {
  notifPanelOpen = !notifPanelOpen;

  // Backdrop for click-outside
  let backdrop = document.getElementById('notifBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'notifBackdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;z-index:598;background:transparent;';
    backdrop.onclick = () => { notifPanelOpen = false; document.getElementById('notifPanel')?.classList.remove('open'); backdrop.style.display = 'none'; };
    document.body.appendChild(backdrop);
  }

  let panel = document.getElementById('notifPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'notifPanel';
    panel.className = 'notif-panel';
    panel.innerHTML = `
      <div class="notif-panel-header">
        <span>🔔 Thông báo</span>
        <div style="display:flex;align-items:center;gap:4px;">
          <button onclick="markAllRead()" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;font-weight:600;padding:6px;">Đọc hết</button>
          <button onclick="openNotifSettings()" style="background:none;border:none;color:var(--text3);font-size:14px;cursor:pointer;padding:6px;" title="Cài đặt">⚙️</button>
          <button onclick="notifPanelOpen=false;document.getElementById('notifPanel').classList.remove('open');document.getElementById('notifBackdrop').style.display='none';" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:6px;line-height:1;">✕</button>
        </div>
      </div>
      <div class="notif-panel-body" id="notifPanelBody"></div>
    `;
    document.body.appendChild(panel);
  }

  if (notifPanelOpen) {
    panel.classList.add('open');
    backdrop.style.display = '';
    loadNotifications();
  } else {
    panel.classList.remove('open');
    backdrop.style.display = 'none';
  }
}

async function loadNotifications() {
  const myCode = getEffectiveStaffCode();
  const body = document.getElementById('notifPanelBody');
  if (!body || !myCode) return;
  body.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">⌛ Đang tải...</div>';
  try {
    const res = await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&channel=eq.app&order=created_at.desc&limit=60`);
    const notifs = await res.json();
    if (!Array.isArray(notifs) || notifs.length === 0) {
      body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Chưa có thông báo nào</div>';
      return;
    }
    body.innerHTML = notifs.map(n => {
      const timeAgo = getTimeAgo(n.created_at);
      const icon = getNotifIcon(n.event_type);
      const unreadCls = !n.is_read ? 'notif-unread' : '';
      const navFn = getNotifNavFn(n);
      return `<div class="notif-item ${unreadCls}" onclick="${navFn}">
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

// Build onclick function for a notification based on its event_type
function getNotifNavFn(n) {
  const markRead = `markNotifRead('${n.id}')`;
  const closePanel = `notifPanelOpen=false;document.getElementById('notifPanel')?.classList.remove('open');document.getElementById('notifBackdrop').style.display='none';`;

  switch (n.event_type) {
    case 'hapja_created':
      return `${markRead};${closePanel};switchMainTab(document.querySelector('[data-tab=\\'unit\\']'),'unit');setTimeout(()=>{ const el=document.getElementById('pendingHapjaSection'); if(el) el.scrollIntoView({behavior:'smooth'}); },300);`;
    case 'hapja_approved':
    case 'hapja_rejected':
    case 'chot_tv':
    case 'bc_tv':
    case 'lap_group_tv_bb':
    case 'bc_bb':
    case 'mo_kt':
    case 'drop_out':
    case 'pause':
    case 'chot_center':
      if (n.profile_id) {
        return `${markRead};${closePanel};openProfileById('${n.profile_id}');`;
      }
      return markRead;
    case 'reminder':
    case 'bb_reminder':
    case 'bb_report_reminder':
      if (n.profile_id) {
        return `${markRead};${closePanel};openProfileById('${n.profile_id}');`;
      }
      return `${markRead};${closePanel};switchMainTab(document.querySelector('[data-tab=\\'calendar\\']'),'calendar');`;
    default:
      return markRead;
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
    const item = document.querySelector(`#notifPanelBody .notif-item.notif-unread`);
    if (item) { item.classList.remove('notif-unread'); const dot = item.querySelector('.notif-dot'); dot?.remove(); }
  } catch(e) {}
}

async function markAllRead() {
  const myCode = getEffectiveStaffCode();
  try {
    await sbFetch(`/rest/v1/notifications?recipient_staff_code=eq.${myCode}&is_read=eq.false`,
      { method: 'PATCH', body: JSON.stringify({ is_read: true }) });
    showToast('✅ Đã đọc tất cả');
    loadNotifications();
    loadNotifCount();
  } catch(e) { showToast('❌ Lỗi'); }
}

function getNotifIcon(type) {
  const m = {
    hapja_created:'🍎', hapja_approved:'✅', hapja_rejected:'❌',
    chot_tv:'📅', bc_tv:'📝',
    lap_group_tv_bb:'🎓', bc_bb:'📋',
    mo_kt:'📖', drop_out:'🔴', pause:'⏸️', chot_center:'🏛️', reminder:'⏰',
    bb_reminder:'📚', bb_report_reminder:'✍️', bb_milestone:'⭐'
  };
  return m[type] || '🔔';
}

// getTimeAgo() → moved to utils.js


// ─── SCOPE HELPERS ────────────────────────────────────────────────────────────
// Get all managers (GYJN→TJN→YJYN) above a staff member
function getManagersForStaffCode(staffCode) {
  const managers = new Set();
  const staffItem = (allStaff || []).find(s => s.staff_code === staffCode);
  const teamId = staffItem?.team_id;
  if (!teamId) return [];
  for (const area of (structureData || [])) {
    for (const group of (area.org_groups || [])) {
      for (const team of (group.teams || [])) {
        if (String(team.id) === String(teamId)) {
          if (team.gyjn_staff_code && team.gyjn_staff_code !== staffCode) managers.add(team.gyjn_staff_code);
          if (team.bgyjn_staff_code && team.bgyjn_staff_code !== staffCode) managers.add(team.bgyjn_staff_code);
          if (group.tjn_staff_code && group.tjn_staff_code !== staffCode) managers.add(group.tjn_staff_code);
          if (area.yjyn_staff_code && area.yjyn_staff_code !== staffCode) managers.add(area.yjyn_staff_code);
        }
      }
    }
  }
  return [...managers];
}

// Get all staff_codes managed by myCode (their entire scope downward)
// Also includes GVBB staff from fruit_roles for profiles in scope
async function getMyManagedStaffCodes() {
  const myCode = getEffectiveStaffCode();
  const managed = new Set([myCode]);
  for (const area of (structureData || [])) {
    // YJYN → manages entire area
    if (area.yjyn_staff_code === myCode) {
      for (const group of (area.org_groups || [])) {
        if (group.tjn_staff_code) managed.add(group.tjn_staff_code);
        for (const team of (group.teams || [])) {
          if (team.gyjn_staff_code) managed.add(team.gyjn_staff_code);
          if (team.bgyjn_staff_code) managed.add(team.bgyjn_staff_code);
          (allStaff || []).filter(s => String(s.team_id) === String(team.id)).forEach(s => managed.add(s.staff_code));
        }
      }
      // Also include all GVBBs assigned to profiles whose NDD is in area scope
      await _addGvbbForScope(managed);
      return [...managed];
    }
    for (const group of (area.org_groups || [])) {
      // TJN → manages entire group
      if (group.tjn_staff_code === myCode) {
        for (const team of (group.teams || [])) {
          if (team.gyjn_staff_code) managed.add(team.gyjn_staff_code);
          if (team.bgyjn_staff_code) managed.add(team.bgyjn_staff_code);
          (allStaff || []).filter(s => String(s.team_id) === String(team.id)).forEach(s => managed.add(s.staff_code));
        }
        await _addGvbbForScope(managed);
        return [...managed];
      }
      for (const team of (group.teams || [])) {
        // GYJN/BGYJN → manages their team
        if (team.gyjn_staff_code === myCode || team.bgyjn_staff_code === myCode) {
          if (team.gyjn_staff_code) managed.add(team.gyjn_staff_code);
          if (team.bgyjn_staff_code) managed.add(team.bgyjn_staff_code);
          (allStaff || []).filter(s => String(s.team_id) === String(team.id)).forEach(s => managed.add(s.staff_code));
          await _addGvbbForScope(managed);
          return [...managed];
        }
      }
    }
  }
  return [...managed];
}

// Fetch GVBB codes from fruit_roles for profiles whose NDD is in the given scope set
async function _addGvbbForScope(scopeSet) {
  try {
    const ndds = [...scopeSet].join(',');
    // Get profile_ids of profiles whose NDD is in scope
    const pRes = await sbFetch(`/rest/v1/profiles?ndd_staff_code=in.(${ndds})&select=id`);
    const profiles = await pRes.json();
    if (!profiles.length) return;
    const pids = profiles.map(p => `"${p.id}"`).join(',');
    // Get all fruit_groups for those profiles
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=in.(${pids})&select=fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs || []).forEach(fg => (fg.fruit_roles || []).forEach(r => {
      if (r.staff_code) scopeSet.add(r.staff_code); // includes NDD, TVV, GVBB
    }));
  } catch(e) { console.warn('_addGvbbForScope:', e); }
}

// ─── CREATE NOTIFICATIONS ──────────────────────────────────────────────────────
const ALL_EVENT_TYPES = [
  'hapja_created','hapja_approved','hapja_rejected',
  'chot_tv','bc_tv','lap_group_tv_bb','bc_bb','mo_kt','drop_out','pause','chot_center','reminder','bb_reminder','bb_report_reminder','bb_milestone'
];

async function getMyPrefs() {
  if (_notifPrefsCache) return _notifPrefsCache;
  const myCode = getEffectiveStaffCode();
  try {
    const res = await sbFetch(`/rest/v1/notification_preferences?staff_code=eq.${myCode}&select=*&limit=1`);
    const rows = await res.json();
    _notifPrefsCache = rows.length > 0 ? rows[0] : { app_events: ALL_EVENT_TYPES, chat_events: [] };
  } catch(e) { _notifPrefsCache = { app_events: ALL_EVENT_TYPES, chat_events: [] }; }
  return _notifPrefsCache;
}

async function createNotification(recipients, eventType, title, bodyText, profileId) {
  if (!recipients || recipients.length === 0) return;
  const myCode = getEffectiveStaffCode();
  const unique = [...new Set(recipients.filter(r => r))];

  // 1. Create in-app notifications
  for (const staffCode of unique) {
    try {
      const r = await sbFetch('/rest/v1/notifications', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          recipient_staff_code: staffCode, event_type: eventType,
          title, body: bodyText || null, profile_id: profileId || null,
          source_staff_code: myCode || null, channel: 'app', is_read: false
        })
      });
      if (!r.ok) console.error('createNotification fail', staffCode, await r.text());
    } catch(e) { console.error('createNotification error for', staffCode, ':', e); }
  }
  loadNotifCount();

  // 2. Send Telegram chat notifications via Edge Function (fire-and-forget)
  // Use raw fetch (not sbFetch) to avoid Prefer:return=representation header conflict
  try {
    const edgeUrl = SUPABASE_URL + '/functions/v1/send-notification';
    fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        staff_codes: unique,
        event_type: eventType,
        title,
        body: bodyText || null,
        profile_id: profileId || null
      })
    }).then(r => {
      if (!r.ok) r.text().then(t => console.warn('send-notification edge fn error:', t));
      else r.json().then(d => console.log('send-notification ok:', d?.results?.filter(r=>r.sent).length, 'sent'));
    }).catch(e => console.warn('send-notification fetch error:', e));
  } catch(e) { console.warn('send-notification call error:', e); }
}

// Find approvers from DB (reliable, no in-memory dependency)
async function getApproverCodes() {
  try {
    const posRes = await sbFetch('/rest/v1/positions?select=code,permissions');
    const positions = await posRes.json();
    const approverPosCodes = (positions || [])
      .filter(p => {
        const perms = Array.isArray(p.permissions) ? p.permissions : [];
        return perms.includes('approve_hapja');
      }).map(p => p.code);
    if (!approverPosCodes.length) return [];
    const staffRes = await sbFetch(`/rest/v1/staff?position=in.(${approverPosCodes.join(',')})&select=staff_code`);
    const rows = await staffRes.json();
    return (rows || []).map(s => s.staff_code).filter(Boolean);
  } catch(e) { console.warn('getApproverCodes:', e); return []; }
}

// Get all staff involved with a profile (NDD + TVV + GVBB) + their managers up chain
async function getProfileStakeholders(profileId) {
  const codes = new Set();
  const myCode = getEffectiveStaffCode();
  const p = (allProfiles || []).find(x => x.id === profileId);
  if (p?.ndd_staff_code) codes.add(p.ndd_staff_code);
  try {
    const res = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=fruit_roles(staff_code,role_type)`);
    const fgs = await res.json();
    (fgs || []).forEach(fg => (fg.fruit_roles || []).forEach(r => {
      if (r.staff_code) codes.add(r.staff_code); // NDD, TVV, GVBB
    }));
  } catch(e) {}
  // Also notify managers up the chain for EACH stakeholder (NDD, TVV, GVBB)
  const directCodes = [...codes];
  directCodes.forEach(sc => {
    if (sc !== myCode) getManagersForStaffCode(sc).forEach(m => codes.add(m));
  });
  return [...codes];
}

// ─── NOTIFICATION SETTINGS ─────────────────────────────────────────────────────
const NOTIF_EVENT_LABELS = {
  hapja_created:     { label: 'Phiếu Hapja mới',        icon: '🍎' },
  hapja_approved:    { label: 'Hapja được duyệt',        icon: '✅' },
  hapja_rejected:    { label: 'Hapja bị từ chối',        icon: '❌' },
  chot_tv:           { label: 'Chốt TV (lên lịch)',      icon: '📅' },
  bc_tv:             { label: 'Báo cáo TV mới',          icon: '📝' },
  lap_group_tv_bb:   { label: 'Lập Group TV-BB',         icon: '🎓' },
  bc_bb:             { label: 'Báo cáo BB mới',          icon: '📋' },
  mo_kt:             { label: 'Mở KT',                   icon: '📖' },
  drop_out:          { label: 'Drop-out',                icon: '🔴' },
  pause:             { label: 'Pause',                   icon: '⏸️' },
  chot_center:       { label: 'Chốt Center',             icon: '🏛️' },
  reminder:          { label: 'Nhắc nhở lịch',           icon: '⏰' },
  bb_reminder:       { label: 'Nhắc buổi học BB',        icon: '📚' },
  bb_report_reminder:{ label: 'Nhắc viết BC BB',         icon: '✍️' },
  bb_milestone:      { label: 'Milestone BB→Center',     icon: '⭐' },
};

async function openNotifSettings() {
  notifPanelOpen = false;
  document.getElementById('notifPanel')?.classList.remove('open');
  document.getElementById('notifBackdrop').style.display = 'none';

  let modal = document.getElementById('notifSettingsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'notifSettingsModal';
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) closeModal('notifSettingsModal'); };
    modal.innerHTML = `
      <div class="modal" style="max-height:88vh;">
        <div class="modal-handle"></div>
        <div class="modal-title">⚙️ Cài đặt thông báo</div>
        <div id="notifSettingsBody"></div>
        <button class="save-btn" onclick="saveNotifSettings()">💾 Lưu cài đặt</button>
      </div>`;
    document.body.appendChild(modal);
  }

  _notifPrefsCache = null;
  const prefs = await getMyPrefs();
  const appSet  = new Set(prefs.app_events  || ALL_EVENT_TYPES);
  const chatSet = new Set(prefs.chat_events || []);

  document.getElementById('notifSettingsBody').innerHTML = `
    <div style="margin-bottom:12px;padding:10px 12px;background:var(--surface2);border-radius:var(--radius-sm);font-size:12px;color:var(--text2);line-height:1.6;">
      📱 <b>Trong App</b>: Hiện trong 🔔 — mặc định bật hết<br>
      💬 <b>Qua Chat</b>: Bot gửi Telegram — mặc định tắt hết
    </div>
    <div style="display:grid;grid-template-columns:1fr 44px 44px;gap:8px;align-items:center;padding:6px 4px;border-bottom:2px solid var(--border);margin-bottom:4px;">
      <div style="font-size:11px;font-weight:700;color:var(--text3);text-transform:uppercase;">Loại sự kiện</div>
      <div style="font-size:11px;font-weight:700;color:var(--accent);text-align:center;">App</div>
      <div style="font-size:11px;font-weight:700;color:var(--green);text-align:center;">Chat</div>
    </div>
    ${ALL_EVENT_TYPES.map(type => {
      const info = NOTIF_EVENT_LABELS[type] || { label: type, icon: '🔔' };
      return `<div style="display:grid;grid-template-columns:1fr 44px 44px;gap:8px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--border);">
        <div style="font-size:13px;">${info.icon} ${info.label}</div>
        <div style="display:flex;justify-content:center;">
          <label class="notif-toggle"><input type="checkbox" id="nset_app_${type}" ${appSet.has(type) ? 'checked' : ''}><span class="notif-toggle-slider"></span></label>
        </div>
        <div style="display:flex;justify-content:center;">
          <label class="notif-toggle"><input type="checkbox" id="nset_chat_${type}" ${chatSet.has(type) ? 'checked' : ''}><span class="notif-toggle-slider notif-toggle-chat"></span></label>
        </div>
      </div>`;
    }).join('')}
    <div style="display:flex;gap:8px;margin-top:14px;margin-bottom:4px;">
      <button onclick="setAllNotifPrefs(true,false)" style="flex:1;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text2);font-size:12px;cursor:pointer;border-radius:8px;">✅ App bật hết</button>
      <button onclick="setAllNotifPrefs(false,false)" style="flex:1;padding:8px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text2);font-size:12px;cursor:pointer;border-radius:8px;">🔕 Tắt hết</button>
    </div>`;

  modal.classList.add('open');
}

function setAllNotifPrefs(appOn, chatOn) {
  ALL_EVENT_TYPES.forEach(type => {
    const a = document.getElementById(`nset_app_${type}`);
    const c = document.getElementById(`nset_chat_${type}`);
    if (a) a.checked = appOn;
    if (c) c.checked = chatOn;
  });
}

async function saveNotifSettings() {
  const myCode = getEffectiveStaffCode();
  const app_events  = ALL_EVENT_TYPES.filter(t => document.getElementById(`nset_app_${t}`)?.checked);
  const chat_events = ALL_EVENT_TYPES.filter(t => document.getElementById(`nset_chat_${t}`)?.checked);
  try {
    await sbFetch('/rest/v1/notification_preferences', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ staff_code: myCode, app_events, chat_events })
    });
    _notifPrefsCache = { app_events, chat_events };
    showToast('✅ Đã lưu cài đặt thông báo');
    closeModal('notifSettingsModal');
  } catch(e) { showToast('❌ Lỗi lưu'); console.error(e); }
}

// ─── AUTO-REFRESH ─────────────────────────────────────────────────────────────
setInterval(loadNotifCount, 30000);
