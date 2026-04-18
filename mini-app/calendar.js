// ============ CALENDAR MODULE ============
// Lịch tháng với auto-events từ hệ thống + events cá nhân

let calYear, calMonth, calEvents = [], calSelectedDate = null;

const CAL_COLORS = {
  chot_tv:       '#8b5cf6',   // purple
  hoc_bb:        '#22c55e',   // green
  lap_group_tv_bb: '#f59e0b', // amber
  custom:        '#3b82f6',   // blue
  note:          '#f97316'    // orange — linked notes
};
const CAL_LABELS = {
  chot_tv:       'Lịch TV',
  hoc_bb:        'Học BB',
  lap_group_tv_bb: 'Lập Group TV-BB',
  custom:        'Cá nhân',
  note:          'Ghi chú'
};

// Notes linked to calendar dates (keyed by YYYY-MM-DD)
let _calLinkedNotes = [];

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
  if (label) label.textContent = `Shin ${calYear - 1983} — Tháng ${calMonth + 1}`;
  
  try {
    // Fetch calendar events + linked notes in parallel
    const [evRes, noteRes] = await Promise.all([
      sbFetch(`/rest/v1/calendar_events?event_date=gte.${startStr}&event_date=lte.${endStr}&select=*&order=event_date.asc,event_time.asc`),
      sbFetch(`/rest/v1/personal_notes?cal_date=gte.${startStr}&cal_date=lte.${endStr}&select=id,title,cal_date,color,owner_staff_code&order=cal_date.asc`).catch(() => null)
    ]);
    const allEvents = await evRes.json();
    try {
      _calLinkedNotes = noteRes && noteRes.ok ? (await noteRes.json()).filter(n => n.owner_staff_code === myCode || scope === 'system') : [];
    } catch(e2) { _calLinkedNotes = []; }
    
    // Filter: system events by scope, personal events by owner
    calEvents = allEvents.filter(ev => {
      if (ev.is_system) {
        return isEventInScope(ev, myCode, scope);
      } else {
        return ev.staff_code === myCode;
      }
    });
  } catch(e) {
    console.error('loadCalendar:', e);
    calEvents = [];
    _calLinkedNotes = [];
  }
  
  // Also fetch TV/BB records with scheduled dates to merge as virtual events
  await _mergeRecordMilestones(startStr, endStr, myCode, scope);

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
  if (typeof markFresh === 'function') markFresh('calendar');
}

