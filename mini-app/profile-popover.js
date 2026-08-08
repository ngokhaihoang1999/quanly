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
      if (typeof openProfileById === 'function') openProfileById(profileId);
      return;
    }

    // 2. Fetch recent records & notes for context rendering if needed
    let recentRecord = null;
    if (contextType === 'calendar' || contextType === 'overview') {
      try {
        const res = await sbFetch(`/rest/v1/profile_records?profile_id=eq.${profileId}&order=created_at.desc&limit=1`);
        if (res.ok) {
          const rArr = await res.json();
          if (rArr && rArr[0]) recentRecord = rArr[0];
        }
      } catch(e) {}
    }

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
      if (diffDays > 7 && profile.status !== 'drop_out' && profile.status !== 'pause') {
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
      if (typeof getStaffLabel === 'function') {
        nddLabel = getStaffLabel(rawNdd);
      } else {
        nddLabel = rawNdd;
      }
    }

    const rawGvbb = profile.gvbb_staff_code || profile.gvbb_code || '';
    let gvbbLabel = '';
    if (rawGvbb) {
      if (typeof getStaffLabel === 'function') {
        gvbbLabel = getStaffLabel(rawGvbb);
      } else {
        gvbbLabel = rawGvbb;
      }
    }

    if (contextType === 'calendar') {
      // Focus: Next Appointment & Latest Report
      contextBodyHtml = `
        <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">📅 Lịch hẹn & Nhật ký gần nhất</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">${recentRecord ? (recentRecord.noi_dung || recentRecord.noi_dung_tiep || 'Chưa có thông tin lịch hẹn') : 'Chưa có nhật ký báo cáo mới'}</div>
          ${recentRecord && recentRecord.created_at ? `<div style="font-size:11px;color:var(--text3);margin-top:4px;">⏱ Ngày: ${shinDate(recentRecord.created_at)}</div>` : ''}
        </div>
      `;
    } else if (contextType === 'homework') {
      // Focus: BTVN & Progress
      contextBodyHtml = `
        <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
          <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">📚 Bài Tập & Tiến Độ</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);">${profile.phase === 'bb' || profile.phase === 'center' ? `Tiến độ BB: ${profile.bb_progress || 0}/12 bài` : `Giai đoạn: ${phaseLabel}`}</div>
          ${profile.diem_hai ? `<div style="font-size:11.5px;color:var(--text2);margin-top:4px;">🎯 Điểm hái trái: ${escHtml(profile.diem_hai)}</div>` : ''}
        </div>
      `;
    } else {
      // Focus: Overview (Phase-Accurate display)
      if (['chakki','new'].includes(profile.phase)) {
        const chakkiD = profile.t2_values?.t2_ngay_chakki || profile.chakki_date || (profile.created_at ? shinDate(profile.created_at) : 'Chưa cập nhật');
        contextBodyHtml = `
          <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">🌱 GIAI ĐOẠN CHAKKI (HAPJA)</div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">Đang tìm hiểu & tiếp cận ban đầu</div>
            <div style="font-size:11.5px;color:var(--text2);margin-top:6px;display:flex;flex-direction:column;gap:3px;">
              <div>👤 <b>NDD:</b> ${escHtml(nddLabel)}</div>
              <div>📅 <b>Ngày Chakki:</b> ${chakkiD}</div>
            </div>
          </div>
        `;
      } else if (['tu_van','tu_van_hinh'].includes(profile.phase)) {
        contextBodyHtml = `
          <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
            <div style="font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;margin-bottom:4px;">🧭 GIAI ĐOẠN TƯ VẤN</div>
            <div style="font-size:13px;font-weight:600;color:var(--text);">${recentRecord ? (recentRecord.noi_dung || recentRecord.ten_cong_cu || 'Đang trong quá trình tư vấn') : 'Đang hẹn tư vấn'}</div>
            <div style="font-size:11.5px;color:var(--text2);margin-top:6px;display:flex;flex-direction:column;gap:3px;">
              <div>👤 <b>NDD:</b> ${escHtml(nddLabel)}</div>
              ${profile.diem_hai ? `<div>🎯 <b>Điểm hái trái:</b> ${escHtml(profile.diem_hai)}</div>` : ''}
              ${recentRecord && recentRecord.created_at ? `<div>⏱ <b>Nhật ký gần nhất:</b> ${shinDate(recentRecord.created_at)}</div>` : ''}
            </div>
          </div>
        `;
      } else {
        // BB / Center / Completed Phase: Show 12 BB progress bar + 4 milestones
        const progressPercent = Math.min(Math.round(((profile.bb_progress || 0) / 12) * 100), 100);
        contextBodyHtml = `
          <div style="background:var(--surface2);border-radius:10px;padding:10px 12px;border:1px solid var(--border);margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <span style="font-size:12px;font-weight:700;color:var(--text);">Tiến độ 12 bài BB: ${profile.bb_progress || 0}/12</span>
              <span style="font-size:11px;font-weight:700;color:var(--accent);">${progressPercent}%</span>
            </div>
            <div style="width:100%;height:6px;background:var(--border);border-radius:4px;overflow:hidden;margin-bottom:10px;">
              <div style="width:${progressPercent}%;height:100%;background:linear-gradient(90deg,var(--accent),var(--green));transition:width 0.3s;"></div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;">
              <div style="color:${m1?'var(--green)':'var(--text3)'};">● Bài ĐB ${m1?'✓':''}</div>
              <div style="color:${m2?'var(--green)':'var(--text3)'};">● PV GVBB ${m2?'✓':''}</div>
              <div style="color:${m3?'var(--green)':'var(--text3)'};">● ĐK Center ${m3?'✓':''}</div>
              <div style="color:${m4?'var(--green)':'var(--text3)'};">● PV Học viên ${m4?'✓':''}</div>
            </div>
          </div>
        `;
      }
    }

    // Phone / Zalo action URL
    const cleanPhone = (profile.phone || profile.phone_number || '').replace(/\D/g, '');
    const zaloUrl = cleanPhone ? `https://zalo.me/${cleanPhone}` : null;
    const phoneCallUrl = cleanPhone ? `tel:${cleanPhone}` : null;

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

        <div style="font-size:11.5px;color:var(--text2);margin-bottom:12px;line-height:1.5;">
          👤 NDD: <b>${escHtml(nddLabel)}</b> ${gvbbLabel ? ` | 📖 GVBB: <b>${escHtml(gvbbLabel)}</b>` : ''}
        </div>

        <!-- Quick Action Dock -->
        <div style="display:flex;gap:8px;align-items:center;">
          ${zaloUrl ? `<a href="${zaloUrl}" target="_blank" class="popover-action-btn" style="background:#0068ff;color:white;" title="Mở Zalo">💬 Zalo</a>` : ''}
          ${phoneCallUrl ? `<a href="${phoneCallUrl}" class="popover-action-btn" style="background:var(--surface2);color:var(--text);" title="Gọi điện">📞 Gọi</a>` : ''}
          <button onclick="openFloatingChat('${profile.id}')" class="popover-action-btn" style="background:var(--surface2);color:var(--text);" title="Chat nhóm">💬 Chat</button>
          <button onclick="expandToProfileDetail('${profile.id}')" class="popover-action-btn primary" style="flex:1;background:linear-gradient(135deg,var(--accent),var(--accent2));color:white;font-weight:700;">🚀 Chi tiết hồ sơ</button>
        </div>
      </div>
    `;

    document.body.appendChild(popoverOverlay);
    setTimeout(() => {
      popoverOverlay.classList.add('active');
    }, 10);
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

  function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

})();
