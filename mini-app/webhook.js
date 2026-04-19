// webhook.js
// Handles background data synchronization to Google Sheets Webhook

// Paste Google Apps Script Webhook URL here to enable Google Sheets sync
window.HAPJA_SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbw7M2PaW97SlZquTOEI_VRMR2GZDo1LaQUEkkCih75f2dxGCrNhzDdlXFWqwxDn4Pib_A/exec';

// ── Format helpers ──
// "HCM2 · Nhóm 1 · Tổ 3" → "HCM2 - N1T3"
function formatGroupName(raw) {
  if (!raw) return '';
  const m = raw.match(/^(.+?)\s*[·•-]\s*Nhóm\s*(\d+)\s*[·•-]\s*Tổ\s*(\d+)$/i);
  if (m) return `${m[1].trim()} - N${m[2]}T${m[3]}`;
  return raw; // fallback
}

// "Tháng 5/2026" → "May/Tháng 5",  "Tháng 12/2026" → "Dec/Tháng 12"
function formatSemesterMonth(raw) {
  if (!raw) return '';
  const m = raw.match(/Tháng\s*(\d+)/i);
  if (!m) return raw;
  const monthNum = parseInt(m[1]);
  const engNames = ['', 'Jan', 'Feb', 'Mar', 'April', 'May', 'June', 'July', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const eng = engNames[monthNum] || '';
  return eng ? `${eng}/Tháng ${monthNum}` : raw;
}

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
    
    const rawGroup = (typeof staffUnitMap !== 'undefined' && p.ndd_staff_code) 
                    ? (staffUnitMap[p.ndd_staff_code] || '') : '';
    const nddGroup = formatGroupName(rawGroup);
    const rawSem = (typeof allSemesters !== 'undefined' && p.semester_id)
                    ? (allSemesters.find(s => s.id === p.semester_id)?.name || '') : '';
    const semName = formatSemesterMonth(rawSem);

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

// Delete a profile row from Google Sheet
async function deleteFromSheet(pid) {
  if (!window.HAPJA_SHEET_WEBHOOK || !pid) return;
  try {
    fetch(window.HAPJA_SHEET_WEBHOOK, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', profile_id: pid })
    });
  } catch(e) { console.warn('Delete Sheet Fail:', e); }
}

async function bulkSyncDatabaseToSheet() {
  if (!window.HAPJA_SHEET_WEBHOOK) {
    alert('Chưa cấu hình HAPJA_SHEET_WEBHOOK');
    return;
  }
  if (!confirm('Bạn có chắc chắn muốn Tái đồng bộ toàn bộ dữ liệu xuống Google Sheet? Thao tác này có thể tốn vài chục giây.')) return;
  
  try {
    showToast('⏳ Đang tải toàn bộ dữ liệu để đồng bộ...', 3000);

    // Fetch ALL required data in parallel — do not rely on global state
    const [pRes, hcRes, hjRes, noteRes, tvRes, fgRes, structRes, semRes] = await Promise.all([
      sbFetch(`/rest/v1/profiles?select=*&order=created_at.asc`),
      sbFetch(`/rest/v1/form_hanh_chinh?select=profile_id,data`),
      sbFetch(`/rest/v1/check_hapja?status=eq.approved&select=profile_id,data&order=created_at.asc`),
      sbFetch(`/rest/v1/records?record_type=eq.note&select=profile_id,content,created_at&order=created_at.desc`),
      sbFetch(`/rest/v1/records?record_type=eq.tu_van&select=profile_id,content,created_at&order=created_at.desc`),
      sbFetch(`/rest/v1/fruit_groups?select=profile_id,fruit_roles(staff_code,role_type)`),
      sbFetch(`/rest/v1/areas?select=name,org_groups(name,teams(name,staff:staff!staff_team_id_fkey(staff_code)))`),
      sbFetch(`/rest/v1/semesters?select=id,name&order=created_at.asc`)
    ]);
    
    const prs = await pRes.json();
    const hcs = await hcRes.json();
    const hjs = await hjRes.json();
    const notes = await noteRes.json();
    const tvs = await tvRes.json();
    const fgs = await fgRes.json();
    const structs = await structRes.json();
    const sems = await semRes.json();
    
    // ── Build maps ──
    const hcMap = {}; hcs.forEach(h => hcMap[h.profile_id] = h.data || {});
    const hjMap = {}; hjs.forEach(h => { if (!hjMap[h.profile_id]) hjMap[h.profile_id] = h.data || {}; });
    const semMap = {}; sems.forEach(s => semMap[s.id] = s.name);
    
    // staffUnitMap from fresh structure data
    const freshUnitMap = {};
    (structs || []).forEach(a => {
      (a.org_groups || []).forEach(g => {
        (g.teams || []).forEach(t => {
          (t.staff || []).forEach(m => {
            freshUnitMap[m.staff_code] = `${a.name} · ${g.name} · ${t.name}`;
          });
        });
      });
    });
    
    // GVBB map from fruit_roles per profile
    const gvbbMap = {};
    (fgs || []).forEach(fg => {
      const pid = fg.profile_id;
      (fg.fruit_roles || []).forEach(r => {
        if (r.role_type === 'gvbb' && !gvbbMap[pid]) gvbbMap[pid] = r.staff_code;
      });
    });

    // Latest note per profile
    const noteMap = {}; 
    notes.forEach(n => {
      if (!noteMap[n.profile_id]) noteMap[n.profile_id] = n.content?.body || '';
    });
    
    // Collect all tools from TV records (dedup)
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
      const d = hcMap[pid] || {};
      const hj = hjMap[pid] || {};
      // Use freshly fetched GVBB (fruit_roles) or fall back to profiles field
      const gvbbCode = gvbbMap[pid] || p.gvbb_staff_code || '';
      const nddGroup = formatGroupName(p.ndd_staff_code ? (freshUnitMap[p.ndd_staff_code] || '') : '');
      const semName = formatSemesterMonth(p.semester_id ? (semMap[p.semester_id] || '') : '');
      const recentNote = noteMap[pid] || '';
      const tools = (tvToolsMap[pid] ? [...tvToolsMap[pid]].join(', ') : '') || d.t2_cong_cu || '';
      
      // Inject gvbb into p so Webhook.gs can read p.gvbb_staff_code
      const pWithGvbb = { ...p, gvbb_staff_code: gvbbCode };
      
      return {
        profile_id: pid,
        p: pWithGvbb,
        d: d,
        hj: hj,
        recentNote: recentNote,
        tools: tools,
        nddGroup: nddGroup,
        semesterName: semName
      };
    });

    await fetch(window.HAPJA_SHEET_WEBHOOK, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bulk_sync', profiles: profilesPayload })
    });
    
    showToast('✅ Đã đồng bộ Sheet thành công!');
  } catch(e) {
    console.error('Bulk Sync Fail:', e);
    showToast('❌ Lỗi đồng bộ Sheet');
  }
}
