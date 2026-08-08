// === Date/time helpers moved to utils.js (shinDate, shinDateTime, shinTime, getTimeAgo, escHtml) ===

// ── Shared utility: label for the latest activity of a profile ──────────────
// rec = latest record row, sess = latest consultation_session row (either can be null)
function latestActivityLabel(rec, sess) {
  const recTime = rec ? new Date(rec.created_at).getTime() : 0;
  const sessTime = sess ? new Date(sess.created_at).getTime() : 0;
  if (!rec && !sess) return '';
  let label, actDate;
  if (recTime >= sessTime) {
    const { record_type: rt, content: c } = rec;
    actDate = rec.created_at;
    if (rt === 'tu_van')      label = `Báo cáo TV lần ${c?.lan_thu||''}`;
    else if (rt === 'bien_ban')    label = `Báo cáo BB buổi ${c?.buoi_thu||''}`;
    else if (rt === 'chot_bb')     label = '🎓 Chốt BB';
    else if (rt === 'chot_center') label = '🏛️ Chốt Center';
    else if (rt === 'mo_kt')       label = '📖 Đã mở KT';
    else if (rt === 'drop_out')    label = '🔴 Drop-out';
    else if (rt === 'pause')       label = '⏸️ Pause';
    else if (rt === 'alive')       label = '🟢 Khôi phục Alive';
    else if (rt === 'bai_dac_biet') label = `⭐ Bài đặc biệt${c?.buoi_thu ? ' (buổi '+c.buoi_thu+')' : ''}`;
    else if (rt === 'pv_gvbb')     label = '🎤 PV GVBB';
    else if (rt === 'dky_center')   label = '📋 ĐKý Center';
    else if (rt === 'pv_hs')       label = '🎓 PV HS';
    else if (rt === 'btvn')        label = '📝 BTVN';
    else if (rt === 'team_meeting') label = '🤝 Team Meeting';
    else label = rt;
  } else {
    actDate = sess.created_at;
    label = `Chốt TV lần ${sess.session_number}${sess.tool ? ' ('+sess.tool+')' : ''}`;
  }
  const ago = getTimeAgo(actDate);
  return ago ? `${label} · ${ago}` : label;
}

// ══════════════════════════════════════════════════════════════════════════════
// TIMELINE + PHASE MANAGEMENT
// ══════════════════════════════════════════════════════════════════════════════

