// webhook.js
// Handles background data synchronization to Google Sheets Webhook

// Paste Google Apps Script Webhook URL here to enable Google Sheets sync
window.HAPJA_SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbw7M2PaW97SlZquTOEI_VRMR2GZDo1LaQUEkkCih75f2dxGCrNhzDdlXFWqwxDn4Pib_A/exec';

// Global background syncer to Google Sheets
async function syncToGoogleSheet(pid) {
  if (!window.HAPJA_SHEET_WEBHOOK || !pid) return;
  try {
    const [pRes, hcRes, hjRes, noteRes, tvRes] = await Promise.all([
      sbFetch(`/rest/v1/profiles?id=eq.${pid}&select=*`),
      sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${pid}&select=data`),
      sbFetch(`/rest/v1/check_hapja?profile_id=eq.${pid}&status=eq.approved&select=data&limit=1`),
      sbFetch(`/rest/v1/records?profile_id=eq.${pid}&record_type=eq.note&select=content&order=created_at.desc&limit=1`),
      sbFetch(`/rest/v1/records?profile_id=eq.${pid}&record_type=eq.tu_van&select=content&order=created_at.desc&limit=5`)
    ]);
    const prs = await pRes.json(), hcs = await hcRes.json();
    const hjs = await hjRes.json();
    const notes = await noteRes.json(), tvs = await tvRes.json();
    
    if (!prs || !prs.length) return;
    const p = prs[0];
    const d = hcs[0]?.data || {};
    const hj = hjs[0]?.data || {};
    const recentNote = notes[0]?.content?.body || '';
    const tools = tvs.map(r => r.content?.ten_cong_cu).filter(Boolean).join(', ');
    
    const nddGroup = (typeof staffUnitMap !== 'undefined' && p.ndd_staff_code) 
                    ? (staffUnitMap[p.ndd_staff_code] || '') : '';
    const semName = (typeof allSemesters !== 'undefined' && p.semester_id)
                    ? (allSemesters.find(s => s.id === p.semester_id)?.name || '') : '';

    fetch(window.HAPJA_SHEET_WEBHOOK, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'upsert',
        profile_id: pid, 
        p: p, 
        d: d,
        hj: hj,
        recentNote: recentNote,
        tools: tools || d.t2_cong_cu || '',
        nddGroup: nddGroup,
        semesterName: semName
      })
    });
  } catch(e) { console.warn('Sync Sheet Fail:', e); }
}

async function bulkSyncDatabaseToSheet() {
  if (!window.HAPJA_SHEET_WEBHOOK) {
    alert('Chưa cấu hình HAPJA_SHEET_WEBHOOK');
    return;
  }
  if (!confirm('Bạn có chắc chắn muốn Tái đồng bộ toàn bộ dữ liệu xuống Google Sheet? Thao tác này có thể tốn vài chục giây.')) return;
  
  try {
    showToast('⏳ Đang tải toàn bộ dữ liệu để đồng bộ...', 3000);
    // Fetch all profiles, hanh_chinh, hapja, notes, tu_van
    const [pRes, hcRes, hjRes, noteRes, tvRes] = await Promise.all([
      sbFetch(`/rest/v1/profiles?select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/form_hanh_chinh?select=profile_id,data`),
      sbFetch(`/rest/v1/check_hapja?status=eq.approved&select=profile_id,data&order=created_at.asc`),
      sbFetch(`/rest/v1/records?record_type=eq.note&select=profile_id,content,created_at&order=created_at.desc`),
      sbFetch(`/rest/v1/records?record_type=eq.tu_van&select=profile_id,content,created_at&order=created_at.desc`)
    ]);
    
    const prs = await pRes.json();
    const hcs = await hcRes.json();
    const hjs = await hjRes.json();
    const notes = await noteRes.json();
    const tvs = await tvRes.json();
    
    // Build maps
    const hcMap = {}; hcs.forEach(h => hcMap[h.profile_id] = h.data || {});
    // Hapja map: dùng data của hapja đã approved (hinh_thuc, ket_noi, concept, ngay_chakki)
    const hjMap = {}; hjs.forEach(h => { if (!hjMap[h.profile_id]) hjMap[h.profile_id] = h.data || {}; });
    
    // Only take the latest note per profile
    const noteMap = {}; 
    notes.forEach(n => {
      if (!noteMap[n.profile_id]) noteMap[n.profile_id] = n.content?.body || '';
    });
    
    // Collect all tools from all TV records (dedup)
    const tvToolsMap = {};
    tvs.forEach(t => {
      const pid = t.profile_id;
      const toolName = t.content?.ten_cong_cu;
      if (toolName) {
        if (!tvToolsMap[pid]) tvToolsMap[pid] = new Set();
        tvToolsMap[pid].add(toolName);
      }
    });

    // Prepare payload
    const profilesPayload = prs.map(p => {
      const pid = p.id;
      const d = hcMap[pid] || {};    // form_hanh_chinh.data  (t2_* fields)
      const hj = hjMap[pid] || {};   // check_hapja.data (hinh_thuc, ket_noi, concept, ngay_chakki)
      const nddGroup = (typeof staffUnitMap !== 'undefined' && p.ndd_staff_code) ? (staffUnitMap[p.ndd_staff_code] || '') : '';
      const semName = (typeof allSemesters !== 'undefined' && p.semester_id) ? (allSemesters.find(s => s.id === p.semester_id)?.name || '') : '';
      const recentNote = noteMap[pid] || '';
      const tools = (tvToolsMap[pid] ? [...tvToolsMap[pid]].join(', ') : '') || d.t2_cong_cu || '';
      
      return {
        profile_id: pid,
        p: p,
        d: d,   // form_hanh_chinh data (t2_ prefix fields)
        hj: hj, // hapja data (no prefix: hinh_thuc, ket_noi, concept, ngay_chakki)
        recentNote: recentNote,
        tools: tools,
        nddGroup: nddGroup,
        semesterName: semName
      };
    });

    const bodyData = {
      action: 'bulk_sync',
      profiles: profilesPayload
    };

    await fetch(window.HAPJA_SHEET_WEBHOOK, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData)
    });
    
    showToast('✅ Đã đồng bộ Sheet thành công!');
  } catch(e) {
    console.error('Bulk Sync Fail:', e);
    showToast('❌ Lỗi đồng bộ Sheet');
  }
}
