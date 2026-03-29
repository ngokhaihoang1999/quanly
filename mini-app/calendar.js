// ============ CALENDAR MODULE ============
// Lịch tháng với auto-events từ hệ thống + events cá nhân

let calYear, calMonth, calEvents = [], calSelectedDate = null;

const CAL_COLORS = {
  chot_tv:       '#8b5cf6',   // purple
  hoc_bb:        '#22c55e',   // green
  lap_group_tv_bb: '#f59e0b', // amber
  custom:        '#3b82f6'    // blue
};
const CAL_LABELS = {
  chot_tv:       'Lịch TV',
  hoc_bb:        'Học BB',
  lap_group_tv_bb: 'Lập Group TV-BB',
  custom:        'Cá nhân'
};

function initCalendar() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}

function calNavMonth(dir) {
  calMonth += dir;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  if (calMonth > 11) { calMonth = 0; calYear++; }
  loadCalendar();
}

async function loadCalendar() {
  if (calYear === undefined) initCalendar();
  const myCode = getEffectiveStaffCode();
  const scope = getScope();
  
  // Build date range for this month
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay = new Date(calYear, calMonth + 1, 0);
  const startStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
  const endStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(lastDay.getDate()).padStart(2,'0')}`;
  
  // Update month label
  const label = document.getElementById('calMonthLabel');
  if (label) label.textContent = `Tháng ${calMonth + 1}, ${calYear}`;
  
  try {
    // Fetch events for this month
    const res = await sbFetch(`/rest/v1/calendar_events?event_date=gte.${startStr}&event_date=lte.${endStr}&select=*&order=event_date.asc,event_time.asc`);
    const allEvents = await res.json();
    
    // Filter: system events by scope, personal events by owner
    calEvents = allEvents.filter(ev => {
      if (ev.is_system) {
        // System events: visible based on scope
        return isEventInScope(ev, myCode, scope);
      } else {
        // Personal events: only the creator sees them
        return ev.staff_code === myCode;
      }
    });
  } catch(e) {
    console.error('loadCalendar:', e);
    calEvents = [];
  }
  
  renderCalendarGrid();
  // Auto-select today or keep selected date
  const today = new Date();
  if (!calSelectedDate || calSelectedDate.getMonth() !== calMonth || calSelectedDate.getFullYear() !== calYear) {
    if (today.getMonth() === calMonth && today.getFullYear() === calYear) {
      calSelectedDate = today;
    } else {
      calSelectedDate = firstDay;
    }
  }
  renderCalendarDayEvents(calSelectedDate);
}

function isEventInScope(ev, myCode, scope) {
  // Admin sees all
  if (scope === 'system') return true;

  // Owner always sees their own event
  if (ev.staff_code === myCode) return true;

  // Creator of a distributed event always sees it (even if staff_code = recipient)
  if (ev.created_by && ev.created_by === myCode) return true;

  // Distributed events (is_system=true + created_by set) — only visible to the specific recipient
  // (staff_code is the recipient, already caught above if matches myCode)
  if (ev.created_by) return false; // has a creator → it's a distributed event, not for us

  // Auto-generated system events (chot_tv, hoc_bb): show if profile is in user's scope
  if (ev.profile_id) {
    const p = allProfiles.find(x => x.id === ev.profile_id);
    // NDD of the profile sees it
    if (p && p.ndd_staff_code === myCode) return true;
    // If manager is in staffUnitMap scope (managed by user): show
    if (p && p.ndd_staff_code && getStaffUnit(p.ndd_staff_code)) {
      // Check if ndd is in my managed scope
      const nddUnit = getStaffUnit(p.ndd_staff_code);
      const myUnit = getStaffUnit(myCode);
      if (nddUnit && myUnit && nddUnit.startsWith(myUnit.split(' · ')[0])) return true;
    }
  }

  // Default: show auto system events to all (chot_tv, hoc_bb visible to scope)
  return !ev.created_by; // only if NOT a distributed event
}

function renderCalendarGrid() {
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  
  const firstDay = new Date(calYear, calMonth, 1);
  const lastDate = new Date(calYear, calMonth + 1, 0).getDate();
  const startDay = (firstDay.getDay() + 6) % 7; // Monday = 0
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  // Group events by date
  const eventsByDate = {};
  calEvents.forEach(ev => {
    if (!eventsByDate[ev.event_date]) eventsByDate[ev.event_date] = [];
    eventsByDate[ev.event_date].push(ev);
  });
  
  let html = '<div class="cal-grid">';
  // Headers
  ['T2','T3','T4','T5','T6','T7','CN'].forEach(d => {
    html += `<div class="cal-header">${d}</div>`;
  });
  
  // Empty cells before first day
  for (let i = 0; i < startDay; i++) {
    html += '<div class="cal-cell cal-empty"></div>';
  }
  
  // Date cells
  for (let d = 1; d <= lastDate; d++) {
    const dateStr = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const isSelected = calSelectedDate && calSelectedDate.getDate() === d && calSelectedDate.getMonth() === calMonth;
    const dayEvents = eventsByDate[dateStr] || [];
    
    let cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isSelected) cls += ' cal-selected';
    
    let labels = '';
    if (dayEvents.length > 0) {
      // Count: only chot_tv for TV sessions, only hoc_bb for BB sessions
      const tvCount = dayEvents.filter(e => e.event_type === 'chot_tv').length;
      const bbCount = dayEvents.filter(e => e.event_type === 'hoc_bb').length;
      const customEvents = dayEvents.filter(e => e.event_type === 'custom');

      const parts = [];
      if (tvCount > 0) parts.push(`<span style="display:block;font-size:9px;font-weight:600;color:#8b5cf6;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tvCount} ca TV</span>`);
      if (bbCount > 0) parts.push(`<span style="display:block;font-size:9px;font-weight:600;color:#22c55e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${bbCount} ca BB</span>`);
      customEvents.slice(0, 2).forEach(e => {
        const short = (e.title || '').substring(0, 10) + (e.title?.length > 10 ? '…' : '');
        parts.push(`<span style="display:block;font-size:9px;color:#3b82f6;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</span>`);
      });

      if (parts.length) labels = `<div style="width:100%;overflow:hidden;">${parts.join('')}</div>`;
    }

    html += `<div class="${cls}" onclick="calSelectDay(${d})"><span class="cal-day-num">${d}</span>${labels}</div>`;

  }
  
  html += '</div>';
  grid.innerHTML = html;
}