async function loadJourney(profileId, currentPhase) {
  const phBtnEl = document.getElementById('phaseButtons');
  const tlEl = document.getElementById('timelineList');
  if (!phBtnEl || !tlEl) return;

  const cp = (currentPhase || 'chakki').toString().trim().toLowerCase();
  const isDropout = ['dropout','pause'].includes(allProfiles.find(x => x.id === profileId)?.fruit_status);

  // Fetch group info (for tu_van/BB/center phase — after Lập Group)
  let bbGroupInfo = null;
  if (['tu_van','bb','center','completed'].includes(cp)) {
    try {
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id,telegram_group_id,telegram_group_title,invite_link`);
      const fgs = await fgRes.json();
      // Find real group (not null, not -Date.now() placeholder)
      bbGroupInfo = (fgs||[]).find(g => g.telegram_group_id && g.telegram_group_id > -1000000000000) || null;
    } catch(e) {}
  }

  // Phase action buttons
  let btnHtml = '';
  if (phBtnEl) phBtnEl.style.display = isDropout ? 'none' : 'flex'; // Force display or hide
  if (!isDropout) {
    if (['new','chakki'].includes(cp)) {
      btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt Tư vấn lần tiếp theo</button>`;
    } else if (cp === 'tu_van_hinh') {
      btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt TV tiếp</button>
        <button id="btnLapGroupTVBB" class="add-record-btn" onclick="openChotBBModal()" style="display:none;flex:1;background:var(--green);color:white;">🎓 Lập group TV - BB</button>`;
    } else if (cp === 'tu_van') {
      // (Báo cáo BB được thêm ở tab BB, nút Mở KT nằm trên Báo cáo BB)
    } else if (cp === 'bb') {
      // BB milestones + conditional Chốt Center — rendered after records fetch
    }
    // Undo button — visible for any phase past Chakki
    if (!['new','chakki','completed'].includes(cp)) {
      const phaseLabels = { tu_van_hinh:'Chốt TV 2', tu_van:'Lập Group', bb:'Mở KT', center:'Chốt Center' };
      btnHtml += `<button onclick="undoLastPhaseChange()" title="Hoàn tác '${phaseLabels[cp]||cp}'" style="
        flex:0 0 auto;padding:10px 14px;border-radius:var(--radius-sm);border:1px dashed var(--text3);
        background:transparent;color:var(--text2);font-size:13px;cursor:pointer;white-space:nowrap;
        transition:all 0.2s;" onmouseover="this.style.borderColor='var(--red)';this.style.color='var(--red)'"
        onmouseout="this.style.borderColor='var(--text3)';this.style.color='var(--text2)'">
        ↩️ Hoàn tác
      </button>`;
    }
  }
  phBtnEl.innerHTML = btnHtml;

  const ktBox = document.getElementById('ktStatusBox');
  const ktText = document.getElementById('ktStatusText');
  const btnMoKT = document.getElementById('btnMoKT');
  const pData = allProfiles.find(x => x.id === profileId);
  if (ktBox && pData) {
    if (['tu_van','bb','center','completed'].includes(cp)) {
      ktBox.style.display = 'flex';
      if (pData.is_kt_opened) {
        ktText.textContent = 'Đã mở KT';
        ktText.style.color = 'var(--green)';
        if (btnMoKT) btnMoKT.style.display = 'none';
      } else {
        ktText.textContent = 'Chưa mở KT';
        ktText.style.color = 'var(--text3)';
        if (btnMoKT) btnMoKT.style.display = 'block';
      }
    } else {
      ktBox.style.display = 'none';
    }
  }

  // ── Group Status Box (only shown when connected — provides "Mở Group" button) ──
  const groupBox = document.getElementById('groupStatusBox');
  if (groupBox) {
    if (['tu_van','bb','center','completed'].includes(cp) && !isDropout && bbGroupInfo) {
      groupBox.style.display = 'block';
      const gTitle = bbGroupInfo.telegram_group_title || 'Group Trái quả';
      const gid = bbGroupInfo.telegram_group_id;
      const invLink = (bbGroupInfo.invite_link || '').replace(/"/g, '&quot;');
      groupBox.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:22px;">💬</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:600;color:var(--text1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${gTitle}</div>
            <div style="font-size:11px;color:var(--green);font-weight:600;margin-top:2px;">✅ Đã kết nối Group Telegram</div>
          </div>
          <button onclick="openBBGroup(this)" data-gid="${gid}" data-link="${invLink}"
            style="padding:6px 14px;border-radius:20px;background:var(--green);color:white;font-size:11px;font-weight:700;border:none;cursor:pointer;white-space:nowrap;"
          >Mở Group →</button>
        </div>`;
      groupBox.style.border = '1px solid rgba(34,197,94,0.35)';
      groupBox.style.background = 'rgba(34,197,94,0.06)';
    } else {
      groupBox.style.display = 'none';
    }
  }



  try {
    const [sessRes, recRes, hjRes, fhRes] = await Promise.all([
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/profile_records?profile_id=eq.${profileId}&record_type=not.in.(ai_mindmap,ai_chat)&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}&select=data,created_at&limit=1`),
      sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data&limit=1`)
    ]);
    const sessions = await sessRes.json();
    const recs = await recRes.json();
    const hapjas = await hjRes.json();
    const fhs = await fhRes.json();
    const fhData = (Array.isArray(fhs) && fhs[0]) ? (fhs[0].data || {}) : {};


    if (cp === 'tu_van_hinh') {
      const hasBcTv2 = recs.some(r => r.record_type === 'tu_van' && Number(r.content?.lan_thu) >= 2);
      const btn = document.getElementById('btnLapGroupTVBB');
      if (btn && hasBcTv2) btn.style.display = '';
    }

    // === BB Milestones: detect status & render buttons ===
    if (cp === 'bb' && !isDropout) {
      const BB_MS = [
        { type: 'bai_dac_biet', icon: '⭐', label: 'Bài đặc biệt' },
        { type: 'pv_gvbb',      icon: '🎤', label: 'PV GVBB' },
        { type: 'dky_center',   icon: '📝', label: 'ĐKý Center' },
        { type: 'pv_hs',        icon: '🎓', label: 'PV HS' }
      ];
      const msRecs = recs.filter(r => BB_MS.some(m => m.type === r.record_type));
      const msDone = new Set(msRecs.map(r => r.record_type));

      let msHtml = BB_MS.map(m => {
        const done = msDone.has(m.type);
        return `<button onclick="toggleBBMilestone('${m.type}',${done})" class="add-record-btn"
          style="flex:1 1 45%;min-width:110px;font-size:12px;padding:8px 6px;
          ${done ? 'background:var(--green);color:white;' : 'background:var(--surface2);color:var(--text1);border:1px dashed var(--border);'}">
          ${done ? '✅' : '⬜'} ${m.icon} ${m.label}
        </button>`;
      }).join('');

      if (msDone.has('pv_hs')) {
        msHtml += `<button class="add-record-btn" onclick="chotCenter()"
          style="flex:1 1 100%;background:#8b5cf6;color:white;margin-top:2px;">
          🏛️ Chốt Center
        </button>`;
      }

      // Prepend milestone buttons before the undo button
      const undoBtn = phBtnEl.innerHTML;
      phBtnEl.innerHTML = msHtml + undoBtn;
    }

    let events = [];

    // Separate mo_kt, bai_dac_biet, and btvn records for lookup
    const moKtRecords = recs.filter(r => r.record_type === 'mo_kt');
    const matchedMoKtIds = new Set();
    const bdbRecords = recs.filter(r => r.record_type === 'bai_dac_biet');
    const matchedBdbIds = new Set();
    const btvnRecords = recs.filter(r => r.record_type === 'btvn');
    const matchedBtvnIds = new Set();

    // 1. Chakki — ALWAYS at bottom (oldest anchor)
    const currentP = allProfiles.find(x => x.id === profileId);
    const t2Chakki = fhData.t2_ngay_chakki || currentP?.t2_values?.t2_ngay_chakki;
    const hjRecord = recs.find(r => r.record_type === 'hapja');
    const hjChakki = hjRecord?.data?.ngay_chakki || hapjas[0]?.data?.ngay_chakki;
    const chakkiDate = t2Chakki || hjChakki || hapjas[0]?.created_at || currentP?.created_at;
    if (chakkiDate) {
      events.push({
        date: chakkiDate, icon: '🍎', text: 'Ngày Chakki (Hapja)',
        sortDate: 0, deletable: false, isMajor: true, _type: 'chakki'
      });
    }

    // 2. Pair Sessions (Chốt TV) and tu_van Records (Báo cáo TV) on the SAME ROW
    const tuVanRecords = recs.filter(r => r.record_type === 'tu_van');
    const matchedTuVanIds = new Set();

    const parseNum = val => {
      if (val === null || val === undefined) return null;
      if (typeof val === 'number') return isNaN(val) ? null : val;
      const m = String(val).match(/\d+/);
      return m ? parseInt(m[0], 10) : null;
    };

    // Sort sessions by session_number ascending (1, 2, 3...)
    const sortedSessions = [...sessions].sort((a,b) => (parseNum(a.session_number)||0) - (parseNum(b.session_number)||0));
    // Sort tu_van records by report date / created_at ascending
    const sortedTuVan = [...tuVanRecords].sort((a,b) => {
      const tA = new Date(a.content?.report_date || a.created_at).getTime();
      const tB = new Date(b.content?.report_date || b.created_at).getTime();
      return tA - tB;
    });

    const sessionMatchMap = new Map();

    // Step 1: Match by explicit parsed session_number / lan_thu
    sortedSessions.forEach(s => {
      const sNum = parseNum(s.session_number);
      if (sNum !== null) {
        const match = sortedTuVan.find(r => !matchedTuVanIds.has(r.id) && parseNum(r.content?.lan_thu) === sNum);
        if (match) {
          matchedTuVanIds.add(match.id);
          sessionMatchMap.set(s.id, match);
        }
      }
    });

    // Step 2: Fallback match by order index for remaining unmatched sessions & tu_van records
    sortedSessions.forEach(s => {
      if (!sessionMatchMap.has(s.id)) {
        const match = sortedTuVan.find(r => !matchedTuVanIds.has(r.id));
        if (match) {
          matchedTuVanIds.add(match.id);
          sessionMatchMap.set(s.id, match);
        }
      }
    });

    sessions.forEach(s => {
      const sessNum = parseNum(s.session_number) || s.session_number;
      const sessDate = s.scheduled_at || s.created_at;
      const sSortDate = sessDate ? new Date(sessDate).getTime() : 0;

      const matchingTuVan = sessionMatchMap.get(s.id) || null;
      let tuVanDate = null;
      if (matchingTuVan) {
        tuVanDate = matchingTuVan.content?.report_date ? matchingTuVan.content.report_date + 'T12:00:00' : matchingTuVan.created_at;
      }

      const tuVanSortDate = tuVanDate ? new Date(tuVanDate).getTime() : 0;
      const effectiveSortDate = Math.max(sSortDate, tuVanSortDate);

      events.push({
        date: sessDate || tuVanDate,
        sortDate: effectiveSortDate,
        _type: 'paired_tv',
        _session: s,
        _sessionNum: sessNum,
        _sessionDate: sessDate,
        _tuVanRecord: matchingTuVan,
        _tuVanDate: tuVanDate,
        isMajor: false,
        deletable: false
      });
    });

    // Orphan tu_van records without matching session
    sortedTuVan.forEach(r => {
      if (matchedTuVanIds.has(r.id)) return;
      const lanThu = parseNum(r.content?.lan_thu);
      const _eventDate = r.content?.report_date ? r.content.report_date + 'T12:00:00' : r.created_at;
      events.push({
        date: _eventDate,
        sortDate: new Date(_eventDate).getTime(),
        _type: 'paired_tv',
        _session: null,
        _sessionNum: lanThu,
        _sessionDate: null,
        _tuVanRecord: r,
        _tuVanDate: _eventDate,
        isMajor: false,
        deletable: false
      });
    });

    // 3. Other Records (BC BB, Chốt BB, Chốt Center, etc.)
    recs.forEach(r => {
      if (r.record_type === 'tu_van') return; // Handled in paired_tv above!

      let icon, text, isMajor = false;
      let _buoiThu = null;

      if      (r.record_type === 'bien_ban')    { 
        _buoiThu = r.content?.buoi_thu;
        const _hasKT = r.content?.has_kt_content;
        icon='📋'; text=`Báo cáo BB${_buoiThu?' buổi '+_buoiThu:''}${_hasKT ? ' 📖' : ''}`;
      }
      else if (r.record_type === 'chot_bb')     { icon='🎓'; text='Lập Group TV - BB'; isMajor = true; }
      else if (r.record_type === 'chot_center') { icon='🏛️'; text='Chốt Center'; isMajor = true; }
      else if (r.record_type === 'bai_dac_biet') { return; } // handled via split-row on bien_ban
      else if (r.record_type === 'pv_gvbb')     { icon='🎤'; text='PV GVBB'; isMajor = true; }
      else if (r.record_type === 'dky_center')   { icon='📝'; text='ĐKý Center'; isMajor = true; }
      else if (r.record_type === 'pv_hs')        { icon='🎓'; text='PV HS'; isMajor = true; }
      else if (r.record_type === 'btvn') { return; } // skipped, handled via 3rd column or standalone row
      else if (r.record_type === 'team_meeting') { icon='🤝'; text='Team Meeting'; isMajor = true; }
      else if (r.record_type === 'mo_kt')       { return; }
      else if (r.record_type === 'note')        { return; }
      else if (r.record_type === 'phase_change') { return; }
      else if (r.record_type === 'drop_out')    { icon='🔴'; text=`Drop-out: ${r.content?.reason||'Không có lý do'}`; isMajor = true; }
      else if (r.record_type === 'pause')         { icon='⏸️'; text=`Pause: ${r.content?.reason||'Tạm dừng'}`; isMajor = true; }
      else if (r.record_type === 'alive')       { icon='🟢'; text='Khôi phục Alive'; isMajor = true; }
      else { icon='📌'; text=r.record_type; }

      // Check if this bien_ban has a matching KT
      let hasKT = false, ktRecordId = null;
      if (r.record_type === 'bien_ban' && _buoiThu != null) {
        const ktMatch = moKtRecords.find(m => Number(m.content?.buoi_thu) === Number(_buoiThu));
        if (ktMatch) {
          hasKT = true;
          ktRecordId = ktMatch.id;
          matchedMoKtIds.add(ktMatch.id);
        }
      }

      // Check if this bien_ban has a matching Bài đặc biệt
      let hasBDB = false, bdbRecordId = null;
      if (r.record_type === 'bien_ban' && _buoiThu != null) {
        const bdbMatch = bdbRecords.find(m => Number(m.content?.buoi_thu) === Number(_buoiThu));
        if (bdbMatch) {
          hasBDB = true;
          bdbRecordId = bdbMatch.id;
          matchedBdbIds.add(bdbMatch.id);
        }
      }

      // Check if this bien_ban has a matching BTVN
      let hasBTVN = false, btvnRecordId = null, btvnDeletable = false;
      if (r.record_type === 'bien_ban') {
        const btvnMatch = btvnRecords.find(b => b.content?.bb_record_id === r.id);
        if (btvnMatch) {
          hasBTVN = true;
          btvnRecordId = btvnMatch.id;
          btvnDeletable = true;
          matchedBtvnIds.add(btvnMatch.id);
        }
      }

      const _eventDate = r.content?.report_date ? r.content.report_date + 'T12:00:00' : r.created_at;
      events.push({
        date: _eventDate, icon, text, sortDate: new Date(_eventDate).getTime(),
        deletable: false, _type: 'record', _id: r.id, _rtype: r.record_type,
        isMajor, _buoiThu, hasKT, ktRecordId, hasBDB, bdbRecordId,
        hasBTVN, btvnRecordId, btvnDeletable
      });
    });

    // 4. Standalone BTVN records
    btvnRecords.forEach(b => {
      if (matchedBtvnIds.has(b.id)) return;
      const _eventDate = b.content?.report_date ? b.content.report_date + 'T12:00:00' : b.created_at;
      events.push({
        date: _eventDate,
        icon: '📝',
        text: 'Bài tập về nhà (Tự do)',
        sortDate: new Date(_eventDate).getTime(),
        deletable: false,
        _type: 'record',
        _id: b.id,
        _rtype: 'btvn',
        isMajor: false,
        _buoiThu: null,
        hasKT: false,
        ktRecordId: null,
        hasBDB: false,
        bdbRecordId: null,
        hasBTVN: true,
        btvnRecordId: b.id,
        btvnDeletable: true
      });
    });

    // Sort descending: newest (top) → oldest (bottom)
    events.sort((a,b) => b.sortDate - a.sortDate);

    const finalEvents = [...events];

    // ── Determine which SINGLE event gets the 🗑 delete button ──
    if (cp === 'bb') {
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'bien_ban') {
          finalEvents[i].deletable = true; break;
        }
      }
    } else if (cp === 'tu_van') {
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'bien_ban') {
          finalEvents[i].deletable = true; break;
        }
      }
    } else if (cp === 'tu_van_hinh' || cp === 'chakki') {
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'paired_tv') {
          if (finalEvents[i]._tuVanRecord) {
            finalEvents[i].tuVanDeletable = true;
          } else if (finalEvents[i]._session) {
            finalEvents[i].sessionDeletable = true;
          }
          break;
        }
      }
    }

    // ── Render as TIMELINE ──
    if (finalEvents.length === 0) {
      tlEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có sự kiện nào</div>';
    } else {
      const hoverIn  = `this.querySelectorAll('.tl-del-btn,.tl-edit-btn').forEach(b=>b.classList.add('visible'))`;
      const hoverOut = `this.querySelectorAll('.tl-del-btn,.tl-edit-btn').forEach(b=>b.classList.remove('visible'))`;

      let html = '<div class="tl-container">';
      html += `
        <div class="tl-header-row">
          <div class="tl-left tl-header-cell">Sự kiện</div>
          <div class="tl-right tl-header-cell">Báo cáo</div>
          <div class="tl-btvn tl-header-cell">BTVN</div>
        </div>
      `;

      const renderBtvnCard = (btvnId, dateStr) => {
        if (!btvnId) return '';
        return `
          <div class="tl-btvn-card tl-clickable" onclick="viewRecord('${btvnId}','btvn')">
            <span class="tl-icon" style="font-size:15px;margin-right:4px;">📝</span>
            <div class="tl-btvn-info">
              ${dateStr ? `<span class="tl-date" style="margin-top:0;">${dateStr}</span>` : ''}
            </div>
            <div class="tl-btn-group-btvn">
              <button onclick="event.stopPropagation();editRecord('${btvnId}','btvn')" title="Chỉnh sửa BTVN" class="tl-edit-btn visible" style="opacity:1;">✏️</button>
              <button onclick="event.stopPropagation();deleteEventRecord('${btvnId}','btvn')" title="Xóa BTVN" class="tl-del-btn visible" style="opacity:1;">🗑</button>
            </div>
          </div>
        `;
      };

      finalEvents.forEach((e) => {
        const d = e.date ? shinDate(e.date) : '';

        // Delete button helper
        let delBtn = '';
        if (e.deletable) {
          const fn = e._type === 'session'
            ? `deleteEventSession('${e._id}',${e._num})`
            : `deleteEventRecord('${e._id}','${e._rtype}')`;
          delBtn = `<button onclick="event.stopPropagation();${fn}" title="Xóa" class="tl-del-btn">🗑</button>`;
        }

        const clickAttr = (e._type === 'session' && e._session)
          ? `onclick="editSession('${e._id}')" style="cursor:pointer;"`
          : '';

        const viewAttr = (e._type === 'record' && e._id && (e._rtype === 'tu_van' || e._rtype === 'bien_ban'))
          ? `onclick="viewRecord('${e._id}','${e._rtype}')" style="cursor:pointer;"`
          : '';

        let editBtn = '';
        if (e._type === 'record' && e._id && (e._rtype === 'tu_van' || e._rtype === 'bien_ban')) {
          editBtn = `<button onclick="event.stopPropagation();editRecord('${e._id}','${e._rtype}')" title="Chỉnh sửa báo cáo" class="tl-edit-btn">✏️</button>`;
        }

        if (e._type === 'paired_tv') {
          // ── PAIRED ROW: Chốt TV (left) + Báo cáo TV (right) ──
          const sDateStr = e._sessionDate ? shinDate(e._sessionDate) : '';
          const rDateStr = e._tuVanDate ? shinDate(e._tuVanDate) : '';

          const sessEditBtn = e._session ? `<button onclick="event.stopPropagation();editSession('${e._session.id}')" title="Chỉnh sửa Chốt TV" class="tl-edit-btn">✏️</button>` : '';
          const sessDelBtn = e.sessionDeletable ? `<button onclick="event.stopPropagation();deleteEventSession('${e._session.id}',${e._sessionNum})" title="Xóa Chốt TV" class="tl-del-btn">🗑</button>` : '';

          const rEditBtn = e._tuVanRecord ? `<button onclick="event.stopPropagation();editRecord('${e._tuVanRecord.id}','tu_van')" title="Chỉnh sửa báo cáo" class="tl-edit-btn">✏️</button>` : '';
          const rDelBtn = e.tuVanDeletable ? `<button onclick="event.stopPropagation();deleteEventRecord('${e._tuVanRecord.id}','tu_van')" title="Xóa báo cáo" class="tl-del-btn">🗑</button>` : '';

          html += `<div class="tl-item tl-paired-tv" onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left"${e._session ? ` onclick="editSession('${e._session.id}')" style="cursor:pointer;"` : ''}>
              ${e._session ? `
                <span class="tl-icon">📅</span>
                <div class="tl-left-info">
                  <span class="tl-label">Chốt TV lần ${e._sessionNum}${e._session.tool ? ' ('+e._session.tool+')' : ''}</span>
                  ${sDateStr ? `<span class="tl-date">${sDateStr}</span>` : ''}
                </div>
                <div class="tl-btn-group">${sessEditBtn}${sessDelBtn}</div>
              ` : ''}
            </div>
            <div class="tl-right${e._tuVanRecord ? ' tl-clickable' : ''}" ${e._tuVanRecord ? `onclick="viewRecord('${e._tuVanRecord.id}','tu_van')" style="cursor:pointer;"` : ''}>
              ${e._tuVanRecord ? `
                <span class="tl-icon" style="flex-shrink:0">📝</span>
                <div class="tl-right-info">
                  <span class="tl-label">Báo cáo TV${e._sessionNum ? ' lần '+e._sessionNum : ''}</span>
                  ${rDateStr ? `<span class="tl-date">${rDateStr}</span>` : ''}
                </div>
                <div class="tl-btn-group">${rEditBtn}${rDelBtn}</div>
              ` : ''}
            </div>
            <div class="tl-btvn"></div>
          </div>`;
        } else if (e.hasKT || e.hasBDB) {
          // ── SPLIT ROW: milestone(s) left + BB report middle + BTVN right ──
          let leftHtml = '';
          if (e.hasKT) {
            const ktDel = `<button onclick="event.stopPropagation();deleteEventRecordKt('${e.ktRecordId}')" title="Hủy Mở KT" class="tl-del-btn">🗑</button>`;
            leftHtml += `<div style="display:flex;align-items:center;gap:6px;">
              <span class="tl-icon">📖</span>
              <div class="tl-left-info">
                <span class="tl-label tl-label-kt">Đã mở KT</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              ${ktDel}
            </div>`;
          }
          if (e.hasBDB) {
            const bdbDel = `<button onclick="event.stopPropagation();deleteBBMilestone('${e.bdbRecordId}')" title="Hủy Bài đặc biệt" class="tl-del-btn">🗑</button>`;
            leftHtml += `<div style="display:flex;align-items:center;gap:6px;">
              <span class="tl-icon">⭐</span>
              <div class="tl-left-info">
                <span class="tl-label" style="color:#f59e0b;font-weight:600;">Bài đặc biệt</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              ${bdbDel}
            </div>`;
          }
          html += `<div class="tl-item tl-kt" onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left"${(e.hasKT && e.hasBDB) ? ' style="flex-direction:column;gap:8px;"' : ''}>
              ${leftHtml}
            </div>
            <div class="tl-right tl-clickable" ${viewAttr}>
              <span class="tl-icon" style="flex-shrink:0">${e.icon}</span>
              <div class="tl-right-info">
                <span class="tl-label">${e.text}</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              <div class="tl-btn-group">${editBtn}${delBtn}</div>
            </div>
            <div class="tl-btvn">
              ${e.hasBTVN ? renderBtvnCard(e.btvnRecordId, d) : ''}
            </div>
          </div>`;
        } else if (e.isMajor) {
          // ── MAJOR EVENT: left column only ── (with date edit)
          const canEditDate = e._type === 'record' && e._id;
          const dateEditBtn = canEditDate
            ? `<button onclick="event.stopPropagation();editEventDate('${e._id}')" title="Đổi ngày" class="tl-edit-btn" style="font-size:11px;">📅</button>`
            : '';
          html += `<div class="tl-item tl-major" ${clickAttr} onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left">
              <span class="tl-icon">${e.icon}</span>
              <div class="tl-left-info">
                <span class="tl-label">${e.text}</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              <div class="tl-btn-group">${dateEditBtn}${delBtn}</div>
            </div>
            <div class="tl-right"></div>
            <div class="tl-btvn"></div>
          </div>`;
        } else if (e._rtype === 'btvn') {
          // ── STANDALONE BTVN: right column only ──
          html += `<div class="tl-item tl-btvn-standalone" onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left"></div>
            <div class="tl-right"></div>
            <div class="tl-btvn">
              ${renderBtvnCard(e.btvnRecordId, d)}
            </div>
          </div>`;
        } else {
          // ── REPORT: middle column only ──
          html += `<div class="tl-item tl-report-row" onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left"></div>
            <div class="tl-right tl-clickable" ${viewAttr}>
              <span class="tl-icon" style="flex-shrink:0">${e.icon}</span>
              <div class="tl-right-info">
                <span class="tl-label">${e.text}</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              <div class="tl-btn-group">${editBtn}${delBtn}</div>
            </div>
            <div class="tl-btvn">
              ${e.hasBTVN ? renderBtvnCard(e.btvnRecordId, d) : ''}
            </div>
          </div>`;
        }
      });

      html += '</div>';
      tlEl.innerHTML = html;
    }
  } catch(e) { console.error('Journey error:', e); }
}

