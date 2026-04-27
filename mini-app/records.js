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
    const [sessRes, recRes, hjRes] = await Promise.all([
      sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=not.in.(ai_mindmap,ai_chat)&select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}&select=data,created_at&limit=1`)
    ]);
    const sessions = await sessRes.json();
    const recs = await recRes.json();
    const hapjas = await hjRes.json();


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

    // Separate mo_kt and bai_dac_biet records for lookup
    const moKtRecords = recs.filter(r => r.record_type === 'mo_kt');
    const matchedMoKtIds = new Set();
    const bdbRecords = recs.filter(r => r.record_type === 'bai_dac_biet');
    const matchedBdbIds = new Set();

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
        _buoiThu = r.content?.buoi_thu;
        icon='📋'; text=`Báo cáo BB${_buoiThu?' buổi '+_buoiThu:''}`;
      }
      else if (r.record_type === 'chot_bb')     { icon='🎓'; text='Lập Group TV - BB'; isMajor = true; }
      else if (r.record_type === 'chot_center') { icon='🏛️'; text='Chốt Center'; isMajor = true; }
      else if (r.record_type === 'bai_dac_biet') { return; } // handled via split-row on bien_ban
      else if (r.record_type === 'pv_gvbb')     { icon='🎤'; text='PV GVBB'; isMajor = true; }
      else if (r.record_type === 'dky_center')   { icon='📝'; text='ĐKý Center'; isMajor = true; }
      else if (r.record_type === 'pv_hs')        { icon='🎓'; text='PV HS'; isMajor = true; }
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

      events.push({
        date: r.created_at, icon, text, sortDate: new Date(r.created_at).getTime(),
        deletable: false, _type: 'record', _id: r.id, _rtype: r.record_type,
        isMajor, _buoiThu, hasKT, ktRecordId, hasBDB, bdbRecordId
      });
    });

    // Sort descending: newest (top) → oldest (bottom)
    events.sort((a,b) => b.sortDate - a.sortDate);

    // No separate KT events needed — KT is annotated on the matching bien_ban
    const finalEvents = [...events];

    // ── Determine which SINGLE event gets the 🗑 delete button ──
    if (cp === 'bb') {
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'bien_ban') {
          finalEvents[i].deletable = true; break;
        }
      }
    } else if (cp === 'tu_van') {
      let found = false;
      for (let i = 0; i < finalEvents.length; i++) {
        if (finalEvents[i]._type === 'record' && finalEvents[i]._rtype === 'bien_ban') {
          finalEvents[i].deletable = true; found = true; break;
        }
      }
      if (!found) {
        // Only allow deleting Lập Group (chot_bb record) if no bien_ban exists but we wouldn't show it here anyway, 
        // we handle Lập group via Undo Last Phase Change!
      }
    } else if (cp === 'tu_van_hinh' || cp === 'chakki') {
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

    // ── Render as TIMELINE ──
    if (finalEvents.length === 0) {
      tlEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có sự kiện nào</div>';
    } else {
      const hoverIn  = `this.querySelectorAll('.tl-del-btn,.tl-edit-btn').forEach(b=>b.classList.add('visible'))`;
      const hoverOut = `this.querySelectorAll('.tl-del-btn,.tl-edit-btn').forEach(b=>b.classList.remove('visible'))`;

      let html = '<div class="tl-container">';

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

        // Click-to-view for report records (read-only view)
        const viewAttr = (e._type === 'record' && e._id && (e._rtype === 'tu_van' || e._rtype === 'bien_ban'))
          ? `onclick="viewRecord('${e._id}','${e._rtype}')" style="cursor:pointer;"`
          : '';

        // Edit button for report records (always shown, not just when deletable)
        let editBtn = '';
        if (e._type === 'record' && e._id && (e._rtype === 'tu_van' || e._rtype === 'bien_ban')) {
          editBtn = `<button onclick="event.stopPropagation();editRecord('${e._id}','${e._rtype}')" title="Chỉnh sửa báo cáo" class="tl-edit-btn">✏️</button>`;
        }

        if (e.hasKT || e.hasBDB) {
          // ── SPLIT ROW: milestone(s) left + BB report right ──
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
          </div>`;
        } else if (e.isMajor) {
          // ── MAJOR EVENT: left column only ──
          html += `<div class="tl-item tl-major" ${clickAttr} onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left">
              <span class="tl-icon">${e.icon}</span>
              <div class="tl-left-info">
                <span class="tl-label">${e.text}</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              ${delBtn}
            </div>
            <div class="tl-right"></div>
          </div>`;
        } else {
          // ── REPORT: right column only ──
          html += `<div class="tl-item tl-report-row" ${viewAttr} onmouseenter="${hoverIn}" onmouseleave="${hoverOut}">
            <div class="tl-left"></div>
            <div class="tl-right">
              <span class="tl-icon" style="flex-shrink:0">${e.icon}</span>
              <div class="tl-right-info">
                <span class="tl-label">${e.text}</span>
                ${d ? `<span class="tl-date">${d}</span>` : ''}
              </div>
              <div class="tl-btn-group">${editBtn}${delBtn}</div>
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
    const res = await sbFetch(`/rest/v1/records?id=eq.${recordId}&select=*`);
    const rows = await res.json();
    if (!rows[0]) { showToast('⚠️ Không tìm thấy báo cáo'); return; }
    const r = rows[0];
    const c = r.content || {};
    const date = shinDate(r.created_at);
    const pName = allProfiles.find(x => x.id === r.profile_id)?.full_name || '';
    const isTV = recordType === 'tu_van';

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
    } else {
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
    } else {
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
  // Actions: Copy + Edit + Close
  const acts = document.getElementById('reportViewActions');
  acts.innerHTML = `
    <button onclick="copyToClipboard(window._reportCopyText)" style="padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:transparent;color:var(--text);font-size:13px;cursor:pointer;" title="Copy báo cáo">📋</button>
    <button onclick="document.getElementById('reportViewModal').classList.remove('open');editRecord('${recordId}','${recordType}')" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:1px solid var(--accent);background:transparent;color:var(--accent);font-size:13px;font-weight:600;cursor:pointer;">✏️ Chỉnh sửa</button>
    <button onclick="document.getElementById('reportViewModal').classList.remove('open')" style="flex:1;padding:10px;border-radius:var(--radius-sm);border:none;background:var(--surface2);color:var(--text2);font-size:13px;cursor:pointer;">Đóng</button>`;
  modal.classList.add('open');
}

// ── Edit a report record (fetch content & open modal in EDIT mode) ──
async function editRecord(recordId, recordType) {
  try {
    const res = await sbFetch(`/rest/v1/records?id=eq.${recordId}&select=*`);
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
    filterProfiles();
    loadDashboard();
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

// ── Delete single BC record (newest of current phase only) ──
async function deleteEventRecord(recordId, recordType) {
  const labels = { tu_van:'Báo cáo TV', bien_ban:'Báo cáo BB' };
  const label = labels[recordType] || recordType;
  if (!await showConfirmAsync(`Xóa "${label}" mới nhất?`)) return;
  try {
    await sbFetch(`/rest/v1/records?id=eq.${recordId}`, { method:'DELETE' });
    showToast(`✅ Đã xóa ${label}`);
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi xóa'); console.error(e); }
}

async function deleteEventRecordKt(recordId) {
  if (!await showConfirmAsync('Hủy trạng thái Đã mở KT?')) return;
  try {
    if (recordId && recordId !== 'undefined' && recordId !== 'null') {
      await sbFetch(`/rest/v1/records?id=eq.${recordId}`, { method:'DELETE' });
    } else {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt`, { method:'DELETE' });
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
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van`, { method:'DELETE' });
      await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${currentProfileId}&session_number=gt.1`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'chakki' }) });
    };
  } else if (phase === 'tu_van') {
    confirmMsg = '↩️ Hoàn tác về Tư vấn hình?\n\n⚠️ Sẽ xóa TẤT CẢ:\n• Sự kiện Lập Group\n• Tất cả Báo cáo BB\n\n(Báo cáo TV và Chốt TV được giữ nguyên)\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban`, { method:'DELETE' });
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.chot_bb`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'tu_van_hinh' }) });
    };
  } else if (phase === 'bb') {
    confirmMsg = '↩️ Hoàn tác về Tư vấn?\n\n⚠️ Sẽ hủy trạng thái Đã mở KT (Báo cáo BB được giữ nguyên).\nHành động này không thể hoàn tác!';
    actionFn = async () => {
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt`, { method:'DELETE' });
      await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase:'tu_van', is_kt_opened: false }) });
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
    // ⚠️ Kiểm tra: nếu đây là lần 2+, phải có Báo cáo TV lần (nextNum-1) rồi mới chốt tiếp
    if (nextNum > 1) {
      try {
        const prevLan = nextNum - 1;
        const bcCheckRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van&select=id,content`);
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
      if (num > 1 && p && (p.phase === 'new' || p.phase === 'chakki' || !p.phase)) {
        await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van_hinh' })});
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
          // TVV bổ sung → cập nhật priority task chot_tv_1
          if (typeof updateChotTV1Task === 'function') {
            const pp = allProfiles.find(x => x.id === currentProfileId);
            updateChotTV1Task(currentProfileId, pp?.full_name || '', true, !!dt);
          }
        }
      } catch(e) { console.warn('Assign role fail:', e); }
    }

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
      const bcRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.tu_van&content->>lan_thu=eq.${lastSessNum}&select=id&limit=1`);
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
    const gvbb = getStaffCodeFromInput('cbb_gvbb');
    // GVBB bắt buộc khi Lập Group TV/BB
    if (!gvbb) {
      showToast('⚠️ Phải điền GVBB trước khi Lập Group!');
      return;
    }
    // 1. Update phase
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van' })});
    // 2. Record chot_bb event on timeline
    await sbFetch('/rest/v1/records', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, record_type: 'chot_bb', content: { label: 'Lập Group TV - BB', phase: 'tu_van' }
    })});
    // 3. Save GVBB to fruit_roles if provided
    if (gvbb) {
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
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'resolution=ignore-duplicates'}, body: JSON.stringify({
            fruit_group_id: fgId, staff_code: gvbb, role_type: 'gvbb', assigned_by: getEffectiveStaffCode()
          })});
        }
      } catch(e) { console.warn('Assign GVBB fail:', e); }
    }
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
    await sbFetch('/rest/v1/records', { method:'POST', body: JSON.stringify({
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
function openAddRecordModal(type, existingContent = null, readOnly = false) {
  currentRecordType = type;
  if (!existingContent) currentRecordId = null;
  const isTV = type === 'tu_van';
  let titleText;
  if (readOnly) {
    titleText = isTV ? '📋 Xem Báo cáo Tư vấn' : '📋 Xem Báo cáo BB';
  } else {
    titleText = existingContent
      ? (isTV ? '✏️ Chỉnh sửa Báo cáo Tư vấn' : '✏️ Chỉnh sửa Báo cáo BB')
      : (isTV ? '💬 Báo cáo Tư vấn' : '📝 Báo cáo BB');
  }
  document.getElementById('recordModalTitle').textContent = titleText;
  const body = document.getElementById('recordModalBody');
  const c = existingContent || {};
  if (isTV) {
    body.innerHTML = `
      <div class="field-group"><label>Lần thứ</label><input type="text" id="rm_lan_thu" placeholder="1, 2, 3..." value="${c.lan_thu||''}"/></div>
      <div class="field-group"><label>Tên công cụ tư vấn</label><input type="text" id="rm_ten_cong_cu" list="datalist_tools" placeholder="Chọn hoặc nhập công cụ..." autocomplete="off" value="${c.ten_cong_cu||''}"/></div>
      <div class="field-group"><label>Kết quả test công cụ</label><textarea id="rm_ket_qua_test" placeholder="...">${c.ket_qua_test||''}</textarea></div>
      <div class="field-group"><label>Vấn đề / Nhu cầu / Thông tin khai thác được</label><textarea id="rm_van_de" style="min-height:100px;" placeholder="...">${c.van_de||''}</textarea></div>
      <div class="field-group"><label>Phản hồi / Cảm nhận của trái sau tư vấn</label><textarea id="rm_phan_hoi" placeholder="...">${c.phan_hoi||''}</textarea></div>
      <div class="field-group"><label>Điểm hái trái</label><textarea id="rm_diem_hai" placeholder="...">${c.diem_hai||''}</textarea></div>
      <div class="field-group"><label>Đề xuất của TVV</label><textarea id="rm_de_xuat" placeholder="...">${c.de_xuat||''}</textarea></div>`;
  } else {
    // Parse existing buoi_tiep to date/time values (support old DD/MM/YYYY and ISO formats)
    const parseBuoiTiep = (val) => {
      if (!val) return { date: '', time: '' };
      // ISO format: YYYY-MM-DDTHH:mm or datetime-local
      const isoMatch = val.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (isoMatch) return { date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, time: `${isoMatch[4]}:${isoMatch[5]}` };
      // Old format: DD/MM/YYYY HH:mm
      const oldMatch = val.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*(\d{1,2}):(\d{2})/);
      if (oldMatch) return { date: `${oldMatch[3]}-${String(oldMatch[2]).padStart(2,'0')}-${String(oldMatch[1]).padStart(2,'0')}`, time: `${String(oldMatch[4]).padStart(2,'0')}:${oldMatch[5]}` };
      return { date: '', time: '' };
    };
    const bt = parseBuoiTiep(c.buoi_tiep);
    body.innerHTML = `
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
        <div style="font-size:11px;color:var(--text3);margin-top:3px;">💡 Bạn có thể thay đổi thời gian này sau đó</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;"><input type="checkbox" id="rm_has_kt_content" ${c.has_kt_content ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--accent);"/><label for="rm_has_kt_content" style="margin:0;font-size:13px;font-weight:600;">📖 Có nội dung KT</label></div>
      <div class="field-group"><label>Nội dung buổi tiếp theo</label><textarea id="rm_noi_dung_tiep" placeholder="...">${c.noi_dung_tiep||''}</textarea></div>`;
  }
  document.getElementById('addRecordModal').classList.add('open');
  // Apply read-only state after rendering fields
  setTimeout(() => {
    const modal = document.getElementById('addRecordModal');
    const saveBtn = modal ? modal.querySelector('.save-btn') : null;
    const inputs = modal ? modal.querySelectorAll('input, textarea, select') : [];
    if (readOnly) {
      inputs.forEach(el => { el.disabled = true; el.style.opacity = '0.8'; });
      if (saveBtn) saveBtn.style.display = 'none';
    } else {
      inputs.forEach(el => { el.disabled = false; el.style.opacity = ''; });
      if (saveBtn) saveBtn.style.display = '';
    }
  }, 50);
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
    // Build ISO datetime from date + time pickers
    const btDate = document.getElementById('rm_buoi_tiep_date')?.value; // YYYY-MM-DD
    const btTime = document.getElementById('rm_buoi_tiep_time')?.value; // HH:mm
    const buoiTiepISO = btDate ? (btTime ? `${btDate}T${btTime}:00` : `${btDate}T00:00:00`) : null;
    data = {
      buoi_thu:      document.getElementById('rm_buoi_thu')?.value,
      noi_dung:      document.getElementById('rm_noi_dung')?.value,
      phan_ung:      document.getElementById('rm_phan_ung')?.value,
      khai_thac:     document.getElementById('rm_khai_thac')?.value,
      tuong_tac:     document.getElementById('rm_tuong_tac')?.value,
      de_xuat_cs:    document.getElementById('rm_de_xuat_cs')?.value,
      buoi_tiep:     buoiTiepISO,
      noi_dung_tiep: document.getElementById('rm_noi_dung_tiep')?.value,
      has_kt_content: document.getElementById('rm_has_kt_content')?.checked || false,
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

      // === Auto-triggers for NEW records ===
      const p = allProfiles.find(x => x.id === currentProfileId);
      const pName = p?.full_name || '';
      if (isTV) {
        // Complete "viet_bc_tv" priority task
        if (typeof completePriorityTask === 'function') completePriorityTask(currentProfileId, 'viet_bc_tv');
        // Notification
        if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
          const stakeholders = await getProfileStakeholders(currentProfileId);
          createNotification(stakeholders, 'bc_tv', `📝 BC TV lần ${data.lan_thu}`, pName, currentProfileId);
        }
      } else {
        // BB report: complete current "viet_bc_bb" priority
        if (typeof completePriorityTask === 'function') completePriorityTask(currentProfileId, 'viet_bc_bb');

        // Calendar: add Học BB next session event
        if (data.buoi_tiep && typeof createCalEventFromBBReport === 'function') {
          const nextNum = (parseInt(data.buoi_thu) || 1) + 1;
          createCalEventFromBBReport(currentProfileId, nextNum, data.buoi_tiep);
        }

        // Priority: create next "viet_bc_bb" task — visible 1 hour AFTER next BB session
        if (data.buoi_tiep && typeof createPriorityTask === 'function') {
          const myCode = getEffectiveStaffCode();
          const buoiTime = new Date(data.buoi_tiep);
          const visibleAt = new Date(buoiTime.getTime() + 60 * 60 * 1000).toISOString(); // +1h
          createPriorityTask(
            myCode, currentProfileId, 'viet_bc_bb',
            `Viết BC BB buổi ${(parseInt(data.buoi_thu) || 0) + 1} — ${pName}`,
            null, visibleAt
          );
        }

        // Notification
        if (typeof createNotification === 'function' && typeof getProfileStakeholders === 'function') {
          const stakeholders = await getProfileStakeholders(currentProfileId);
          createNotification(stakeholders, 'bc_bb', `📋 BC BB buổi ${data.buoi_thu}`, pName, currentProfileId);
        }
      }
    }
    
    // Auto-sync TV records updates to Google Sheets
    if (typeof syncToGoogleSheet === 'function') syncToGoogleSheet(currentProfileId);

    closeModal('addRecordModal');
    currentRecordId = null;
    await _refreshCurrentProfile();
  } catch { showToast('❌ Lỗi'); }
}

// ══════════════════════════════════════════════════════════════════════════════
// NOTES (Sticky Notes)
// ══════════════════════════════════════════════════════════════════════════════
async function loadNotes(profileId) {
  const listEl = document.getElementById('notesList');
  const countEl = document.getElementById('noteCount');
  if (!listEl) return;
  try {
    const res = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&record_type=eq.note&select=id,content,created_at&order=created_at.desc`);
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
      await sbFetch(`/rest/v1/records?id=eq.${editId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: { title: title || 'Ghi chú', body: body || '' } })
      });
      delete titleEl.dataset.editId;
      document.getElementById('noteSaveBtn').textContent = '📌 Thêm ghi chú';
      showToast('✅ Đã cập nhật ghi chú!');
    } else {
      await sbFetch('/rest/v1/records', {
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
    await sbFetch(`/rest/v1/records?id=eq.${noteId}`, { method: 'DELETE' });
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
    const bbRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban&select=id,content&order=created_at.asc`);
    const bbRecords = await bbRes.json();
    if (!bbRecords || bbRecords.length === 0) {
      showToast('⚠️ Chưa có báo cáo BB nào để xác nhận mở KT.');
      return;
    }
    // Fetch existing mo_kt records
    const ktRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.mo_kt&select=id,content`);
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
      await sbFetch('/rest/v1/records', {
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
      await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.${type}`, { method: 'DELETE' });
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
      await sbFetch('/rest/v1/records', { method: 'POST', body: JSON.stringify({
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
    const bbRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.bien_ban&select=id,content&order=created_at.asc`);
    const bbRecords = await bbRes.json();
    if (!bbRecords || bbRecords.length === 0) {
      showToast('⚠️ Chưa có báo cáo BB nào.'); return;
    }
    // Fetch existing bai_dac_biet
    const bdRes = await sbFetch(`/rest/v1/records?profile_id=eq.${currentProfileId}&record_type=eq.bai_dac_biet&select=id,content`);
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

    await sbFetch('/rest/v1/records', { method: 'POST', body: JSON.stringify({
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
    await sbFetch(`/rest/v1/records?id=eq.${recordId}`, { method: 'DELETE' });
    showToast('🗑️ Đã hủy');
    await _refreshCurrentProfile();
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
