// ============ UTILS.JS — Shared Utilities ============
// Centralized date/time formatters and text helpers.
// All files can rely on these being available globally.

function getRecordContent(r) {
  if (!r) return {};
  let c = r.content || r.data || {};
  if (typeof c === 'string') {
    try { c = JSON.parse(c); } catch(e) { c = {}; }
  }
  return (c && typeof c === 'object') ? c : {};
}

// ── Shin Calendar: 2026 = Shin 43 → offset = year - 1983 ──
const SHIN_OFFSET = 1983;

function shinDate(dateInput) {
  if (!dateInput) return '';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  const sy = d.getFullYear() - SHIN_OFFSET;
  return `Shin ${sy}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function shinDateTime(dateInput) {
  if (!dateInput) return '';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  const sy = d.getFullYear() - SHIN_OFFSET;
  return `Shin ${sy}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function shinTime(dateInput) {
  if (!dateInput) return '';
  const d = (dateInput instanceof Date) ? dateInput : new Date(dateInput);
  if (isNaN(d)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Time ago: human-readable elapsed time ──
// < 1 phút → "Vừa xong", < 1h → "X phút trước", < 24h → "X giờ trước",
// < 7 ngày → "X ngày trước", >= 7 ngày → shinDate fallback
function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff)) return '';
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  const dy = Math.floor(hr / 24);
  if (dy < 7) return `${dy} ngày trước`;
  return shinDate(dateStr);
}

// ── Shared utility: label for the latest activity of a profile ──────────────
function latestActivityLabel(rec, sess) {
  try {
    const recTime = rec && rec.created_at ? new Date(rec.created_at).getTime() : 0;
    const sessTime = sess && sess.created_at ? new Date(sess.created_at).getTime() : 0;
    if (!rec && !sess) return '';
    let label = '', actDate = null;
    if (recTime >= sessTime) {
      const rt = rec?.record_type || '';
      const c = rec?.content || {};
      actDate = rec.created_at;
      if (rt === 'tu_van')          label = `Báo cáo TV lần ${c?.lan_thu||''}`;
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
      else label = rt || '';
    } else {
      actDate = sess.created_at;
      label = `Chốt TV lần ${sess.session_number||''}${sess.tool ? ' ('+sess.tool+')' : ''}`;
    }
    const ago = typeof getTimeAgo === 'function' ? getTimeAgo(actDate) : '';
    return ago ? `${label} · ${ago}` : label;
  } catch(e) {
    return '';
  }
}

// ── HTML escape ──
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Name initial: take first letter of LAST word (Vietnamese convention) ──
// "Huyền Trang" → "T", "Ngô Khải Hoàng" → "H", "Maize" → "M"
function getNameInitial(name) {
  if (!name || name === '?') return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 1][0] || '?').toUpperCase();
}