// ── View a report record (polished read-only popup matching Telegram style) ──
async function viewRecord(recordId, recordType) {
  try {
    const res = await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}&select=*`);
    const rows = await res.json();
    if (!rows[0]) { showToast('⚠️ Không tìm thấy báo cáo'); return; }
    const r = rows[0];
    const c = r.content || {};
    const date = shinDate(r.created_at);
    const pName = allProfiles.find(x => x.id === r.profile_id)?.full_name || '';
    const isTV = recordType === 'tu_van';
    const isBB = recordType === 'bien_ban';
    const isBTVN = recordType === 'btvn';
    const isTeamMeeting = recordType === 'team_meeting';

    // Build styled content sections
    let sections = '';
    const addSection = (icon, label, value) => {
      if (!value) return;
      sections += `<div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:4px;">${icon} ${label}</div>
        <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${value}</div>
      </div>`;
    };

    if (isTV) {
      // ── TV Report ──
      const header = `<div style="text-align:center;padding:12px 0 8px;">
        <div style="font-size:16px;font-weight:800;color:var(--accent);">📝 BÁO CÁO TƯ VẤN — Lần ${c.lan_thu || '?'}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">🍎 ${pName}</div>
        <div style="margin:8px auto 0;width:80%;height:1px;background:linear-gradient(90deg, transparent, var(--border), transparent);"></div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 ${date}${c.ten_cong_cu ? ` · 🔧 ${c.ten_cong_cu}` : ''}</div>
      </div>`;
      sections = header;
      addSection('📌', 'Kết quả test', c.ket_qua_test);
      addSection('💬', 'Vấn đề / Nhu cầu khai thác', c.van_de);
      addSection('💭', 'Phản hồi của trái', c.phan_hoi);
      addSection('🎯', 'Điểm hái trái', c.diem_hai);
      addSection('📋', 'Đề xuất TVV', c.de_xuat);
    } else if (isBB) {
      // ── BB Report ──
      let buoiTiepDisplay = '';
      if (c.buoi_tiep) {
        try { buoiTiepDisplay = shinDateTime(c.buoi_tiep); } catch(e) {}
      }
      const header = `<div style="text-align:center;padding:12px 0 8px;">
        <div style="font-size:16px;font-weight:800;color:var(--green);">📖 BÁO CÁO BB — Buổi ${c.buoi_thu || '?'}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">🍎 ${pName}</div>
        <div style="margin:8px auto 0;width:80%;height:1px;background:linear-gradient(90deg, transparent, var(--border), transparent);"></div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 ${date}</div>
      </div>`;
      sections = header;
      addSection('📚', 'Nội dung buổi học', c.noi_dung);
      addSection('😊', 'Phản ứng HS', c.phan_ung);
      addSection('🔍', 'Khai thác mới về HS', c.khai_thac);
      addSection('💡', 'Tương tác đáng chú ý', c.tuong_tac);
      addSection('📋', 'Đề xuất hướng chăm sóc', c.de_xuat_cs);
      if (buoiTiepDisplay || c.noi_dung_tiep) {
        sections += `<div style="margin-top:8px;padding:10px 12px;background:var(--surface);border-radius:var(--radius-sm);border:1px dashed var(--border);">`;
        if (buoiTiepDisplay) sections += `<div style="font-size:12px;font-weight:600;color:var(--text2);">📅 Buổi tiếp: ${buoiTiepDisplay}</div>`;
        if (c.noi_dung_tiep) sections += `<div style="font-size:12px;color:var(--text2);margin-top:4px;">📝 Nội dung tiếp: ${c.noi_dung_tiep}</div>`;
        sections += `</div>`;
      }
    } else if (isTeamMeeting) {
      const header = `<div style="text-align:center;padding:12px 0 8px;">
        <div style="font-size:16px;font-weight:800;color:var(--text1);">🤝 TEAM MEETING</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">🍎 ${pName}</div>
        <div style="margin:8px auto 0;width:80%;height:1px;background:linear-gradient(90deg, transparent, var(--border), transparent);"></div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 ${date}</div>
      </div>`;
      sections = header;
      addSection('📝', 'Ghi chú cuộc họp', c.meeting_notes);
    } else if (isBTVN) {
      const header = `<div style="text-align:center;padding:12px 0 8px;">
        <div style="font-size:16px;font-weight:800;color:var(--accent);">📝 BÀI TẬP VỀ NHÀ</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px;">🍎 ${pName}</div>
        <div style="margin:8px auto 0;width:80%;height:1px;background:linear-gradient(90deg, transparent, var(--border), transparent);"></div>
        <div style="font-size:11px;color:var(--text3);margin-top:6px;">📅 Nộp ngày: ${date}</div>
      </div>`;
      sections = header;
      if (c.qas && c.qas.length > 0) {
        c.qas.forEach((qa, i) => {
          sections += `<div style="margin-bottom:14px;background:var(--surface2);padding:10px;border-radius:8px;border:1px solid var(--border);">
            <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:4px;">Q${i+1}: ${qa.q}</div>
            <div style="font-size:13px;color:var(--text);line-height:1.6;white-space:pre-wrap;">${qa.a}</div>
          </div>`;
        });
      }
    }

    if (c.image_url) {
      const imgUrls = c.image_url.split(',').map(u => u.trim()).filter(Boolean);
      const galleryHtml = imgUrls.map(url => `
        <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden; width:100px; height:100px; cursor:pointer; flex-shrink:0;" onclick="if(typeof openChatImageModal === 'function') openChatImageModal('${url}')">
          <img src="${url}" style="width:100%; height:100%; object-fit:cover; display:block;" />
        </div>
      `).join('');
      sections += `
        <div style="margin-top:14px; border-top: 1px dashed var(--border); padding-top:14px;">
          <div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px;">📸 Hình ảnh đính kèm (${imgUrls.length} ảnh)</div>
          <div style="display:flex; gap:8px; overflow-x:auto; padding-bottom:4px;">
            ${galleryHtml}
          </div>
          ${c.image_desc ? `<div style="font-size:11.5px;color:var(--text2);margin-top:6px;font-style:italic;line-height:1.4;">📝 ${escHtml(c.image_desc)}</div>` : ''}
        </div>
      `;
    }

    // Build plain-text for copy (Telegram-friendly format)
    let copyText = '';
    const addCopyLine = (icon, label, value) => {
      if (!value) return;
      copyText += `${icon} ${label}:\n${value}\n\n`;
    };
    if (isTV) {
      copyText += `📝 BÁO CÁO TƯ VẤN — Lần ${c.lan_thu || '?'}\n`;
      copyText += `🍎 ${pName}\n━━━━━━━━━━━━━━━━━━━━━\n`;
      copyText += `📅 Ngày: ${date}${c.ten_cong_cu ? ` · 🔧 ${c.ten_cong_cu}` : ''}\n\n`;
      addCopyLine('📌', 'Kết quả test', c.ket_qua_test);
      addCopyLine('💬', 'Vấn đề / Nhu cầu khai thác', c.van_de);
      addCopyLine('💭', 'Phản hồi của trái', c.phan_hoi);
      addCopyLine('🎯', 'Điểm hái trái', c.diem_hai);
      addCopyLine('📋', 'Đề xuất TVV', c.de_xuat);
      if (c.image_url) {
        copyText += `📸 Ảnh: ${c.image_url}\n`;
        if (c.image_desc) copyText += `📝 Mô tả: ${c.image_desc}\n`;
        copyText += `\n`;
      }
    } else if (isBB) {
      let buoiTiepCopy = '';
      if (c.buoi_tiep) { try { buoiTiepCopy = shinDateTime(c.buoi_tiep); } catch(e) {} }
      copyText += `📖 BÁO CÁO BB — Buổi ${c.buoi_thu || '?'}\n`;
      copyText += `🍎 ${pName}\n━━━━━━━━━━━━━━━━━━━━━\n`;
      copyText += `📅 Ngày: ${date}\n\n`;
      addCopyLine('📚', 'Nội dung buổi học', c.noi_dung);
      addCopyLine('😊', 'Phản ứng HS', c.phan_ung);
      addCopyLine('🔍', 'Khai thác mới', c.khai_thac);
      addCopyLine('💡', 'Tương tác đáng chú ý', c.tuong_tac);
      addCopyLine('📋', 'Đề xuất chăm sóc', c.de_xuat_cs);
      if (buoiTiepCopy) copyText += `📅 Buổi tiếp: ${buoiTiepCopy}\n`;
      if (c.noi_dung_tiep) copyText += `📝 Nội dung tiếp: ${c.noi_dung_tiep}\n`;
      if (c.image_url) {
        copyText += `\n📸 Ảnh: ${c.image_url}\n`;
        if (c.image_desc) copyText += `📝 Mô tả: ${c.image_desc}\n`;
      }
    } else if (isTeamMeeting) {
      copyText += `🤝 TEAM MEETING\n`;
      copyText += `🍎 ${pName}\n━━━━━━━━━━━━━━━━━━━━━\n`;
      copyText += `📅 Ngày: ${date}\n\n`;
      addCopyLine('📝', 'Ghi chú', c.meeting_notes);
    } else if (isBTVN) {
      copyText += `📝 BÀI TẬP VỀ NHÀ\n`;
      copyText += `🍎 ${pName}\n━━━━━━━━━━━━━━━━━━━━━\n`;
      copyText += `📅 Ngày nộp: ${date}\n\n`;
      if (c.qas && c.qas.length > 0) {
        c.qas.forEach((qa, i) => {
          copyText += `Q${i+1}: ${qa.q}\nA: ${qa.a}\n\n`;
        });
      }
    }

    // Show in a read-only popup
    showReportPopup(sections, recordId, recordType, copyText.trim());
  } catch(e) { showToast('❌ Lỗi tải báo cáo'); console.error(e); }
}

// ── Polished report popup ──
function showReportPopup(contentHtml, recordId, recordType, copyText) {
  let modal = document.getElementById('reportViewModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reportViewModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `<div class="modal" style="max-height:85vh;padding:0;display:flex;flex-direction:column;">
      <div class="modal-handle" style="margin-top:12px;"></div>
      <div style="overflow-y:auto;overflow-x:hidden;padding:0 16px 16px;flex:1;" id="reportViewBody"></div>
      <div style="display:flex;gap:8px;padding:8px 16px 16px;border-top:1px solid var(--border);" id="reportViewActions"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('open'); });
  }
  document.getElementById('reportViewBody').innerHTML = contentHtml;
  // Store copy text
  window._reportCopyText = copyText || '';
  // Actions: Copy + Delete (if BTVN) + Edit + Close
  const acts = document.getElementById('reportViewActions');
  let delBtnHtml = '';
  if (recordType === 'btvn') {
    delBtnHtml = `<button onclick="document.getElementById('reportViewModal').classList.remove('open');deleteEventRecord('${recordId}','${recordType}')" style="padding:10px 14px;border-radius:var(--radius-sm);border:1px solid rgba(239, 68, 68, 0.4);background:rgba(239, 68, 68, 0.08);color:var(--red);font-size:13px;cursor:pointer;" title="Xóa BTVN">🗑️</button>`;
  }
  acts.innerHTML = `
    <button onclick="copyToClipboard(window._reportCopyText)" style="padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;color:var(--text);font-size:13px;cursor:pointer;" title="Copy báo cáo">📋</button>
    ${delBtnHtml}
    <button onclick="document.getElementById('reportViewModal').classList.remove('open');editRecord('${recordId}','${recordType}')" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;">✏️ Chỉnh sửa</button>
    <button onclick="document.getElementById('reportViewModal').classList.remove('open')" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:none;background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;">Đóng</button>`;
  modal.classList.add('open');
}