// Fetch TV & BB records and merge as virtual calendar events
async function _mergeRecordMilestones(startStr, endStr, myCode, scope) {
  try {
    // Fetch BB records (buoi_tiep in content) AND TV sessions (scheduled_at column) in parallel
    const [bbRes, tvRes] = await Promise.all([
      sbFetch(`/rest/v1/records?record_type=eq.bien_ban&select=id,profile_id,content,created_at&order=created_at.asc`),
      sbFetch(`/rest/v1/consultation_sessions?scheduled_at=not.is.null&select=id,profile_id,session_number,tool,scheduled_at,tvv_staff_code&order=scheduled_at.asc`)
    ]);
    const bbRecords = bbRes.ok ? await bbRes.json() : [];
    const tvSessions = tvRes.ok ? await tvRes.json() : [];

    const start = new Date(startStr), end = new Date(endStr);

    // Process BB records — extract buoi_tiep dates from content JSON
    bbRecords.forEach(rec => {
      const c = typeof rec.content === 'string' ? JSON.parse(rec.content) : rec.content;
      if (!c || !c.buoi_tiep) return;
      const p = allProfiles.find(x => x.id === rec.profile_id);
      if (!p) return;
      // Scope check
      if (scope !== 'system' && p.ndd_staff_code !== myCode && p.tvv_staff_code !== myCode && p.gvbb_staff_code !== myCode) return;

      const d = new Date(c.buoi_tiep);
      if (isNaN(d.getTime()) || d < start || d > end) return;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

      // Don't duplicate if already in calEvents from calendar_events table
      if (calEvents.find(e => e.event_type === 'hoc_bb' && e.profile_id === p.id && e.event_date === dateStr)) return;

      const buoiNum = c.buoi_thu || c.lan_thu || '?';
      calEvents.push({
        id: `vbb_${rec.id}`,
        event_type: 'hoc_bb',
        title: `Học BB buổi ${buoiNum} — ${p.full_name || '?'}`,
        event_date: dateStr,
        event_time: timeStr,
        profile_id: p.id,
        is_auto: true,
        _virtual: true
      });
    });

    // Process TV sessions — scheduled_at is a DB column, not content JSON
    tvSessions.forEach(sess => {
      if (!sess.scheduled_at) return;
      const p = allProfiles.find(x => x.id === sess.profile_id);
      if (!p) return;
      if (scope !== 'system' && p.ndd_staff_code !== myCode && p.tvv_staff_code !== myCode) return;

      const d = new Date(sess.scheduled_at);
      if (isNaN(d.getTime()) || d < start || d > end) return;
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

      if (calEvents.find(e => e.event_type === 'chot_tv' && e.profile_id === p.id && e.event_date === dateStr)) return;

      const sessNum = sess.session_number || '?';
      calEvents.push({
        id: `vtv_${sess.id}`,
        event_type: 'chot_tv',
        title: `Lịch TV lần ${sessNum} (${sess.tool || '?'}) — ${p.full_name || '?'}`,
        event_date: dateStr,
        event_time: timeStr,
        profile_id: p.id,
        is_auto: true,
        _virtual: true
      });
    });
  } catch(e) {
    console.warn('_mergeRecordMilestones:', e);
  }
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
  // Group linked notes by date
  const notesByDate = {};
  _calLinkedNotes.forEach(n => {
    if (!notesByDate[n.cal_date]) notesByDate[n.cal_date] = [];
    notesByDate[n.cal_date].push(n);
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
    const dayNotes = notesByDate[dateStr] || [];
    
    let cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isSelected) cls += ' cal-selected';
    
    const parts = [];
    // TV sessions
    const tvCount = dayEvents.filter(e => e.event_type === 'chot_tv').length;
    if (tvCount > 0) parts.push(`<span style="display:block;font-size:9px;font-weight:600;color:#8b5cf6;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${tvCount} ca TV</span>`);
    // BB sessions
    const bbCount = dayEvents.filter(e => e.event_type === 'hoc_bb').length;
    if (bbCount > 0) parts.push(`<span style="display:block;font-size:9px;font-weight:600;color:#22c55e;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${bbCount} ca BB</span>`);
    // Custom events
    const customEvents = dayEvents.filter(e => e.event_type === 'custom');
    customEvents.slice(0, 2).forEach(e => {
      const short = (e.title || '').substring(0, 10) + (e.title?.length > 10 ? '…' : '');
      parts.push(`<span style="display:block;font-size:9px;color:#3b82f6;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${short}</span>`);
    });
    // Linked notes (orange)
    if (dayNotes.length > 0) {
      parts.push(`<span style="display:block;font-size:9px;font-weight:600;color:#f97316;line-height:1.3;">📝 ${dayNotes.length}</span>`);
    }

    const labels = parts.length ? `<div style="width:100%;overflow:hidden;">${parts.join('')}</div>` : '';
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
  const weekdays = ['Chủ Nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const dayLabel = `${weekdays[date.getDay()]} — ${shinDate(date)}`;
  titleEl.textContent = `📅 ${dayLabel}`;
  
  const dayEvents = calEvents.filter(e => e.event_date === dateStr);
  const dayNotes = _calLinkedNotes.filter(n => n.cal_date === dateStr);
  const myCode = getEffectiveStaffCode();
  
  let html = '';

  // Events section
  if (dayEvents.length > 0) {
    html += dayEvents.map(ev => {
      const color = CAL_COLORS[ev.event_type] || '#6b7280';
      const time = ev.event_time ? ev.event_time.substring(0, 5) : '';
      const typeLabel = CAL_LABELS[ev.event_type] || ev.event_type;
      const profile = ev.profile_id ? allProfiles.find(p => p.id === ev.profile_id) : null;
      const completedCls = ev.is_completed ? 'style="opacity:0.5;text-decoration:line-through;"' : '';
      
      let metaHtml = `<span class="cal-event-type" style="color:${color}">${typeLabel}</span>`;
      if (time) metaHtml += `<span>\u23f0 ${time}</span>`;
      if (profile && ev.event_type === 'chot_tv') {
          const ndd = typeof getStaffLabel === 'function' ? getStaffLabel(profile.ndd_staff_code) : (profile.ndd_staff_code || '?');
          const tvv = typeof getStaffLabel === 'function' ? getStaffLabel(profile.tvv_staff_code) : (profile.tvv_staff_code || '?');
          metaHtml += `<span>NDD: ${ndd}</span><span>TVV: ${tvv}</span>`;
      } else if (profile && ev.event_type === 'hoc_bb') {
          const ndd = typeof getStaffLabel === 'function' ? getStaffLabel(profile.ndd_staff_code) : (profile.ndd_staff_code || '?');
          const gvbb = typeof getStaffLabel === 'function' ? getStaffLabel(profile.gvbb_staff_code) : (profile.gvbb_staff_code || '?');
          metaHtml += `<span>NDD: ${ndd}</span><span>GVBB: ${gvbb}</span>`;
      } else if (profile) {
          metaHtml += `<span>\ud83d\udc64 ${profile.full_name}</span>`;
      }

      // Alarm badge — show in meta only if alarm exists
      const hasAlarm = !!ev.reminder_at && !ev.reminder_sent;
      const alarmSent = !!ev.reminder_sent;
      if (hasAlarm) {
        const rAt = new Date(ev.reminder_at);
        const rTime = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
        const rDate = `${String(rAt.getDate()).padStart(2,'0')}/${String(rAt.getMonth()+1).padStart(2,'0')}`;
        metaHtml += `<span style="font-size:10px;color:#fbbf24;background:rgba(251,191,36,0.12);padding:1px 6px;border-radius:8px;">🔔 ${rDate} ${rTime}</span>`;
      } else if (alarmSent) {
        metaHtml += `<span style="font-size:10px;color:var(--text3);background:var(--surface2);padding:1px 6px;border-radius:8px;">✅ Đã nhắc</span>`;
      }
      
      // Determine capabilities
      const canDelete = !ev.is_auto && !ev._virtual;
      const isCreator = ev.created_by === myCode;
      const canEdit = isCreator && !ev._virtual && !ev.is_auto;
      const isRealEvent = !ev._virtual && ev.id && !String(ev.id).startsWith('v');

      // Build compact action buttons — single horizontal row
      let actionBtns = '';
      
      // Alarm button — show for ALL events (real + virtual)
      if (isRealEvent) {
        const alarmIcon = ev.reminder_at ? '🔔' : '🔕';
        const alarmCls = ev.reminder_at ? 'cal-event-alarm-btn has-alarm' : 'cal-event-alarm-btn';
        const alarmTitle = ev.reminder_at ? 'Sửa alarm' : 'Đặt nhắc';
        actionBtns += `<button onclick="event.stopPropagation();openSetAlarmModal('${ev.id}','${ev.event_date}','${ev.event_time || ''}','${(ev.title||'').replace(/'/g,"\\'")}','${ev.reminder_at || ''}')" class="${alarmCls}" title="${alarmTitle}">${alarmIcon}</button>`;
      } else if (ev._virtual && ev.id) {
        // Virtual event — need to create real event first, then set alarm
        const safeTitle = (ev.title||'').replace(/'/g,"\\'");
        actionBtns += `<button onclick="event.stopPropagation();createAndAlarmVirtual('${ev.event_date}','${ev.event_time || ''}','${safeTitle}','${ev.event_type}','${ev.profile_id || ''}')" class="cal-event-alarm-btn" title="Đặt nhắc">🔕</button>`;
      }
      
      if (canEdit) {
        actionBtns += `<button onclick="event.stopPropagation();openEditEventModal('${ev.id}')" class="cal-event-edit-btn" title="Sửa">✏️</button>`;
      }
      if (canDelete) {
        actionBtns += `<button onclick="event.stopPropagation();deleteCalEvent('${ev.id}')" class="cal-event-del" title="Xoá" style="font-size:12px;">🗑</button>`;
      }
      
      // Only show action column if there are buttons
      const actionCol = actionBtns ? `<div style="display:flex;gap:3px;align-items:center;flex-shrink:0;margin-left:4px;">${actionBtns}</div>` : '';

      return `<div class="cal-event-card" ${completedCls} onclick="${ev.profile_id ? `openProfileById('${ev.profile_id}')` : ''}">
        <div class="cal-event-bar" style="background:${color}"></div>
        <div class="cal-event-body" style="flex:1;min-width:0;">
          <div class="cal-event-title" style="font-weight:600;font-size:14px;color:var(--text);margin-bottom:4px;">${ev.title}</div>
          <div class="cal-event-meta" style="display:flex;flex-wrap:wrap;gap:6px;font-size:11px;color:var(--text3);align-items:center;">
            ${metaHtml}
          </div>
          ${ev.description ? `<div class="cal-event-desc" style="margin-top:6px;font-size:12px;color:var(--text2);">${ev.description}</div>` : ''}
        </div>
        ${actionCol}
      </div>`;
    }).join('');
  }

  // Linked notes section
  if (dayNotes.length > 0) {
    html += `<div style="margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:8px;">📝 Ghi chú gắn ngày này (${dayNotes.length})</div>`;
    html += dayNotes.map(n => {
      const noteColor = n.color || '#fef08a';
      return `<div onclick="openNoteFromCal('${n.id}')" style="padding:8px 12px;margin-bottom:6px;background:${noteColor};border-radius:8px;cursor:pointer;border:1px solid rgba(0,0,0,0.08);transition:transform 0.15s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform=''">
        <div style="font-size:13px;font-weight:600;color:#333;">${n.title || 'Không tiêu đề'}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:4px;">
          <button onclick="event.stopPropagation();unlinkNoteFromCal('${n.id}','${dateStr}')" style="font-size:10px;padding:2px 8px;border-radius:6px;border:1px solid rgba(0,0,0,0.15);background:rgba(255,255,255,0.7);color:#666;cursor:pointer;" title="Bỏ gắn">✕ Bỏ gắn</button>
        </div>
      </div>`;
    }).join('');
    html += '</div>';
  }

  if (!html) {
    html = '<div style="text-align:center;padding:20px;color:var(--text3);font-size:13px;">Không có sự kiện</div>';
  }

  listEl.innerHTML = html;
}

// ============ SET ALARM MODAL ============
function openSetAlarmModal(eventId, eventDate, eventTime, eventTitle, existingAlarm) {
  const evDt = eventTime ? new Date(`${eventDate}T${eventTime}:00`) : new Date(`${eventDate}T23:59:59`);
  
  let defaultDate, defaultTime;
  if (existingAlarm) {
    // Pre-fill with existing alarm
    const rAt = new Date(existingAlarm);
    defaultDate = `${rAt.getFullYear()}-${String(rAt.getMonth()+1).padStart(2,'0')}-${String(rAt.getDate()).padStart(2,'0')}`;
    defaultTime = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
  } else {
    // Default: 30 min before event
    const defaultRemind = new Date(evDt.getTime() - 30 * 60000);
    defaultDate = `${defaultRemind.getFullYear()}-${String(defaultRemind.getMonth()+1).padStart(2,'0')}-${String(defaultRemind.getDate()).padStart(2,'0')}`;
    defaultTime = `${String(defaultRemind.getHours()).padStart(2,'0')}:${String(defaultRemind.getMinutes()).padStart(2,'0')}`;
  }

  const modalTitle = existingAlarm ? `🔔 Sửa Alarm — ${eventTitle}` : `🔔 Đặt Alarm — ${eventTitle}`;
  document.getElementById('recordModalTitle').textContent = modalTitle;
  document.getElementById('recordModalBody').innerHTML = `
    <div style="text-align:center;font-size:32px;margin-bottom:8px;">🔔</div>
    <div style="text-align:center;font-size:13px;color:var(--text2);margin-bottom:12px;">
      Sự kiện: <b>${eventTitle}</b><br>
      ${eventTime ? `Lúc ${eventTime.substring(0,5)} ngày ${eventDate}` : `Ngày ${eventDate}`}
    </div>
    <div class="grid-2">
      <div class="field-group"><label>📅 Ngày nhắc</label><input type="date" id="alarm_date" value="${defaultDate}" /></div>
      <div class="field-group"><label>⏰ Giờ nhắc</label><input type="time" id="alarm_time" value="${defaultTime}" /></div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
      <button class="chip" onclick="setAlarmPreset(15,'${eventDate}','${eventTime}')">15p trước</button>
      <button class="chip" onclick="setAlarmPreset(30,'${eventDate}','${eventTime}')">30p trước</button>
      <button class="chip" onclick="setAlarmPreset(60,'${eventDate}','${eventTime}')">1h trước</button>
      <button class="chip" onclick="setAlarmPreset(1440,'${eventDate}','${eventTime}')">1 ngày trước</button>
    </div>
    <div id="alarm_warn" style="font-size:11px;color:var(--red);margin-top:6px;display:none;">⚠️ Phải trước thời điểm sự kiện</div>
    ${existingAlarm ? `<button type="button" onclick="removeEventAlarm('${eventId}')" style="width:100%;margin-top:8px;padding:8px;border:1px solid rgba(248,113,113,0.4);background:none;color:var(--red);border-radius:8px;font-size:12px;cursor:pointer;">🗑 Xoá alarm</button>` : ''}
    <input type="hidden" id="alarm_event_id" value="${eventId}" />
    <input type="hidden" id="alarm_event_date" value="${eventDate}" />
    <input type="hidden" id="alarm_event_time" value="${eventTime}" />
  `;
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.textContent = existingAlarm ? '💾 Lưu Alarm' : '🔔 Đặt Alarm'; saveBtn.onclick = saveEventAlarm; saveBtn.style.display = ''; }
  document.getElementById('addRecordModal').classList.add('open');
}

function setAlarmPreset(minutes, eventDate, eventTime) {
  const evDt = eventTime ? new Date(`${eventDate}T${eventTime}:00`) : new Date(`${eventDate}T23:59:59`);
  const r = new Date(evDt.getTime() - minutes * 60000);
  document.getElementById('alarm_date').value = `${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,'0')}-${String(r.getDate()).padStart(2,'0')}`;
  document.getElementById('alarm_time').value = `${String(r.getHours()).padStart(2,'0')}:${String(r.getMinutes()).padStart(2,'0')}`;
}

async function saveEventAlarm() {
  const eventId = document.getElementById('alarm_event_id')?.value;
  const ad = document.getElementById('alarm_date')?.value;
  const at = document.getElementById('alarm_time')?.value;
  const evDate = document.getElementById('alarm_event_date')?.value;
  const evTime = document.getElementById('alarm_event_time')?.value;

  if (!ad || !at) { showToast('⚠️ Chọn ngày và giờ nhắc'); return; }

  const reminderAt = new Date(`${ad}T${at}:00`);
  const eventDt = evTime ? new Date(`${evDate}T${evTime}:00`) : new Date(`${evDate}T23:59:59`);
  
  if (reminderAt >= eventDt) {
    document.getElementById('alarm_warn').style.display = '';
    showToast('⚠️ Giờ nhắc phải trước sự kiện');
    return;
  }

  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⌛...'; }

  try {
    await sbFetch(`/rest/v1/calendar_events?id=eq.${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ reminder_at: reminderAt.toISOString(), reminder_sent: false })
    });
    closeModal('addRecordModal');
    showToast('🔔 Đã lưu alarm!');
    if (saveBtn) { saveBtn.textContent = '💾 Lưu phiếu'; saveBtn.onclick = saveRecord; saveBtn.disabled = false; }
    loadCalendar();
  } catch(e) {
    showToast('❌ Lỗi lưu alarm');
    console.error(e);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '🔔 Đặt Alarm'; }
  }
}

async function removeEventAlarm(eventId) {
  try {
    await sbFetch(`/rest/v1/calendar_events?id=eq.${eventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ reminder_at: null, reminder_sent: false })
    });
    closeModal('addRecordModal');
    showToast('🗑 Đã xoá alarm');
    const saveBtn = document.querySelector('#addRecordModal .save-btn');
    if (saveBtn) { saveBtn.textContent = '💾 Lưu phiếu'; saveBtn.onclick = saveRecord; saveBtn.disabled = false; }
    loadCalendar();
  } catch(e) {
    showToast('❌ Lỗi xoá alarm');
    console.error(e);
  }
}

