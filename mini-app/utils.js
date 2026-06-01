// ============ UTILS.JS — Shared Utilities ============
// Centralized date/time formatters and text helpers.
// All files can rely on these being available globally.

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
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Vừa xong';
  if (m < 60) return `${m} phút trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} giờ trước`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ngày trước`;
  return shinDate(dateStr);
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

