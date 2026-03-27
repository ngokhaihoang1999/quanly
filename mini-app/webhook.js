// webhook.js
// Handles background data synchronization to Google Sheets Webhook

// Paste Google Apps Script Webhook URL here to enable Google Sheets sync
window.HAPJA_SHEET_WEBHOOK = 'https://script.google.com/macros/s/AKfycbw7M2PaW97SlZquTOEI_VRMR2GZDo1LaQUEkkCih75f2dxGCrNhzDdlXFWqwxDn4Pib_A/exec';

// Global background syncer to Google Sheets
async function syncToGoogleSheet(pid) {
  if (!window.HAPJA_SHEET_WEBHOOK || !pid) return; // Prevent errors if no webhook or pid
  try {
    // Load full profile, form data, and recent records
    const [pRes, hcRes, noteRes, tvRes] = await Promise.all([
      sbFetch(`/rest/v1/profiles?id=eq.${pid}&select=*`),
      sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${pid}&select=data`),
      sbFetch(`/rest/v1/records?profile_id=eq.${pid}&record_type=eq.note&select=content&order=created_at.desc&limit=1`),
      sbFetch(`/rest/v1/records?profile_id=eq.${pid}&record_type=eq.tu_van&select=content&order=created_at.desc&limit=5`)
    ]);
    const prs = await pRes.json(), hcs = await hcRes.json();
    const notes = await noteRes.json(), tvs = await tvRes.json();
    
    if (!prs || !prs.length) return;
    const p = prs[0];
    const d = hcs[0]?.data || {}; 
    const recentNote = notes[0]?.content?.body || ''; // latest short note
    const tools = tvs.map(r => r.content?.ten_cong_cu).filter(Boolean).join(', '); // all tools from TV
    
    // Calculate NDD Group from staffUnitMap
    const nddGroup = (typeof staffUnitMap !== 'undefined' && p.ndd_staff_code) 
                    ? (staffUnitMap[p.ndd_staff_code] || '') 
                    : '';

    fetch(window.HAPJA_SHEET_WEBHOOK, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        action: 'upsert',
        profile_id: pid, 
        p: p, 
        d: d,
        recentNote: recentNote,
        tools: tools || d.t2_cong_cu || '',
        nddGroup: nddGroup
      })
    });
  } catch(e) { console.warn('Sync Sheet Fail:', e); }
}