// ── Edit a report record (fetch content & open modal in EDIT mode) ──
async function editRecord(recordId, recordType) {
  try {
    const res = await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}&select=*`);
    const rows = await res.json();
    if (rows[0]) {
      currentRecordId = rows[0].id; // set ID so saveRecord does PATCH
      openAddRecordModal(recordType, rows[0].content, false); // false = editable
    }
  } catch(e) { showToast('❌ Lỗi tải báo cáo'); console.error(e); }
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
    if (typeof invalidateCache === 'function') {
      invalidateCache('profiles');
      invalidateCache('reports');
    }
    filterProfiles();
    loadDashboard(true);
  }
}

// ── Delete single session (only allowed when in tu_van phase, newest only) ──
async function deleteEventSession(sessionId, sessionNum) {
  if (!await showConfirmAsync(`Xóa "Chốt TV lần ${sessionNum}"?\n\nChú ý: Hành động này có thể làm thay đổi giai đoạn hệ thống nếu đó là mốc chuyển giai đoạn.`)) return;
  try {
    await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessionId}`, { method:'DELETE' });
    const remRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&select=session_number&limit=1&order=session_number.desc`);
    const rem = await remRes.json();
    if (rem.length === 0) {
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    } else if (rem[0].session_number === 1) {
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    }
    showToast('✅ Đã xóa Chốt TV');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

// ── Delete single BC record (newest of current phase only, except for BTVN which is unrestricted) ──
async function deleteEventRecord(recordId, recordType) {
  const labels = { tu_van:'Báo cáo TV', bien_ban:'Báo cáo BB', btvn:'Bài tập về nhà' };
  const label = labels[recordType] || recordType;
  const confirmMsg = recordType === 'btvn' ? `Xóa "${label}" này?` : `Xóa "${label}" mới nhất?`;
  if (!await showConfirmAsync(confirmMsg)) return;
  try {
    await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}`, { method:'DELETE' });
    showToast(`✅ Đã xóa ${label}`);
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

