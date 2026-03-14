// ============ CONSULTATION SESSIONS ============
async function loadJourney(profileId, currentPhase) {
  const phBtnEl = document.getElementById('phaseButtons');
  const tlEl = document.getElementById('timelineList');
  // Phase buttons based on current phase
  let btnHtml = '';
  if (['new','chakki'].includes(currentPhase)) {
    btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt Tư vấn</button>`;
  } else if (currentPhase === 'tu_van') {
    btnHtml = `<button class="add-record-btn" onclick="openScheduleTVModal()" style="flex:1;">📅 Chốt TV tiếp</button>
      <button class="add-record-btn" onclick="openChotBBModal()" style="flex:1;background:var(--green);color:white;">🎓 Chốt BB</button>`;
  } else if (currentPhase === 'bb') {
    btnHtml = `<button class="add-record-btn" onclick="chotCenter()" style="flex:1;background:#8b5cf6;color:white;">🏛️ Chốt Center</button>`;
  }
  phBtnEl.innerHTML = btnHtml;
  try {
    const res = await sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=*&order=session_number.asc`);
    const sessions = await res.json();
    // Timeline
    let events = [];
    sessions.forEach(s => {
      events.push({date: s.created_at, icon:'📅', text:`Chốt TV lần ${s.session_number} (${s.tool||'—'})`});
      if (s.status !== 'scheduled') events.push({date: s.scheduled_at||s.created_at, icon:'✅', text:`TV lần ${s.session_number} hoàn thành`});
    });
    const recRes = await sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&select=*&order=created_at.asc`);
    const recs = await recRes.json();
    recs.forEach(r => {
      const isTV = r.record_type === 'tu_van';
      const num = r.content?.lan_thu || r.content?.buoi_thu || '';
      events.push({date: r.created_at, icon: isTV?'📝':'📋', text:`${isTV?'BC TV':'BC BB'}${num?' lần '+num:''}`});
    });
    events.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (events.length === 0) {
      tlEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text2);font-size:13px;">Chưa có sự kiện nào</div>';
    } else {
      tlEl.innerHTML = events.map(e => {
        const d = new Date(e.date).toLocaleDateString('vi-VN');
        return `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-left:3px solid var(--border);margin-left:10px;padding-left:16px;">
          <div style="font-size:16px;margin-top:-2px;">${e.icon}</div>
          <div><div style="font-size:12px;font-weight:600;">${e.text}</div><div style="font-size:10px;color:var(--text3);margin-top:2px;">${d}</div></div>
        </div>`;
      }).join('');
    }
  } catch(e) { console.error('Journey error:', e); }
}
function openScheduleTVModal() {
  if (!currentProfileId) return;
  const pos = getCurrentPosition();
  if (!['admin','gyjn','bgyjn'].includes(pos)) {
    // Check if user is NDD of this profile
    const p = allProfiles.find(x=>x.id===currentProfileId);
    if (!p || p.ndd_staff_code !== getEffectiveStaffCode()) {
      showToast('⚠️ Chỉ NDD/GYJN/BGYJN được chốt TV');
      return;
    }
  }
  // Auto-increment session number
  const existing = document.querySelectorAll('#sessionsList > div').length;
  document.getElementById('stv_session_num').value = existing + 1;
  document.getElementById('stv_tool').value = '';
  document.getElementById('stv_datetime').value = '';
  document.getElementById('stv_tvv').value = '';
  document.getElementById('stv_notes').value = '';
  document.getElementById('scheduleTVModal').classList.add('open');
}
async function saveScheduleTV() {
  const num = parseInt(document.getElementById('stv_session_num').value)||1;
  const tool = document.getElementById('stv_tool').value.trim();
  const dt = document.getElementById('stv_datetime').value;
  const tvv = getStaffCodeFromInput('stv_tvv');
  const notes = document.getElementById('stv_notes').value;
  if (!tool) { showToast('⚠️ Nhập công cụ tư vấn'); return; }
  try {
    await sbFetch('/rest/v1/consultation_sessions', { method:'POST', body: JSON.stringify({
      profile_id: currentProfileId, session_number: num, tool,
      scheduled_at: dt || null, tvv_staff_code: tvv || null, notes: notes || null,
      created_by: getEffectiveStaffCode()
    })});
    // Update phase to tu_van if still new
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&phase=eq.new`, { method:'PATCH', body: JSON.stringify({ phase: 'tu_van' })});
    // If TVV assigned, create fruit_role so TVV sees this fruit in their dashboard
    if (tvv) {
      try {
        // Find or create fruit_group for this profile
        const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id`);
        const fgs = await fgRes.json();
        let fgId = fgs[0]?.id;
        if (!fgId) {
          const newFg = await sbFetch('/rest/v1/fruit_groups', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({
            telegram_group_id: 0, profile_id: currentProfileId, level: 'tu_van'
          })});
          const newFgs = await newFg.json();
          fgId = newFgs[0]?.id;
        }
        if (fgId) {
          await sbFetch('/rest/v1/fruit_roles', { method:'POST', headers:{'Prefer':'resolution=ignore-duplicates'}, body: JSON.stringify({
            fruit_group_id: fgId, staff_code: tvv, role_type: 'tvv', assigned_by: getEffectiveStaffCode()
          })});
        }
      } catch(e) { console.warn('TVV role assign warning:', e); }
    }
    closeModal('scheduleTVModal');
    showToast('✅ Đã chốt Tư vấn lần ' + num);
    loadSessions(currentProfileId);
    const pRes = await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&select=*`);
    const ps = await pRes.json();
    if (ps[0]) { const idx = allProfiles.findIndex(x=>x.id===currentProfileId); if (idx>=0) allProfiles[idx]=ps[0]; openProfile(ps[0]); }
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
async function completeSession(sessionId) {
  try {
    await sbFetch(`/rest/v1/consultation_sessions?id=eq.${sessionId}`, { method:'PATCH', body: JSON.stringify({ status: 'completed' })});
    showToast('✅ Đã hoàn thành buổi tư vấn');
    loadSessions(currentProfileId);
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
function createTVFromSession(sessionId, num, tool) {
  // Open add record modal with pre-filled data
  openAddRecordModal('tu_van');
  setTimeout(() => {
    const lanEl = document.getElementById('rm_lan_thu');
    const toolEl = document.getElementById('rm_ten_cong_cu');
    if (lanEl) lanEl.value = num;
    if (toolEl) toolEl.value = tool;
  }, 100);
}
function openChotBBModal() {
  if (!currentProfileId) return;
  document.getElementById('cbb_gvbb').value = '';
  document.getElementById('cbb_notes').value = '';
  document.getElementById('chotBBModal').classList.add('open');
}
async function saveChotBB() {
  const gvbb = getStaffCodeFromInput('cbb_gvbb'); // optional
  try {
    // Update phase to bb
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'bb' })});
    closeModal('chotBBModal');
    showToast('🎓 Đã chốt BB! Hãy tạo group Telegram và gắn hồ sơ.');
    // Refresh
    const pRes = await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&select=*`);
    const ps = await pRes.json();
    if (ps[0]) { const idx = allProfiles.findIndex(x=>x.id===currentProfileId); if (idx>=0) allProfiles[idx]=ps[0]; openProfile(ps[0]); }
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}
async function chotCenter() {
  if (!currentProfileId) return;
  const pos = getCurrentPosition();
  const myCode = getEffectiveStaffCode();
  const p = allProfiles.find(x=>x.id===currentProfileId);
  // Permission: NDD, GYJN of NDD, BGYJN of NDD, or GVBB of this fruit
  const isNDD = p?.ndd_staff_code === myCode;
  const isAdmin = pos === 'admin';
  const isGYJN = pos === 'gyjn' || pos === 'bgyjn';
  // Check GVBB role
  let isGVBB = false;
  try {
    const fgRes = await sbFetch(`/rest/v1/fruit_groups?profile_id=eq.${currentProfileId}&select=id,fruit_roles(staff_code,role_type)`);
    const fgs = await fgRes.json();
    (fgs||[]).forEach(fg => (fg.fruit_roles||[]).forEach(r => {
      if (r.role_type==='gvbb' && r.staff_code===myCode) isGVBB = true;
    }));
  } catch(e) {}
  if (!isNDD && !isAdmin && !isGYJN && !isGVBB) {
    showToast('⚠️ Chỉ NDD/GYJN/BGYJN/GVBB được chốt Center');
    return;
  }
  if (!confirm('Xác nhận trái quả nhập học Center?')) return;
  try {
    await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}`, { method:'PATCH', body: JSON.stringify({ phase: 'center' })});
    showToast('🏛️ Đã chốt Center!');
    const pRes = await sbFetch(`/rest/v1/profiles?id=eq.${currentProfileId}&select=*`);
    const ps = await pRes.json();
    if (ps[0]) { const idx = allProfiles.findIndex(x=>x.id===currentProfileId); if (idx>=0) allProfiles[idx]=ps[0]; openProfile(ps[0]); }
  } catch(e) { showToast('❌ Lỗi'); console.error(e); }
}

// ============ ADD RECORD MODAL ============
function openAddRecordModal(type, existingContent = null) {
  currentRecordType = type;
  if (!existingContent) currentRecordId = null; // new record
  const isTV = type==='tu_van';
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
  const isTV = currentRecordType==='tu_van';
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
    if (currentRecordId) {
      // Edit existing
      await sbFetch(`/rest/v1/records?id=eq.${currentRecordId}`, { method:'PATCH', body: JSON.stringify({ content: data }) });
      showToast('✅ Đã cập nhật phiếu!');
    } else {
      // Create new
      await sbFetch('/rest/v1/records', { method:'POST', headers:{'Prefer':'return=representation'}, body: JSON.stringify({ profile_id: currentProfileId, record_type: currentRecordType, content: data }) });
      showToast('✅ Đã thêm!');
    }
    closeModal('addRecordModal');
    currentRecordId = null;
    if (isTV) loadRecords(currentProfileId,'tu_van','tvList','tvCount');
    else loadRecords(currentProfileId,'bien_ban','bbList','bbCount');
  } catch { showToast('❌ Lỗi'); }
}

