/**
 * Profile Quick Popover Engine - Context-Aware Focus & Quick Action Dock
 * Version: v6.02.0033
 */

(function() {
  'use strict';

  window.openProfileQuickPopover = async function(profileId, contextType, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!profileId) return;
    contextType = contextType || 'overview';

    try {
      // 1. Fetch profile from cache or database
      let profile = null;
      if (window.allProfiles && Array.isArray(window.allProfiles)) {
        profile = window.allProfiles.find(p => String(p.id) === String(profileId));
      }
      if (!profile && window._profilesCache && Array.isArray(window._profilesCache)) {
        profile = window._profilesCache.find(p => String(p.id) === String(profileId));
      }
      
      if (!profile && typeof sbFetch === 'function') {
        try {
          const res = await sbFetch(`/rest/v1/profiles?id=eq.${profileId}&select=*`);
          if (res.ok) {
            const arr = await res.json();
            if (arr && arr[0]) profile = arr[0];
          }
        } catch(e) {
          console.warn('Failed to fetch profile for popover:', e);
        }
      }

      if (!profile) {
        if (typeof openProfileById === 'function') openProfileById(profileId, event);
        return;
      }

      // 2. Fetch sessions, records & form_hanh_chinh for stage intelligence & phone numbers
      let sessions = [];
      let records = [];
      let fhData = {};
      try {
        const [sRes, rRes, fbRes, fhRes] = await Promise.all([
          sbFetch(`/rest/v1/consultation_sessions?profile_id=eq.${profileId}&select=*&order=session_number.asc`),
          sbFetch(`/rest/v1/profile_records?profile_id=eq.${profileId}&select=*&order=created_at.desc`),
          sbFetch(`/rest/v1/records?profile_id=eq.${profileId}&select=*&order=created_at.desc`),
          sbFetch(`/rest/v1/form_hanh_chinh?profile_id=eq.${profileId}&select=data&limit=1`)
        ]);
        if (sRes && sRes.ok) {
          const sArr = await sRes.json();
          if (Array.isArray(sArr)) sessions = sArr;
        }
        let prArr = (rRes && rRes.ok) ? await rRes.json() : [];
        let fbArr = (fbRes && fbRes.ok) ? await fbRes.json() : [];
        if (!Array.isArray(prArr)) prArr = [];
        if (!Array.isArray(fbArr)) fbArr = [];

        const recMap = new Map();
        [...prArr, ...fbArr].forEach(r => { if (r && r.id && !recMap.has(r.id)) recMap.set(r.id, r); });
        records = Array.from(recMap.values()).sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

        let fhArr = (fhRes && fhRes.ok) ? await fhRes.json() : [];
        if (Array.isArray(fhArr) && fhArr[0] && fhArr[0].data) {
          fhData = fhArr[0].data;
        }
      } catch(e) {}

      const recentRecord = records[0] || null;

      // Remove existing popover if any
      const existing = document.getElementById('profileQuickPopoverContainer');
      if (existing) existing.remove();

      // 3. Calculate smart warning chips
      const warningChips = [];
      if (profile.phase === 'bb' && !profile.is_kt_opened) {
        warningChips.push('<span class="chip-warning" style="background:rgba(245,158,11,0.15);color:#d97706;border:1px solid rgba(245,158,11,0.3);padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">📕 Chưa mở KT</span>');
      }
      
      // Check 4 Milestones
      const m1 = profile.has_special_lesson || false;
      const m2 = profile.has_pv_gvbb || false;
      const m3 = profile.has_dk_center || false;
      const m4 = profile.has_pv_hocvien || false;
      const allMilestonesDone = m1 && m2 && m3 && m4;

      if (profile.phase === 'bb' && allMilestonesDone) {
        warningChips.push('<span class="chip-warning" style="background:rgba(34,197,94,0.15);color:#16a34a;border:1px solid rgba(34,197,94,0.3);padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">🎯 Đã đủ 4 Mốc — Sẵn sàng Chốt Center!</span>');
      }

      // Check last record age (> 7 days warning)
      if (recentRecord && recentRecord.created_at) {
        const diffDays = Math.floor((new Date() - new Date(recentRecord.created_at)) / (86400 * 1000));
        if (diffDays > 7 && profile.fruit_status !== 'dropout' && profile.fruit_status !== 'pause') {
          warningChips.push(`<span class="chip-warning" style="background:rgba(239,68,68,0.15);color:#dc2626;border:1px solid rgba(239,68,68,0.3);padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;">⚠️ Chưa có báo cáo > ${diffDays} ngày</span>`);
        }
      }

      // 4. Build Context-Aware Body HTML
      let contextBodyHtml = '';
      const statusLabel = profile.fruit_status === 'dropout' ? '🔴 Drop-out' : profile.fruit_status === 'pause' ? '⏸️ Tạm ngưng' : '🟢 Alive';
      
      const phasePrettyMap = {
        'chakki': '🌱 Chakki',
        'tu_van_hinh': '🧭 TV Hình',
        'tu_van': '🧭 Tư vấn',
        'bb': '📖 BB',
        'center': '🏛️ Center',
        'completed': '🎓 Tốt nghiệp'
      };
      const phaseLabel = phasePrettyMap[profile.phase] || profile.phase || '🌱 Chakki';

      // Resolve NDD & GVBB labels accurately
      const rawNdd = profile.ndd_staff_code || profile.ndd_code || profile.ndd_name || '';
      let nddLabel = 'Chưa gán';
      if (rawNdd) {
        nddLabel = typeof getStaffLabel === 'function' ? getStaffLabel(rawNdd) : rawNdd;
      }

      const rawGvbb = profile.gvbb_staff_code || profile.gvbb_code || '';
      let gvbbLabel = '';
      if (rawGvbb) {
        gvbbLabel = typeof getStaffLabel === 'function' ? getStaffLabel(rawGvbb) : rawGvbb;
      }

      const getRecordContent = r => {
        if (!r) return {};
        let c = r.content || r.data || {};
        if (typeof c === 'string') {
          try { c = JSON.parse(c); } catch(e) { c = {}; }
        }
        return (c && typeof c === 'object') ? c : {};
      };

      const parseNum = val => {
        if (val === null || val === undefined) return null;
        if (typeof val === 'number') return isNaN(val) ? null : val;
        const m = String(val).match(/\d+/);
        return m ? parseInt(m[0], 10) : null;
      };

      // Sessions & TV records lookup
      const tvv1Session = sessions.find(s => parseNum(s.session_number) === 1);
      const tvv2Session = sessions.find(s => parseNum(s.session_number) === 2);
      const tv1Record = records.find(r => ['tu_van','tu_van_hinh'].includes(r.record_type) && parseNum(getRecordContent(r).lan_thu) === 1);
      const tv2Record = records.find(r => ['tu_van','tu_van_hinh'].includes(r.record_type) && parseNum(getRecordContent(r).lan_thu) === 2);

      const formatD = (dStr) => typeof shinDate === 'function' ? shinDate(dStr) : (dStr || '');

      if (contextType === 'calendar') {
        // Focus: Next Appointment & Latest Report
        contextBodyHtml = `
          <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">📅 Lịch hẹn & Nhật ký gần nhất</div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${recentRecord ? (recentRecord.noi_dung || recentRecord.noi_dung_tiep || 'Chưa có thông tin lịch hẹn') : 'Chưa có nhật ký báo cáo mới'}</div>
            ${recentRecord && recentRecord.created_at ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">⏱ Ngày: ${formatD(recentRecord.created_at)}</div>` : ''}
          </div>
        `;
      } else {
        // Focus: Stage Intelligence
        if (['chakki','new'].includes(profile.phase)) {
          const chakkiD = profile.t2_values?.t2_ngay_chakki || profile.chakki_date || (profile.created_at ? formatD(profile.created_at) : 'Chưa cập nhật');
          const tv1Text = tvv1Session
            ? `<span style="color:var(--green);font-weight:700;">✅ ${formatD(tvv1Session.created_at)}</span> (TVV: <b>${escHtml(typeof getStaffLabel === 'function' ? getStaffLabel(tvv1Session.tvv_staff_code) : tvv1Session.tvv_staff_code)}</b>${tvv1Session.tool ? ' · 🛠️ '+tvv1Session.tool : ''})`
            : '<span style="color:#f59e0b;font-weight:600;">⏳ Chưa chốt lịch TV</span>';
          const bc1Text = tv1Record ? '<span style="color:var(--green);font-weight:700;">✅ Đã gửi báo cáo</span>' : '<span style="color:var(--text3);">⚪ Chưa có báo cáo</span>';

          contextBodyHtml = `
            <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:6px;">🌱 GIAI ĐOẠN CHAKKI (HAPJA)</div>
              <div style="font-size:12px;color:var(--text2);display:flex;flex-direction:column;gap:5px;">
                <div>👤 <b>NDD:</b> ${escHtml(nddLabel)}</div>
                <div>📅 <b>Chốt TV 1:</b> ${tv1Text}</div>
                <div>📝 <b>Báo cáo TV 1:</b> ${bc1Text}</div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px;">📆 Ngày Chakki: ${chakkiD}</div>
              </div>
            </div>
          `;
        } else if (['tu_van','tu_van_hinh'].includes(profile.phase)) {
          const tv1Text = tvv1Session
            ? `<b>${escHtml(typeof getStaffLabel === 'function' ? getStaffLabel(tvv1Session.tvv_staff_code) : tvv1Session.tvv_staff_code)}</b> ${tv1Record ? '<span style="color:var(--green);font-weight:700;">(✅ Đã BC)</span>' : '<span style="color:#f59e0b;">(⏳ Chờ BC)</span>'}`
            : '<span style="color:var(--text3);">⚪ Chưa chốt</span>';

          const tv2Text = tvv2Session
            ? `<b>${escHtml(typeof getStaffLabel === 'function' ? getStaffLabel(tvv2Session.tvv_staff_code) : tvv2Session.tvv_staff_code)}</b> ${tv2Record ? '<span style="color:var(--green);font-weight:700;">(✅ Đã BC)</span>' : '<span style="color:#f59e0b;">(⏳ Chờ BC)</span>'}`
            : '<span style="color:var(--text3);">⚪ Chưa chốt</span>';

          contextBodyHtml = `
            <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:6px;">🧭 TIẾN ĐỘ TƯ VẤN</div>
              <div style="font-size:12px;color:var(--text2);display:flex;flex-direction:column;gap:5px;">
                <div>👤 <b>NDD:</b> ${escHtml(nddLabel)}</div>
                <div style="border-top:1px solid var(--border);padding-top:4px;">1️⃣ <b>TV Lần 1:</b> ${tv1Text}</div>
                <div style="border-top:1px dashed var(--border);padding-top:4px;">2️⃣ <b>TV Lần 2:</b> ${tv2Text}</div>
                ${profile.diem_hai ? `<div style="border-top:1px dashed var(--border);padding-top:4px;color:var(--text1);font-weight:600;">🎯 <b>Điểm hái trái:</b> ${escHtml(profile.diem_hai)}</div>` : ''}
              </div>
            </div>
          `;
        } else {
          // BB / Center / Completed Phase
          const progressPercent = Math.min(Math.round(((profile.bb_progress || 0) / 12) * 100), 100);
          contextBodyHtml = `
            <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
              <div style="font-size:11.5px;color:var(--text2);margin-bottom:8px;">
                👤 <b>NDD:</b> ${escHtml(nddLabel)} ${gvbbLabel ? ` | 📖 <b>GVBB:</b> ${escHtml(gvbbLabel)}` : ''}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:700;color:var(--text);">Tiến độ 12 bài BB: ${profile.bb_progress || 0}/12</span>
                <span style="font-size:11px;font-weight:700;color:var(--accent);">${progressPercent}%</span>
              </div>
              <div style="width:100%;height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:10px;">
                <div style="width:${progressPercent}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--green));transition:width 0.3s;"></div>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
                <div style="color:${m1?'var(--green)':'var(--text3)'};font-weight:${m1?'700':'400'};">● Bài ĐB ${m1?'✓':''}</div>
                <div style="color:${m2?'var(--green)':'var(--text3)'};font-weight:${m2?'700':'400'};">● PV GVBB ${m2?'✓':''}</div>
                <div style="color:${m3?'var(--green)':'var(--text3)'};font-weight:${m3?'700':'400'};">● ĐK Center ${m3?'✓':''}</div>
                <div style="color:${m4?'var(--green)':'var(--text3)'};font-weight:${m4?'700':'400'};">● PV Học viên ${m4?'✓':''}</div>
              </div>
            </div>
          `;
        }
      }

      // Phone / Zalo action URL resolution
      let rawPhone = profile.phone || profile.sdt || profile.t2_sdt || fhData.t2_sdt || profile.t2_values?.t2_sdt || '';
      let cleanPhone = String(rawPhone || '').replace(/\D/g, '');
      if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
        cleanPhone = '0' + cleanPhone.slice(2);
      }
      const isValidPhone = /^0[35789]\d{8}$/.test(cleanPhone);
      const zaloActionAttr = isValidPhone 
        ? `href="https://zalo.me/${cleanPhone}" target="_blank"` 
        : `href="javascript:void(0)" onclick="if(typeof showToast==='function') showToast('⚠️ Hồ sơ chưa cập nhật SĐT Zalo hợp lệ')"` ;

      // 5. Create Popover DOM Container
      const popoverOverlay = document.createElement('div');
      popoverOverlay.id = 'profileQuickPopoverContainer';
      popoverOverlay.className = 'quick-popover-overlay';
      popoverOverlay.onclick = function(e) {
        if (e.target === popoverOverlay) closeProfileQuickPopover();
      };

      const birthYearText = profile.birth_year ? ` · ${profile.birth_year}${profile.gender ? ' · '+profile.gender : ''}` : '';

      popoverOverlay.innerHTML = `
        <div class="quick-popover-card glassmorphic-card">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent2));display:flex;align-items:center;justify-content:center;color:white;font-size:18px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.15);">
                ${(profile.full_name || 'H')[0].toUpperCase()}
              </div>
              <div>
                <div style="font-size:15px;font-weight:700;color:var(--text);line-height:1.2;">${escHtml(profile.full_name || 'Chưa tên')}<span style="font-size:12px;color:var(--text3);font-weight:400;">${birthYearText}</span></div>
                <div style="font-size:11px;color:var(--text3);margin-top:2px;display:flex;align-items:center;gap:6px;">
                  <span>${statusLabel}</span>
                  <span>•</span>
                  <span style="font-weight:600;color:var(--accent);">${phaseLabel}</span>
                </div>
              </div>
            </div>
            <button onclick="closeProfileQuickPopover()" style="background:none;border:none;color:var(--text3);font-size:18px;cursor:pointer;padding:4px 8px;">×</button>
          </div>

          ${warningChips.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${warningChips.join('')}</div>` : ''}

          ${contextBodyHtml}

          <!-- Quick Action Dock -->
          <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
            <a ${zaloActionAttr} class="popover-action-btn" style="background:#0068ff;color:white;" title="Mở Zalo">💬 Zalo</a>
            <button onclick="expandToProfileChat('${profile.id}')" class="popover-action-btn" style="background:var(--surface2);color:var(--text);" title="Thảo luận hồ sơ">💬 Chat</button>
            <button onclick="expandToProfileDetail('${profile.id}')" class="popover-action-btn primary" style="flex:1;background:linear-gradient(135deg,var(--accent),var(--accent2));color:white;font-weight:700;">🚀 Chi tiết hồ sơ</button>
          </div>
        </div>
      `;

      document.body.appendChild(popoverOverlay);
      setTimeout(() => {
        popoverOverlay.classList.add('active');
      }, 10);
    } catch(e) {
      console.error('Error in openProfileQuickPopover:', e);
      if (typeof openProfileById === 'function') openProfileById(profileId, event);
    }
  };

  window.closeProfileQuickPopover = function() {
    const el = document.getElementById('profileQuickPopoverContainer');
    if (el) {
      el.classList.remove('active');
      setTimeout(() => el.remove(), 200);
    }
  };

  window.expandToProfileDetail = function(profileId) {
    closeProfileQuickPopover();
    if (typeof openProfileById === 'function') {
      openProfileById(profileId);
    }
  };

  window.expandToProfileChat = function(profileId) {
    closeProfileQuickPopover();
    if (typeof openProfileById === 'function') {
      openProfileById(profileId, null, 'chatTab');
    }
  };

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