// ============ VIRTUAL EVENT → CREATE REAL + SET ALARM ============
async function createAndAlarmVirtual(eventDate, eventTime, title, eventType, profileId) {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  
  // Check if a real event already exists for this (to avoid duplicates)
  const checkRes = await sbFetch(
    `/rest/v1/calendar_events?staff_code=eq.${myCode}&event_date=eq.${eventDate}&title=eq.${encodeURIComponent(title)}&select=id,reminder_at&limit=1`
  );
  if (checkRes.ok) {
    const existing = await checkRes.json();
    if (existing && existing.length > 0) {
      // Already has real event → just open alarm modal on it
      openSetAlarmModal(existing[0].id, eventDate, eventTime, title, existing[0].reminder_at || '');
      return;
    }
  }
  
  // Create real event from virtual
  try {
    const body = {
      title, event_date: eventDate, event_time: eventTime || null,
      event_type: eventType, staff_code: myCode,
      profile_id: profileId || null, is_system: false,
      created_by: myCode
    };
    const res = await sbFetch('/rest/v1/calendar_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    const created = await res.json();
    const newId = Array.isArray(created) ? created[0].id : created.id;
    
    // Reload calendar to reflect the new event, then open alarm modal
    await loadCalendar();
    openSetAlarmModal(newId, eventDate, eventTime, title, '');
  } catch(e) {
    showToast('❌ Lỗi tạo sự kiện');
    console.error(e);
  }
}

// ============ EDIT EVENT ============
function openEditEventModal(eventId) {
  const ev = calEvents.find(e => e.id === eventId);
  if (!ev) { showToast('Không tìm thấy sự kiện'); return; }

  document.getElementById('recordModalTitle').textContent = '✏️ Sửa sự kiện';
  document.getElementById('recordModalBody').innerHTML = `
    <div class="field-group"><label>Tiêu đề *</label><input type="text" id="edit_ev_title" value="${(ev.title||'').replace(/"/g,'&quot;')}" /></div>
    <div class="grid-2">
      <div class="field-group"><label>Ngày *</label><input type="date" id="edit_ev_date" value="${ev.event_date}" /></div>
      <div class="field-group"><label>Giờ</label><input type="time" id="edit_ev_time" value="${ev.event_time ? ev.event_time.substring(0,5) : ''}" /></div>
    </div>
    <div class="field-group"><label>Mô tả</label><textarea id="edit_ev_desc" placeholder="Chi tiết..." style="min-height:60px;">${ev.description || ''}</textarea></div>
    <input type="hidden" id="edit_ev_id" value="${eventId}" />
    <input type="hidden" id="edit_ev_is_system" value="${ev.is_system ? '1' : '0'}" />
    <input type="hidden" id="edit_ev_created_by" value="${ev.created_by || ''}" />
    <input type="hidden" id="edit_ev_old_title" value="${(ev.title||'').replace(/"/g,'&quot;')}" />
    <input type="hidden" id="edit_ev_old_date" value="${ev.event_date}" />
    ${ev.is_system ? '<div style="font-size:11px;color:var(--accent);margin-top:4px;">📢 Sự kiện phân phối — chỉnh sửa sẽ cập nhật cho tất cả người nhận</div>' : ''}
  `;
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.textContent = '💾 Lưu chỉnh sửa'; saveBtn.onclick = saveEditedEvent; saveBtn.style.display = ''; }
  document.getElementById('addRecordModal').classList.add('open');
}

