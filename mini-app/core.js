

// ── Hiển thị hồ sơ TĐ khi bấm vào mã TĐ ──────────────────────────────
function showStaffCard(code) {
  var s = allStaff.find(function(x){ return x.staff_code === code; });
  if (!s) { showToast('Khong tim thay TDo: ' + code); return; }
  var existing = document.getElementById('staffCardModal');
  if (existing) existing.remove();
  var avatar = s.avatar_emoji || (s.nickname || s.full_name || '?')[0];
  var isEmoji = !!(s.avatar_emoji && s.avatar_emoji.length <= 4);
  var unit    = getStaffUnit(code) || '';
  var genderStr = s.gender ? ' · ' + s.gender : '';
  var birthStr  = s.birth_year ? ' · ' + s.birth_year : '';
  var posStr = s.staff_code + ' · ' + getPositionName(s.position) + (s.specialist_position ? ' + ' + getPositionName(s.specialist_position) : '');

  var modal = document.createElement('div');
  modal.id = 'staffCardModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);';
  modal.innerHTML =
    '<div style="width:100%;max-width:480px;background:var(--surface);border-radius:20px 20px 0 0;padding:20px;box-shadow:0 -8px 40px rgba(0,0,0,0.3);">' +
      '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>' +
      '<div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">' +
        '<div style="width:56px;height:56px;border-radius:16px;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:' + (isEmoji?'28px':'22px') + ';font-weight:700;color:white;flex-shrink:0;">' + avatar + '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-weight:700;font-size:16px;">' + (s.nickname || s.full_name) + '</div>' +
          (s.nickname ? '<div style="font-size:12px;color:var(--text3);">' + s.full_name + '</div>' : '') +
          '<div style="font-size:11px;color:var(--text3);margin-top:2px;">' + posStr + '</div>' +
        '</div>' +
      '</div>' +
      (unit ? '<div style="font-size:12px;color:var(--accent);font-weight:600;margin-bottom:10px;">' + unit + '</div>' : '') +
      ((s.gender||s.birth_year) ? '<div style="font-size:12px;color:var(--text2);margin-bottom:8px;">' + genderStr.replace(' · ','').trim() + birthStr + '</div>' : '') +
      (s.motto ? '<div style="font-size:13px;font-style:italic;color:var(--accent);border-left:3px solid var(--accent);padding-left:10px;margin-bottom:10px;">&ldquo;' + s.motto + '&rdquo;</div>' : '') +
      (s.bio ? '<div style="font-size:12px;color:var(--text2);line-height:1.5;margin-bottom:12px;">' + s.bio + '</div>' : '') +
      '<button onclick="document.getElementById('staffCardModal').remove()" style="width:100%;padding:11px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;font-size:13px;font-weight:600;color:var(--text2);cursor:pointer;">Dong</button>' +
    '</div>';
  modal.addEventListener('click', function(e){ if(e.target===modal) modal.remove(); });
  document.body.appendChild(modal);
}