function calSelectDay(day) {
  calSelectedDate = new Date(calYear, calMonth, day);
  renderCalendarGrid();
  renderCalendarDayEvents(calSelectedDate);
}

function renderCalendarDayEvents(date) {
  const titleEl = document.getElementById('calDayTitle');
  const listEl = document.getElementById('calEventList');
  if (!titleEl || !listEl) return;
  
  const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const dayLabel = date.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' });
  titleEl.textContent = `📅 ${dayLabel}`;
  
  const dayEvents = calEvents.filter(e => e.event_date === dateStr);
  
  if (dayEvents.length === 0) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Không có sự kiện</div>';
    return;
  }
  
  listEl.innerHTML = dayEvents.map(ev => {
    const color = CAL_COLORS[ev.event_type] || '#6b7280';
    const time = ev.event_time ? ev.event_time.substring(0, 5) : '';
    const typeLabel = CAL_LABELS[ev.event_type] || ev.event_type;
    const profile = ev.profile_id ? allProfiles.find(p => p.id === ev.profile_id) : null;
    const completedCls = ev.is_completed ? 'style="opacity:0.5;text-decoration:line-through;"' : '';
    
    let metaHtml = `<span class="cal-event-type" style="color:${color}">${typeLabel}</span>`;
    if (time) metaHtml += `<span>\u23f0 ${time}</span>`;
    if (profile && ev.event_type === 'chot_tv') {
        const ndd = profile.ndd_staff_code || '?';
        const tvv = profile.tvv_staff_code || '?';
        metaHtml += `<span>NDD: ${ndd}</span><span>TVV: ${tvv}</span>`;
    } else if (profile && ev.event_type === 'hoc_bb') {
        const ndd = profile.ndd_staff_code || '?';
        const gvbb = profile.gvbb_staff_code || '?';
        metaHtml += `<span>NDD: ${ndd}</span><span>GVBB: ${gvbb}</span>`;
    } else if (profile) {
        // Fallback for custom events with profile assigned
        metaHtml += `<span>\ud83d\udc64 ${profile.full_name}</span>`;
    }
    
    return `<div class="cal-event-card" ${completedCls} onclick="${ev.profile_id ? `openProfileById('${ev.profile_id}')` : ''}">
      <div class="cal-event-bar" style="background:${color}"></div>
      <div class="cal-event-body">
        <div class="cal-event-title" style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:6px;">${ev.title}</div>
        <div class="cal-event-meta" style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:var(--text3);align-items:center;">
          ${metaHtml}
        </div>
        ${ev.description ? `<div class="cal-event-desc" style="margin-top:8px;font-size:13px;color:var(--text2);">${ev.description}</div>` : ''}
      </div>
      ${!ev.is_auto ? `<button onclick="event.stopPropagation();deleteCalEvent('${ev.id}')" class="cal-event-del" title="Xoá">ÁE/button>` : ''}
    </div>`;
  }).join('');
}