async function saveEditedEvent() {
  const eventId = document.getElementById('edit_ev_id')?.value;
  const title = document.getElementById('edit_ev_title')?.value?.trim();
  const date = document.getElementById('edit_ev_date')?.value;
  const time = document.getElementById('edit_ev_time')?.value || null;
  const desc = document.getElementById('edit_ev_desc')?.value?.trim() || null;
  const isSystem = document.getElementById('edit_ev_is_system')?.value === '1';
  const createdBy = document.getElementById('edit_ev_created_by')?.value;
  const oldTitle = document.getElementById('edit_ev_old_title')?.value;
  const oldDate = document.getElementById('edit_ev_old_date')?.value;

  if (!title || !date) { showToast('⚠️ Nhập tiêu đề và ngày'); return; }

  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⌛ Đang lưu...'; }

  try {
    const patch = { title, event_date: date, event_time: time, description: desc };

    if (isSystem && createdBy) {
      // Distributed event — update ALL copies with same created_by + old title + old date
      await sbFetch(`/rest/v1/calendar_events?created_by=eq.${encodeURIComponent(createdBy)}&title=eq.${encodeURIComponent(oldTitle)}&event_date=eq.${oldDate}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(patch)
      });
      showToast('✅ Đã cập nhật cho tất cả người nhận');
    } else {
      // Single event
      await sbFetch(`/rest/v1/calendar_events?id=eq.${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(patch)
      });
      showToast('✅ Đã cập nhật sự kiện');
    }

    closeModal('addRecordModal');
    if (saveBtn) { saveBtn.textContent = '💾 Lưu phiếu'; saveBtn.onclick = saveRecord; saveBtn.disabled = false; }
    loadCalendar();
  } catch(e) {
    showToast('❌ Lỗi cập nhật');
    console.error(e);
    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Lưu chỉnh sửa'; }
  }
}

