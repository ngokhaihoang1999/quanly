// ============ PROFILE FILTER MODULE v2 ============
// Excel-like filtering for profile lists
// Depends on: allProfiles, allStaff, structureData, allSemesters, sbFetch,
//             renderProfileCard, _rptCache (from reports.js)

(function() {
  'use strict';

  // ══════════════════════════════════════
  // STATE
  // ══════════════════════════════════════

  const _pfState = {
    semesters: [],    // multi-select semester ids
    unit: null,       // { codes: [...], label: '' }
    ndd: [],          // staff_code[]
    name: [],         // multi-select full names
    phase: [],        // ['chakki','bb',...]
    status: [],       // ['alive','dropout','pause']
    tvv: [],
    gvbb: [],
    tools: [],        // ['Enneagram',...]
    concept: [],      // multi-select concepts
    kt: null,         // true/false/null
    gender: [],
    birthFrom: '',
    birthTo: '',
    tonGiao: [],
    idleFrom: '',     // min days idle (number)
    idleTo: '',       // max days idle (number)
    chakkiFrom: '',
    chakkiTo: '',
    dkCenter: null,   // true/false/null
  };

  // Enriched data cache (lazy loaded)
  let _pfEnriched = null; // Map<profileId, { tools, concept, tonGiao, ngayChakki, hasDKCenter }>
  let _pfAllProfiles = null; // Cache of ALL profiles across all semesters
  let _pfLoading = false;
  let _pfResults = [];
  let _pfInitialized = false;

  // ══════════════════════════════════════
  // DATA LOADING
  // ══════════════════════════════════════

  /**
   * Get ALL profiles within scope (independent of currentSemesterId).
   * Uses _rptCache.allScopeCodes for scope enforcement.
   */
  function _pfGetScopeProfiles() {
    const scopeCodes = _rptCache?.allScopeCodes;
    const sourceProfiles = _pfAllProfiles || [];
    if (!scopeCodes || scopeCodes.length === 0) {
      return sourceProfiles.slice();
    }
    const codeSet = new Set(scopeCodes);
    return sourceProfiles.filter(p => codeSet.has(p.ndd_staff_code));
  }

  /** Fetch and parse all profiles across all semesters */
  async function _pfLoadAllProfiles() {
    if (_pfAllProfiles) return;
    try {
      const res = await sbFetch('/rest/v1/profiles?select=*,fruit_groups(telegram_group_id,fruit_roles(staff_code,role_type))&order=created_at.desc');
      const rawData = await res.json();
      _pfAllProfiles = rawData.map(p => {
        let tvv = [], gvbb = null, nddRole = null, la = [];
        const sortedFGs = (p.fruit_groups || []).sort((a, b) => {
          const aReal = a.telegram_group_id && a.telegram_group_id > -1000000000000 ? 1 : 0;
          const bReal = b.telegram_group_id && b.telegram_group_id > -1000000000000 ? 1 : 0;
          return bReal - aReal;
        });
        sortedFGs.forEach(fg => {
          (fg.fruit_roles || []).forEach(r => {
            if (r.role_type === 'ndd' && !nddRole) nddRole = r.staff_code;
            if (r.role_type === 'tvv') tvv.push(r.staff_code);
            if (r.role_type === 'gvbb' && !gvbb) gvbb = r.staff_code;
            if (r.role_type === 'la') la.push(r.staff_code);
          });
        });
        p.ndd_staff_code = nddRole || p.ndd_staff_code;
        p.tvv_staff_code = tvv.length ? tvv.join(', ') : '';
        p.gvbb_staff_code = gvbb || '';
        p.la_staff_code = la.length ? la.join(', ') : '';
        return p;
      });
    } catch (e) {
      console.error('Profile filter: load all profiles error', e);
      _pfAllProfiles = [];
    }
  }

  window._pfResetCache = function() {
    _pfAllProfiles = null;
    _pfEnriched = null;
  };

  /** Load enriched data (form_hanh_chinh, TV records, DK Center) */
  async function _pfLoadEnrichedData() {
    if (_pfEnriched || _pfLoading) return;
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

      (hcData || []).forEach(h => {
        const d = h.data || {};
        _pfEnriched.set(h.profile_id, {
          concept: d.t2_concept || '',
          tonGiao: Array.isArray(d.t2_ton_giao) ? d.t2_ton_giao : (d.t2_ton_giao ? [d.t2_ton_giao] : []),
          ngayChakki: d.t2_ngay_chakki || '',
          tools: new Set(),
          hasDKCenter: false,
        });
      });

      (tvData || []).forEach(r => {
        const toolName = r.content?.ten_cong_cu;
        if (!toolName) return;
        if (!_pfEnriched.has(r.profile_id)) {
          _pfEnriched.set(r.profile_id, { concept: '', tonGiao: [], ngayChakki: '', tools: new Set(), hasDKCenter: false });
        }
        _pfEnriched.get(r.profile_id).tools.add(toolName);
      });

      const dkPids = new Set();
      (dkData || []).forEach(r => dkPids.add(r.profile_id));
      dkPids.forEach(pid => {
        if (_pfEnriched.has(pid)) {
          _pfEnriched.get(pid).hasDKCenter = true;
        } else {
          _pfEnriched.set(pid, { concept: '', tonGiao: [], ngayChakki: '', tools: new Set(), hasDKCenter: true });
        }
      });
    } catch (e) {
      console.error('Profile filter: enriched data load error', e);
    } finally {
      _pfLoading = false;
    }
  }

  // ══════════════════════════════════════
  // UNIQUE VALUES EXTRACTION
  // ══════════════════════════════════════

  /**
   * Get unique values for a field from scope profiles.
   * Returns Map<value, count> + blankCount.
   */
  function _pfGetUniqueValues(field) {
    const profiles = _pfGetScopeProfiles();
    const vals = new Map();
    let blankCount = 0;

    profiles.forEach(p => {
      let values = [];

      switch (field) {
        case 'name':
          values = [p.full_name || ''];
          break;
        case 'ndd':
          values = [p.ndd_staff_code || ''];
          break;
        case 'phase':
          values = [p.phase || 'chakki'];
          break;
        case 'status':
          values = [p.fruit_status || 'alive'];
          break;
        case 'gender':
          values = [p.gender || ''];
          break;
        case 'tvv': {
          const codes = (p.tvv_staff_code || '').split(',').map(c => c.trim()).filter(Boolean);
          values = codes.length > 0 ? codes : [''];
          break;
        }
        case 'gvbb':
          values = [p.gvbb_staff_code || ''];
          break;
        case 'tools': {
          const en = _pfEnriched?.get(p.id);
          if (en && en.tools && en.tools.size > 0) {
            values = [...en.tools];
          } else {
            values = [''];
          }
          break;
        }
        case 'concept': {
          const en = _pfEnriched?.get(p.id);
          values = [en?.concept || ''];
          break;
        }
        case 'tonGiao': {
          const en = _pfEnriched?.get(p.id);
          const tg = en?.tonGiao || [];
          values = tg.length > 0 ? tg.filter(Boolean) : [''];
          if (tg.length > 0 && tg.every(t => !t)) values = [''];
          break;
        }
        case 'semester':
          values = [p.semester_id || ''];
          break;
        default:
          return;
      }

      values.forEach(v => {
        if (!v) {
          blankCount++;
        } else {
          vals.set(v, (vals.get(v) || 0) + 1);
        }
      });
    });

    return { vals, blankCount };
  }

  // ══════════════════════════════════════
  // IDLE DAYS CALCULATION
  // ══════════════════════════════════════

  const DAY = 86400000;

  /** Calculate days since last activity for a profile */
  function _pfIdleDays(p) {
    const now = Date.now();
    const recs = _rptCache?.recMap?.[p.id] || [];
    const sess = _rptCache?.sessMap?.[p.id] || [];
    const allDates = [
      ...recs.map(r => new Date(r.created_at).getTime()),
      ...sess.map(s => new Date(s.created_at).getTime()),
    ];
    const lastActivity = allDates.length > 0
      ? Math.max(...allDates)
      : (p.created_at ? new Date(p.created_at).getTime() : 0);
    return lastActivity ? Math.floor((now - lastActivity) / DAY) : 999;
  }

  // ══════════════════════════════════════
  // FILTER ENGINE (AND logic)
  // ══════════════════════════════════════

  function _pfApply() {
    const profiles = _pfGetScopeProfiles();
    const s = _pfState;

    _pfResults = profiles.filter(p => {
      // Semesters (multi-select, independent from header)
      if (s.semesters.length > 0 && !s.semesters.includes(p.semester_id || '')) return false;

      // Unit
      if (s.unit) {
        const ndd = p.ndd_staff_code || '';
        if (!s.unit.codes.includes(ndd)) return false;
      }

      // NDD
      if (s.ndd.length > 0 && !s.ndd.includes(p.ndd_staff_code || '')) return false;

      // Name (multi-select Excel-like)
      if (s.name.length > 0) {
        const n = p.full_name || '';
        const hasBlankSelected = s.name.includes('__blank__');
        const nonBlank = s.name.filter(c => c !== '__blank__');
        if (!nonBlank.includes(n) && !(hasBlankSelected && !n)) return false;
      }

      // Phase
      if (s.phase.length > 0 && !s.phase.includes(p.phase || 'chakki')) return false;

      // Status
      if (s.status.length > 0 && !s.status.includes(p.fruit_status || 'alive')) return false;

      // TVV
      if (s.tvv.length > 0) {
        const tvvCodes = (p.tvv_staff_code || '').split(',').map(c => c.trim()).filter(Boolean);
        const hasBlankSelected = s.tvv.includes('__blank__');
        const nonBlank = s.tvv.filter(c => c !== '__blank__');
        const matchNonBlank = nonBlank.length > 0 && nonBlank.some(c => tvvCodes.includes(c));
        const matchBlank = hasBlankSelected && tvvCodes.length === 0;
        if (!matchNonBlank && !matchBlank) return false;
      }

      // GVBB
      if (s.gvbb.length > 0) {
        const gvbbCode = p.gvbb_staff_code || '';
        const hasBlankSelected = s.gvbb.includes('__blank__');
        const nonBlank = s.gvbb.filter(c => c !== '__blank__');
        if (!nonBlank.includes(gvbbCode) && !(hasBlankSelected && !gvbbCode)) return false;
      }

      // KT
      if (s.kt !== null) {
        if (s.kt && !p.is_kt_opened) return false;
        if (s.kt === false && p.is_kt_opened) return false;
      }

      // Gender
      if (s.gender.length > 0) {
        const g = p.gender || '';
        const hasBlankSelected = s.gender.includes('__blank__');
        const nonBlank = s.gender.filter(c => c !== '__blank__');
        if (!nonBlank.includes(g) && !(hasBlankSelected && !g)) return false;
      }

      // Birth year range
      if (s.birthFrom || s.birthTo) {
        const by = parseInt(p.birth_year) || 0;
        if (!by) return false;
        if (s.birthFrom && by < parseInt(s.birthFrom)) return false;
        if (s.birthTo && by > parseInt(s.birthTo)) return false;
      }

      // Enriched data
      const en = _pfEnriched?.get(p.id);

      // Tools (Công cụ TV)
      if (s.tools.length > 0) {
        const hasBlankSelected = s.tools.includes('__blank__');
        const nonBlank = s.tools.filter(c => c !== '__blank__');
        const hasTools = en && en.tools && en.tools.size > 0;
        const matchNonBlank = nonBlank.length > 0 && hasTools && nonBlank.some(t => en.tools.has(t));
        const matchBlank = hasBlankSelected && !hasTools;
        if (!matchNonBlank && !matchBlank) return false;
      }

      // Concept (multi-select Excel-like)
      if (s.concept.length > 0) {
        const c = en?.concept || '';
        const hasBlankSelected = s.concept.includes('__blank__');
        const nonBlank = s.concept.filter(x => x !== '__blank__');
        if (!nonBlank.includes(c) && !(hasBlankSelected && !c)) return false;
      }

      // Tôn giáo
      if (s.tonGiao.length > 0) {
        const hasBlankSelected = s.tonGiao.includes('__blank__');
        const nonBlank = s.tonGiao.filter(c => c !== '__blank__');
        const hasTG = en?.tonGiao && en.tonGiao.some(t => t);
        const matchNonBlank = nonBlank.length > 0 && hasTG && nonBlank.some(t => en.tonGiao.includes(t));
        const matchBlank = hasBlankSelected && !hasTG;
        if (!matchNonBlank && !matchBlank) return false;
      }

      // Idle days range
      if (s.idleFrom || s.idleTo) {
        const idle = _pfIdleDays(p);
        if (s.idleFrom && idle < parseInt(s.idleFrom)) return false;
        if (s.idleTo && idle > parseInt(s.idleTo)) return false;
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

  // ══════════════════════════════════════
  // ACTIVE FILTER COUNT
  // ══════════════════════════════════════

  function _pfActiveCount() {
    const s = _pfState;
    let c = 0;
    if (s.semesters.length) c++;
    if (s.unit) c++;
    if (s.ndd.length) c++;
    if (s.name.length) c++;
    if (s.phase.length) c++;
    if (s.status.length) c++;
    if (s.tvv.length) c++;
    if (s.gvbb.length) c++;
    if (s.tools.length) c++;
    if (s.concept.length) c++;
    if (s.kt !== null) c++;
    if (s.gender.length) c++;
    if (s.birthFrom || s.birthTo) c++;
    if (s.tonGiao.length) c++;
    if (s.idleFrom || s.idleTo) c++;
    if (s.chakkiFrom || s.chakkiTo) c++;
    if (s.dkCenter !== null) c++;
    return c;
  }

  // ══════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════

  function _pfStaffName(code) {
    if (!code) return '';
    const s = (allStaff || []).find(x => x.staff_code === code);
    return s ? (s.nickname || s.full_name || code) : code;
  }

  function _pfTruncate(str, max) {
    if (!str) return '';
    return str.length > max ? str.slice(0, max) + '…' : str;
  }

  function _pfEsc(str) {
    return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  // ══════════════════════════════════════
  // FILTER DEFINITIONS (ordered)
  // ══════════════════════════════════════

  const FILTER_DEFS = [
    { key: 'semester',  label: '📅 Kỳ KG',       icon: '📅' },
    { key: 'unit',      label: '🏢 Đơn vị',      icon: '🏢' },
    { key: 'ndd',       label: '👤 NDD',          icon: '👤' },
    { key: 'name',      label: '🔍 Tên hồ sơ',   icon: '🔍' },
    { key: 'phase',     label: '📋 Giai đoạn',    icon: '📋' },
    { key: 'status',    label: '🔵 Trạng thái',   icon: '🔵' },
    { key: 'tvv',       label: '💬 TVV',           icon: '💬' },
    { key: 'gvbb',      label: '🎓 GVBB',         icon: '🎓' },
    { key: 'tools',     label: '🔧 Công cụ TV',   icon: '🔧' },
    { key: 'concept',   label: '💡 Concept',       icon: '💡' },
    { key: 'kt',        label: '📖 Mở KT',        icon: '📖' },
    { key: 'gender',    label: '⚤ Giới tính',     icon: '⚤' },
    { key: 'birthYear', label: '🎂 Năm sinh',     icon: '🎂' },
    { key: 'tonGiao',   label: '🙏 Tôn giáo',     icon: '🙏' },
    { key: 'idle',      label: '😴 Nhàn rỗi',     icon: '😴' },
    { key: 'chakkiDate',label: '📆 Ngày CK',      icon: '📆' },
    { key: 'dkCenter',  label: '🏛️ ĐK Center',   icon: '🏛️' },
  ];

  const PHASE_NAMES = {
    new: 'Mới', chakki: 'Chakki', tu_van_hinh: 'TV Hình',
    tu_van: 'Tư Vấn', bb: 'BB', center: 'Center', completed: 'Hoàn thành',
  };
  const STATUS_NAMES = { alive: 'Alive', dropout: 'Dropout', pause: 'Pause' };

  // ══════════════════════════════════════
  // UI: MAIN SECTION RENDERER
  // ══════════════════════════════════════

  window._pfRenderSection = async function(containerEl) {
    if (!containerEl) return;

    await Promise.all([
      _pfLoadAllProfiles(),
      _pfLoadEnrichedData()
    ]);
    _pfApply();

    const totalScope = _pfGetScopeProfiles().length;
    const hasFilters = _pfActiveCount() > 0;

    // ── Chip active check ──
    function isActive(key) {
      const s = _pfState;
      switch (key) {
        case 'semester': return s.semesters.length > 0;
        case 'unit': return !!s.unit;
        case 'ndd': return s.ndd.length > 0;
        case 'name': return s.name.length > 0;
        case 'phase': return s.phase.length > 0;
        case 'status': return s.status.length > 0;
        case 'tvv': return s.tvv.length > 0;
        case 'gvbb': return s.gvbb.length > 0;
        case 'tools': return s.tools.length > 0;
        case 'concept': return s.concept.length > 0;
        case 'kt': return s.kt !== null;
        case 'gender': return s.gender.length > 0;
        case 'birthYear': return !!(s.birthFrom || s.birthTo);
        case 'tonGiao': return s.tonGiao.length > 0;
        case 'idle': return !!(s.idleFrom || s.idleTo);
        case 'chakkiDate': return !!(s.chakkiFrom || s.chakkiTo);
        case 'dkCenter': return s.dkCenter !== null;
        default: return false;
      }
    }

    // ── Build chips ──
    const chipsHtml = FILTER_DEFS.map(f =>
      `<div class="pf-chip ${isActive(f.key) ? 'active' : ''}" onclick="_pfOpenFilter('${f.key}')">${f.label} <span class="pf-chip-arrow">▼</span></div>`
    ).join('');

    // ── Build active tags ──
    let tagsHtml = '';
    const s = _pfState;
    if (s.semesters.length) {
      const names = s.semesters.map(id => {
        if (id === '__blank__') return '(Trống)';
        return (allSemesters || []).find(x => x.id === id)?.name || id;
      });
      tagsHtml += _pfTagHtml('Kỳ KG', names.join(', '), () => { s.semesters = []; _pfRefresh(); });
    }
    if (s.unit) tagsHtml += _pfTagHtml('Đơn vị', s.unit.label || 'Đã chọn', () => { s.unit = null; _pfRefresh(); });
    if (s.ndd.length) tagsHtml += _pfTagHtml('NDD', s.ndd.filter(c => c !== '__blank__').map(c => _pfStaffName(c)).join(', ') + (s.ndd.includes('__blank__') ? ', (Trống)' : ''), () => { s.ndd = []; _pfRefresh(); });
    if (s.name.length) tagsHtml += _pfTagHtml('Tên', s.name.filter(c => c !== '__blank__').join(', ') + (s.name.includes('__blank__') ? ', (Trống)' : ''), () => { s.name = []; _pfRefresh(); });
    if (s.phase.length) tagsHtml += _pfTagHtml('GĐ', s.phase.map(p => PHASE_NAMES[p] || p).join(', '), () => { s.phase = []; _pfRefresh(); });
    if (s.status.length) tagsHtml += _pfTagHtml('TT', s.status.map(p => STATUS_NAMES[p] || p).join(', '), () => { s.status = []; _pfRefresh(); });
    if (s.tvv.length) tagsHtml += _pfTagHtml('TVV', s.tvv.filter(c => c !== '__blank__').map(c => _pfStaffName(c)).join(', ') + (s.tvv.includes('__blank__') ? ', (Trống)' : ''), () => { s.tvv = []; _pfRefresh(); });
    if (s.gvbb.length) tagsHtml += _pfTagHtml('GVBB', s.gvbb.filter(c => c !== '__blank__').map(c => _pfStaffName(c)).join(', ') + (s.gvbb.includes('__blank__') ? ', (Trống)' : ''), () => { s.gvbb = []; _pfRefresh(); });
    if (s.tools.length) tagsHtml += _pfTagHtml('Công cụ TV', s.tools.filter(c => c !== '__blank__').join(', ') + (s.tools.includes('__blank__') ? ', (Trống)' : ''), () => { s.tools = []; _pfRefresh(); });
    if (s.concept.length) tagsHtml += _pfTagHtml('Concept', s.concept.filter(c => c !== '__blank__').join(', ') + (s.concept.includes('__blank__') ? ', (Trống)' : ''), () => { s.concept = []; _pfRefresh(); });
    if (s.kt !== null) tagsHtml += _pfTagHtml('KT', s.kt ? 'Đã mở' : 'Chưa mở', () => { s.kt = null; _pfRefresh(); });
    if (s.gender.length) tagsHtml += _pfTagHtml('Giới tính', s.gender.filter(c => c !== '__blank__').join(', ') + (s.gender.includes('__blank__') ? ', (Trống)' : ''), () => { s.gender = []; _pfRefresh(); });
    if (s.birthFrom || s.birthTo) tagsHtml += _pfTagHtml('Năm sinh', `${s.birthFrom || '?'} – ${s.birthTo || '?'}`, () => { s.birthFrom = ''; s.birthTo = ''; _pfRefresh(); });
    if (s.tonGiao.length) tagsHtml += _pfTagHtml('Tôn giáo', s.tonGiao.filter(c => c !== '__blank__').join(', ') + (s.tonGiao.includes('__blank__') ? ', (Trống)' : ''), () => { s.tonGiao = []; _pfRefresh(); });
    if (s.idleFrom || s.idleTo) tagsHtml += _pfTagHtml('Nhàn rỗi', `${s.idleFrom || '0'} – ${s.idleTo || '∞'} ngày`, () => { s.idleFrom = ''; s.idleTo = ''; _pfRefresh(); });
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
          const fullP = (_pfAllProfiles || []).find(x => x.id === p.id) || p;
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
            ndd: fullP.ndd_staff_code || '', tvv: fullP.tvv_staff_code || '', gvbb: fullP.gvbb_staff_code || '',
            extraBadges: extras,
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
        <div class="pf-summary-text">📊 ${_pfResults.length}/${totalScope} hồ sơ</div>
        <div class="pf-summary-actions">
          <button class="pf-export-btn" onclick="_pfExportCSV()">📥 CSV</button>
          <button class="pf-export-btn" onclick="_pfCopyList()">📋 Copy</button>
          <button class="pf-export-btn" onclick="_pfClearAll()" style="color:var(--red);border-color:rgba(239,68,68,0.3);">✕ Xoá lọc</button>
        </div>
      </div>` : '';

    // ── Full HTML ──
    containerEl.innerHTML = `
      <div class="pf-section">
        <div class="pf-header">
          <div class="pf-header-title">🔍 BỘ LỌC CHI TIẾT</div>
          <div class="pf-header-count">${hasFilters ? `${_pfActiveCount()} bộ lọc · ` : ''}${totalScope} hồ sơ</div>
        </div>
        <div class="pf-bar">${chipsHtml}</div>
        ${tagsHtml ? `<div class="pf-tags">${tagsHtml}</div>` : ''}
        ${summaryHtml}
        <div class="pf-results">${resultsHtml}</div>
      </div>`;
  };

  // ── Tag HTML ──
  function _pfTagHtml(label, value, onRemove) {
    const tagId = 'pftag_' + Math.random().toString(36).slice(2, 8);
    window['_pfRm_' + tagId] = function() { onRemove(); };
    return `<span class="pf-tag"><b>${label}:</b>&nbsp;${_pfTruncate(value, 30)}<span class="pf-tag-x" onclick="event.stopPropagation();_pfRm_${tagId}()">✕</span></span>`;
  }

  // ══════════════════════════════════════
  // REFRESH
  // ══════════════════════════════════════

  function _pfRefresh() {
    _pfApply();
    const el = document.getElementById('pfFilterContainer');
    if (el) window._pfRenderSection(el);
  }
  window._pfRefresh = _pfRefresh;

  // ══════════════════════════════════════
  // EXCEL-LIKE DROPDOWN SYSTEM
  // ══════════════════════════════════════

  window._pfOpenFilter = function(key) {
    if (typeof haptic === 'function') haptic('selection');

    const existing = document.getElementById('pfOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'pfOverlay';
    overlay.className = 'pf-dropdown-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) _pfCloseDropdown();
    });

    let content = '';

    // ── Routing to specific filter builders ──
    switch (key) {
      case 'semester':
        content = _pfBuildExcelSelect('Kỳ Khai Giảng', 'semester', _pfState.semesters);
        break;
      case 'ndd':
        content = _pfBuildExcelSelect('NDD (Người Dìu Dắt)', 'ndd', _pfState.ndd);
        break;
      case 'name':
        content = _pfBuildExcelSelect('Tên hồ sơ', 'name', _pfState.name);
        break;
      case 'phase':
        content = _pfBuildExcelSelect('Giai đoạn', 'phase', _pfState.phase);
        break;
      case 'status':
        content = _pfBuildExcelSelect('Trạng thái', 'status', _pfState.status);
        break;
      case 'tvv':
        content = _pfBuildExcelSelect('TVV (Tư Vấn Viên)', 'tvv', _pfState.tvv);
        break;
      case 'gvbb':
        content = _pfBuildExcelSelect('GVBB (Giảng Viên BB)', 'gvbb', _pfState.gvbb);
        break;
      case 'tools':
        content = _pfBuildExcelSelect('Công cụ Tư vấn', 'tools', _pfState.tools);
        break;
      case 'concept':
        content = _pfBuildExcelSelect('Concept / Chủ đề', 'concept', _pfState.concept);
        break;
      case 'kt':
        content = _pfBuildToggle('Mở Kinh Thánh', _pfState.kt, val => { _pfState.kt = val; _pfCloseDropdown(); _pfRefresh(); });
        break;
      case 'gender':
        content = _pfBuildExcelSelect('Giới tính', 'gender', _pfState.gender);
        break;
      case 'birthYear':
        content = _pfBuildRangeInput('Năm sinh', _pfState.birthFrom, _pfState.birthTo, 'number', '1950', '2010',
          (f, t) => { _pfState.birthFrom = f; _pfState.birthTo = t; _pfCloseDropdown(); _pfRefresh(); });
        break;
      case 'tonGiao':
        content = _pfBuildExcelSelect('Tôn giáo', 'tonGiao', _pfState.tonGiao);
        break;
      case 'idle':
        content = _pfBuildRangeInput('Nhàn rỗi (số ngày)', _pfState.idleFrom, _pfState.idleTo, 'number', '0', '999',
          (f, t) => { _pfState.idleFrom = f; _pfState.idleTo = t; _pfCloseDropdown(); _pfRefresh(); });
        break;
      case 'chakkiDate':
        content = _pfBuildRangeInput('Ngày Chakki', _pfState.chakkiFrom, _pfState.chakkiTo, 'date', '', '',
          (f, t) => { _pfState.chakkiFrom = f; _pfState.chakkiTo = t; _pfCloseDropdown(); _pfRefresh(); });
        break;
      case 'dkCenter':
        content = _pfBuildToggle('ĐK Center', _pfState.dkCenter, val => { _pfState.dkCenter = val; _pfCloseDropdown(); _pfRefresh(); });
        break;
      case 'unit':
        content = _pfBuildUnitSelect();
        break;
    }

    overlay.innerHTML = `<div class="pf-dropdown">${content}</div>`;
    requestAnimationFrame(() => overlay.classList.add('open'));
  };

  function _pfCloseDropdown() {
    const overlay = document.getElementById('pfOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    setTimeout(() => overlay.remove(), 300);
  }
  window._pfCloseDropdown = _pfCloseDropdown;

  // ══════════════════════════════════════
  // EXCEL-LIKE MULTI-SELECT (unified)
  // ══════════════════════════════════════
  //
  // Features:
  // - Search box (always)
  // - "Chọn tất cả" button
  // - "(Trống)" option for blank values
  // - Search → check → clear search → check more
  // - Selected count summary
  //

  function _pfBuildExcelSelect(title, field, currentSelected) {
    const cbId = '_pfxl_' + Math.random().toString(36).slice(2, 6);

    // Get items based on field type
    let items = [];
    let blankCount = 0;

    if (field === 'phase') {
      const phases = ['chakki', 'tu_van_hinh', 'tu_van', 'bb', 'center', 'completed'];
      const { vals } = _pfGetUniqueValues('phase');
      items = phases.map(v => ({ val: v, label: PHASE_NAMES[v] || v, count: vals.get(v) || 0 })).filter(i => i.count > 0);
    } else if (field === 'status') {
      const statuses = ['alive', 'dropout', 'pause'];
      const { vals } = _pfGetUniqueValues('status');
      items = statuses.map(v => ({ val: v, label: STATUS_NAMES[v] || v, count: vals.get(v) || 0 })).filter(i => i.count > 0);
    } else if (field === 'semester') {
      const profiles = _pfGetScopeProfiles();
      const semCounts = new Map();
      let noSemCount = 0;
      profiles.forEach(p => {
        if (p.semester_id) {
          semCounts.set(p.semester_id, (semCounts.get(p.semester_id) || 0) + 1);
        } else {
          noSemCount++;
        }
      });
      items = (allSemesters || []).map(s => ({
        val: s.id, label: s.name || s.id, count: semCounts.get(s.id) || 0,
      })).filter(i => i.count > 0);
      blankCount = noSemCount;
    } else if (field === 'ndd' || field === 'tvv' || field === 'gvbb') {
      const { vals, blankCount: bc } = _pfGetUniqueValues(field);
      blankCount = bc;
      items = [...vals.entries()].map(([code, count]) => ({
        val: code, label: _pfStaffName(code), count,
      })).sort((a, b) => b.count - a.count);
    } else if (field === 'name') {
      const { vals, blankCount: bc } = _pfGetUniqueValues('name');
      blankCount = bc;
      items = [...vals.entries()].map(([n, count]) => ({ val: n, label: n, count })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    } else if (field === 'concept') {
      const { vals, blankCount: bc } = _pfGetUniqueValues('concept');
      blankCount = bc;
      items = [...vals.entries()].map(([c, count]) => ({ val: c, label: c, count })).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
    } else if (field === 'tools') {
      const { vals, blankCount: bc } = _pfGetUniqueValues('tools');
      blankCount = bc;
      items = [...vals.entries()].map(([t, count]) => ({ val: t, label: t, count })).sort((a, b) => b.count - a.count);
    } else if (field === 'gender') {
      const { vals, blankCount: bc } = _pfGetUniqueValues('gender');
      blankCount = bc;
      items = [...vals.entries()].map(([g, count]) => ({ val: g, label: g, count }));
    } else if (field === 'tonGiao') {
      const { vals, blankCount: bc } = _pfGetUniqueValues('tonGiao');
      blankCount = bc;
      items = [...vals.entries()].map(([t, count]) => ({ val: t, label: t, count })).sort((a, b) => b.count - a.count);
    }

    const selSet = new Set(currentSelected);

    // Store state for interaction
    window[cbId] = {
      items,
      blankCount,
      selected: new Set(selSet),
      field,
      apply: function() {
        const sel = [...this.selected];
        // Route to correct state field
        switch (this.field) {
          case 'semester': _pfState.semesters = sel; break;
          case 'ndd': _pfState.ndd = sel; break;
          case 'name': _pfState.name = sel; break;
          case 'phase': _pfState.phase = sel; break;
          case 'status': _pfState.status = sel; break;
          case 'tvv': _pfState.tvv = sel; break;
          case 'gvbb': _pfState.gvbb = sel; break;
          case 'tools': _pfState.tools = sel; break;
          case 'concept': _pfState.concept = sel; break;
          case 'gender': _pfState.gender = sel; break;
          case 'tonGiao': _pfState.tonGiao = sel; break;
        }
        _pfCloseDropdown();
        _pfRefresh();
      },
    };

    // Check if all items (+ blank if applicable) are selected
    const totalItems = items.length + (blankCount > 0 ? 1 : 0);
    const allSelected = selSet.size === totalItems && items.every(i => selSet.has(i.val)) && (blankCount === 0 || selSet.has('__blank__'));

    // Build options HTML
    let optionsHtml = '';

    // Blank option
    if (blankCount > 0) {
      optionsHtml += `<div class="pf-option ${selSet.has('__blank__') ? 'selected' : ''}" data-val="__blank__" onclick="_pfXlToggle(this,'${cbId}','__blank__')">
        <div class="pf-option-check">✓</div>
        <div class="pf-option-label" style="font-style:italic;color:var(--text3);">(Trống)</div>
        <div class="pf-option-count">${blankCount}</div>
      </div>`;
    }

    optionsHtml += items.map(item =>
      `<div class="pf-option ${selSet.has(item.val) ? 'selected' : ''}" data-val="${_pfEsc(item.val)}" data-search="${_pfEsc(item.label.toLowerCase())}" onclick="_pfXlToggle(this,'${cbId}','${_pfEsc(item.val)}')">
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
      <input class="pf-search" type="text" placeholder="🔍 Tìm kiếm..." oninput="_pfXlSearch(this,'${cbId}')" />
      <div class="pf-toolbar">
        <button class="pf-toolbar-btn ${allSelected ? 'active' : ''}" id="${cbId}_selAll" onclick="_pfXlSelectAll('${cbId}')">☑ Chọn tất cả</button>
        <button class="pf-toolbar-btn" onclick="_pfXlClear('${cbId}')">☐ Bỏ chọn</button>
        <div class="pf-selected-summary" id="${cbId}_summary">${selSet.size > 0 ? `Đã chọn: ${selSet.size}` : ''}</div>
      </div>
      <div class="pf-options" id="${cbId}_opts">${optionsHtml || '<div class="pf-empty">Không có dữ liệu</div>'}</div>
      <div class="pf-dropdown-actions">
        <button class="pf-btn-clear" onclick="_pfXlClear('${cbId}')">Bỏ chọn</button>
        <button class="pf-btn-apply" onclick="_pfXlApply('${cbId}')">Áp dụng</button>
      </div>`;
  }

  // Toggle single option
  window._pfXlToggle = function(el, cbId, val) {
    if (typeof haptic === 'function') haptic('selection');
    const state = window[cbId];
    if (!state) return;

    if (state.selected.has(val)) {
      state.selected.delete(val);
      el.classList.remove('selected');
    } else {
      state.selected.add(val);
      el.classList.add('selected');
    }
    _pfXlUpdateSummary(cbId);
  };

  // Search within options
  window._pfXlSearch = function(input, cbId) {
    const state = window[cbId];
    if (!state) return;
    const term = (input.value || '').toLowerCase().trim();
    const container = document.getElementById(cbId + '_opts');
    if (!container) return;

    const options = container.querySelectorAll('.pf-option');
    options.forEach(opt => {
      const val = opt.getAttribute('data-val') || '';
      const search = opt.getAttribute('data-search') || '';
      if (val === '__blank__') {
        opt.style.display = term && !'(trống)'.includes(term) ? 'none' : '';
      } else {
        opt.style.display = !term || search.includes(term) || val.toLowerCase().includes(term) ? '' : 'none';
      }
    });
  };

  // Select all visible
  window._pfXlSelectAll = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    const container = document.getElementById(cbId + '_opts');
    if (!container) return;

    const visibleOpts = container.querySelectorAll('.pf-option:not([style*="display: none"])');
    const allVisible = [...visibleOpts].map(o => o.getAttribute('data-val'));
    const allSelected = allVisible.every(v => state.selected.has(v));

    if (allSelected) {
      // Deselect all visible
      allVisible.forEach(v => state.selected.delete(v));
      visibleOpts.forEach(o => o.classList.remove('selected'));
    } else {
      // Select all visible
      allVisible.forEach(v => state.selected.add(v));
      visibleOpts.forEach(o => o.classList.add('selected'));
    }
    _pfXlUpdateSummary(cbId);
  };

  // Clear all
  window._pfXlClear = function(cbId) {
    const state = window[cbId];
    if (!state) return;
    state.selected.clear();
    const container = document.getElementById(cbId + '_opts');
    if (container) container.querySelectorAll('.pf-option').forEach(o => o.classList.remove('selected'));
    _pfXlUpdateSummary(cbId);
  };

  // Apply
  window._pfXlApply = function(cbId) {
    const state = window[cbId];
    if (state && state.apply) state.apply();
  };

  // Update summary count
  function _pfXlUpdateSummary(cbId) {
    const state = window[cbId];
    if (!state) return;
    const el = document.getElementById(cbId + '_summary');
    if (el) el.textContent = state.selected.size > 0 ? `Đã chọn: ${state.selected.size}` : '';

    // Update "Select All" button state
    const btn = document.getElementById(cbId + '_selAll');
    if (btn) {
      const totalItems = state.items.length + (state.blankCount > 0 ? 1 : 0);
      btn.classList.toggle('active', state.selected.size === totalItems);
    }
  }



  // ══════════════════════════════════════
  // TOGGLE FILTER (boolean: KT, ĐK Center)
  // ══════════════════════════════════════

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

  // ══════════════════════════════════════
  // RANGE INPUT (birth year, idle days, dates)
  // ══════════════════════════════════════

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

  // ══════════════════════════════════════
  // UNIT SELECT (Đơn vị — hierarchical)
  // ══════════════════════════════════════

  function _pfBuildUnitSelect() {
    const units = _rptCache?.scopeUnits || [];

    // Count profiles per unit (not staff codes)
    const profiles = _pfGetScopeProfiles();
    function countProfilesForUnit(u) {
      const codeSet = new Set(u.codes);
      return profiles.filter(p => codeSet.has(p.ndd_staff_code)).length;
    }

    const optionsHtml = units.map((u, i) => {
      const icon = u.type === 'area' ? '🏢' : u.type === 'group' ? '👥' : '🏠';
      const indent = u.type === 'group' ? 'padding-left:16px;' : u.type === 'team' ? 'padding-left:32px;' : '';
      const label = u.label.replace(/^[\s└]+/, '').trim();
      const profileCount = countProfilesForUnit(u);
      return `<div class="pf-option" style="${indent}" onclick="_pfApplyUnit(${i})">
        <div class="pf-option-label">${icon} ${label}</div>
        <div class="pf-option-count">${profileCount} hồ sơ</div>
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

    const headers = ['Họ tên', 'Giai đoạn', 'Trạng thái', 'NDD', 'TVV', 'GVBB', 'Mở KT', 'Năm sinh', 'Giới tính', 'Công cụ TV', 'Concept', 'SĐT', 'Ngày Chakki', 'Đơn vị', 'Kỳ KG', 'Nhàn rỗi (ngày)'];

    const rows = _pfResults.map(p => {
      const fullP = (_pfAllProfiles || []).find(x => x.id === p.id) || p;
      const en = _pfEnriched?.get(p.id);
      const unit = typeof getStaffUnit === 'function' ? getStaffUnit(fullP.ndd_staff_code || '') : '';
      const sem = (allSemesters || []).find(s => s.id === fullP.semester_id);
      const idle = _pfIdleDays(fullP);

      return [
        fullP.full_name || '',
        PHASE_NAMES[fullP.phase] || fullP.phase || '',
        fullP.fruit_status || 'alive',
        _pfStaffName(fullP.ndd_staff_code || ''),
        _pfStaffName(fullP.tvv_staff_code || ''),
        _pfStaffName(fullP.gvbb_staff_code || ''),
        fullP.is_kt_opened ? 'Đã mở' : 'Chưa',
        fullP.birth_year || '',
        fullP.gender || '',
        en?.tools ? [...en.tools].join('; ') : '',
        en?.concept || '',
        fullP.phone_number || '',
        en?.ngayChakki || '',
        unit,
        sem?.name || '',
        idle,
      ];
    });

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

    let text = `📋 Danh sách hồ sơ (${_pfResults.length}):\n\n`;
    _pfResults.forEach((p, i) => {
      const fullP = (_pfAllProfiles || []).find(x => x.id === p.id) || p;
      const en = _pfEnriched?.get(p.id);
      const phase = (PHASE_NAMES[fullP.phase] || fullP.phase || 'CK').substring(0, 3);
      const tool = en?.tools?.size ? [...en.tools].join(', ') : '';
      text += `${i + 1}. ${fullP.full_name} [${phase}] NDD: ${_pfStaffName(fullP.ndd_staff_code || '')}`;
      if (tool) text += ` · CC: ${tool}`;
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
      semesters: [], unit: null, ndd: [], name: [],
      phase: [], status: [], tvv: [], gvbb: [],
      tools: [], concept: [], kt: null, gender: [],
      birthFrom: '', birthTo: '', tonGiao: [],
      idleFrom: '', idleTo: '',
      chakkiFrom: '', chakkiTo: '', dkCenter: null,
    });
    _pfRefresh();
    showToast('✅ Đã xoá tất cả bộ lọc');
  };

  // ══════════════════════════════════════
  // HAPJA VIEW FROM PROFILE
  // ══════════════════════════════════════

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