// ============ CREATE EVENT ============
function openAddEventModal() {
  const today = calSelectedDate || new Date();
  const dateVal = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  // Check if user has management scope to distribute
  const myPos = getCurrentPosition();
  const mySpec = getCurrentSpecialistPosition();
  const posObj = getPositionObj(myPos);
  const specObj = getPositionObj(mySpec);
  const scopeLevel = (SCOPE_LEVELS[posObj?.scope_level]||0) >= (SCOPE_LEVELS[specObj?.scope_level]||0)
    ? posObj?.scope_level : specObj?.scope_level;
  const canDistribute = (SCOPE_LEVELS[scopeLevel] || 0) >= 1 &&
    (myPos !== 'td' || mySpec); // not plain TD

  // Build position chips for distribution filter
  const mgmtPosChips = getManagementPositions()
    .map(p => `<div class="chip" data-pos="${p.code}" onclick="toggleChip(this)">${p.name}</div>`).join('');
  const specPosChips = getSpecialistPositions()
    .map(p => `<div class="chip" data-pos="${p.code}" onclick="toggleChip(this)">${p.name}</div>`).join('');

  const distributeSection = canDistribute ? `
    <div class="field-group" style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px;">
      <label style="font-weight:600;color:var(--accent);">📢 Phân phối cho</label>
      <div style="display:flex;gap:8px;margin:8px 0;flex-wrap:wrap;">
        <button id="dist_me" onclick="setDistMode('me')" class="dist-btn active"
          style="font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--accent);background:var(--accent);color:#fff;cursor:pointer;">Chỉ tôi</button>
        <button id="dist_all" onclick="setDistMode('all')"
          style="font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;">Tất cả trong scope</button>
        <button id="dist_pos" onclick="setDistMode('pos')"
          style="font-size:12px;padding:5px 12px;border-radius:20px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;">Theo chức vụ</button>
      </div>
      <div id="dist_pos_wrap" style="display:none;margin-top:4px;">
        <div style="font-size:11px;color:var(--text3);margin-bottom:4px;">Chọn chức vụ nhận sự kiện:</div>
        <div class="chips" id="chips_dist_pos" style="flex-wrap:wrap;gap:6px;">${mgmtPosChips}${specPosChips}</div>
      </div>
      <div id="dist_count" style="font-size:11px;color:var(--text3);margin-top:6px;"></div>
    </div>` : '';

  // Reuse addRecordModal
  document.getElementById('recordModalTitle').textContent = '📅 Tạo sự kiện mới';
  const body = document.getElementById('recordModalBody');
  body.innerHTML = `
    <div class="field-group"><label>Tiêu đề *</label><input type="text" id="ev_title" placeholder="Nội dung sự kiện..." /></div>
    <div class="grid-2">
      <div class="field-group"><label>Ngày *</label><input type="date" id="ev_date" value="${dateVal}" /></div>
      <div class="field-group"><label>Giờ</label><input type="time" id="ev_time" /></div>
    </div>
    <div class="field-group"><label>Mô tả</label><textarea id="ev_desc" placeholder="Chi tiết..." style="min-height:60px;"></textarea></div>
    <div class="field-group"><label>Nhắc trước</label>
      <div class="chips" id="chips_ev_reminder" style="margin-bottom:6px;">
        <div class="chip" onclick="toggleChip(this);document.getElementById('ev_remind_custom_wrap').style.display='none';">15 phút</div>
        <div class="chip" onclick="toggleChip(this);document.getElementById('ev_remind_custom_wrap').style.display='none';">30 phút</div>
        <div class="chip" onclick="toggleChip(this);document.getElementById('ev_remind_custom_wrap').style.display='none';">60 phút</div>
        <div class="chip" id="chip_custom_remind" onclick="toggleCustomReminder(this)">⏰ Chọn giờ</div>
      </div>
      <div id="ev_remind_custom_wrap" style="display:none;">
        <div class="grid-2">
          <div class="field-group" style="margin:0;"><label style="font-size:11px;">Ngày nhắc</label><input type="date" id="ev_remind_date" /></div>
          <div class="field-group" style="margin:0;"><label style="font-size:11px;">Giờ nhắc</label><input type="time" id="ev_remind_time" /></div>
        </div>
        <div id="ev_remind_warn" style="font-size:11px;color:var(--red);margin-top:4px;display:none;">⚠️ Phải trước thời điểm sự kiện</div>
      </div>
    </div>
    ${distributeSection}
  `;
  // Event listeners
  document.getElementById('ev_date').addEventListener('change', validateReminderTime);
  document.getElementById('ev_time').addEventListener('change', validateReminderTime);
  document.getElementById('ev_remind_date')?.addEventListener('change', validateReminderTime);
  document.getElementById('ev_remind_time')?.addEventListener('change', validateReminderTime);
  // Override save button
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.textContent = '📅 Tạo sự kiện'; saveBtn.onclick = saveCalEvent; }
  document.getElementById('addRecordModal').classList.add('open');
}

