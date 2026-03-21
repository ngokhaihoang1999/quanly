// ============ CALENDAR MODULE ============
// Lịch tháng với auto-events từ hệ thống + events cá nhân

let calYear, calMonth, calEvents = [], calSelectedDate = null;

const CAL_COLORS = {
  chot_tv: '#8b5cf6',      // purple
  hoc_bb: '#22c55e',       // green
  deadline_bc_tv: '#f97316', // orange
  deadline_bc_bb: '#ef4444', // red
  custom: '#3b82f6'         // blue
};
const CAL_LABELS = {
  chot_tv: 'Chốt TV',
  hoc_bb: 'Học BB',
  deadline_bc_tv: 'Deadline BC TV',
  deadline_bc_bb: 'Deadline BC BB',
  custom: 'Cá nhân'
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
  // If admin/system scope, see all
  if (scope === 'system') return true;
  // If the event belongs to this user, always show
  if (ev.staff_code === myCode) return true;
  // For scope-based visibility of system events:
  // Check if the event's profile is within the user's scope
  // Simple approach: check if the event's staff_code is in a team under user's management
  if (ev.profile_id) {
    const p = allProfiles.find(x => x.id === ev.profile_id);
    if (p && p.ndd_staff_code === myCode) return true;
  }
  // For now, show system events to all (they can be filtered further)
  return true;
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
    
    let dots = '';
    if (dayEvents.length > 0) {
      const types = [...new Set(dayEvents.map(e => e.event_type))];
      dots = '<div class="cal-dots">' + types.slice(0, 3).map(t => 
        `<span class="cal-dot" style="background:${CAL_COLORS[t] || '#6b7280'}"></span>`
      ).join('') + '</div>';
    }
    
    html += `<div class="${cls}" onclick="calSelectDay(${d})"><span class="cal-day-num">${d}</span>${dots}</div>`;
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
    const profileName = ev.profile_id ? (allProfiles.find(p => p.id === ev.profile_id)?.full_name || '') : '';
    const completedCls = ev.is_completed ? 'style="opacity:0.5;text-decoration:line-through;"' : '';
    
    return `<div class="cal-event-card" ${completedCls} onclick="${ev.profile_id ? `openProfileById('${ev.profile_id}')` : ''}">
      <div class="cal-event-bar" style="background:${color}"></div>
      <div class="cal-event-body">
        <div class="cal-event-title">${ev.title}</div>
        <div class="cal-event-meta">
          <span class="cal-event-type" style="color:${color}">${typeLabel}</span>
          ${time ? `<span>⏰ ${time}</span>` : ''}
          ${profileName ? `<span>👤 ${profileName}</span>` : ''}
        </div>
        ${ev.description ? `<div class="cal-event-desc">${ev.description}</div>` : ''}
      </div>
      ${!ev.is_auto ? `<button onclick="event.stopPropagation();deleteCalEvent('${ev.id}')" class="cal-event-del" title="Xoá">×</button>` : ''}
    </div>`;
  }).join('');
}

// ============ CREATE EVENT ============
function openAddEventModal() {
  const today = calSelectedDate || new Date();
  const dateVal = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  
  // Reuse addRecordModal for simplicity
  document.getElementById('recordModalTitle').textContent = '📅 Tạo sự kiện mới';
  const body = document.getElementById('recordModalBody');
  body.innerHTML = `
    <div class="field-group"><label>Tiêu đề *</label><input type="text" id="ev_title" placeholder="Nội dung sự kiện..." /></div>
    <div class="grid-2">
      <div class="field-group"><label>Ngày *</label><input type="date" id="ev_date" value="${dateVal}" /></div>
      <div class="field-group"><label>Giờ</label><input type="time" id="ev_time" /></div>
    </div>
    <div class="field-group"><label>Mô tả</label><textarea id="ev_desc" placeholder="Chi tiết..." style="min-height:60px;"></textarea></div>
    <div class="field-group"><label>Nhắc trước (phút)</label>
      <div class="chips" id="chips_ev_reminder">
        <div class="chip" onclick="toggleChip(this)">15</div>
        <div class="chip" onclick="toggleChip(this)">30</div>
        <div class="chip" onclick="toggleChip(this)">60</div>
      </div>
    </div>
  `;
  // Override save button behavior
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) {
    saveBtn.textContent = '📅 Tạo sự kiện';
    saveBtn.onclick = saveCalEvent;
  }
  document.getElementById('addRecordModal').classList.add('open');
}