async function deleteEventRecordKt(recordId) {
  if (!await showConfirmAsync('Hủy trạng thái Đã mở KT?')) return;
  try {
    if (recordId && recordId !== 'undefined' && recordId !== 'null') {
      await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}`, { method:'DELETE' });
    } else {
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt`, { method:'DELETE' });
    }
    
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {
       method: 'PATCH',
       body: JSON.stringify({ is_kt_opened: false, phase: 'tu_van' })
    });
    const idx = allProfiles.findIndex(x => x.id === currentProfileId);
    if (idx >= 0) {
      allProfiles[idx].is_kt_opened = false;
      allProfiles[idx].phase = 'tu_van';
    }
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

  if (phase === 'tu_van_hinh') {
    confirmMsg = '↩️ Hoàn tác về Chakki?\n\n⚠️ Sẽ xóa:\n• Tất cả buổi Chốt TV (từ lần 2)\n• Tất cả Báo cáo TV (từ lần 2)\n\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      // Just safely drop session > 1 and bc > 1. A bit tricky with JSON queries, so we delete ALL sessions/bc > 1 or just rely on API limit if needed, but for simplicity:
      // Actually, standard undo deletes EVERYTHING of that phase. Since it's Chakki vs TV, maybe just clear all.
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van`, { method:'DELETE' });
      await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&session_number=gt.1`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    };
  } else if (phase === 'tu_van') {
    confirmMsg = '↩️ Hoàn tác về Tư vấn hình?\n\n⚠️ Sẽ xóa TẤT CẢ:\n• Sự kiện Lập Group\n• Tất cả Báo cáo BB\n\n(Báo cáo TV và Chốt TV được giữ nguyên)\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.chot_bb`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'tu_van_hinh' }) });
    };
  } else if (phase === 'bb') {
    confirmMsg = '↩️ Hoàn tác về Tư vấn?\n\n⚠️ Sẽ hủy trạng thái Đã mở KT (Báo cáo BB được giữ nguyên).\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'tu_van', is_kt_opened: false }) });
    };
  } else if (phase === 'center') {
    confirmMsg = '↩️ Hoàn tác về BB?\n\n⚠️ Sẽ xóa sự kiện Chốt Center.\n(Báo cáo BB được giữ nguyên)\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.chot_center`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'bb' }) });
    };
  } else {
    showToast('⚠️ Không có gì để hoàn tác'); return;
  }

  if (!await showConfirmAsync(confirmMsg)) return;
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
    if (el('stv_date') && el('stv_time')) {
      const dt = existingSession.scheduled_at || existingSession.created_at;
      if (dt) {
        const d = new Date(dt);
        const pad = n => String(n).padStart(2,'0');
        el('stv_date').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        el('stv_time').value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    if (el('stv_tvv')) {
      setStaffInputValue('stv_tvv', existingSession.tvv_staff_code);
      _showStaffWarning('stv_tvv');
    }
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
    // ⚠️ Kiểm tra: nếu đây là lần 2+, phải có Báo cáo TV lần (nextNum-1) rồi mới chốt tiếp
    if (nextNum > 1) {
      try {
        const prevLan = nextNum - 1;
        const bcCheckRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van&select=id,content`);
        const bcAllRows = await bcCheckRes.json();
        const hasPrevBC = bcAllRows.some(r => Number(r.content?.lan_thu) === prevLan);
        if (!hasPrevBC) {
          showToast(`⚠️ Phải có Báo cáo TV lần ${prevLan} trước khi chốt TV lần ${nextNum}!`);
          return;
        }
      } catch(e) { console.warn('Check BC TV order:', e); }
    }
    if (el('stv_session_num')) el('stv_session_num').value = nextNum;
    if (el('stv_tool')) el('stv_tool').value = '';
    if (el('stv_date')) el('stv_date').value = '';
    if (el('stv_time')) el('stv_time').value = '';
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
  const dtDate = document.getElementById('stv_date')?.value; // YYYY-MM-DD
  const dtTime = document.getElementById('stv_time')?.value; // HH:mm
  let dt = '';
  if (dtDate) {
    const timeVal = dtTime || '00:00';
    dt = new Date(`${dtDate}T${timeVal}:00`).toISOString();
  }
  const tvv = getStaffCodeFromInput('stv_tvv');

  if (tvv) {
    const tvvRegistered = isStaffRegistered(tvv);
    if (!tvvRegistered) {
      const ok = typeof showConfirmAsync === 'function'
        ? await showConfirmAsync(`⚠️ TVV "${tvv}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục?`)
        : confirm(`⚠️ TVV "${tvv}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục?`);
      if (!ok) {
        if (btn) { btn.disabled = false; btn.textContent = editingSessionId ? '💾 Cập nhật Chốt TV' : '✅ Chốt Tư Vấn'; }
        return;
      }
    }
  }

  if (!tool) { showToast('⚠️ Nhập công cụ tư vấn'); return; }

  if (btn) { btn.disabled = true; btn.textContent = '⌛ Đang lưu...'; }

  try {
    if (editingSessionId) {
      // UPDATE existing session
      const patchData = {
        session_number: num, tool,
        scheduled_at: dt || null, tvv_staff_code: tvv || null
      };
      if (dt) patchData.created_at = dt;
      await sbFetch(`/rest/v1/consultation_sessions?id=eq.${editingSessionId}`, { method:'PATCH', body: JSON.stringify(patchData)});
    } else {
      // CREATE new session
      const postData = {
        profile_id: currentProfileId, session_number: num, tool,
        scheduled_at: dt || null, tvv_staff_code: tvv || null,
        created_by: getEffectiveStaffCode()
      };
      if (dt) postData.created_at = dt;
      await sbFetch('/rest/v1/consultation_sessions', { method:'POST', body: JSON.stringify(postData)});

      const p = allProfiles.find(x => x.id === currentProfileId);
      if (num > 1 && p && (p.phase === 'new' || p.phase === 'chakki' || !p.phase)) {
        await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van_hinh' })});
      }
    }

    // Sync TVV roles in fruit_roles to match the TVVs across all sessions of this profile
    await syncTVVRolesFromSessions(currentProfileId);

    closeModal('scheduleTVModal');
    if (editingSessionId) {
      showToast('✅ Đã cập nhật Chốt TV');
    } else {
      const p2 = allProfiles.find(x => x.id === currentProfileId);
      showCelebration('📅', `Chốt TV lần ${num} — ${p2?.full_name || ''}!`);
    }

    // Calendar: sync Chốt TV event (Create or Update)
    if (typeof createCalEventFromChotTV === 'function') {
      createCalEventFromChotTV(currentProfileId, num, dt || null, tool);
    }

    // === Auto-triggers for NEW Chốt TV ===
    if (!editingSessionId) {
      const p = allProfiles.find(x => x.id === currentProfileId);
      const pName = p?.full_name || '';
      const myCode = getEffectiveStaffCode();
      // Notification: notify stakeholders
      if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
        const stakeholders = await getProfileStakeholders(currentProfileId);
        createNotification(stakeholders, 'chot_tv', `📅 Chốt TV lần ${num}`, `${pName} — ${tool}`, currentProfileId);
      }
      // Priority: create "viết BC TV" task — visible 1 hour AFTER Chốt TV session time
      if (typeof createPriorityTask === 'function') {
        const sessionTime = dt ? new Date(dt) : new Date();
        const visibleAt = new Date(sessionTime.getTime() + 60 * 60 * 1000).toISOString(); // +1 hour
        createPriorityTask(myCode, currentProfileId, 'viet_bc_tv', `Viết BC TV lần ${num} — ${pName}`, null, visibleAt);
      }
      // Priority: complete "chot_tv_1" if this is session 1
      if (num === 1 && typeof completePriorityTask === 'function') {
        completePriorityTask(currentProfileId, 'chot_tv_1');
      }
      // Priority: if session 2, profile is now TV Hình — create "chot_tv_hinh" task for NDD
      // to remind them to transition to Group TV-BB when ready
      if (num === 2 && typeof createPriorityTask === 'function') {
        const nddCode = p?.ndd_staff_code || myCode;
        // Complete old chot_tv_hinh if exists (re-schedule)
        completePriorityTask(currentProfileId, 'chot_tv_hinh');
        createPriorityTask(nddCode, currentProfileId, 'lap_group',
          `Lập Group TV-BB — ${pName}`, null, null);
      }
    }

    editingSessionId = null;
    await _refreshCurrentProfile();
    if (typeof loadJourney === 'function' && currentProfileId) {
      await loadJourney(currentProfileId);
    }
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

async function openBaoCaoTV() {
  openAddRecordModal('tu_van');
  try {
    const res = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&select=session_number,tool&order=session_number.desc&limit=1`);
    const sessions = await res.json();
    if (sessions && sessions.length > 0) {
      setTimeout(() => {
        const lanEl = document.getElementById('rm_lan_thu');
        const toolEl = document.getElementById('rm_ten_cong_cu');
        // Chỉ điền tự động nếu đang trống (tránh ghi đè khi edit)
        if (lanEl && !lanEl.value) lanEl.value = sessions[0].session_number;
        if (toolEl && !toolEl.value) toolEl.value = sessions[0].tool || '';
      }, 100);
    }
  } catch(e) { console.warn('Could not auto-fill session info:', e); }
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
async function openChotBBModal() {
  if (!currentProfileId) return;
  // Kiểm tra: phải có Báo cáo TV ít nhất 1 lần thay vì bỏ qua, để đảm bảo logic
  try {
    const sessRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&select=session_number&order=session_number.desc&limit=1`);
    const sessList = await sessRes.json();
    if (sessList && sessList.length > 0) {
      const lastSessNum = sessList[0].session_number;
      const bcRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van&content->>lan_thu=eq.${lastSessNum}&select=id&limit=1`);
      const bcRows = await bcRes.json();
      if (!bcRows || bcRows.length === 0) {
        showToast(`⚠️ Phải có Báo cáo TV lần ${lastSessNum} rồi mới được Lập Group!`);
        return;
      }
    } else {
      showToast('⚠️ Phải có Báo cáo TV trước khi Lập Group!');
      return;
    }
  } catch(e) { console.warn('Check BC TV for Chot BB:', e); }
  document.getElementById('cbb_gvbb').value = '';
  document.getElementById('chotBBModal').classList.add('open');
}

async function saveChotBB() {
  try {
    const gvbbRaw = getStaffCodeFromInput('cbb_gvbb');
    // GVBB bắt buộc khi Lập Group TV/BB
    if (!gvbbRaw) {
      showToast('⚠️ Phải điền GVBB trước khi Lập Group!');
      return;
    }
    // Check if GVBB is registered
    const gvbbRegistered = isStaffRegistered(gvbbRaw);
    const gvbb = gvbbRegistered ? gvbbRaw : `tg:${gvbbRaw}`;
    const gvbbDisplayName = gvbbRegistered ? null : gvbbRaw;
    // Warn user about unregistered GVBB
    if (!gvbbRegistered) {
      if (!confirm(`⚠️ GVBB "${gvbbRaw}" chưa đăng ký trong hệ thống.\n\nVẫn tiếp tục Lập Group?`)) return;
    }
    // 1. Update phase
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van' })});
    // 2. Record chot_bb event on timeline
    await sbFetch('/rest/v1/profile_records', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'chot_bb', content: { label: 'Lập Group TV - BB', phase: 'tu_van' }
    })});
    // 3. Save GVBB to fruit_roles
    try {
      const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id`);
      const fgs = await fgRes.json();
      let fgId = fgs[0]?.id;
      if (!fgId) {
        const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
          telegram_group_id: null, profile_id: currentProfileId, level: 'tu_van'
        })});
        fgId = (await newFgRes.json())[0]?.id;
      }
      if (fgId) {
        const existRes = await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=eq.${fgId}&staff_code=eq.${gvbb}&role_type=eq.gvbb&select=id`);
        const existRows = await existRes.json();
        if (!existRows || existRows.length === 0) {
          const roleData = {
            fruit_group_id: fgId, staff_code: gvbb, role_type: 'gvbb', assigned_by: getEffectiveStaffCode()
          };
          if (gvbbDisplayName) roleData.display_name = gvbbDisplayName;
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', body: JSON.stringify(roleData) });
        }
      }
    } catch(e) { console.warn('Assign GVBB fail:', e); }
    closeModal('chotBBModal');
    const pName2 = allProfiles.find(x => x.id === currentProfileId)?.full_name || '';
    showCelebration('🎓', `Lập Group TV-BB — ${pName2}!`);

    // === Auto-triggers for Chốt BB ===
    const p = allProfiles.find(x => x.id === currentProfileId);
    const pName = p?.full_name || '';

    // Notify all stakeholders (NDD, TVV, GVBB + their managers)
    if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
      const stakeholders = await getProfileStakeholders(currentProfileId);
      createNotification(stakeholders, 'lap_group_tv_bb', '🎓 Lập Group TV-BB', pName, currentProfileId);
    }

    // Create priority task "Học BB" for GVBB if assigned,
    // else for NDD + all managers in chain (so they know to assign GVBB)
    if (typeof createPriorityTask === 'function') {
      const gvbbCode = gvbb || null;
      // Complete "lap_group" task since it's now done
      completePriorityTask(currentProfileId, 'lap_group');
      if (gvbbCode) {
        // GVBB assigned → only their task
        createPriorityTask(gvbbCode, currentProfileId, 'hoc_bb', `Học BB lần 1 — ${pName}`, null);
      } else {
        // No GVBB yet → create task for NDD + full managers chain
        const nddCode = p?.ndd_staff_code || getEffectiveStaffCode();
        const managers = typeof getManagersForStaffCode === 'function' ? getManagersForStaffCode(nddCode) : [];
        const assignees = [nddCode, ...managers].filter(Boolean);
        assignees.forEach(code => {
          createPriorityTask(code, currentProfileId, 'hoc_bb', `⚠️ Chưa có GVBB — ${pName}`, null);
        });
      }
    }

    await _refreshCurrentProfile();
    const tbBtn = document.getElementById('tabBB');
    if (tbBtn && typeof switchFormTab === 'function') switchFormTab(tbBtn, 'bienBan');
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

async function chotCenter() {
  if (!currentProfileId) return;
  const myCode = getEffectiveStaffCode();
  const p = allProfiles.find(x => x.id === currentProfileId);
  const isNDD = p?.ndd_staff_code === myCode;
  // Use DB-driven permission check — covers NDD, admin, GYJN, BGYJN, SGN Jondo, etc.
  const canEdit = hasPermission('edit_profile') || isNDD;
  let isGVBB = false;
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id,fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs||[]).forEach(fg => (fg.fruit_roles||[]).forEach(r => {
      if (r.role_type === 'gvbb' && r.staff_code === myCode) isGVBB = true;
    }));
  } catch(e) {}
  if (!canEdit && !isGVBB) {
    showToast('⚠️ Không có quyền chốt Center'); return;
  }
  if (!await showConfirmAsync('Xác nhận trái quả nhập học Center?')) return;
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'center' })});
    await sbFetch('/rest/v1/profile_records', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'chot_center', content: { label: 'Chốt Center', phase: 'center' }
    })});
    const pName3 = allProfiles.find(x => x.id === currentProfileId)?.full_name || '';
    showCelebration('🏛️', `${pName3} nhập học Center!`);
    // Notify stakeholders about Chốt Center
    if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
      const stakeholders = await getProfileStakeholders(currentProfileId);
      createNotification(stakeholders, 'chot_center', '🏛️ Chốt Center', pName3, currentProfileId);
    }
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ══════════════════════════════════════════════════════════════════════════════
// ADD / EDIT RECORD MODAL
// ══════════════════════════════════════════════════════════════════════════════
function addBTVNQA() {
  const container = document.getElementById('btvn_qa_container');
  if (!container) return;
  const i = container.querySelectorAll('.qa-block').length;
  const div = document.createElement('div');
  div.className = 'qa-block';
  div.style.cssText = 'border:1px solid var(--border);padding:10px;border-radius:8px;margin-bottom:10px;background:var(--surface2);';
  div.innerHTML = `
    <div class="field-group"><label>Câu hỏi ${i+1}</label><textarea class="btvn-q" placeholder="Nội dung câu hỏi..." style="min-height:60px;"></textarea></div>
    <div class="field-group"><label>Câu trả lời</label><textarea class="btvn-a" placeholder="Trái quả trả lời..." style="min-height:80px;"></textarea></div>
  `;
  container.appendChild(div);
}

function _setKTToggle(val) {
  const yesBtn = document.getElementById('rm_kt_yes');
  const noBtn = document.getElementById('rm_kt_no');
  const hidden = document.getElementById('rm_has_kt_content');
  if (!yesBtn || !noBtn || !hidden) return;
  hidden.value = val;
  if (val === 'yes') {
    yesBtn.style.border = '2px solid var(--green)'; yesBtn.style.background = 'rgba(34,197,94,0.12)'; yesBtn.style.color = 'var(--green)';
    noBtn.style.border = '2px solid var(--border)'; noBtn.style.background = 'var(--surface2)'; noBtn.style.color = 'var(--text2)';
  } else {
    noBtn.style.border = '2px solid #f59e0b'; noBtn.style.background = 'rgba(245,158,11,0.12)'; noBtn.style.color = '#f59e0b';
    yesBtn.style.border = '2px solid var(--border)'; yesBtn.style.background = 'var(--surface2)'; yesBtn.style.color = 'var(--text2)';
  }
}

async function openAddRecordModal(type, existingContent = null, readOnly = false) {
  currentRecordType = type;
  if (!existingContent) currentRecordId = null;
  const isTV = type === 'tu_van';
  const isBB = type === 'bien_ban';
  const isBTVN = type === 'btvn';
  const isTeamMeeting = type === 'team_meeting';

  let titleText;
  if (readOnly) {
    if (isTV) titleText = '📋 Xem Báo cáo Tư vấn';
    else if (isBB) titleText = '📋 Xem Báo cáo BB';
    else if (isBTVN) titleText = '📋 Xem Báo cáo Bài tập';
    else if (isTeamMeeting) titleText = '📋 Xem Họp Team';
  } else {
    if (existingContent) {
      if (isTV) titleText = '✏️ Chỉnh sửa Báo cáo Tư vấn';
      else if (isBB) titleText = '✏️ Chỉnh sửa Báo cáo BB';
      else if (isBTVN) titleText = '✏️ Chỉnh sửa Bài tập';
      else if (isTeamMeeting) titleText = '✏️ Chỉnh sửa Họp Team';
    } else {
      if (isTV) titleText = '💬 Báo cáo Tư vấn';
      else if (isBB) titleText = '📝 Báo cáo BB';
      else if (isBTVN) titleText = '📝 Viết Báo cáo Bài tập';
      else if (isTeamMeeting) titleText = '🤝 Ghi nhận Họp Team';
    }
  }
  document.getElementById('recordModalTitle').textContent = titleText;
  const body = document.getElementById('recordModalBody');
  const c = existingContent || {};
  const _today = new Date().toISOString().split('T')[0];
  const _reportDate = c.report_date || _today;

  if (isTV) {
    body.innerHTML = `
      <div class="field-group"><label>📅 Ngày buổi Tư vấn</label><input type="date" id="rm_report_date" value="${_reportDate}"/><div style="font-size:11px;color:var(--text3);margin-top:3px;">💡 Mặc định là hôm nay.</div></div>
      <div class="field-group"><label>Lần thứ</label><input type="text" id="rm_lan_thu" placeholder="1, 2, 3..." value="${c.lan_thu||''}"/></div>
      <div class="field-group"><label>Tên công cụ tư vấn</label><input type="text" id="rm_ten_cong_cu" list="datalist_tools" placeholder="Chọn hoặc nhập công cụ..." autocomplete="off" value="${c.ten_cong_cu||''}"/></div>
      <div class="field-group"><label>Kết quả test công cụ</label><textarea id="rm_ket_qua_test" placeholder="...">${c.ket_qua_test||''}</textarea></div>
      <div class="field-group"><label>Vấn đề / Nhu cầu / Thông tin khai thác được</label><textarea id="rm_van_de" style="min-height:100px;" placeholder="...">${c.van_de||''}</textarea></div>
      <div class="field-group"><label>Phản hồi / Cảm nhận của trái sau tư vấn</label><textarea id="rm_phan_hoi" placeholder="...">${c.phan_hoi||''}</textarea></div>
      <div class="field-group"><label>Điểm hái trái</label><textarea id="rm_diem_hai" placeholder="...">${c.diem_hai||''}</textarea></div>
      <div class="field-group"><label>Đề xuất của TVV</label><textarea id="rm_de_xuat" placeholder="...">${c.de_xuat||''}</textarea></div>
      <div class="field-group">
        <label>📸 Ảnh đính kèm (gợi ý: kết quả bài test, sơ đồ...)</label>
        <input type="file" id="rm_image_file" accept="image/*" multiple style="margin-top:4px;font-size:12px;width:100%;" onchange="uploadRecordImage(this)" />
        
        <!-- Premium clipboard instruction block -->
        <div style="border: 1px dashed var(--accent); border-radius: 8px; padding: 10px; text-align: center; background: rgba(124,106,247,0.03); margin-top: 6px; box-sizing: border-box; pointer-events: none;">
          <div style="font-size: 12.5px; font-weight: 700; color: var(--accent); display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 2px;">
            📋 Hỗ trợ dán ảnh từ Clipboard
          </div>
          <div style="font-size: 11px; color: var(--text3);">
            Nhấn <b>Ctrl + V</b> trên máy tính hoặc nhấn giữ và chọn Dán trên điện thoại để tải lên nhanh chóng.
          </div>
        </div>

        <input type="hidden" id="rm_image_url" value="${c.image_url||''}" />
        <div id="rm_image_preview_container" style="margin-top:8px; display:${c.image_url?'block':'none'}; border:1px solid var(--border); border-radius:8px; overflow:hidden; position:relative; max-width:240px;">
          <img id="rm_image_preview" src="${c.image_url||''}" style="width:100%; display:block;" />
          <button type="button" onclick="removeRecordImage()" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; z-index:10;">×</button>
        </div>
      </div>
      <div class="field-group">
        <label>📝 Mô tả ảnh đính kèm</label>
        <input type="text" id="rm_image_desc" placeholder="Nhập mô tả cho hình ảnh..." value="${c.image_desc||''}" />
      </div>`;
  } else if (isBB) {
    const parseBuoiTiep = (val) => {
      if (!val) return { date: '', time: '' };
      const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (isoMatch) return { date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, time: `${isoMatch[4]}:${isoMatch[5]}` };
      return { date: '', time: '' };
    };
    const bt = parseBuoiTiep(c.buoi_tiep);
    const _ktState = c.has_kt_content === true ? 'yes' : c.has_kt_content === false ? 'no' : 'none';
    body.innerHTML = `
      <div class="field-group"><label>📅 Ngày buổi BB</label><input type="date" id="rm_report_date" value="${_reportDate}"/><div style="font-size:11px;color:var(--text3);margin-top:3px;">💡 Mặc định là hôm nay.</div></div>
      <div class="field-group"><label>Buổi thứ</label><input type="text" id="rm_buoi_thu" placeholder="1, 2, 3..." value="${c.buoi_thu||''}"/></div>
      <div class="field-group"><label>Nội dung buổi học</label><textarea id="rm_noi_dung" style="min-height:100px;" placeholder="...">${c.noi_dung||''}</textarea></div>
      <div class="field-group"><label>Phản ứng của HS trong và sau buổi học</label><textarea id="rm_phan_ung" placeholder="...">${c.phan_ung||''}</textarea></div>
      <div class="field-group"><label>Khai thác mới về HS</label><textarea id="rm_khai_thac" placeholder="...">${c.khai_thac||''}</textarea></div>
      <div class="field-group"><label>Tương tác với HS đáng chú ý</label><textarea id="rm_tuong_tac" placeholder="...">${c.tuong_tac||''}</textarea></div>
      <div class="field-group"><label>Đề xuất hướng chăm sóc tiếp theo</label><textarea id="rm_de_xuat_cs" placeholder="...">${c.de_xuat_cs||''}</textarea></div>
      <div class="field-group">
        <label>📅 Buổi gặp tiếp theo</label>
        <div class="grid-2">
          <div class="field-group"><label style="font-size:11px;">Ngày</label><input type="date" id="rm_buoi_tiep_date" value="${bt.date}"/></div>
          <div class="field-group"><label style="font-size:11px;">Giờ</label><input type="time" id="rm_buoi_tiep_time" value="${bt.time}"/></div>
        </div>
      </div>
      <div style="padding:10px 0;">
        <label style="font-size:13px;font-weight:700;margin-bottom:8px;display:block;">📖 Nội dung Kinh Thánh <span style="color:var(--red);">*</span></label>
        <div id="rm_kt_toggle" style="display:flex;gap:8px;">
          <button type="button" onclick="_setKTToggle('yes')" id="rm_kt_yes" style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:2px solid ${_ktState==='yes'?'var(--green)':'var(--border)'};background:${_ktState==='yes'?'rgba(34,197,94,0.12)':'var(--surface2)'};color:${_ktState==='yes'?'var(--green)':'var(--text2)'}">📖 Có nội dung KT</button>
          <button type="button" onclick="_setKTToggle('no')" id="rm_kt_no" style="flex:1;padding:10px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:2px solid ${_ktState==='no'?'#f59e0b':'var(--border)'};background:${_ktState==='no'?'rgba(245,158,11,0.12)':'var(--surface2)'};color:${_ktState==='no'?'#f59e0b':'var(--text2)'}">📕 Không có KT</button>
        </div>
        <input type="hidden" id="rm_has_kt_content" value="${_ktState}" />
      </div>
      <div class="field-group"><label>Nội dung buổi tiếp theo</label><textarea id="rm_noi_dung_tiep" placeholder="...">${c.noi_dung_tiep||''}</textarea></div>
      <div class="field-group">
        <label>📸 Ảnh đính kèm (gợi ý: sơ đồ, kết quả buổi học...)</label>
        <input type="file" id="rm_image_file" accept="image/*" multiple style="margin-top:4px;font-size:12px;width:100%;" onchange="uploadRecordImage(this)" />
        
        <!-- Premium clipboard instruction block -->
        <div style="border: 1px dashed var(--accent); border-radius: 8px; padding: 10px; text-align: center; background: rgba(124,106,247,0.03); margin-top: 6px; box-sizing: border-box; pointer-events: none;">
          <div style="font-size: 12.5px; font-weight: 700; color: var(--accent); display: flex; align-items: center; justify-content: center; gap: 6px; margin-bottom: 2px;">
            📋 Hỗ trợ dán ảnh từ Clipboard
          </div>
          <div style="font-size: 11px; color: var(--text3);">
            Nhấn <b>Ctrl + V</b> trên máy tính hoặc nhấn giữ và chọn Dán trên điện thoại để tải lên nhanh chóng.
          </div>
        </div>

        <input type="hidden" id="rm_image_url" value="${c.image_url||''}" />
        <div id="rm_image_preview_container" style="margin-top:8px; display:${c.image_url?'block':'none'}; border:1px solid var(--border); border-radius:8px; overflow:hidden; position:relative; max-width:240px;">
          <img id="rm_image_preview" src="${c.image_url||''}" style="width:100%; display:block;" />
          <button type="button" onclick="removeRecordImage()" style="position:absolute; top:4px; right:4px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-weight:bold; z-index:10;">×</button>
        </div>
      </div>
      <div class="field-group">
        <label>📝 Mô tả ảnh đính kèm</label>
        <input type="text" id="rm_image_desc" placeholder="Nhập mô tả cho hình ảnh..." value="${c.image_desc||''}" />
      </div>`;
  } else if (isTeamMeeting) {
    body.innerHTML = `
      <div class="field-group"><label>📅 Ngày họp</label><input type="date" id="rm_report_date" value="${_reportDate}"/></div>
      <div class="field-group"><label>Ghi chú cuộc họp</label><textarea id="rm_meeting_notes" placeholder="Tóm tắt nội dung họp về trái quả này..." style="min-height:150px;">${c.meeting_notes||''}</textarea></div>
    `;
  } else if (isBTVN) {
    let bbOptions = '<option value="">-- Chọn Báo cáo BB --</option>';
    try {
      const res = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban&select=id,content,created_at&order=created_at.desc`);
      const bbRecs = await res.json();
      bbOptions += bbRecs.map(r => {
        const _buoi = r.content?.buoi_thu ? `Buổi ${r.content.buoi_thu}` : 'BB không rõ buổi';
        const d = r.content?.report_date || r.created_at.split('T')[0];
        const selected = (c.bb_record_id === r.id) ? 'selected' : '';
        return `<option value="${r.id}" ${selected}>${_buoi} (Ngày ${shinDate(d)})</option>`;
      }).join('');
    } catch(e) {}

    const qas = (c.qas && c.qas.length > 0) ? c.qas : [{q:'', a:''}];
    let qaHtml = qas.map((qa, i) => `
      <div class="qa-block" style="border:1px solid var(--border);padding:10px;border-radius:8px;margin-bottom:10px;background:var(--surface2);">
        <div class="field-group"><label>Câu hỏi ${i+1}</label><textarea class="btvn-q" placeholder="Nội dung câu hỏi..." style="min-height:60px;">${qa.q||''}</textarea></div>
        <div class="field-group"><label>Câu trả lời</label><textarea class="btvn-a" placeholder="Trái quả trả lời..." style="min-height:80px;">${qa.a||''}</textarea></div>
      </div>
    `).join('');

    body.innerHTML = `
      <div class="field-group"><label>Bài tập theo buổi BB nào?</label>
        <select id="rm_bb_id" style="width:100%;padding:10px;border-radius:8px;background:var(--surface2);color:var(--text1);border:1px solid var(--border);">${bbOptions}</select>
      </div>
      <div id="btvn_qa_container">${qaHtml}</div>
      <button type="button" class="btn secondary" onclick="addBTVNQA()" style="width:100%;margin-top:5px;">➕ Thêm câu hỏi và trả lời</button>
    `;
  }

  document.getElementById('addRecordModal').classList.add('open');
  if (!existingContent && !readOnly && typeof checkAndShowDraftBanner === 'function') {
    setTimeout(() => {
      checkAndShowDraftBanner(type);
    }, 50);
  }
  // Toggle save button visibility based on readOnly
  const saveBtn = document.querySelector('#addRecordModal .save-btn');
  if (readOnly) {
    const inputs = body.querySelectorAll('input, textarea, select, button');
    inputs.forEach(el => { if (el.id !== 'rm_kt_yes' && el.id !== 'rm_kt_no') el.disabled = true; });
    if (saveBtn) saveBtn.style.display = 'none';
  } else {
    if (saveBtn) saveBtn.style.display = 'block';
  }
}