// Distribution mode toggle
let _distMode = 'me';
function setDistMode(mode) {
  _distMode = mode;
  ['me','all','pos'].forEach(m => {
    const btn = document.getElementById(`dist_${m}`);
    if (!btn) return;
    const isActive = m === mode;
    btn.style.background = isActive ? 'var(--accent)' : 'var(--surface2)';
    btn.style.color = isActive ? '#fff' : 'var(--text2)';
    btn.style.borderColor = isActive ? 'var(--accent)' : 'var(--border)';
  });
  const posWrap = document.getElementById('dist_pos_wrap');
  if (posWrap) posWrap.style.display = mode === 'pos' ? '' : 'none';
  updateDistCount();
}
async function updateDistCount() {
  const countEl = document.getElementById('dist_count');
  if (!countEl || _distMode === 'me') { if (countEl) countEl.textContent = ''; return; }
  const codes = await _getDistTargetCodes();
  countEl.textContent = `→ Gửi cho ${codes.length} TĐ trong scope`;
}
async function _getDistTargetCodes() {
  const myCode = getEffectiveStaffCode();
  if (_distMode === 'me') return [myCode];
  // Get all managed codes
  const allCodes = await getMyManagedStaffCodes();
  if (_distMode === 'all') return allCodes;
  // Filter by selected positions
  const selectedPos = [...document.querySelectorAll('#chips_dist_pos .chip.active')].map(c => c.dataset.pos).filter(Boolean);
  if (!selectedPos.length) return allCodes; // nothing selected = all
  return (allStaff || []).filter(s => allCodes.includes(s.staff_code) &&
    (selectedPos.includes(s.position) || selectedPos.includes(s.specialist_position))
  ).map(s => s.staff_code);
}