// ── Robust JSON Parser for LLM outputs (handles newlines in strings, trailing commas, think blocks) ──
function robustJSONParse(raw) {
  if (!raw || typeof raw !== 'string') {
    throw new Error('Dữ liệu trống hoặc không phải chuỗi');
  }

  // 1. Remove thinking block (e.g. <think>...</think>)
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

  // 2. Remove markdown code blocks if any (e.g., ```json ... ``` or just ``` ... ```)
  cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```\s*$/i, '').trim();

  // 3. Locate braces to narrow down to the JSON content.
  // Strategy: Find first '{' and last '}'
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  // 4. Escape control characters (like actual newlines and tabs) that are inside JSON string literals.
  let repaired = '';
  let inString = false;
  let escape = false;
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escape) {
      repaired += char;
      escape = false;
      continue;
    }
    if (char === '\\') {
      repaired += char;
      if (inString) {
        escape = true;
      }
      continue;
    }
    if (char === '"') {
      inString = !inString;
      repaired += char;
      continue;
    }
    if (inString) {
      if (char === '\n') {
        repaired += '\\n';
      } else if (char === '\r') {
        repaired += '\\r';
      } else if (char === '\t') {
        repaired += '\\t';
      } else {
        repaired += char;
      }
    } else {
      repaired += char;
    }
  }

  // 5. Remove trailing commas (e.g., [1, 2,] or {a:1,})
  // A comma is followed by optional whitespace and a closing bracket or brace.
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // 6. Try parsing the repaired JSON
  try {
    return JSON.parse(repaired);
  } catch (err1) {
    console.warn('[RobustJSON] First parse attempt failed after basic repair. Attempting aggressive repair...', err1);
    
    // Attempt strategy: if there's any unescaped double quotes inside values, like "reason": "say "hello"",
    // it's very hard to parse, but let's try another strategy if the above failed.
    // Try to parse the cleaned string directly just in case the repair broke something.
    try {
      return JSON.parse(cleaned);
    } catch (err2) {
      console.error('[RobustJSON] Parsing failed completely.', { raw, cleaned, repaired, err2 });
      throw err2;
    }
  }
}

// ════════════════════════════════════════════════════════
// DIRTY FORM GUARD — detect unsaved changes & warn user
// ════════════════════════════════════════════════════════
var DirtyFormGuard = (function() {
  var _snapshots = {};  // { containerId: { fieldId: value } }
  var _pendingAction = null;  // deferred navigation callback

  // Take snapshot of all input/textarea/select values in a container
  function snapshot(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var snap = {};
    container.querySelectorAll('input, textarea, select').forEach(function(el) {
      if (el.id) snap[el.id] = el.value || '';
    });
    _snapshots[containerId] = snap;
  }

  // Check if any fields changed from snapshot
  function isDirty(containerId) {
    var snap = _snapshots[containerId];
    if (!snap) return false;
    var container = document.getElementById(containerId);
    if (!container) return false;
    var fields = container.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.id && snap.hasOwnProperty(el.id)) {
        if ((el.value || '') !== snap[el.id]) return true;
      }
    }
    return false;
  }

  // Clear snapshot (after save or discard)
  function clear(containerId) {
    delete _snapshots[containerId];
  }

  // Map container to its save function and display name
  var _formConfig = {
    'sinkaContent': { saveFn: 'saveSinka', label: 'Thẻ Học Viên' },
    'thongTinTab':  { saveFn: 'saveInfoSheet', label: 'Phiếu Thông Tin' }
  };

  // Check all tracked forms for dirty state, show popup if dirty
  // onProceed: callback to execute after user decides (save/discard)
  function guard(onProceed) {
    var dirtyId = null;
    for (var cid in _snapshots) {
      if (isDirty(cid)) { dirtyId = cid; break; }
    }
    if (!dirtyId) {
      // No dirty forms, proceed immediately
      if (onProceed) onProceed();
      return false;
    }

    _pendingAction = onProceed;
    _showGuardModal(dirtyId);
    return true; // blocked, waiting for user choice
  }

  function _showGuardModal(dirtyContainerId) {
    var old = document.getElementById('dirtyFormGuardModal');
    if (old) old.remove();

    var config = _formConfig[dirtyContainerId] || { label: 'Form', saveFn: null };
    
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'dirtyFormGuardModal';
    overlay.style.zIndex = '10000';

    overlay.innerHTML = `
      <div style="width:88%;max-width:380px;background:var(--bg, #fff);border-radius:16px;padding:24px 20px;box-shadow:0 20px 60px rgba(0,0,0,0.25);text-align:center;animation:sdSlideUp 0.25s ease;">
        <div style="font-size:32px;margin-bottom:8px;">⚠️</div>
        <div style="font-size:15px;font-weight:700;color:var(--text1, #1f2937);margin-bottom:6px;">Chưa lưu thay đổi</div>
        <div style="font-size:12px;color:var(--text3, #6b7280);margin-bottom:20px;line-height:1.5;">
          Bạn có thay đổi chưa lưu trong <strong>${config.label}</strong>.<br/>Bạn muốn làm gì?
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="dfg-save" style="width:100%;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;color:white;background:linear-gradient(135deg,var(--accent, #7c6af7),var(--accent2, #a78bfa));box-shadow:0 3px 10px rgba(124,106,247,0.2);">
            💾 Lưu và tiếp tục
          </button>
          <button id="dfg-edit" style="width:100%;padding:10px;border:1px solid var(--border, #e5e7eb);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:var(--text1, #374151);background:var(--surface, #f9fafb);">
            ✏️ Chỉnh sửa tiếp
          </button>
          <button id="dfg-discard" style="width:100%;padding:10px;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;color:var(--text3, #9ca3af);background:none;">
            Huỷ thay đổi
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Save & proceed
    document.getElementById('dfg-save').onclick = async function() {
      overlay.remove();
      if (config.saveFn && typeof window[config.saveFn] === 'function') {
        await window[config.saveFn]();
      }
      snapshot(dirtyContainerId); // re-snapshot after save
      if (_pendingAction) { _pendingAction(); _pendingAction = null; }
    };

    // Continue editing (close popup, stay)
    document.getElementById('dfg-edit').onclick = function() {
      overlay.remove();
      _pendingAction = null;
    };

    // Discard & proceed
    document.getElementById('dfg-discard').onclick = function() {
      overlay.remove();
      snapshot(dirtyContainerId); // overwrite snapshot to current (discard)
      if (_pendingAction) { _pendingAction(); _pendingAction = null; }
    };
  }

  return {
    snapshot: snapshot,
    isDirty: isDirty,
    clear: clear,
    guard: guard
  };
})();
