// ── Shared utility: label for the latest activity of a profile ──────────────
// rec = latest record row, sess = latest consultation_session row (either can be null)
function latestActivityLabel(rec, sess) {
  const recTime = rec ? new Date(rec.created_at).getTime() : 0;
  const sessTime = sess ? new Date(sess.created_at).getTime() : 0;
  if (!rec && !sess) return '';
  if (recTime >= sessTime) {
    const { record_type: rt, content: c } = rec;
    if (rt === 'tu_van')      return `Báo cáo TV lần ${c?.lan_thu||''}`;
    if (rt === 'bien_ban')    return `Báo cáo BB buổi ${c?.buoi_thu||''}`;
    if (rt === 'chot_bb')     return '🎓 Chốt BB';
    if (rt === 'chot_center') return '🏛️ Chốt Center';
    return rt;
  } else {
    return `Chốt TV lần ${sess.session_number}${sess.tool ? ' ('+sess.tool+')' : ''}`;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// TIMELINE + PHASE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

async function loadJourney(profileId, currentPhase) {
  const phBtnEl = document.getElementById('phaseButtons');
  const tlEl = document.getElementById('timelineList');
  if (!phBtnEl || !tlEl) return;

  // Fetch group BB info (for BB/center phase)
  let bbGroupInfo = null;
  if (['bb','center','completed'].includes(currentPhase)) {
    try {
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id,telegram_group_id,telegram_group_title`);
      const fgs = await fgRes.json();
      // Find real group (not null, not -Date.now() placeholder)
      bbGroupInfo = (fgs||[]).find(g => g.telegram_group_id && g.telegram_group_id > -1000000000000) || null;
    } catch(e) {}
  }

  // Phase action buttons
  let btnHtml = '';
  if (['new','chakki'].includes(currentPhase)) {
    btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt TV</button>`;
  } else if (currentPhase === 'tu_van') {
    btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt TV tiếp</button>
      <button class="add-record-btn" onclick="openChotBBModal()" style="flex:1;background:var(--green);color:white;">🎓 Chốt BB</button>`;
  } else if (currentPhase === 'bb') {
    btnHtml = `<button class="add-record-btn" onclick="chotCenter()" style="flex:1;background:#8b5cf6;color:white;">🏛️ Chốt Center</button>`;
  }
  // Undo button — visible for any phase past Chakki
  if (!['new','chakki','completed'].includes(currentPhase)) {
    const phaseLabels = { tu_van:'Chốt TV', bb:'Chốt BB', center:'Chốt Center' };
    btnHtml += `<button onclick="undoLastPhaseChange()" title="Hoàn tác '${phaseLabels[currentPhase]||currentPhase}'" style="
      flex:0 0 auto;padding:10px 14px;border-radius:var(--radius-sm);border:1px dashed var(--text3);
      background:transparent;color:var(--text2);font-size:13px;cursor:pointer;white-space:nowrap;
      transition:all 0.2s;" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
      onmouseout="this.style.borderColor='var(--text3)';this.style.color='var(--text2)'">
      ↩️ Hoàn tác
    </button>`;
  }
  phBtnEl.innerHTML = btnHtml;

  // Group BB info bar removed — now shown in profile header card only
  const groupBarEl = document.getElementById('bbGroupBar');
  if (groupBarEl) groupBarEl.style.display = 'none';




  try {
    const [sessRes, recRes, hjRes] = await Promise.all([
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}&select=data,created_at&limit=1`)
    ]);
    const sessions = await sessRes.json();
    const recs = await recRes.json();
    const hapjas = await hjRes.json();

    let events = [];

    // Separate mo_kt records for lookup
    const moKtRecords = recs.filter(r => r.record_type === 'mo_kt');
    const matchedMoKtIds = new Set();

    // 1. Chakki — ALWAYS at bottom (oldest anchor)
    if (hapjas.length > 0) {
      const hjData = hapjas[0].data || {};
      const chakkiStr = hjData.ngay_chakki;
      const chakkiDate = chakkiStr || hapjas[0].created_at;
      // sortDate = 0 forces Chakki to always be last in descending sort
      events.push({ date: chakkiDate, icon: '🍎', text: 'Ngày Chakki (Hapja)', sortDate: 0, deletable: false, isMajor: true, _type: 'chakki' });
    }

    // 2. Sessions (Chốt TV) — major events, clickable for editing
    sessions.forEach(s => {
      events.push({
        date: s.created_at, icon: '📅',
        text: `Chốt TV lần ${s.session_number}${s.tool ? ' ('+s.tool+')' : ''}`,
        sortDate: new Date(s.created_at).getTime(),
        deletable: false, _type: 'session', _id: s.id, _num: s.session_number,
        _session: s, isMajor: true
      });
    });

    // 3. Records (BC TV, BC BB, Chốt BB, Chốt Center)
    recs.forEach(r => {
      let icon, text, isMajor = false;
      let _buoiThu = null;

      if      (r.record_type === 'tu_van')      { const n=r.content?.lan_thu||'';  icon='📝'; text=`Báo cáo TV${n?' lần '+n:''}`; }
      else if (r.record_type === 'bien_ban')    { 
        _buoiThu = r.content?.buoi_thu;  // store RAW value (could be number or string)
        icon='📋'; text=`Báo cáo BB${_buoiThu?' buổi '+_buoiThu:''}`;
      }
      else if (r.record_type === 'chot_bb')     { icon='🎓'; text='Chốt BB'; isMajor = true; }
      else if (r.record_type === 'chot_center') { icon='🏛️'; text='Chốt Center'; isMajor = true; }
      else if (r.record_type === 'mo_kt')       { return; /* handled separately below */ }
      else { icon='📌'; text=r.record_type; }

      events.push({
        date: r.created_at, icon, text, sortDate: new Date(r.created_at).getTime(),
        deletable: false, _type: 'record', _id: r.id, _rtype: r.record_type, isMajor, _buoiThu
      });
    });

    // Sort descending: newest (top) → oldest (bottom)
    events.sort((a,b) => b.sortDate - a.sortDate);

    // ─── Inject "Đã mở KT" right BEFORE the matching bien_ban ───
    // In descending list, KT above buổi X means KT is inserted before buổi X in the array
    const finalEvents = [];
    for (const e of events) {
      // Before pushing this bien_ban, check if KT matches it
      if (e._rtype === 'bien_ban' && e._buoiThu != null && e._buoiThu !== '') {
        const eBuoi = Number(e._buoiThu);
        const ktMatch = moKtRecords.find(m => Number(m.content?.buoi_thu) === eBuoi);
        if (ktMatch) {
          matchedMoKtIds.add(ktMatch.id);
          // Push KT BEFORE this bien_ban
          finalEvents.push({
            date: ktMatch.created_at, icon: '📖', text: 'Đã mở KT',
            sortDate: new Date(e.date).getTime() + 1,
            deletable: false, _type: 'kt', _id: ktMatch.id, isMajor: true,
            ktRecordId: ktMatch.id, hideDate: true
          });
        }
      }
      finalEvents.push(e);
    }

    // Handle unmatched mo_kt: find closest position
    moKtRecords.forEach(m => {
      if (!matchedMoKtIds.has(m.id)) {
        const ktBuoi = Number(m.content?.buoi_thu) || 0;
        let insertIdx = -1;
        // Find first bien_ban with buoi <= ktBuoi (descending order)
        for (let i = 0; i < finalEvents.length; i++) {
          if (finalEvents[i]._rtype === 'bien_ban') {
            const bb = Number(finalEvents[i]._buoiThu) || 0;
            if (bb <= ktBuoi) { insertIdx = i; break; }
          }
        }
        const ktEvent = {
          date: m.created_at, icon: '📖', text: 'Đã mở KT',
          sortDate: 0, deletable: false, _type: 'kt', _id: m.id, isMajor: true,
          hideDate: true, ktRecordId: m.id, ktStandalone: true
        };
        if (insertIdx >= 0) finalEvents.splice(insertIdx, 0, ktEvent);
        else {
          // Put after last bien_ban
          let lastBB = finalEvents.map((e,i) => e._rtype==='bien_ban'?i:-1).filter(i=>i>=0);
          if (lastBB.length) finalEvents.splice(lastBB[lastBB.length-1]+1, 0, ktEvent);
        }
      }
    });

    // ── Determine which SINGLE event gets the 🗑 delete button ──
    if (currentPhase === 'bb') {
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'bien_ban') {
          finalEvents[i].deletable = true; break;
        }
      }
    } else if (currentPhase === 'tu_van') {
      let found = false;
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'tu_van') {
          finalEvents[i].deletable = true; found = true; break;
        }
      }
      if (!found) {
        for (let i = 0; i < finalEvents.length; i++) {
          if (finalEvents[i]._type === 'session') { finalEvents[i].deletable = true; break; }
        }
      }
    }

    // Render
    if (finalEvents.length === 0) {
      tlEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có sự kiện nào</div>';
    } else {
      tlEl.innerHTML = finalEvents.map((e, i) => {
        const d = e.date ? new Date(e.date).toLocaleDateString('vi-VN') : '';
        const isHighlight = i === 0;
        const isKT = e._type === 'kt';

        let delBtn = '';
        if (e.deletable) {
          const fn = e._type === 'session'
            ? `deleteEventSession('${e._id}',${e._num})`
            : `deleteEventRecord('${e._id}','${e._rtype}')`;
          delBtn = `<button onclick="event.stopPropagation();${fn}" title="Xóa sự kiện" class="event-del-btn" style="
            flex-shrink:0;padding:3px 9px;border:1px solid var(--text3);border-radius:6px;background:transparent;
            color:var(--text3);font-size:11px;cursor:pointer;opacity:0;transition:opacity 0.15s;">🗑</button>`;
        }
        if (isKT) {
          delBtn = `<button onclick="event.stopPropagation();deleteEventRecordKt('${e.ktRecordId}')" title="Hủy Mở KT" class="event-del-btn" style="
            flex-shrink:0;padding:3px 9px;border:1px solid var(--text3);border-radius:6px;background:transparent;
            color:var(--text3);font-size:11px;cursor:pointer;opacity:0;transition:opacity 0.15s;">🗑</button>`;
        }

        const clickEdit = e._type === 'session' && e._session
          ? `onclick="editSession('${e._id}')" style="cursor:pointer;"`
          : '';
        const dateUi = (e.hideDate || !d) ? '' : `<div style="font-size:10px;color:var(--text3);margin-top:1px;">${d}</div>`;

        // 2-column layout:
        //   Column 1 (major): padding-left 14px — Chakki, Chốt TV, Chốt BB, Đã mở KT, Chốt Center
        //   Column 2 (minor): padding-left 48px — Báo cáo TV, Báo cáo BB
        const leftPad = e.isMajor ? '14px' : '48px';
        const fontW = e.isMajor ? '700' : '500';
        const fontSize = e.isMajor ? '13px' : '12px';
        const iconSize = e.isMajor ? '18px' : '14px';
        const accentColor = isHighlight ? 'color:var(--accent);' : '';
        const borderColor = isHighlight ? 'var(--accent)' : 'var(--border)';
        const ktBg = isKT ? 'background:color-mix(in srgb,var(--green) 10%,transparent);' : '';

        return `<div class="timeline-event" ${clickEdit} style="display:flex;gap:8px;align-items:center;
            padding:8px 10px 8px ${leftPad};border-left:3px solid ${borderColor};
            margin-left:12px;border-radius:0 6px 6px 0;${ktBg}${e._type==='session'?'cursor:pointer;':''}"
            onmouseenter="this.querySelector&&this.querySelector('.event-del-btn')&&(this.querySelector('.event-del-btn').style.opacity='1')"
            onmouseleave="this.querySelector&&this.querySelector('.event-del-btn')&&(this.querySelector('.event-del-btn').style.opacity='0')">
          <div style="font-size:${iconSize};flex-shrink:0;width:22px;text-align:center;">${e.icon}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:${fontSize};font-weight:${fontW};${accentColor}${isKT?'color:var(--green);':''}">${e.text}</div>
            ${dateUi}
          </div>
          ${delBtn}
        </div>`;
      }).join('');
    }
  } catch(e) { console.error('Journey error:', e); }
}