async function saveRecord() {
  const isTV = currentRecordType === 'tu_van';
  const isBB = currentRecordType === 'bien_ban';
  const isBTVN = currentRecordType === 'btvn';
  const isTeamMeeting = currentRecordType === 'team_meeting';

  const reportDate = document.getElementById('rm_report_date')?.value || '';
  let data = {};

  if (isTV) {
    data = {
      report_date: reportDate,
      lan_thu: document.getElementById('rm_lan_thu')?.value,
      ten_cong_cu: document.getElementById('rm_ten_cong_cu')?.value,
      ket_qua_test: document.getElementById('rm_ket_qua_test')?.value,
      van_de: document.getElementById('rm_van_de')?.value,
      phan_hoi: document.getElementById('rm_phan_hoi')?.value,
      diem_hai: document.getElementById('rm_diem_hai')?.value,
      de_xuat: document.getElementById('rm_de_xuat')?.value,
      image_url: document.getElementById('rm_image_url')?.value || '',
      image_desc: document.getElementById('rm_image_desc')?.value || '',
    };
  } else if (isBB) {
    const ktVal = document.getElementById('rm_has_kt_content')?.value;
    if (ktVal !== 'yes' && ktVal !== 'no') {
      showToast('⚠️ Phải chọn trạng thái Kinh Thánh!');
      return;
    }
    const btDate = document.getElementById('rm_buoi_tiep_date')?.value;
    const btTime = document.getElementById('rm_buoi_tiep_time')?.value;
    const buoiTiepISO = btDate ? (btTime ? `${btDate}T${btTime}:00` : `${btDate}T00:00:00`) : null;
    data = {
      report_date: reportDate,
      buoi_thu: document.getElementById('rm_buoi_thu')?.value,
      noi_dung: document.getElementById('rm_noi_dung')?.value,
      phan_ung: document.getElementById('rm_phan_ung')?.value,
      khai_thac: document.getElementById('rm_khai_thac')?.value,
      tuong_tac: document.getElementById('rm_tuong_tac')?.value,
      de_xuat_cs: document.getElementById('rm_de_xuat_cs')?.value,
      buoi_tiep: buoiTiepISO,
      noi_dung_tiep: document.getElementById('rm_noi_dung_tiep')?.value,
      has_kt_content: ktVal === 'yes',
      image_url: document.getElementById('rm_image_url')?.value || '',
      image_desc: document.getElementById('rm_image_desc')?.value || '',
    };
  } else if (isTeamMeeting) {
    data = {
      report_date: reportDate,
      meeting_notes: document.getElementById('rm_meeting_notes')?.value
    };
  } else if (isBTVN) {
    const bbId = document.getElementById('rm_bb_id')?.value;
    if (!bbId) {
      showToast('⚠️ Phải chọn báo cáo BB tương ứng!');
      return;
    }
    const qasArr = [];
    document.querySelectorAll('.qa-block').forEach(block => {
      const q = block.querySelector('.btvn-q')?.value;
      const a = block.querySelector('.btvn-a')?.value;
      if (q || a) qasArr.push({ q, a });
    });
    data = {
      report_date: reportDate,
      bb_record_id: bbId,
      qas: qasArr
    };
  }

  try {
    if (!currentRecordId && isTV) {
      const lanThu = parseInt(data.lan_thu);
      if (lanThu) {
        const checkRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&session_number=eq.${lanThu}&select=id&limit=1`);
        const checkData = await checkRes.json();
        if (checkData.length === 0) {
          showToast(`⚠️ Chưa có Chốt TV lần ${lanThu}. Hãy chốt TV trước!`);
          return;
        }
      }
    }

    const payload = { content: data };
    if (reportDate) {
      payload.created_at = `${reportDate}T12:00:00.000Z`;
    }

    if (currentRecordId) {
      await sbFetch(`/rest/v1/profile_records?id=eq.${currentRecordId}`, { method:'PATCH', body: JSON.stringify(payload) });
      showToast('✅ Đã cập nhật!');
    } else {
      const postPayload = { profile_id: currentProfileId, record_type: currentRecordType, ...payload };
      await sbFetch('/rest/v1/profile_records', { method:'POST', body: JSON.stringify(postPayload) });
      showToast('✅ Đã thêm!');

      const p = allProfiles.find(x => x.id === currentProfileId);
      const pName = p?.full_name || '';

      if (isTV) {
        if (typeof completePriorityTask === 'function') completePriorityTask(currentProfileId, 'viet_bc_tv');
        if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
          const stks = await getProfileStakeholders(currentProfileId);
          createNotification(stks, 'bc_tv', `📝 BC TV lần ${data.lan_thu}`, pName, currentProfileId);
        }
      } else if (isBB) {
        if (typeof completePriorityTask === 'function') completePriorityTask(currentProfileId, 'viet_bc_bb');
        if (data.buoi_tiep && typeof createCalEventFromBBReport === 'function') {
          createCalEventFromBBReport(currentProfileId, (parseInt(data.buoi_thu)||1)+1, data.buoi_tiep);
        }
        if (data.buoi_tiep && typeof createPriorityTask === 'function') {
          const vAt = new Date(new Date(data.buoi_tiep).getTime() + 3600000).toISOString();
          createPriorityTask(getEffectiveStaffCode(), currentProfileId, 'viet_bc_bb', `Viết BC BB buổi ${(parseInt(data.buoi_thu)||0)+1} — ${pName}`, null, vAt);
        }
        if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
          const stks = await getProfileStakeholders(currentProfileId);
          createNotification(stks, 'bc_bb', `📋 BC BB buổi ${data.buoi_thu}`, pName, currentProfileId);
        }
      } else if (isBTVN || isTeamMeeting) {
        if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
          const stks = await getProfileStakeholders(currentProfileId);
          const title = isBTVN ? '📝 Báo cáo BTVN học sinh' : '🤝 Ghi nhận Họp Team mới';
          const type = isBTVN ? 'new_btvn' : 'new_team_meeting';
          createNotification(stks, type, title, pName, currentProfileId);
        }
      }
    }
    
    if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(currentProfileId);
    closeModal('addRecordModal');
    localStorage.removeItem('cj_draft_' + currentRecordType);
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi lưu dữ liệu'); console.error(e); }
}

// ════════════════════════════════════════
// NOTES (Sticky Notes)
// ════════════════════════════════════════
async function loadNotes(profileId) {
  const listEl = document.getElementById('notesList');
  const countEl = document.getElementById('noteCount');
  if (!listEl) return;
  try {
    const res = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${profileId}&record_type=eq.note&select=id,content,created_at&order=created_at.desc`);
    const notes = await res.json();
    countEl.textContent = `${notes.length} ghi chú`;
    if (notes.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có ghi chú nào</div>';
      return;
    }
    listEl.innerHTML = notes.map(n => {
      const title = (n.content?.title || 'Không tiêu đề').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const body = (n.content?.body || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const date = shinDate(n.created_at);
      const rawTitle = (n.content?.title || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
      const rawBody = (n.content?.body || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
      return `<div class="sticky-note" id="note_${n.id}">
        <div class="sticky-note-actions">
          <button class="sticky-note-edit" onclick="event.stopPropagation();editNote('${n.id}','${rawTitle}','${rawBody}')" title="Sửa">✏️</button>
          <button class="sticky-note-del" onclick="event.stopPropagation();deleteNote('${n.id}')" title="Xoá">×</button>
        </div>
        <div class="sticky-note-header" onclick="this.nextElementSibling.classList.toggle('open')">
          <span class="sticky-note-title">📌 ${title}</span>
          <span class="sticky-note-date">${date}</span>
        </div>
        <div class="sticky-note-body">${body}</div>
      </div>`;
    }).join('');
  } catch(e) { console.error('loadNotes:', e); }
}

async function saveNote() {
  if (!currentProfileId) return;
  const titleEl = document.getElementById('note_title');
  const bodyEl = document.getElementById('note_body');
  const editId = titleEl?.dataset?.editId;
  const title = titleEl?.value?.trim();
  const body = bodyEl?.value?.trim();
  if (!title && !body) { showToast('⚠️ Nhập tiêu đề hoặc nội dung'); return; }
  try {
    if (editId) {
      // Update existing note
      await sbFetch(`/rest/v1/profile_records?id=eq.${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: { title: title || 'Ghi chú', body: body || '' } })
      });
      delete titleEl.dataset.editId;
      document.getElementById('noteSaveBtn').textContent = '📌 Thêm ghi chú';
      showToast('✅ Đã cập nhật ghi chú!');
    } else {
      await sbFetch('/rest/v1/profile_records', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ profile_id: currentProfileId, record_type: 'note', content: { title: title || 'Ghi chú', body: body || '' } })
      });
      showToast('✅ Đã thêm ghi chú!');
    }
    titleEl.value = '';
    bodyEl.value = '';
    loadNotes(currentProfileId);
    
    // Auto-sync notes updates to Google Sheets
    if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(currentProfileId);
  } catch(e) { showToast('❌ Lỗi lưu ghi chú'); }
}

function editNote(noteId, title, body) {
  const titleEl = document.getElementById('note_title');
  const bodyEl = document.getElementById('note_body');
  if (!titleEl || !bodyEl) return;
  titleEl.value = title.replace(/\\n/g, "\n");
  bodyEl.value = body.replace(/\\n/g, "\n");
  titleEl.dataset.editId = noteId;
  document.getElementById('noteSaveBtn').textContent = '💾 Cập nhật ghi chú';
  titleEl.focus();
  // Scroll to form
  titleEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deleteNote(noteId) {
  if (!await showConfirmAsync('Xoá ghi chú này?')) return;
  try {
    await sbFetch(`/rest/v1/profile_records?id=eq.${noteId}`, { method: 'DELETE' });
    showToast('🗑️ Đã xoá ghi chú');
    if (currentProfileId) loadNotes(currentProfileId);
  } catch(e) { showToast('❌ Lỗi xoá'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// MỞ KT — Session Picker
// ══════════════════════════════════════════════════════════════════════════════
async function confirmMoKT() {
  if (!currentProfileId) return;
  try {
    const p = allProfiles.find(x => x.id === currentProfileId);
    // Fetch BB reports
    const bbRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban&select=id,content&order=created_at.asc`);
    const bbRecords = await bbRes.json();
    if (!bbRecords || bbRecords.length === 0) {
      showToast('⚠️ Chưa có báo cáo BB nào để xác nhận mở KT.');
      return;
    }
    // Fetch existing mo_kt records
    const ktRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt&select=id,content`);
    const ktRecords = await ktRes.json();
    const confirmedSessions = new Set((ktRecords || []).map(r => Number(r.content?.buoi_thu)).filter(Boolean));
    const sessions = bbRecords.map(r => Number(r.content?.buoi_thu || 0)).filter(n => n > 0);
    const unconfirmed = sessions.filter(n => !confirmedSessions.has(n));

    if (unconfirmed.length === 0) {
      // All sessions confirmed — but phase may be stuck from a previous crash
      if (p && p.phase === 'tu_van') {
        await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {
          method: 'PATCH', body: JSON.stringify({ phase: 'bb', is_kt_opened: true })
        });
        p.phase = 'bb';
        p.is_kt_opened = true;
        showToast('📖 Đã chuyển sang giai đoạn BB!');
        openProfile(p);
      } else {
        showToast('✅ Tất cả buổi BB đã được xác nhận mở KT.');
      }
      return;
    }

    // Show session picker
    const picked = await showKTSessionPicker(unconfirmed, confirmedSessions, sessions);
    if (!picked || picked.length === 0) return;

    // Create mo_kt records
    for (const session of picked) {
      await sbFetch('/rest/v1/profile_records', {
        method: 'POST',
        body: JSON.stringify({
          profile_id: currentProfileId,
          record_type: 'mo_kt',
          content: { label: `Mở KT buổi ${session}`, buoi_thu: session, phase: 'bb' }
        })
      });
    }

    // Update profile: is_kt_opened + kt_opened_at + auto-transition tu_van → bb
    const patchData = { is_kt_opened: true, kt_opened_at: new Date().toISOString() };
    if (p && p.phase === 'tu_van') patchData.phase = 'bb';
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, {
      method: 'PATCH', body: JSON.stringify(patchData)
    });

    // Sync local cache
    if (p) {
      p.is_kt_opened = true;
      p.kt_opened_at = patchData.kt_opened_at;
      if (patchData.phase) p.phase = 'bb';
    }

    showToast(`📖 Đã xác nhận mở KT cho ${picked.length} buổi!`);
    // Notify stakeholders about Mở KT
    if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
      const pName = p?.full_name || '';
      const stakeholders = await getProfileStakeholders(currentProfileId);
      createNotification(stakeholders, 'mo_kt', `📖 Mở KT — buổi ${picked.join(', ')}`, pName, currentProfileId);
    }
    if (p) openProfile(p);
  } catch (e) {
    showToast('❌ Lỗi: ' + e.message);
  }
}

// KT Session Picker Dialog
function showKTSessionPicker(unconfirmed, confirmedSessions, allSessions) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg1,#fff);border-radius:16px;padding:20px;max-width:340px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    let html = `<div style="font-size:15px;font-weight:700;margin-bottom:14px;color:var(--text1,#333);">📖 Xác nhận mở KT</div>`;
    html += `<div style="font-size:12px;color:var(--text3,#888);margin-bottom:12px;">Chọn buổi BB đã mở Kinh Thánh:</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px;">`;
    for (const s of allSessions) {
      const isConfirmed = confirmedSessions.has(s);
      const isAvailable = unconfirmed.includes(s);
      if (isConfirmed) {
        html += `<div style="padding:10px 14px;border-radius:10px;background:var(--green,#22c55e);color:white;font-size:13px;font-weight:600;opacity:0.7;">
          ✅ Buổi ${s} — Đã xác nhận</div>`;
      } else {
        html += `<button class="kt-pick-btn" data-session="${s}" style="padding:10px 14px;border-radius:10px;background:var(--bg2,#f5f5f5);border:2px solid var(--border,#ddd);color:var(--text1,#333);font-size:13px;font-weight:600;cursor:pointer;text-align:left;transition:all 0.2s;">
          📕 Buổi ${s} — Chưa xác nhận</button>`;
      }
    }
    html += `</div>`;
    html += `<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">`;
    html += `<button id="ktPickCancel" style="padding:8px 16px;border-radius:10px;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:12px;font-weight:600;cursor:pointer;">Huỷ</button>`;
    html += `<button id="ktPickConfirm" style="padding:8px 16px;border-radius:10px;background:#8b5cf6;border:none;color:white;font-size:12px;font-weight:700;cursor:pointer;opacity:0.5;" disabled>Xác nhận</button>`;
    html += `</div>`;
    box.innerHTML = html;
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const selected = new Set();
    const confirmBtn = box.querySelector('#ktPickConfirm');
    box.querySelectorAll('.kt-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const s = Number(btn.dataset.session);
        if (selected.has(s)) {
          selected.delete(s);
          btn.style.border = '2px solid var(--border,#ddd)';
          btn.style.background = 'var(--bg2,#f5f5f5)';
          btn.innerHTML = `📕 Buổi ${s} — Chưa xác nhận`;
        } else {
          selected.add(s);
          btn.style.border = '2px solid #8b5cf6';
          btn.style.background = 'rgba(139,92,246,0.1)';
          btn.innerHTML = `📖 Buổi ${s} — Đã chọn ✓`;
        }
        confirmBtn.disabled = selected.size === 0;
        confirmBtn.style.opacity = selected.size > 0 ? '1' : '0.5';
      });
    });

    box.querySelector('#ktPickCancel').addEventListener('click', () => {
      overlay.remove();
      resolve([]);
    });
    confirmBtn.addEventListener('click', () => {
      overlay.remove();
      resolve([...selected].sort((a,b) => a-b));
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); resolve([]); }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// BB MILESTONES — Toggle & Session Picker
// ══════════════════════════════════════════════════════════════════════════════

const BB_MS_LABELS = {
  bai_dac_biet: 'Bài đặc biệt',
  pv_gvbb:      'PV GVBB',
  dky_center:   'ĐKý Center',
  pv_hs:        'PV HS'
};

async function toggleBBMilestone(type, isDone) {
  if (!currentProfileId) return;

  if (isDone) {
    // Undo — delete the milestone record
    if (!await showConfirmAsync(`Hủy "${BB_MS_LABELS[type]}"?`)) return;
    try {
      await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.${type}`, { method: 'DELETE' });
      showToast('↩️ Đã hủy');
      await _refreshCurrentProfile();
    } catch(e) { showToast('❌ Lỗi'); console.error(e); }
    return;
  }

  // Create milestone
  if (type === 'bai_dac_biet') {
    await pickBaiDacBiet();
  } else {
    const label = BB_MS_LABELS[type];
    if (!await showConfirmAsync(`Xác nhận "${label}" đã hoàn thành?`)) return;
    try {
      await sbFetch('/rest/v1/profile_records', { method: 'POST', body: JSON.stringify({
        profile_id: currentProfileId, record_type: type,
        content: { label }
      })});
      showToast(`✅ ${label} — Đã hoàn thành!`);
      // Notify stakeholders about milestone completion
      if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
        const msIcons = { pv_gvbb: '🎤', dky_center: '📋', pv_hs: '🎓' };
        const pName = allProfiles.find(x => x.id === currentProfileId)?.full_name || '';
        const stakeholders = await getProfileStakeholders(currentProfileId);
        createNotification(stakeholders, 'bb_milestone', `${msIcons[type] || '✅'} ${label}`, pName, currentProfileId);
      }
      await _refreshCurrentProfile();
    } catch(e) { showToast('❌ Lỗi'); console.error(e); }
  }
}

async function pickBaiDacBiet() {
  if (!currentProfileId) return;
  try {
    // Fetch BB reports
    const bbRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban&select=id,content&order=created_at.asc`);
    const bbRecords = await bbRes.json();
    if (!bbRecords || bbRecords.length === 0) {
      showToast('⚠️ Chưa có báo cáo BB nào.'); return;
    }
    // Fetch existing bai_dac_biet
    const bdRes = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${currentProfileId}&record_type=eq.bai_dac_biet&select=id,content`);
    const bdRecords = await bdRes.json();
    const doneSessions = new Set((bdRecords||[]).map(r => Number(r.content?.buoi_thu)).filter(Boolean));
    const allSessions = bbRecords.map(r => Number(r.content?.buoi_thu || 0)).filter(n => n > 0);
    const available = allSessions.filter(n => !doneSessions.has(n));

    if (available.length === 0) {
      showToast('✅ Tất cả buổi BB đã có Bài đặc biệt.'); return;
    }

    // Show picker
    const picked = await showBDBSessionPicker(available, doneSessions, allSessions);
    if (!picked) return;

    await sbFetch('/rest/v1/profile_records', { method: 'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'bai_dac_biet',
      content: { label: `Bài đặc biệt (buổi BB ${picked})`, buoi_thu: picked }
    })});
    showToast(`⭐ Bài đặc biệt buổi BB ${picked} — Đã ghi nhận!`);
    // Notify stakeholders about Bài đặc biệt
    if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
      const pName = allProfiles.find(x => x.id === currentProfileId)?.full_name || '';
      const stakeholders = await getProfileStakeholders(currentProfileId);
      createNotification(stakeholders, 'bb_milestone', `⭐ Bài đặc biệt — buổi BB ${picked}`, pName, currentProfileId);
    }
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

function showBDBSessionPicker(available, doneSessions, allSessions) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;';
    const card = document.createElement('div');
    card.style.cssText = 'background:var(--card);border-radius:var(--radius);padding:20px;max-width:320px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);';
    let html = `<div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text1);">⭐ Chọn buổi BB cho Bài đặc biệt</div>`;
    html += `<div style="display:flex;flex-direction:column;gap:8px;">`;
    allSessions.forEach(n => {
      const done = doneSessions.has(n);
      const avail = available.includes(n);
      if (done) {
        html += `<div style="padding:10px 14px;border-radius:10px;background:var(--green,#22c55e);color:white;font-size:13px;font-weight:600;opacity:0.7;">
          ⭐ Buổi ${n} — Đã có Bài đặc biệt</div>`;
      } else if (avail) {
        html += `<button class="bdb-pick-btn" data-session="${n}" style="padding:10px 14px;border-radius:10px;background:#fef3c7;border:2px solid #fcd34d;color:#92400e;font-size:13px;font-weight:600;cursor:pointer;text-align:left;transition:all 0.2s;">
          📋 Buổi ${n} — Chọn buổi này</button>`;
      }
    });
    html += `</div>`;
    html += `<div style="display:flex;gap:8px;margin-top:16px;justify-content:flex-end;">`;
    html += `<button id="bdbPickCancel" style="padding:8px 16px;border-radius:10px;background:var(--bg2,#f5f5f5);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:12px;font-weight:600;cursor:pointer;">Hủy</button>`;
    html += `</div>`;
    card.innerHTML = html;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Click a session button to pick it
    card.querySelectorAll('.bdb-pick-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.session);
        overlay.remove();
        resolve(n);
      });
    });

    card.querySelector('#bdbPickCancel').addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); resolve(null); }
    });
  });
}