// ============ ALARM OVERLAY (dramatic in-app) ============
function showAlarmOverlay(title, dateStr, timeStr, source = 'event') {
  // Prevent duplicate overlays
  if (document.getElementById('alarmOverlay')) return;

  // Screen shake
  document.body.classList.add('alarm-shake');
  setTimeout(() => document.body.classList.remove('alarm-shake'), 600);

  // Haptic
  haptic('heavy');
  setTimeout(() => haptic('heavy'), 300);
  setTimeout(() => haptic('heavy'), 600);

  const icon = source === 'note' ? '📝' : '📅';
  const sourceLabel = source === 'note' ? 'Ghi chú' : 'Sự kiện';
  const displayTime = timeStr ? `${timeStr}` : '';
  const displayDate = dateStr || '';

  let countdown = 15;
  const overlay = document.createElement('div');
  overlay.id = 'alarmOverlay';
  overlay.className = 'alarm-overlay';
  overlay.innerHTML = `
    <div class="alarm-card" style="position:relative;">
      <div class="alarm-pulse-ring"></div>
      <div class="alarm-bell">🔔</div>
      <div class="alarm-title">${icon} ${title}</div>
      <div class="alarm-subtitle">${sourceLabel}</div>
      ${displayTime || displayDate ? `<div class="alarm-time-badge">⏰ ${displayTime}${displayTime && displayDate ? ' · ' : ''}${displayDate}</div>` : ''}
      <button class="alarm-dismiss" onclick="dismissAlarm()">✓ Đã biết</button>
      <div class="alarm-countdown" id="alarmCountdown">Tự đóng sau ${countdown}s</div>
    </div>`;
  document.body.appendChild(overlay);

  // Auto dismiss countdown
  const timer = setInterval(() => {
    countdown--;
    const el = document.getElementById('alarmCountdown');
    if (el) el.textContent = `Tự đóng sau ${countdown}s`;
    if (countdown <= 0) {
      clearInterval(timer);
      dismissAlarm();
    }
  }, 1000);
  overlay._timer = timer;
}