async function saveCalEvent() {
  const title = document.getElementById('ev_title')?.value?.trim();
  const date = document.getElementById('ev_date')?.value;
  const time = document.getElementById('ev_time')?.value || null;
  const desc = document.getElementById('ev_desc')?.value?.trim() || null;
  const reminderChips = getChipValues('chips_ev_reminder');
  const reminderMinutes = reminderChips.map(v => parseInt(v)).filter(v => !isNaN(v));
  
  if (!title || !date) { showToast('⚠️ Nhập tiêu đề và ngày'); return; }
  
  try {
    await sbFetch('/rest/v1/calendar_events', {
      method: 'POST',
      body: JSON.stringify({
        staff_code: getEffectiveStaffCode(),
        event_type: 'custom',
        title, description: desc,
        event_date: date,
        event_time: time,
        reminder_minutes: reminderMinutes,
        reminder_channels: ['app'],
        is_auto: false,
        is_system: false
      })
    });
    closeModal('addRecordModal');
    // Restore save button
    const saveBtn = document.querySelector('#addRecordModal .save-btn');
    if (saveBtn) { saveBtn.textContent = '💾 Lưu phiếu'; saveBtn.onclick = saveRecord; }
    showToast('✅ Đã tạo sự kiện');
    loadCalendar();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

async function deleteCalEvent(eventId) {
  if (!confirm('Xoá sự kiện này?')) return;
  try {
    await sbFetch(`/rest/v1/calendar_events?id=eq.${eventId}`, { method: 'DELETE' });
    showToast('✅ Đã xoá');
    loadCalendar();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ============ AUTO-CREATE CALENDAR EVENTS ============
// Called from records.js when Chốt TV or creating BB report with buoi_tiep
async function createCalEventFromChotTV(profileId, sessionNum, scheduledAt) {
  const p = allProfiles.find(x => x.id === profileId);
  const pName = p?.full_name || '';
  const myCode = getEffectiveStaffCode();
  const eventDate = scheduledAt ? new Date(scheduledAt) : new Date();
  const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth()+1).padStart(2,'0')}-${String(eventDate.getDate()).padStart(2,'0')}`;
  const timeStr = scheduledAt ? `${String(eventDate.getHours()).padStart(2,'0')}:${String(eventDate.getMinutes()).padStart(2,'0')}` : null;
  
  try {
    // Create Chốt TV event
    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'chot_tv',
      title: `Chốt TV lần ${sessionNum} — ${pName}`,
      event_date: dateStr, event_time: timeStr,
      is_auto: true, is_system: true
    })});
    
    // Create deadline BC TV (+1h)
    const deadlineDate = new Date(eventDate.getTime() + 60*60*1000);
    const dlDateStr = `${deadlineDate.getFullYear()}-${String(deadlineDate.getMonth()+1).padStart(2,'0')}-${String(deadlineDate.getDate()).padStart(2,'0')}`;
    const dlTimeStr = `${String(deadlineDate.getHours()).padStart(2,'0')}:${String(deadlineDate.getMinutes()).padStart(2,'0')}`;
    
    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'deadline_bc_tv',
      title: `Deadline BC TV lần ${sessionNum} — ${pName}`,
      event_date: dlDateStr, event_time: dlTimeStr,
      is_auto: true, is_system: true
    })});
  } catch(e) { console.warn('createCalEventFromChotTV:', e); }
}

async function createCalEventFromBBReport(profileId, buoiTiepStr) {
  if (!buoiTiepStr) return;
  const p = allProfiles.find(x => x.id === profileId);
  const pName = p?.full_name || '';
  const myCode = getEffectiveStaffCode();

  let dateStr, timeStr;

  // Try ISO format first: YYYY-MM-DDTHH:mm or YYYY-MM-DDTHH:mm:ss
  const isoMatch = buoiTiepStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (isoMatch) {
    dateStr = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    timeStr = `${isoMatch[4]}:${isoMatch[5]}`;
  } else {
    // Fallback: old DD/MM/YYYY HH:mm format
    const oldMatch = buoiTiepStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/);
    if (!oldMatch) return;
    const [, dd, mm, yyyy, hh, mi] = oldMatch;
    dateStr = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    timeStr = `${hh.padStart(2,'0')}:${mi}`;
  }

  try {
    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'hoc_bb',
      title: `Học BB tiếp — ${pName}`,
      event_date: dateStr, event_time: timeStr,
      is_auto: true, is_system: true
    })});
  } catch(e) { console.warn('createCalEventFromBBReport:', e); }
}