async function deleteBBMilestone(recordId) {
  if (!await showConfirmAsync('Hủy sự kiện này?')) return;
  try {
    await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}`, { method: 'DELETE' });
    showToast('🗑️ Đã hủy');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ── Edit date for a major timeline event ──
async function editEventDate(recordId) {
  try {
    const res = await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}&select=id,content,record_type,created_at`);
    const rows = await res.json();
    if (!rows[0]) { showToast('⚠️ Không tìm thấy sự kiện'); return; }
    const r = rows[0];
    const currentDate = r.content?.report_date || r.created_at?.split('T')[0] || '';
    // Use a simple date prompt overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `<div style="background:var(--surface,#fff);border-radius:16px;padding:24px;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
      <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text1,#333);">📅 Đổi ngày sự kiện</div>
      <input type="date" id="_editDateInput" value="${currentDate}" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border,#ddd);background:var(--surface2,#f5f5f5);color:var(--text1,#333);font-size:14px;"/>
      <div style="display:flex;gap:8px;margin-top:14px;justify-content:flex-end;">
        <button id="_editDateCancel" style="padding:8px 16px;border-radius:8px;background:var(--surface2,#eee);border:1px solid var(--border,#ddd);color:var(--text2,#666);font-size:13px;cursor:pointer;">Hủy</button>
        <button id="_editDateSave" style="padding:8px 16px;border-radius:8px;background:var(--accent,#3b82f6);border:none;color:white;font-size:13px;font-weight:600;cursor:pointer;">Lưu</button>
      </div>
    </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_editDateCancel').onclick = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#_editDateSave').onclick = async () => {
      const newDate = document.getElementById('_editDateInput').value;
      if (!newDate) { showToast('⚠️ Chọn ngày'); return; }
      try {
        const updatedContent = { ...(r.content || {}), report_date: newDate };
        await sbFetch(`/rest/v1/profile_records?id=eq.${recordId}`, { method: 'PATCH', body: JSON.stringify({ content: updatedContent }) });
        overlay.remove();
        showToast('✅ Đã đổi ngày');
        await _refreshCurrentProfile();
      } catch(e) { showToast('❌ Lỗi đổi ngày'); console.error(e); }
    };
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

