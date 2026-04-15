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