// ── Helper: refresh current profile view and global UI ──
async function _refreshCurrentProfile() {
  const pRes = await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&select=*`);
  const ps = await pRes.json();
  if (ps[0]) {
    const idx = allProfiles.findIndex(x => x.id === currentProfileId);
    if (idx >= 0) allProfiles[idx] = ps[0];
    openProfile(ps[0]);
    // Ensure lists and dashboard metrics are never stale when navigating away
    filterProfiles();
    loadDashboard();
  }
}

// ── Delete single session (only allowed when in tu_van phase, newest only) ──
async function deleteEventSession(sessionId, sessionNum) {
  if (!confirm(`Xóa "Chốt TV lần ${sessionNum}"?\nNếu hết buổi TV, giai đoạn sẽ về Chakki.`)) return;
  try {
    await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessionId}`, { method:'DELETE' });
    const remRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&select=id&limit=1`);
    const rem = await remRes.json();
    if (rem.length === 0) {
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    }
    showToast('✅ Đã xóa Chốt TV');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

// ── Delete single BC record (newest of current phase only) ──
async function deleteEventRecord(recordId, recordType) {
  const labels = { tu_van:'Báo cáo TV', bien_ban:'Báo cáo BB' };
  const label = labels[recordType] || recordType;
  if (!confirm(`Xóa "${label}" mới nhất?`)) return;
  try {
    await sbFetch(`/rest/v1/records?id=eq.${recordId}`, { method:'DELETE' });
    showToast(`✅ Đã xóa ${label}`);
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

async function deleteEventRecordKt(recordId) {
  if (!confirm('Hủy trạng thái Đã mở KT?')) return;
  try {
    if (recordId && recordId !== 'undefined' && recordId !== 'null') {
      await sbFetch(`/rest/v1/records?id=eq.${recordId}`, { method:'DELETE' });
    } else {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt`, { method:'DELETE' });
    }
    
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {
       method: 'PATCH',
       body: JSON.stringify({ is_kt_opened: false })
    });
    const idx = allProfiles.findIndex(x => x.id === currentProfileId);
    if (idx >= 0) allProfiles[idx].is_kt_opened = false;
    showToast('✅ Đã hủy Mở KT');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// SMART UNDO: cascade-delete all data of current phase + revert
