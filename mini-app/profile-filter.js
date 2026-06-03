// ============ PROFILE FILTER MODULE ============
// Advanced Excel-like filtering for profile lists
// Depends on: allProfiles, allStaff, structureData, allSemesters, sbFetch, renderProfileCard, _rptCache (from reports.js)

(function() {
  'use strict';

  // ── Filter state ──
  const _pfState = {
    phase: [],        // ['chakki','bb',...]
    status: [],       // ['alive','dropout','pause']
    ndd: [],          // ['000142-NKH',...]
    tvv: [],
    gvbb: [],
    kt: null,         // true/false/null (all)
    semester: null,    // semester id
    unit: null,       // { codes: [...] }
    gender: [],
    birthFrom: '',
    birthTo: '',
    tools: [],        // ['Enneagram',...]
    concept: '',      // text search
    tonGiao: [],
    honNhan: [],
    activity: null,   // 7/14/30 (days idle)
    chakkiFrom: '',
    chakkiTo: '',
    dkCenter: null,   // true/false/null
  };

  // ── Enriched data cache ──
  let _pfEnriched = null;    // Map<profileId, { tools, concept, tonGiao, honNhan, ngayChakki, hasDKCenter }>
  let _pfLoading = false;
  let _pfResults = [];

  // ── Load enriched data (lazy, called once) ──
  async function _pfLoadEnrichedData() {
    if (_pfEnriched) return;
    if (_pfLoading) return;
    _pfLoading = true;

    try {
      const [hcRes, tvRes, dkRes] = await Promise.all([
        sbFetch('/rest/v1/form_hanh_chinh?select=profile_id,data'),
        sbFetch('/rest/v1/records?record_type=eq.tu_van&select=profile_id,content&order=created_at.desc'),
        sbFetch('/rest/v1/records?record_type=eq.chot_center&select=profile_id&order=created_at.desc'),
      ]);

      const hcData = await hcRes.json();
      const tvData = await tvRes.json();
      const dkData = await dkRes.json();

      _pfEnriched = new Map();

      // form_hanh_chinh data
      (hcData || []).forEach(h => {
        const d = h.data || {};
        _pfEnriched.set(h.profile_id, {
          concept: d.t2_concept || '',
          tonGiao: Array.isArray(d.t2_ton_giao) ? d.t2_ton_giao : (d.t2_ton_giao ? [d.t2_ton_giao] : []),
          honNhan: Array.isArray(d.t2_hon_nhan) ? d.t2_hon_nhan : (d.t2_hon_nhan ? [d.t2_hon_nhan] : []),
          ngayChakki: d.t2_ngay_chakki || '',
          tools: new Set(),
          hasDKCenter: false,
        });
      });

      // TV records — extract unique tools per profile
      (tvData || []).forEach(r => {
        const toolName = r.content?.ten_cong_cu;
        if (!toolName) return;
        if (!_pfEnriched.has(r.profile_id)) {
          _pfEnriched.set(r.profile_id, { concept: '', tonGiao: [], honNhan: [], ngayChakki: '', tools: new Set(), hasDKCenter: false });
        }
        _pfEnriched.get(r.profile_id).tools.add(toolName);
      });

      // DK Center records
      const dkPids = new Set();
      (dkData || []).forEach(r => dkPids.add(r.profile_id));
      dkPids.forEach(pid => {
        if (_pfEnriched.has(pid)) {
          _pfEnriched.get(pid).hasDKCenter = true;
        } else {
          _pfEnriched.set(pid, { concept: '', tonGiao: [], honNhan: [], ngayChakki: '', tools: new Set(), hasDKCenter: true });
        }
      });

    } catch (e) {
      console.error('Profile filter: enriched data load error', e);
    } finally {
      _pfLoading = false;
    }
  }

  // ── Get scope-filtered profiles ──
  function _pfGetScopeProfiles() {
    if (!_rptCache) {
      // Fallback: use allProfiles directly
      return (allProfiles || []).slice();
    }
    return Array.from(_rptCache.profileMap.values());
  }

  // ── Get all unique values for a field ──
  function _pfGetUniqueValues(field) {
    const profiles = _pfGetScopeProfiles();
    const vals = new Map(); // value → count

    profiles.forEach(p => {
      let v;
      if (field === 'ndd') {
        v = p.ndd_staff_code || p.ndd || '';
      } else if (field === 'phase') {
        v = p.phase || 'chakki';
      } else if (field === 'status') {
        v = p.fruit_status || 'alive';
      } else if (field === 'gender') {
        v = p.gender || '';
      } else if (field === 'tvv') {
        const codes = (p.tvv_staff_code || '').split(',').map(c => c.trim()).filter(Boolean);
        codes.forEach(c => { vals.set(c, (vals.get(c) || 0) + 1); });
        return;
      } else if (field === 'gvbb') {
        const code = p.gvbb_staff_code || '';
        if (code) vals.set(code, (vals.get(code) || 0) + 1);
        return;
      } else if (field === 'tools') {
        const en = _pfEnriched?.get(p.id);
        if (en && en.tools) {
          en.tools.forEach(t => { vals.set(t, (vals.get(t) || 0) + 1); });
        }
        return;
      } else if (field === 'concept') {
        const en = _pfEnriched?.get(p.id);
        v = en?.concept || '';
      } else if (field === 'tonGiao') {
        const en = _pfEnriched?.get(p.id);
        (en?.tonGiao || []).forEach(t => { if (t) vals.set(t, (vals.get(t) || 0) + 1); });
        return;
      } else if (field === 'honNhan') {
        const en = _pfEnriched?.get(p.id);
        (en?.honNhan || []).forEach(t => { if (t) vals.set(t, (vals.get(t) || 0) + 1); });
        return;
      }
      if (v) vals.set(v, (vals.get(v) || 0) + 1);
    });
    return vals;
  }

  // ── Apply all filters (AND logic) ──
  function _pfApply() {
    const profiles = _pfGetScopeProfiles();
    const s = _pfState;
    const now = Date.now();
    const DAY = 86400000;

    _pfResults = profiles.filter(p => {
      // Phase
      if (s.phase.length > 0 && !s.phase.includes(p.phase || 'chakki')) return false;

      // Status
      if (s.status.length > 0 && !s.status.includes(p.fruit_status || 'alive')) return false;

      // NDD
      if (s.ndd.length > 0 && !s.ndd.includes(p.ndd_staff_code || p.ndd || '')) return false;

      // TVV
      if (s.tvv.length > 0) {
        const tvvCodes = (p.tvv_staff_code || '').split(',').map(c => c.trim()).filter(Boolean);
        if (!s.tvv.some(c => tvvCodes.includes(c))) return false;
      }

      // GVBB
      if (s.gvbb.length > 0) {
        const gvbbCode = p.gvbb_staff_code || '';
        if (!s.gvbb.includes(gvbbCode)) return false;
      }

      // KT
      if (s.kt !== null) {
        if (s.kt && !p.is_kt_opened) return false;
        if (s.kt === false && p.is_kt_opened) return false;
      }

      // Semester
      if (s.semester && p.semester_id !== s.semester) return false;

      // Unit (staff codes filter)
      if (s.unit) {
        const ndd = p.ndd_staff_code || p.ndd || '';
        if (!s.unit.codes.includes(ndd)) return false;
      }

      // Gender
      if (s.gender.length > 0) {
        const g = p.gender || '';
        if (g && !s.gender.includes(g)) return false;
        if (!g && !s.gender.includes('')) return false;
      }

      // Birth year range
      if (s.birthFrom || s.birthTo) {
        const by = parseInt(p.birth_year) || 0;
        if (s.birthFrom && by < parseInt(s.birthFrom)) return false;
        if (s.birthTo && by > parseInt(s.birthTo)) return false;
      }

      // Enriched data filters
      const en = _pfEnriched?.get(p.id);

      // Tools (Công cụ TV)
      if (s.tools.length > 0) {
        if (!en || !en.tools || !s.tools.some(t => en.tools.has(t))) return false;
      }

      // Concept
      if (s.concept) {
        const concept = (en?.concept || '').toLowerCase();
        if (!concept.includes(s.concept.toLowerCase())) return false;
      }

      // Tôn giáo
      if (s.tonGiao.length > 0) {
        if (!en || !s.tonGiao.some(t => en.tonGiao.includes(t))) return false;
      }

      // Hôn nhân
      if (s.honNhan.length > 0) {
        if (!en || !s.honNhan.some(t => en.honNhan.includes(t))) return false;
      }

      // Activity recency
      if (s.activity) {
        const recs = _rptCache?.recMap?.[p.id] || [];
        const sess = _rptCache?.sessMap?.[p.id] || [];
        const allDates = [...recs.map(r => new Date(r.created_at).getTime()), ...sess.map(ss => new Date(ss.created_at).getTime())];
        const last = allDates.length > 0 ? Math.max(...allDates) : (p.created_at ? new Date(p.created_at).getTime() : 0);
        const daysSince = last ? Math.floor((now - last) / DAY) : 999;
        if (daysSince < s.activity) return false;
      }

      // Ngày Chakki range
      if (s.chakkiFrom || s.chakkiTo) {
        const ck = en?.ngayChakki || '';
        if (!ck) return false;
        if (s.chakkiFrom && ck < s.chakkiFrom) return false;
        if (s.chakkiTo && ck > s.chakkiTo) return false;
      }

      // ĐK Center
      if (s.dkCenter !== null) {
        const has = en?.hasDKCenter || false;
        if (s.dkCenter && !has) return false;
        if (s.dkCenter === false && has) return false;
      }

      return true;
    });
  }

  // ── Count active filters ──
  function _pfActiveCount() {
    const s = _pfState;
    let c = 0;
    if (s.phase.length) c++;
    if (s.status.length) c++;
    if (s.ndd.length) c++;
    if (s.tvv.length) c++;
    if (s.gvbb.length) c++;
    if (s.kt !== null) c++;
    if (s.semester) c++;
    if (s.unit) c++;
    if (s.gender.length) c++;
    if (s.birthFrom || s.birthTo) c++;
    if (s.tools.length) c++;
    if (s.concept) c++;
    if (s.tonGiao.length) c++;
    if (s.honNhan.length) c++;
    if (s.activity) c++;
    if (s.chakkiFrom || s.chakkiTo) c++;
    if (s.dkCenter !== null) c++;
    return c;
  }

  // ── Staff display name helper ──
  function _pfStaffName(code) {
    if (!code) return '';
    const s = (allStaff || []).find(x => x.staff_code === code);
    return s ? (s.nickname || s.full_name || code) : code;
  }

  // ══════════════════════════════════════
  // UI RENDERING
  // ══════════════════════════════════════

  // ── Main section renderer (called from reports.js) ──
  window._pfRenderSection = async function(containerEl) {
    if (!containerEl) return;

    // Load enriched data in background
    await _pfLoadEnrichedData();

    // Apply current filters
    _pfApply();

    const totalScope = _pfGetScopeProfiles().length;
    const filtered = _pfResults.length;
    const hasFilters = _pfActiveCount() > 0;

    // ── Build filter chips ──
    const FILTER_DEFS = [
      { key: 'phase', label: '📋 Giai đoạn', icon: '📋' },
      { key: 'status', label: '🔵 Trạng thái', icon: '🔵' },
      { key: 'ndd', label: '👤 NDD', icon: '👤' },
      { key: 'unit', label: '🏢 Đơn vị', icon: '🏢' },
      { key: 'tools', label: '🔧 CC Tư vấn', icon: '🔧' },
      { key: 'concept', label: '💡 Concept', icon: '💡' },
      { key: 'tvv', label: '💬 TVV', icon: '💬' },
      { key: 'gvbb', label: '🎓 GVBB', icon: '🎓' },
      { key: 'kt', label: '📖 Mở KT', icon: '📖' },
      { key: 'semester', label: '📅 Kỳ KG', icon: '📅' },
      { key: 'gender', label: '⚤ Giới tính', icon: '⚤' },
      { key: 'birthYear', label: '🎂 Năm sinh', icon: '🎂' },
      { key: 'activity', label: '😴 Nhàn rỗi', icon: '😴' },
      { key: 'tonGiao', label: '🙏 Tôn giáo', icon: '🙏' },
      { key: 'honNhan', label: '💍 Hôn nhân', icon: '💍' },
      { key: 'chakkiDate', label: '📆 Ngày CK', icon: '📆' },
      { key: 'dkCenter', label: '🏛️ ĐK Center', icon: '🏛️' },
    ];

    function isChipActive(key) {
      const s = _pfState;
      if (key === 'phase') return s.phase.length > 0;
      if (key === 'status') return s.status.length > 0;
      if (key === 'ndd') return s.ndd.length > 0;
      if (key === 'tvv') return s.tvv.length > 0;
      if (key === 'gvbb') return s.gvbb.length > 0;
      if (key === 'kt') return s.kt !== null;
      if (key === 'semester') return !!s.semester;
      if (key === 'unit') return !!s.unit;
      if (key === 'gender') return s.gender.length > 0;
      if (key === 'birthYear') return !!(s.birthFrom || s.birthTo);
      if (key === 'tools') return s.tools.length > 0;
      if (key === 'concept') return !!s.concept;
      if (key === 'tonGiao') return s.tonGiao.length > 0;
      if (key === 'honNhan') return s.honNhan.length > 0;
      if (key === 'activity') return !!s.activity;
      if (key === 'chakkiDate') return !!(s.chakkiFrom || s.chakkiTo);
      if (key === 'dkCenter') return s.dkCenter !== null;
      return false;
    }

    const chipsHtml = FILTER_DEFS.map(f =>
      `<div class="pf-chip ${isChipActive(f.key) ? 'active' : ''}" onclick="_pfOpenFilter('${f.key}')">${f.label} <span class="pf-chip-arrow">▼</span></div>`
    ).join('');

    // ── Build active tags ──
    let tagsHtml = '';
    const s = _pfState;
    const PHASE_NAMES = { new: 'Mới', chakki: 'Chakki', tu_van_hinh: 'TV Hình', tu_van: 'Tư Vấn', bb: 'BB', center: 'Center', completed: 'Hoàn thành' };
    const STATUS_NAMES = { alive: 'Alive', dropout: 'Dropout', pause: 'Pause' };

    if (s.phase.length) tagsHtml += _pfTagHtml('Giai đoạn', s.phase.map(p => PHASE_NAMES[p] || p).join(', '), () => { s.phase = []; _pfRefresh(); });
    if (s.status.length) tagsHtml += _pfTagHtml('Trạng thái', s.status.map(p => STATUS_NAMES[p] || p).join(', '), () => { s.status = []; _pfRefresh(); });
    if (s.ndd.length) tagsHtml += _pfTagHtml('NDD', s.ndd.map(c => _pfStaffName(c)).join(', '), () => { s.ndd = []; _pfRefresh(); });
    if (s.tvv.length) tagsHtml += _pfTagHtml('TVV', s.tvv.map(c => _pfStaffName(c)).join(', '), () => { s.tvv = []; _pfRefresh(); });
    if (s.gvbb.length) tagsHtml += _pfTagHtml('GVBB', s.gvbb.map(c => _pfStaffName(c)).join(', '), () => { s.gvbb = []; _pfRefresh(); });
    if (s.kt !== null) tagsHtml += _pfTagHtml('KT', s.kt ? 'Đã mở' : 'Chưa mở', () => { s.kt = null; _pfRefresh(); });
    if (s.semester) {
      const semName = (allSemesters || []).find(x => x.id === s.semester)?.name || s.semester;
      tagsHtml += _pfTagHtml('Kỳ KG', semName, () => { s.semester = null; _pfRefresh(); });
    }
    if (s.unit) tagsHtml += _pfTagHtml('Đơn vị', s.unit.label || 'Đã chọn', () => { s.unit = null; _pfRefresh(); });
    if (s.gender.length) tagsHtml += _pfTagHtml('Giới tính', s.gender.join(', '), () => { s.gender = []; _pfRefresh(); });
    if (s.birthFrom || s.birthTo) tagsHtml += _pfTagHtml('Năm sinh', `${s.birthFrom || '?'} – ${s.birthTo || '?'}`, () => { s.birthFrom = ''; s.birthTo = ''; _pfRefresh(); });
    if (s.tools.length) tagsHtml += _pfTagHtml('CC TV', s.tools.join(', '), () => { s.tools = []; _pfRefresh(); });
    if (s.concept) tagsHtml += _pfTagHtml('Concept', s.concept, () => { s.concept = ''; _pfRefresh(); });
    if (s.tonGiao.length) tagsHtml += _pfTagHtml('Tôn giáo', s.tonGiao.join(', '), () => { s.tonGiao = []; _pfRefresh(); });
    if (s.honNhan.length) tagsHtml += _pfTagHtml('Hôn nhân', s.honNhan.join(', '), () => { s.honNhan = []; _pfRefresh(); });
    if (s.activity) tagsHtml += _pfTagHtml('Nhàn rỗi', `>${s.activity} ngày`, () => { s.activity = null; _pfRefresh(); });
    if (s.chakkiFrom || s.chakkiTo) tagsHtml += _pfTagHtml('Ngày CK', `${s.chakkiFrom || '?'} – ${s.chakkiTo || '?'}`, () => { s.chakkiFrom = ''; s.chakkiTo = ''; _pfRefresh(); });
    if (s.dkCenter !== null) tagsHtml += _pfTagHtml('ĐK Center', s.dkCenter ? 'Đã ĐK' : 'Chưa ĐK', () => { s.dkCenter = null; _pfRefresh(); });

    // ── Build results ──
    const MAX_SHOW = 50;
    const showProfiles = _pfResults.slice(0, MAX_SHOW);
    let resultsHtml = '';
    if (hasFilters) {
      if (_pfResults.length === 0) {
        resultsHtml = '<div class="pf-empty">🔍 Không tìm thấy hồ sơ nào phù hợp</div>';
      } else {
        resultsHtml = showProfiles.map(p => {
          const fullP = (allProfiles || []).find(x => x.id === p.id) || p;
          const nddC = fullP.ndd_staff_code || '';
          const tvvC = fullP.tvv_staff_code || '';
          const gvbbC = fullP.gvbb_staff_code || '';

          // Extra badges: concept + tool
          let extras = '';
          const en = _pfEnriched?.get(p.id);
          if (en?.concept) {
            extras += `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:6px;background:rgba(245,158,11,0.12);color:#d97706;margin-left:2px;">💡 ${_pfTruncate(en.concept, 15)}</span>`;
          }
          if (en?.tools?.size) {
            extras += `<span style="font-size:9px;font-weight:600;padding:2px 6px;border-radius:6px;background:rgba(99,102,241,0.1);color:var(--accent);margin-left:2px;">🔧 ${_pfTruncate([...en.tools].join(', '), 20)}</span>`;
          }

          return renderProfileCard(fullP, {
            profileId: fullP.id,
            ndd: nddC, tvv: tvvC, gvbb: gvbbC,
            extraBadges: extras
          });
        }).join('');

        if (_pfResults.length > MAX_SHOW) {
          resultsHtml += `<div style="text-align:center;padding:12px;color:var(--text3);font-size:12px;font-weight:600;">... và ${_pfResults.length - MAX_SHOW} hồ sơ khác</div>`;
        }
      }
    }

    // ── Summary bar ──
    const summaryHtml = hasFilters ? `
      <div class="pf-summary">
        <div class="pf-summary-text">📊 ${filtered}/${totalScope} hồ sơ</div>
        <div class="pf-summary-actions">
          <button class="pf-export-btn" onclick="_pfExportCSV()">📥 CSV</button>
          <button class="pf-export-btn" onclick="_pfCopyList()">📋 Copy</button>
          <button class="pf-export-btn" onclick="_pfClearAll()" style="color:var(--red);border-color:rgba(239,68,68,0.3);">✕ Xoá lọc</button>
        </div>
      </div>` : '';

    // ── Full HTML ──
    containerEl.innerHTML = `
      <div class="pf-section">
        <div class="rpt-title" onclick="const el=document.getElementById('pfBody');el.style.display=el.style.display==='none'?'block':'none'">
          🔍 LỌC HỒ SƠ CHI TIẾT
          ${hasFilters ? `<span class="rpt-badge rpt-badge-green">${_pfActiveCount()} bộ lọc</span>` : ''}
          <span style="font-size:10px;color:var(--text3);margin-left:auto;">${totalScope} hồ sơ trong scope</span>
        </div>
        <div id="pfBody">
          <div class="pf-bar">${chipsHtml}</div>
          ${tagsHtml ? `<div class="pf-tags" id="pfTags">${tagsHtml}</div>` : ''}
          ${summaryHtml}
          <div class="pf-results" id="pfResults">${resultsHtml}</div>
        </div>
      </div>`;
  };

  // ── Tag HTML helper ──
  function _pfTagHtml(label, value, onRemove) {
    const tagId = 'pftag_' + Math.random().toString(36).slice(2, 8);
    // Store callback
    window['_pfRm_' + tagId] = function() { onRemove(); };
    return `<span class="pf-tag"><b>${label}:</b>&nbsp;${_pfTruncate(value, 25)}<span class="pf-tag-x" onclick="event.stopPropagation();_pfRm_${tagId}()">✕</span></span>`;
  }

  function _pfTruncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  // ── Refresh after filter change ──
  function _pfRefresh() {
    _pfApply();
    const el = document.getElementById('pfFilterContainer');
    if (el) window._pfRenderSection(el);
  }
  window._pfRefresh = _pfRefresh;

  // ══════════════════════════════════════
  // FILTER DROPDOWNS
  // ══════════════════════════════════════

  window._pfOpenFilter = function(key) {
    if (typeof haptic === 'function') haptic('selection');

    // Remove existing overlay
    const existing = document.getElementById('pfOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pfOverlay';
    overlay.className = 'pf-dropdown-overlay';
    document.body.appendChild(overlay);

    // Close on backdrop click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _pfCloseDropdown();
    });

    let content = '';

    if (key === 'phase') {
      content = _pfBuildMultiSelect('Giai đoạn', [
        { val: 'chakki', label: '🟡 Chakki' },
        { val: 'tu_van_hinh', label: '🖼️ TV Hình' },
        { val: 'tu_van', label: '💬 Tư Vấn' },
        { val: 'bb', label: '🎓 BB' },
        { val: 'center', label: '🏛️ Center' },
        { val: 'completed', label: '✅ Hoàn thành' },
      ], _pfState.phase, sel => { _pfState.phase = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'status') {
      content = _pfBuildMultiSelect('Trạng thái', [
        { val: 'alive', label: '🟢 Alive' },
        { val: 'dropout', label: '🔴 Dropout' },
        { val: 'pause', label: '⏸️ Pause' },
      ], _pfState.status, sel => { _pfState.status = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'ndd' || key === 'tvv' || key === 'gvbb') {
      const vals = _pfGetUniqueValues(key);
      const items = [...vals.entries()].map(([code, count]) => ({
        val: code, label: _pfStaffName(code), count
      })).sort((a, b) => b.count - a.count);
      content = _pfBuildSearchSelect(key === 'ndd' ? 'NDD' : key === 'tvv' ? 'TVV' : 'GVBB', items, _pfState[key], sel => { _pfState[key] = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'tools') {
      const vals = _pfGetUniqueValues('tools');
      const items = [...vals.entries()].map(([t, count]) => ({
        val: t, label: t, count
      })).sort((a, b) => b.count - a.count);
      content = _pfBuildSearchSelect('Công cụ Tư vấn', items, _pfState.tools, sel => { _pfState.tools = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'concept') {
      content = _pfBuildTextSearch('Concept / Chủ đề', _pfState.concept, val => { _pfState.concept = val; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'kt') {
      content = _pfBuildToggle('Mở Kinh Thánh', _pfState.kt, val => { _pfState.kt = val; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'dkCenter') {
      content = _pfBuildToggle('ĐK Center', _pfState.dkCenter, val => { _pfState.dkCenter = val; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'semester') {
      const items = (allSemesters || []).map(s => ({ val: s.id, label: s.name, count: 0 }));
      content = _pfBuildSearchSelect('Kỳ Khai Giảng', items, _pfState.semester ? [_pfState.semester] : [], sel => { _pfState.semester = sel[0] || null; _pfCloseDropdown(); _pfRefresh(); }, true);
    } else if (key === 'unit') {
      content = _pfBuildUnitSelect();
    } else if (key === 'gender') {
      const vals = _pfGetUniqueValues('gender');
      const items = [...vals.entries()].map(([g, count]) => ({
        val: g, label: g || 'Không rõ', count
      }));
      content = _pfBuildMultiSelect('Giới tính', items.map(i => ({ val: i.val, label: i.label })), _pfState.gender, sel => { _pfState.gender = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'birthYear') {
      content = _pfBuildRangeInput('Năm sinh', _pfState.birthFrom, _pfState.birthTo, 'number', '1970', '2010', (from, to) => { _pfState.birthFrom = from; _pfState.birthTo = to; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'activity') {
      content = _pfBuildMultiSelect('Nhàn rỗi (ngày)', [
        { val: '7', label: '> 7 ngày không HĐ' },
        { val: '14', label: '> 14 ngày không HĐ' },
        { val: '30', label: '> 30 ngày không HĐ' },
        { val: '60', label: '> 60 ngày không HĐ' },
      ], _pfState.activity ? [String(_pfState.activity)] : [], sel => { _pfState.activity = sel.length ? parseInt(sel[0]) : null; _pfCloseDropdown(); _pfRefresh(); }, true);
    } else if (key === 'tonGiao') {
      const vals = _pfGetUniqueValues('tonGiao');
      const items = [...vals.entries()].map(([t, count]) => ({ val: t, label: t, count }));
      content = _pfBuildMultiSelect('Tôn giáo', items.map(i => ({ val: i.val, label: i.label })), _pfState.tonGiao, sel => { _pfState.tonGiao = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'honNhan') {
      const vals = _pfGetUniqueValues('honNhan');
      const items = [...vals.entries()].map(([t, count]) => ({ val: t, label: t, count }));
      content = _pfBuildMultiSelect('Hôn nhân', items.map(i => ({ val: i.val, label: i.label })), _pfState.honNhan, sel => { _pfState.honNhan = sel; _pfCloseDropdown(); _pfRefresh(); });
    } else if (key === 'chakkiDate') {
      content = _pfBuildRangeInput('Ngày Chakki', _pfState.chakkiFrom, _pfState.chakkiTo, 'date', '', '', (from, to) => { _pfState.chakkiFrom = from; _pfState.chakkiTo = to; _pfCloseDropdown(); _pfRefresh(); });
    }

    overlay.innerHTML = `<div class="pf-dropdown">${content}</div>`;

    // Animate open
    requestAnimationFrame(() => overlay.classList.add('open'));
  };

  function _pfCloseDropdown() {
    const overlay = document.getElementById('pfOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 300);
  }
  window._pfCloseDropdown = _pfCloseDropdown;

  // ── Multi-select builder ──
  function _pfBuildMultiSelect(title, items, selected, onApply, singleSelect) {
    const selSet = new Set(selected);
    const cbId = '_pfms_' + Math.random().toString(36).slice(2, 6);

    // Store state
    window[cbId] = { selected: new Set(selSet), onApply, singleSelect };

    const optionsHtml = items.map(item =>
      `<div class="pf-option ${selSet.has(item.val) ? 'selected' : ''}" onclick="_pfToggleOption(this,'${cbId}','${item.val.replace(/'/g, "\\'")}'${singleSelect ? ',true' : ''})">
        <div class="pf-option-check">✓</div>
        <div class="pf-option-label">${item.label}</div>
      </div>`
    ).join('');

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">${title}</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <div class="pf-options">${optionsHtml || '<div class="pf-empty">Không có dữ liệu</div>'}</div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="_pfMsClear('${cbId}')">Bỏ chọn</button>
        <button class="pf-btn-apply" onclick="_pfMsApply('${cbId}')">Áp dụng</button>
      </div>`;
  }

  window._pfToggleOption = function(el, cbId, val, singleSelect) {
    if (typeof haptic === 'function') haptic('selection');
    const state = window[cbId];
    if (!state) return;

    if (singleSelect) {
      // Single select: clear others
      state.selected.clear();
      el.closest('.pf-options').querySelectorAll('.pf-option').forEach(o => o.classList.remove('selected'));
    }

    if (state.selected.has(val)) {
      state.selected.delete(val);
      el.classList.remove('selected');
    } else {
      state.selected.add(val);
      el.classList.add('selected');
    }
  };

  window._pfMsClear = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    state.selected.clear();
    document.querySelectorAll('#pfOverlay .pf-option').forEach(o => o.classList.remove('selected'));
  };

  window._pfMsApply = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    state.onApply([...state.selected]);
  };

  // ── Search select builder (with search input) ──
  function _pfBuildSearchSelect(title, items, selected, onApply, singleSelect) {
    const cbId = '_pfss_' + Math.random().toString(36).slice(2, 6);
    const selSet = new Set(selected);
    window[cbId] = { items, selected: new Set(selSet), onApply, singleSelect };

    const optionsHtml = items.slice(0, 50).map(item =>
      `<div class="pf-option ${selSet.has(item.val) ? 'selected' : ''}" data-val="${item.val.replace(/"/g, '&quot;')}" onclick="_pfToggleSearchOption(this,'${cbId}','${item.val.replace(/'/g, "\\'")}'${singleSelect ? ',true' : ''})">
        <div class="pf-option-check">✓</div>
        <div class="pf-option-label">${item.label}</div>
        ${item.count ? `<div class="pf-option-count">${item.count}</div>` : ''}
      </div>`
    ).join('');

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">${title}</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <input class="pf-search" type="text" placeholder="🔍 Tìm kiếm..." oninput="_pfFilterSearchOptions(this,'${cbId}')" />
      <div class="pf-options" id="${cbId}_opts">${optionsHtml || '<div class="pf-empty">Không có dữ liệu</div>'}</div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="_pfMsClear('${cbId}')">Bỏ chọn</button>
        <button class="pf-btn-apply" onclick="_pfMsApply('${cbId}')">Áp dụng</button>
      </div>`;
  }

  window._pfToggleSearchOption = function(el, cbId, val, singleSelect) {
    window._pfToggleOption(el, cbId, val, singleSelect);
  };

  window._pfFilterSearchOptions = function(input, cbId) {
    const state = window[cbId];
    if (!state) return;
    const term = (input.value || '').toLowerCase().trim();
    const container = document.getElementById(cbId + '_opts');
    if (!container) return;

    const filtered = state.items.filter(i =>
      !term || i.label.toLowerCase().includes(term) || i.val.toLowerCase().includes(term)
    ).slice(0, 50);

    container.innerHTML = filtered.map(item =>
      `<div class="pf-option ${state.selected.has(item.val) ? 'selected' : ''}" data-val="${item.val.replace(/"/g, '&quot;')}" onclick="_pfToggleSearchOption(this,'${cbId}','${item.val.replace(/'/g, "\\'")}'${state.singleSelect ? ',true' : ''})">
        <div class="pf-option-check">✓</div>
        <div class="pf-option-label">${item.label}</div>
        ${item.count ? `<div class="pf-option-count">${item.count}</div>` : ''}
      </div>`
    ).join('') || '<div class="pf-empty">Không tìm thấy</div>';
  };

  // ── Toggle builder (Yes/No/All) ──
  function _pfBuildToggle(title, currentVal, onApply) {
    const cbId = '_pftg_' + Math.random().toString(36).slice(2, 6);
    window[cbId] = { onApply };

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">${title}</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <div class="pf-toggle-group">
        <button class="pf-toggle-btn ${currentVal === null ? 'active' : ''}" onclick="_pfApplyToggle('${cbId}',null)">Tất cả</button>
        <button class="pf-toggle-btn ${currentVal === true ? 'active' : ''}" onclick="_pfApplyToggle('${cbId}',true)">✅ Có</button>
        <button class="pf-toggle-btn ${currentVal === false ? 'active' : ''}" onclick="_pfApplyToggle('${cbId}',false)">❌ Chưa</button>
      </div>`;
  }

  window._pfApplyToggle = function(cbId, val) {
    if (typeof haptic === 'function') haptic('selection');
    const state = window[cbId];
    if (state) state.onApply(val);
  };

  // ── Range input builder ──
  function _pfBuildRangeInput(title, fromVal, toVal, type, min, max, onApply) {
    const cbId = '_pfri_' + Math.random().toString(36).slice(2, 6);
    window[cbId] = { onApply };

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">${title}</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <div class="pf-range-row">
        <input class="pf-range-input" type="${type}" id="${cbId}_from" value="${fromVal}" placeholder="Từ" ${min ? `min="${min}"` : ''} ${max ? `max="${max}"` : ''} />
        <span class="pf-range-sep">→</span>
        <input class="pf-range-input" type="${type}" id="${cbId}_to" value="${toVal}" placeholder="Đến" ${min ? `min="${min}"` : ''} ${max ? `max="${max}"` : ''} />
      </div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="document.getElementById('${cbId}_from').value='';document.getElementById('${cbId}_to').value='';">Xoá</button>
        <button class="pf-btn-apply" onclick="_pfApplyRange('${cbId}')">Áp dụng</button>
      </div>`;
  }

  window._pfApplyRange = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    const from = document.getElementById(cbId + '_from')?.value || '';
    const to = document.getElementById(cbId + '_to')?.value || '';
    state.onApply(from, to);
  };

  // ── Text search builder ──
  function _pfBuildTextSearch(title, currentVal, onApply) {
    const cbId = '_pfts_' + Math.random().toString(36).slice(2, 6);
    window[cbId] = { onApply };

    // Get unique concept values for suggestions
    const vals = _pfGetUniqueValues('concept');
    const suggestions = [...vals.entries()]
      .filter(([v]) => v)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    const suggestHtml = suggestions.map(([v, count]) =>
      `<div class="pf-option" onclick="document.getElementById('${cbId}_input').value='${v.replace(/'/g, "\\'")}';_pfApplyText('${cbId}')">
        <div class="pf-option-label">${v}</div>
        <div class="pf-option-count">${count}</div>
      </div>`
    ).join('');

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">${title}</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <input class="pf-search" type="text" id="${cbId}_input" value="${currentVal || ''}" placeholder="🔍 Nhập concept hoặc chọn..." />
      <div class="pf-options">${suggestHtml || '<div class="pf-empty">Không có concept nào</div>'}</div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="document.getElementById('${cbId}_input').value=''">Xoá</button>
        <button class="pf-btn-apply" onclick="_pfApplyText('${cbId}')">Áp dụng</button>
      </div>`;
  }

  window._pfApplyText = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    const val = document.getElementById(cbId + '_input')?.value?.trim() || '';
    state.onApply(val);
  };

  // ── Unit (Đơn vị) select builder ──
  function _pfBuildUnitSelect() {
    const units = _rptCache?.scopeUnits || [];
    const cbId = '_pfunit_' + Math.random().toString(36).slice(2, 6);
    window[cbId] = {};

    const optionsHtml = units.map((u, i) => {
      const icon = u.type === 'area' ? '🏢' : u.type === 'group' ? '👥' : '🏠';
      const indent = u.label.startsWith('  ') ? 'padding-left:20px;' : '';
      const label = u.label.replace(/^[\s└]+/, '').trim();
      return `<div class="pf-option" style="${indent}" onclick="_pfApplyUnit(${i})">
        <div class="pf-option-label">${icon} ${label}</div>
        <div class="pf-option-count">${u.codes.length}</div>
      </div>`;
    }).join('');

    return `
      <div class="pf-dropdown-header">
        <div class="pf-dropdown-title">Đơn vị (Khu vực / Nhóm / Tổ)</div>
        <button class="pf-dropdown-close" onclick="_pfCloseDropdown()">✕</button>
      </div>
      <div class="pf-options">${optionsHtml || '<div class="pf-empty">Không có đơn vị</div>'}</div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="_pfClearUnit()">Bỏ chọn</button>
      </div>`;
  }

  window._pfApplyUnit = function(idx) {
    if (typeof haptic === 'function') haptic('selection');
    const units = _rptCache?.scopeUnits || [];
    if (!units[idx]) return;
    _pfState.unit = { codes: units[idx].codes, label: units[idx].label.replace(/^[\s└]+/, '').trim() };
    _pfCloseDropdown();
    _pfRefresh();
  };

  window._pfClearUnit = function() {
    _pfState.unit = null;
    _pfCloseDropdown();
    _pfRefresh();
  };

  // ══════════════════════════════════════
  // EXPORT
  // ══════════════════════════════════════

  window._pfExportCSV = function() {
    if (!_pfResults.length) { showToast('⚠️ Không có dữ liệu để xuất'); return; }

    const headers = ['Họ tên', 'Giai đoạn', 'Trạng thái', 'NDD', 'TVV', 'GVBB', 'Mở KT', 'Năm sinh', 'Giới tính', 'CC Tư vấn', 'Concept', 'SĐT', 'Ngày Chakki', 'Đơn vị'];
    const PHASE_NAMES = { new: 'Mới', chakki: 'Chakki', tu_van_hinh: 'TV Hình', tu_van: 'Tư Vấn', bb: 'BB', center: 'Center', completed: 'Hoàn thành' };

    const rows = _pfResults.map(p => {
      const fullP = (allProfiles || []).find(x => x.id === p.id) || p;
      const nddC = fullP.ndd_staff_code || '';
      const tvvC = fullP.tvv_staff_code || '';
      const gvbbC = fullP.gvbb_staff_code || '';
      const en = _pfEnriched?.get(p.id);
      const unit = typeof getStaffUnit === 'function' ? getStaffUnit(nddC) : '';

      return [
        fullP.full_name || '',
        PHASE_NAMES[fullP.phase] || fullP.phase || '',
        fullP.fruit_status || 'alive',
        _pfStaffName(nddC),
        _pfStaffName(tvvC),
        _pfStaffName(gvbbC),
        fullP.is_kt_opened ? 'Đã mở' : 'Chưa',
        fullP.birth_year || '',
        fullP.gender || '',
        en?.tools ? [...en.tools].join('; ') : '',
        en?.concept || '',
        fullP.phone_number || '',
        en?.ngayChakki || '',
        unit
      ];
    });

    // BOM for UTF-8 Excel compat
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows].map(r => r.map(v => `"${(v + '').replace(/"/g, '""')}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ho_so_loc_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Đã xuất CSV!');
  };

  window._pfCopyList = function() {
    if (!_pfResults.length) { showToast('⚠️ Không có dữ liệu'); return; }

    const PHASE_NAMES = { new: 'Mới', chakki: 'CK', tu_van_hinh: 'TVH', tu_van: 'TV', bb: 'BB', center: 'CTR', completed: '✅' };
    let text = `📋 Danh sách hồ sơ (${_pfResults.length}):\n\n`;

    _pfResults.forEach((p, i) => {
      const fullP = (allProfiles || []).find(x => x.id === p.id) || p;
      const nddC = fullP.ndd_staff_code || '';
      const en = _pfEnriched?.get(p.id);
      const phase = PHASE_NAMES[fullP.phase] || fullP.phase || 'CK';
      const tool = en?.tools?.size ? [...en.tools].join(', ') : '';
      const concept = en?.concept || '';

      text += `${i + 1}. ${fullP.full_name} [${phase}] NDD: ${_pfStaffName(nddC)}`;
      if (tool) text += ` · CC: ${tool}`;
      if (concept) text += ` · Concept: ${concept}`;
      text += '\n';
    });

    if (typeof copyToClipboard === 'function') {
      copyToClipboard(text);
    } else {
      navigator.clipboard.writeText(text).then(() => showToast('📋 Đã copy!'));
    }
  };

  window._pfClearAll = function() {
    Object.assign(_pfState, {
      phase: [], status: [], ndd: [], tvv: [], gvbb: [],
      kt: null, semester: null, unit: null, gender: [],
      birthFrom: '', birthTo: '', tools: [], concept: '',
      tonGiao: [], honNhan: [], activity: null,
      chakkiFrom: '', chakkiTo: '', dkCenter: null,
    });
    _pfRefresh();
    showToast('✅ Đã xoá tất cả bộ lọc');
  };

  // ══════════════════════════════════════
  // HAPJA VIEW FROM PROFILE
  // ══════════════════════════════════════

  // Fetch and open approved Hapja for a profile
  window.viewApprovedHapja = async function(profileId) {
    if (!profileId) return;
    try {
      const res = await sbFetch(`/rest/v1/check_hapja?profile_id=eq.${profileId}&status=eq.approved&select=id&limit=1&order=created_at.desc`);
      const rows = await res.json();
      if (rows && rows.length > 0) {
        openHapjaDetail(rows[0].id);
      } else {
        showToast('⚠️ Không tìm thấy phiếu Hapja cho hồ sơ này');
      }
    } catch (e) {
      console.error('viewApprovedHapja error:', e);
      showToast('❌ Lỗi tải phiếu Hapja');
    }
  };

})();