async function saveCalEvent() {
  const title = document.getElementById('ev_title')?.value?.trim();
  const date  = document.getElementById('ev_date')?.value;
  const time  = document.getElementById('ev_time')?.value || null;
  const desc  = document.getElementById('ev_desc')?.value?.trim() || null;

  if (!title || !date) { showToast('⚠️ Nhập tiêu đề và ngày'); return; }

  // Reminder
  let reminderAt = null, reminderMinutes = [];
  const customWrap = document.getElementById('ev_remind_custom_wrap');
  const isCustom = customWrap?.style.display !== 'none';
  if (isCustom) {
    const rd = document.getElementById('ev_remind_date')?.value;
    const rt = document.getElementById('ev_remind_time')?.value;
    if (rd) {
      reminderAt = rt ? `${rd}T${rt}:00` : `${rd}T08:00:00`;
      const eventDt = time ? new Date(`${date}T${time}:00`) : new Date(`${date}T23:59:59`);
      if (new Date(reminderAt) >= eventDt) {
        showToast('⚠️ Giờ nhắc phải trước thời điểm sự kiện');
        document.getElementById('ev_remind_warn').style.display = '';
        return;
      }
    }
  } else {
    reminderMinutes = getChipValues('chips_ev_reminder').map(v => parseInt(v)).filter(v => !isNaN(v));
  }

  // Determine distribution targets
  const targetCodes = await _getDistTargetCodes();
  const isDistributed = _distMode !== 'me' && targetCodes.length > 1;
  const myCode = getEffectiveStaffCode();

  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⌛ Đang tạo...'; }

  try {
    // Build event rows for each target
    const rows = targetCodes.map(code => ({
      staff_code: code,
      created_by: myCode, // track who created
      event_type: 'custom',
      title, description: desc,
      event_date: date, event_time: time,
      reminder_minutes: reminderMinutes.length ? reminderMinutes : null,
      reminder_at: reminderAt,
      reminder_channels: ['app','chat'],
      is_auto: false,
      is_system: isDistributed // system=true so scope-based visibility applies
    }));

    // Insert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await sbFetch('/rest/v1/calendar_events', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify(rows.slice(i, i + 50))
      });
    }

    closeModal('addRecordModal');
    if (saveBtn) { saveBtn.textContent = '💾 Lưu phiếu'; saveBtn.onclick = saveRecord; saveBtn.disabled = false; }
    showToast(`✅ Đã tạo sự kiện${isDistributed ? ` cho ${targetCodes.length} TĐ` : ''}`);
    _distMode = 'me'; // reset
    loadCalendar();
  } catch(e) {
    showToast('❌ Lỗi tạo sự kiện'); console.error(e);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '📅 Tạo sự kiện'; }
  }
}

function toggleCustomReminder(chipEl) {
  const wrap = document.getElementById('ev_remind_custom_wrap');
  const isOpen = wrap?.style.display !== 'none';
  if (isOpen) {
    wrap.style.display = 'none';
    chipEl.classList.remove('active');
  } else {
    wrap.style.display = '';
    chipEl.classList.add('active');
    // Deselect all preset chips
    document.querySelectorAll('#chips_ev_reminder .chip:not(#chip_custom_remind)').forEach(c => c.classList.remove('active'));
    // Pre-fill remind date with event date
    const evDate = document.getElementById('ev_date')?.value;
    if (evDate && !document.getElementById('ev_remind_date')?.value) {
      document.getElementById('ev_remind_date').value = evDate;
    }
  }
}