function dismissAlarm() {
  const overlay = document.getElementById('alarmOverlay');
  if (!overlay) return;
  if (overlay._timer) clearInterval(overlay._timer);
  overlay.style.animation = 'alarmFadeOut 0.3s ease forwards';
  setTimeout(() => overlay.remove(), 300);
  haptic('success');
}


// ── Unlink note from calendar (still used from day view) ──
async function unlinkNoteFromCal(noteId, dateStr) {
  try {
    await sbFetch(`/rest/v1/personal_notes?id=eq.${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
      body: JSON.stringify({ cal_date: null })
    });
    showToast('✅ Đã bỏ gắn');
    loadCalendar();
    // Also refresh notes if loaded
    if (typeof loadPersonalNotes === 'function') loadPersonalNotes();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

function openNoteFromCal(noteId) {
  // Find note data
  const note = (typeof _allMyNotes !== 'undefined' ? _allMyNotes : []).find(n => n.id === noteId)
    || (typeof _sharedWithMeNotes !== 'undefined' ? _sharedWithMeNotes : []).find(n => n.id === noteId)
    || _calLinkedNotes.find(n => n.id === noteId);
  if (!note) {
    showToast('Không tìm thấy ghi chú');
    return;
  }
  const c = (typeof NOTE_COLORS !== 'undefined' && NOTE_COLORS[note.color]) || { bg: '#fef9c3', text: '#92400e', headerBg: '#fde68a' };
  const title = note.title || 'Không tiêu đề';
  const content = note.content || '';
  const timeStr = note.updated_at ? getTimeAgo(note.updated_at) : '';

  // Show read-only popup using recordModal
  document.getElementById('recordModalTitle').textContent = `📝 ${title}`;
  document.getElementById('recordModalBody').innerHTML = `
    <div style="background:${c.bg};border-radius:12px;padding:14px 16px;margin-bottom:12px;border:1px solid rgba(0,0,0,0.08);">
      <div style="white-space:pre-wrap;font-size:13px;color:${c.text};line-height:1.6;">${typeof escHtml === 'function' ? escHtml(content) : content}</div>
      ${timeStr ? `<div style="margin-top:10px;font-size:10px;color:${c.text};opacity:0.6;">Cập nhật: ${timeStr}</div>` : ''}
    </div>
    <div style="display:flex;gap:8px;justify-content:center;">
      <button onclick="closeModal('addRecordModal');openEditNoteModal('${noteId}')" style="padding:6px 14px;font-size:11px;border-radius:20px;border:1px solid var(--accent);background:transparent;color:var(--accent);cursor:pointer;font-weight:600;">✏️ Sửa</button>
    </div>`;
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (saveBtn) saveBtn.style.display = 'none';
  document.getElementById('addRecordModal').classList.add('open');
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
    // Convert preset reminder_minutes to an absolute reminder_at timestamp
    // so the client-side polling can fire them (no server cron exists)
    if (!reminderAt && reminderMinutes.length > 0 && date) {
      const eventDt = time ? new Date(`${date}T${time}:00`) : new Date(`${date}T08:00:00`);
      // Use the largest preset (e.g. 60 min) as the single reminder_at
      const maxMins = Math.max(...reminderMinutes);
      const r = new Date(eventDt.getTime() - maxMins * 60000);
      if (r > new Date()) reminderAt = r.toISOString();
    }

    // Build event rows for each target
    const rows = targetCodes.map(code => ({
      staff_code: code,
      created_by: myCode,
      event_type: 'custom',
      title, description: desc,
      event_date: date, event_time: time,
      reminder_minutes: reminderMinutes.length ? reminderMinutes : null,
      reminder_at: reminderAt,
      reminder_channels: ['app','chat'],
      is_auto: false,
      is_system: isDistributed
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
  const oldTitlePattern = encodeURIComponent(`%Chốt TV lần ${sessionNum}%`);

  try {
    // Delete old event with similar pattern for this session (idempotent update)
    await sbFetch(`/rest/v1/calendar_events?profile_id=eq.${profileId}&event_type=eq.chot_tv&title=like.${oldTitlePattern}`, { method: 'DELETE' });

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
    
    // Reminder: 1 hour before the event
    const reminderAt = new Date(`${dateStr}T${timeStr}:00`);
    reminderAt.setHours(reminderAt.getHours() - 1);
    const reminderAtStr = reminderAt.toISOString();

    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'chot_tv',
      title: titleStr,
      event_date: dateStr, event_time: timeStr,
      reminder_at: reminderAtStr,
      reminder_channels: ['app', 'chat'],
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

    // Reminder: 1 hour before the BB session
    const reminderAt = new Date(`${dateStr}T${timeStr}:00`);
    reminderAt.setHours(reminderAt.getHours() - 1);
    const reminderAtStr = reminderAt.toISOString();

    await sbFetch('/rest/v1/calendar_events', { method: 'POST', body: JSON.stringify({
      staff_code: myCode, profile_id: profileId, event_type: 'hoc_bb',
      title: eventTitle,
      event_date: dateStr, event_time: timeStr,
      reminder_at: reminderAtStr,
      reminder_channels: ['app', 'chat'],
      is_auto: true, is_system: true
    })});
  } catch(e) { console.warn('createCalEventFromBBReport:', e); }
}