// ══════════════════════════════════════════════════════════════════════════════
async function undoLastPhaseChange() {
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (!p) return;
  const phase = p.phase;
  let confirmMsg, actionFn;

  if (phase === 'tu_van') {
    confirmMsg = '↩️ Hoàn tác về Chakki?\n\n⚠️ Sẽ xóa TẤT CẢ:\n• Tất cả buổi Chốt TV\n• Tất cả Báo cáo TV\n\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van`, { method:'DELETE' });
      await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    };
  } else if (phase === 'bb') {
    confirmMsg = '↩️ Hoàn tác về Tư vấn?\n\n⚠️ Sẽ xóa TẤT CẢ:\n• Sự kiện Chốt BB\n• Tất cả Báo cáo BB\n\n(Báo cáo TV và Chốt TV được giữ nguyên)\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban`, { method:'DELETE' });
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.chot_bb`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'tu_van' }) });
    };
  } else if (phase === 'center') {
    confirmMsg = '↩️ Hoàn tác về BB?\n\n⚠️ Sẽ xóa sự kiện Chốt Center.\n(Báo cáo BB được giữ nguyên)\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.chot_center`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'bb' }) });
    };
  } else {
    showToast('⚠️ Không có gì để hoàn tác'); return;
  }

  if (!confirm(confirmMsg)) return;
  try {
    await actionFn();
    showToast('↩️ Đã hoàn tác thành công!');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi hoàn tác'); console.error(e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// SCHEDULE TV (Chốt Tư Vấn)
// ══════════════════════════════════════════════════════════════════════════════
let editingSessionId = null; // null = new, string = editing existing

async function openScheduleTVModal(existingSession) {
  if (!currentProfileId) return;
  const p = allProfiles.find(x => x.id === currentProfileId);
  const el = id => document.getElementById(id);

  if (existingSession) {
    // Edit mode
    editingSessionId = existingSession.id;
    if (el('stv_session_num')) el('stv_session_num').value = existingSession.session_number || 1;
    if (el('stv_tool')) el('stv_tool').value = existingSession.tool || '';
    if (el('stv_datetime')) {
      // Format datetime-local: YYYY-MM-DDTHH:MM
      const dt = existingSession.scheduled_at || existingSession.created_at;
      if (dt) {
        const d = new Date(dt);
        const pad = n => String(n).padStart(2,'0');
        el('stv_datetime').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } else el('stv_datetime').value = '';
    }
    if (el('stv_tvv')) el('stv_tvv').value = existingSession.tvv_staff_code || '';
    const subtitleEl = el('stv_subtitle');
    if (subtitleEl) subtitleEl.textContent = p ? `Trái: ${p.full_name} · Chỉnh sửa lần ${existingSession.session_number}` : `Chỉnh sửa`;
    const btn = document.querySelector('#scheduleTVModal .save-btn');
    if (btn) btn.textContent = '💾 Cập nhật Chốt TV';
  } else {
    // New mode
    editingSessionId = null;
    let nextNum = 1;
    try {
      const sRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&select=session_number&order=session_number.desc&limit=1`);
      const ss = await sRes.json();
      if (ss[0]) nextNum = (ss[0].session_number || 0) + 1;
    } catch(e) {}
    if (el('stv_session_num')) el('stv_session_num').value = nextNum;
    if (el('stv_tool')) el('stv_tool').value = '';
    if (el('stv_datetime')) el('stv_datetime').value = '';
    if (el('stv_tvv')) el('stv_tvv').value = '';
    const subtitleEl = el('stv_subtitle');
    if (subtitleEl) subtitleEl.textContent = p ? `Trái: ${p.full_name} · Lần ${nextNum}` : `Lần ${nextNum}`;
    const btn = document.querySelector('#scheduleTVModal .save-btn');
    if (btn) btn.textContent = '✅ Chốt Tư Vấn';
  }
  el('scheduleTVModal')?.classList.add('open');
}

async function editSession(sessionId) {
  try {
    const res = await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessionId}&select=*`);
    const rows = await res.json();
    if (rows[0]) openScheduleTVModal(rows[0]);
  } catch(e) { showToast('❌ Lỗi tải phiên TV'); }
}

async function saveScheduleTV() {
  const btn = document.querySelector('#scheduleTVModal .save-btn');
  if (btn && btn.disabled) return;

  const num = parseInt(document.getElementById('stv_session_num').value) || 1;
  const tool = document.getElementById('stv_tool').value.trim();
  const dt = document.getElementById('stv_datetime').value;
  const tvv = getStaffCodeFromInput('stv_tvv');

  if (!tool) { showToast('⚠️ Nhập công cụ tư vấn'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang lưu...'; }

  try {
    if (editingSessionId) {
      // UPDATE existing session
      await sbFetch(`/rest/v1/consultation_sessions?id=eq.${editingSessionId}`, { method:'PATCH', body: JSON.stringify({
        session_number: num, tool,
        scheduled_at: dt || null, tvv_staff_code: tvv || null
      })});
    } else {
      // CREATE new session
      await sbFetch('/rest/v1/consultation_sessions', { method:'POST', body: JSON.stringify({
        profile_id: currentProfileId, session_number: num, tool,
        scheduled_at: dt || null, tvv_staff_code: tvv || null,
        created_by: getEffectiveStaffCode()
      })});

      const p = allProfiles.find(x => x.id === currentProfileId);
      if (p && (p.phase === 'new' || p.phase === 'chakki' || !p.phase)) {
        await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van' })});
      }
    }

    // Assign TVV role if provided (both create & edit)
    if (tvv) {
      try {
        const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id`);
        const fgs = await fgRes.json();
        let fgId = fgs[0]?.id;
        if (!fgId) {
          const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
            telegram_group_id: null, profile_id: currentProfileId, level: 'tu_van'
          })});
          const newFgs = await newFgRes.json();
          fgId = newFgs[0]?.id;
        }
        if (fgId) {
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'resolution=ignore-duplicates'}, body: JSON.stringify({
            fruit_group_id: fgId, staff_code: tvv, role_type: 'tvv', assigned_by: getEffectiveStaffCode()
          })});
        }
      } catch(e) { console.warn('Assign role fail:', e); }
    }

    closeModal('scheduleTVModal');
    showToast(editingSessionId ? '✅ Đã cập nhật Chốt TV' : '✅ Đã chốt Tư vấn');
    editingSessionId = null;
    await _refreshCurrentProfile();
  } catch(e) {
    showToast('❌ Lỗi: ' + (e.message || 'Hệ thống bận'));
    console.error('saveScheduleTV:', e);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = editingSessionId ? '💾 Cập nhật Chốt TV' : '✅ Chốt Tư Vấn'; }
  }
}

async function completeSession(sessionId) {
  try {
    await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessionId}`, { method:'PATCH', body: JSON.stringify({ status: 'completed' })});
    showToast('✅ Đã hoàn thành buổi tư vấn');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

function createTVFromSession(sessionId, num, tool) {
  openAddRecordModal('tu_van');
  setTimeout(() => {
    const lanEl = document.getElementById('rm_lan_thu');
    const toolEl = document.getElementById('rm_ten_cong_cu');
    if (lanEl) lanEl.value = num;
    if (toolEl) toolEl.value = tool;
  }, 100);
}

// ══════════════════════════════════════════════════════════════════════════════
// CHỐT BB / CENTER
// ══════════════════════════════════════════════════════════════════════════════
function openChotBBModal() {
  if (!currentProfileId) return;
  document.getElementById('cbb_gvbb').value = '';
  document.getElementById('chotBBModal').classList.add('open');
}

async function saveChotBB() {
  try {
    const gvbb = getStaffCodeFromInput('cbb_gvbb');
    // 1. Update phase
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'bb' })});
    // 2. Record chot_bb event on timeline
    await sbFetch('/rest/v1/records', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'chot_bb', content: { label: 'Chốt BB', phase: 'bb' }
    })});
    // 3. Save GVBB to fruit_roles if provided
    if (gvbb) {
      try {
        const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id`);
        const fgs = await fgRes.json();
        let fgId = fgs[0]?.id;
        if (!fgId) {
          const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
            telegram_group_id: null, profile_id: currentProfileId, level: 'bb'
          })});
          fgId = (await newFgRes.json())[0]?.id;
        }
        if (fgId) {
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'resolution=ignore-duplicates'}, body: JSON.stringify({
            fruit_group_id: fgId, staff_code: gvbb, role_type: 'gvbb', assigned_by: getEffectiveStaffCode()
          })});
        }
      } catch(e) { console.warn('Assign GVBB fail:', e); }
    }
    closeModal('chotBBModal');
    showToast('🎓 Đã chốt BB!' + (gvbb ? ` GVBB: ${gvbb}` : ' Hãy tạo group Telegram và gắn hồ sơ.'));
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

async function chotCenter() {
  if (!currentProfileId) return;
  const pos = getCurrentPosition();
  const myCode = getEffectiveStaffCode();
  const p = allProfiles.find(x => x.id === currentProfileId);
  const isNDD = p?.ndd_staff_code === myCode;
  const isAdmin = pos === 'admin';
  const isGYJN = pos === 'gyjn' || pos === 'bgyjn';
  let isGVBB = false;
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id,fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs||[]).forEach(fg => (fg.fruit_roles||[]).forEach(r => {
      if (r.role_type === 'gvbb' && r.staff_code === myCode) isGVBB = true;
    }));
  } catch(e) {}
  if (!isNDD && !isAdmin && !isGYJN && !isGVBB) {
    showToast('⚠️ Chỉ NDD/GYJN/BGYJN/GVBB được chốt Center'); return;
  }
  if (!confirm('Xác nhận trái quả nhập học Center?')) return;
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'center' })});
    await sbFetch('/rest/v1/records', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'chot_center', content: { label: 'Chốt Center', phase: 'center' }
    })});
    showToast('🏛️ Đã chốt Center!');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT RECORD MODAL
// ══════════════════════════════════════════════════════════════════════════════
function openAddRecordModal(type, existingContent = null) {
  currentRecordType = type;
  if (!existingContent) currentRecordId = null;
  const isTV = type === 'tu_van';
  document.getElementById('recordModalTitle').textContent = existingContent
    ? (isTV ? '✏️ Chỉnh sửa Báo cáo Tư vấn' : '✏️ Chỉnh sửa Báo cáo BB')
    : (isTV ? '💬 Báo cáo Tư vấn' : '📝 Báo cáo BB');
  const body = document.getElementById('recordModalBody');
  const c = existingContent || {};
  if (isTV) {
    body.innerHTML = `
      <div class="field-group"><label>Lần thứ</label><input type="text" id="rm_lan_thu" placeholder="1, 2, 3..." value="${c.lan_thu||''}"/></div>
      <div class="field-group"><label>Tên công cụ tư vấn</label><input type="text" id="rm_ten_cong_cu" placeholder="DISC, Enneagram, MBTI..." value="${c.ten_cong_cu||''}"/></div>
      <div class="field-group"><label>Kết quả test công cụ</label><textarea id="rm_ket_qua_test" placeholder="...">${c.ket_qua_test||''}</textarea></div>
      <div class="field-group"><label>Vấn đề / Nhu cầu / Thông tin khai thác được</label><textarea id="rm_van_de" style="min-height:100px;" placeholder="...">${c.van_de||''}</textarea></div>
      <div class="field-group"><label>Phản hồi / Cảm nhận của trái sau tư vấn</label><textarea id="rm_phan_hoi" placeholder="...">${c.phan_hoi||''}</textarea></div>
      <div class="field-group"><label>Điểm hái trái</label><textarea id="rm_diem_hai" placeholder="...">${c.diem_hai||''}</textarea></div>
      <div class="field-group"><label>Đề xuất của TVV</label><textarea id="rm_de_xuat" placeholder="...">${c.de_xuat||''}</textarea></div>`;
  } else {
    body.innerHTML = `
      <div class="field-group"><label>Buổi thứ</label><input type="text" id="rm_buoi_thu" placeholder="1, 2, 3..." value="${c.buoi_thu||''}"/></div>
      <div class="field-group"><label>Nội dung buổi học</label><textarea id="rm_noi_dung" style="min-height:100px;" placeholder="...">${c.noi_dung||''}</textarea></div>
      <div class="field-group"><label>Phản ứng của HS trong và sau buổi học</label><textarea id="rm_phan_ung" placeholder="...">${c.phan_ung||''}</textarea></div>
      <div class="field-group"><label>Khai thác mới về HS</label><textarea id="rm_khai_thac" placeholder="...">${c.khai_thac||''}</textarea></div>
      <div class="field-group"><label>Tương tác với HS đáng chú ý</label><textarea id="rm_tuong_tac" placeholder="...">${c.tuong_tac||''}</textarea></div>
      <div class="field-group"><label>Đề xuất hướng chăm sóc tiếp theo</label><textarea id="rm_de_xuat_cs" placeholder="...">${c.de_xuat_cs||''}</textarea></div>
      <div class="field-group"><label>Buổi gặp tiếp theo</label><input type="text" id="rm_buoi_tiep" placeholder="DD/MM/YYYY HH:mm" value="${c.buoi_tiep||''}"/></div>
      <div class="field-group"><label>Nội dung buổi tiếp theo</label><textarea id="rm_noi_dung_tiep" placeholder="...">${c.noi_dung_tiep||''}</textarea></div>`;
  }
  document.getElementById('addRecordModal').classList.add('open');
}

async function saveRecord() {
  const isTV = currentRecordType === 'tu_van';
  let data = {};
  if (isTV) {
    data = {
      lan_thu:       document.getElementById('rm_lan_thu')?.value,
      ten_cong_cu:   document.getElementById('rm_ten_cong_cu')?.value,
      ket_qua_test:  document.getElementById('rm_ket_qua_test')?.value,
      van_de:        document.getElementById('rm_van_de')?.value,
      phan_hoi:      document.getElementById('rm_phan_hoi')?.value,
      diem_hai:      document.getElementById('rm_diem_hai')?.value,
      de_xuat:       document.getElementById('rm_de_xuat')?.value,
    };
  } else {
    data = {
      buoi_thu:      document.getElementById('rm_buoi_thu')?.value,
      noi_dung:      document.getElementById('rm_noi_dung')?.value,
      phan_ung:      document.getElementById('rm_phan_ung')?.value,
      khai_thac:     document.getElementById('rm_khai_thac')?.value,
      tuong_tac:     document.getElementById('rm_tuong_tac')?.value,
      de_xuat_cs:    document.getElementById('rm_de_xuat_cs')?.value,
      buoi_tiep:     document.getElementById('rm_buoi_tiep')?.value,
      noi_dung_tiep: document.getElementById('rm_noi_dung_tiep')?.value,
    };
  }
  try {
    // Validation for new records (not edits)
    if (!currentRecordId) {
      if (isTV) {
        const lanThu = parseInt(data.lan_thu);
        if (lanThu) {
          // Check if Chốt TV lần N exists
          const checkRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&session_number=eq.${lanThu}&select=id&limit=1`);
          const checkData = await checkRes.json();
          if (checkData.length === 0) {
            showToast(`⚠️ Chưa có Chốt TV lần ${lanThu}. Hãy chốt TV trước!`);
            return;
          }
        }
      }
    }

    if (currentRecordId) {
      await sbFetch(`/rest/v1/records?id=eq.${currentRecordId}`, { method:'PATCH', body: JSON.stringify({ content: data }) });
      showToast('✅ Đã cập nhật phiếu!');
    } else {
      await sbFetch('/rest/v1/records', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ profile_id: currentProfileId, record_type: currentRecordType, content: data }) });
      showToast('✅ Đã thêm!');
    }
    closeModal('addRecordModal');
    currentRecordId = null;
    await _refreshCurrentProfile();
  } catch { showToast('❌ Lỗi'); }
}