function validateReminderTime() {
  const wrap = document.getElementById('ev_remind_custom_wrap');
  if (!wrap || wrap.style.display === 'none') return;
  const warn = document.getElementById('ev_remind_warn');
  const rd = document.getElementById('ev_remind_date')?.value;
  const rt = document.getElementById('ev_remind_time')?.value;
  const ed = document.getElementById('ev_date')?.value;
  const et = document.getElementById('ev_time')?.value;
  if (!rd || !ed) return;
  const reminderDt = new Date(rt ? `${rd}T${rt}:00` : `${rd}T00:00:00`);
  const eventDt    = new Date(et ? `${ed}T${et}:00` : `${ed}T23:59:59`);
  if (warn) warn.style.display = reminderDt >= eventDt ? '' : 'none';
}

async function deleteCalEvent(eventId) {
  if (!await showConfirmAsync('Xoá sự kiện này?')) return;
  try {
    await sbFetch(`/rest/v1/calendar_events?id=eq.${eventId}`, { method: 'DELETE' });
    showToast('✁EĐã xoá');
    loadCalendar();
  } catch(e) { showToast('❁ELỗi'); console.error(e); }
}

// ============ AUTO-CREATE CALENDAR EVENTS ============
// Called from records.js when Chốt TV or creating BB report with buoi_tiep
async function createCalEventFromChotTV(profileId, sessionNum, scheduledAt, toolStr) {
  const p = allProfiles.find(x => x.id === profileId);
  const pName = p?.full_name || '';
  const myCode = getEffectiveStaffCode();
  const toolText = toolStr ? ` (${toolStr})` : '';
  const titleStr = `Chốt TV lần ${sessionNum}${toolText} — ${pName}`;
  const oldTitlePattern = `Chốt TV lần ${sessionNum}`;

  try {
    // Delete old event with similar pattern for this session (idempotent update)
    await sbFetch(`/rest/v1/calendar_events?profile_id=eq.${profileId}&event_type=eq.chot_tv&title=like.%${oldTitlePattern}%`, { method: 'DELETE' });

    // ONLY create calendar event if a date was actually scheduled
    if (!scheduledAt) return;

    let dateStr, timeStr;
    const isoMatch = String(scheduledAt).match(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
    if (isoMatch) {
      dateStr = isoMatch[1];
      timeStr = isoMatch[2];
    } else {
      const d = new Date(scheduledAt);
      const pad = n => String(n).padStart(2,'0');
      dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
      timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    
    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'chot_tv',
      title: titleStr,
      event_date: dateStr, event_time: timeStr,
      is_auto: true, is_system: true
    })});
  } catch(e) { console.warn('createCalEventFromChotTV:', e); }
}

async function createCalEventFromBBReport(profileId, nextNum, buoiTiepStr) {
  if (!buoiTiepStr) return;
  const p = allProfiles.find(x => x.id === profileId);
  const pName = p?.full_name || '';
  const myCode = getEffectiveStaffCode();

  let dateStr, timeStr;

  const isoMatch = buoiTiepStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    timeStr = `${isoMatch[4]}:${isoMatch[5]}`;
  } else {
    const oldMatch = buoiTiepStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/);
    if (!oldMatch) return;
    const [, dd, mm, yyyy, hh, mi] = oldMatch;
    dateStr = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    timeStr = `${hh.padStart(2,'0')}:${mi}`;
  }

  try {
    const eventTitle = `Học BB buổi ${nextNum} — ${pName}`;
    // Delete old matching upcoming BB event to avoid dupes if they edit the report
    await sbFetch(`/rest/v1/calendar_events?profile_id=eq.${profileId}&event_type=eq.hoc_bb&title=eq.${encodeURIComponent(eventTitle)}`, { method: 'DELETE' });

    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'hoc_bb',
      title: eventTitle,
      event_date: dateStr, event_time: timeStr,
      is_auto: true, is_system: true
    })});
  } catch(e) { console.warn('createCalEventFromBBReport:', e); }
}