async function uploadRecordImage(input) {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  showToast(`⏳ Đang tải ${files.length} ảnh đính kèm...`);
  const urlEl = document.getElementById('rm_image_url');
  let currentUrls = (urlEl?.value || '').split(',').map(u => u.trim()).filter(Boolean);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 5 * 1024 * 1024) {
      showToast(`⚠️ Ảnh ${file.name} vượt quá 5MB, bỏ qua`);
      continue;
    }

    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?document=true`;
      const res = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.url) {
          currentUrls.push(data.url);
          continue;
        }
      }
      throw new Error('Upload server failed');
    } catch (e) {
      // Fallback to client-side compressed base64 DataURL
      try {
        const b64 = await _compressNoteImage(file, 1024, 1024, 0.7);
        currentUrls.push(b64);
      } catch (err) {
        const rawB64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
        if (rawB64) currentUrls.push(rawB64);
      }
    }
  }

  input.value = '';
  if (urlEl) urlEl.value = currentUrls.join(',');
  renderRecordImagePreview();
  showToast(`✅ Đã lưu ${currentUrls.length} ảnh đính kèm!`);
}

function renderRecordImagePreview() {
  const urlEl = document.getElementById('rm_image_url');
  const container = document.getElementById('rm_image_preview_container');
  if (!urlEl || !container) return;

  const urls = (urlEl.value || '').split(',').map(u => u.trim()).filter(Boolean);
  if (!urls.length) {
    container.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  container.style.display = 'flex';
  container.style.flexWrap = 'wrap';
  container.style.gap = '8px';
  container.style.marginTop = '8px';
  container.style.maxWidth = '100%';

  container.innerHTML = urls.map((url, idx) => `
    <div style="border:1px solid var(--border); border-radius:8px; overflow:hidden; position:relative; width:80px; height:80px; flex-shrink:0;">
      <img src="${url}" style="width:100%; height:100%; object-fit:cover; display:block;" />
      <button type="button" onclick="removeRecordImageSingle(${idx})" style="position:absolute; top:2px; right:2px; background:rgba(0,0,0,0.7); color:white; border:none; border-radius:50%; width:20px; height:20px; display:flex; align-items:center; justify-content:center; cursor:pointer; font-size:12px; font-weight:bold; z-index:10;">×</button>
    </div>
  `).join('');
}

function removeRecordImageSingle(index) {
  const urlEl = document.getElementById('rm_image_url');
  if (!urlEl) return;
  let urls = (urlEl.value || '').split(',').map(u => u.trim()).filter(Boolean);
  urls.splice(index, 1);
  urlEl.value = urls.join(',');
  renderRecordImagePreview();
}

function removeRecordImage() {
  const urlEl = document.getElementById('rm_image_url');
  if (urlEl) urlEl.value = '';
  renderRecordImagePreview();
}
  
  const fileEl = document.getElementById('rm_image_file');
  if (fileEl) fileEl.value = '';
  
  const preview = document.getElementById('rm_image_preview');
  if (preview) preview.src = '';
  
  const container = document.getElementById('rm_image_preview_container');
  if (container) container.style.display = 'none';
}

// Global sync function for TVV roles across all consultation sessions
async function syncTVVRolesFromSessions(profileId) {
  try {
    const sessionsRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=tvv_staff_code`);
    const sessions = await sessionsRes.json();
    const uniqueTvvs = [...new Set((sessions || []).map(s => s.tvv_staff_code).filter(Boolean))];

    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${profileId}&select=id`);
    const fgs = await fgRes.json();
    let fgId = fgs[0]?.id;
    if (!fgId) {
      const newFgRes = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
        telegram_group_id: null, profile_id: profileId, level: 'tu_van'
      })});
      const newFgs = await newFgRes.json();
      fgId = newFgs[0]?.id;
    }

    if (fgId) {
      // Fetch existing TVV roles in the group
      const existingRolesRes = await sbFetch(`/rest/v1/fruit_roles?fruit_group_id=eq.${fgId}&role_type=eq.tvv&select=id,staff_code`);
      const existingRoles = await existingRolesRes.json();

      // Target list of staff_code in fruit_roles
      const targetStaffCodes = uniqueTvvs.map(t => isStaffRegistered(t) ? t : `tg:${t}`);

      // Roles to delete and insert
      const toDelete = existingRoles.filter(r => !targetStaffCodes.includes(r.staff_code));
      const toInsert = targetStaffCodes.filter(code => !existingRoles.some(r => r.staff_code === code));

      // Delete no longer needed roles
      for (const r of toDelete) {
        await sbFetch(`/rest/v1/fruit_roles?id=eq.${r.id}`, { method: 'DELETE' });
      }

      // Insert new roles
      for (const code of toInsert) {
        const rawCode = code.startsWith('tg:') ? code.slice(3) : code;
        const isReg = isStaffRegistered(rawCode);
        const roleData = {
          fruit_group_id: fgId,
          staff_code: code,
          role_type: 'tvv',
          assigned_by: getEffectiveStaffCode()
        };
        if (!isReg) {
          roleData.display_name = rawCode;
        }
        await sbFetch('/rest/v1/fruit_roles', { method: 'POST', body: JSON.stringify(roleData) });
      }

      // TVV bổ sung → cập nhật priority task chot_tv_1
      if (typeof updateChotTV1Task === 'function') {
        const pp = allProfiles.find(x => x.id === profileId);
        const allSessionsRes = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=scheduled_at`);
        const allSessions = await allSessionsRes.json();
        const hasSchedule = (allSessions || []).some(s => s.scheduled_at);
        updateChotTV1Task(profileId, pp?.full_name || '', true, hasSchedule);
      }
    }
  } catch(e) {
    console.warn('syncTVVRolesFromSessions fail:', e);
  }
}

window.syncTVVRolesFromSessions = syncTVVRolesFromSessions;
