// ============ PERSONAL NOTES ============
// Personal sticky notes with sharing between staff members

let _allMyNotes = [];
let _sharedWithMeNotes = [];
let _notesFilter = 'all'; // all | shared
let _notesPollTimer = null;
let _editingNoteId = null;

const NOTE_COLORS = {
  yellow: { bg: '#fef9c3', border: '#fbbf24', headerBg: '#fde68a', text: '#92400e', dateTxt: '#b45309' },
  blue:   { bg: '#dbeafe', border: '#60a5fa', headerBg: '#bfdbfe', text: '#1e40af', dateTxt: '#2563eb' },
  green:  { bg: '#dcfce7', border: '#4ade80', headerBg: '#bbf7d0', text: '#166534', dateTxt: '#15803d' },
  pink:   { bg: '#fce7f3', border: '#f472b6', headerBg: '#fbcfe8', text: '#9d174d', dateTxt: '#be185d' },
  purple: { bg: '#ede9fe', border: '#a78bfa', headerBg: '#ddd6fe', text: '#5b21b6', dateTxt: '#7c3aed' }
};

// ── Load Notes ──
async function loadPersonalNotes() {
  const sc = getEffectiveStaffCode();
  if (!sc) return;
  try {
    // Fetch my own notes
    const res1 = await sbFetch(`/rest/v1/personal_notes?owner_staff_code=eq.${encodeURIComponent(sc)}&order=updated_at.desc`);
    _allMyNotes = res1.ok ? await res1.json() : [];

    // Fetch ALL share records involving me (either shared WITH me or shared BY me)
    const encodedSc = encodeURIComponent(sc);
    const res2 = await sbFetch(`/rest/v1/note_shares?or=(shared_with.eq.${encodedSc},shared_by.eq.${encodedSc})&select=*`);
    const shares = res2.ok ? await res2.json() : [];
    
    // Separate shares
    const sharesWithMe = shares.filter(s => s.shared_with === sc);
    const sharesByMe = shares.filter(s => s.shared_by === sc);

    // Tag my own notes that I've shared
    const mySharedNoteIds = new Set(sharesByMe.map(s => s.note_id));
    _allMyNotes.forEach(n => {
      n._isSharedByMe = mySharedNoteIds.has(n.id);
    });

    _sharedWithMeNotes = [];
    if (sharesWithMe.length > 0) {
      const noteIds = sharesWithMe.map(s => s.note_id).filter(Boolean);
      const res3 = await sbFetch(`/rest/v1/personal_notes?id=in.(${noteIds.join(',')})&select=*`);
      const sharedNotes = res3.ok ? await res3.json() : [];
      const noteMap = {};
      sharedNotes.forEach(n => noteMap[n.id] = n);
      
      _sharedWithMeNotes = sharesWithMe
        .filter(s => noteMap[s.note_id])
        .map(s => ({
          ...noteMap[s.note_id],
          _shared: true,
          _sharedBy: s.shared_by,
          _canEdit: s.can_edit,
          _shareId: s.id
        }));
    }

    _dataCache['notes'] = Date.now();
    renderNotes();
  } catch(e) {
    console.error('[Notes] load error:', e);
  }
}

// ── Render Notes ──
let _notesBoardLayouts = {};
try { _notesBoardLayouts = JSON.parse(localStorage.getItem('cj_notes_board')) || {}; } catch(e) {}

function _isNotesOnBoard() {
  return typeof _isDesktopApplied !== 'undefined' && _isDesktopApplied &&
    typeof _isTabPinned === 'function' && _isTabPinned('notes');
}

function renderNotes() {
  const container = document.getElementById('notesPanelList');
  if (!container) return;

  let notes = [];
  if (_notesFilter === 'shared') {
    const myShared = _allMyNotes.filter(n => n._isSharedByMe);
    const setIds = new Set(myShared.map(n => n.id));
    notes = [...myShared, ..._sharedWithMeNotes.filter(n => !setIds.has(n.id))];
  } else {
    const myIds = new Set(_allMyNotes.map(n => n.id));
    notes = [..._allMyNotes, ..._sharedWithMeNotes.filter(n => !myIds.has(n.id))];
  }

  notes.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  const countEl = document.getElementById('notesCount');
  if (countEl) countEl.textContent = notes.length;

  if (notes.length === 0) {
    container.classList.remove('notes-board');
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${_notesFilter === 'shared' ? '📤' : '📝'}</div><div class="empty-sub">${_notesFilter === 'shared' ? 'Chưa có ghi chú được share' : 'Chưa có ghi chú nào'}</div></div>`;
    return;
  }

  if (_isNotesOnBoard()) {
    // Board mode
    container.classList.add('notes-board');
    container.innerHTML = notes.map((n, i) => renderBoardNoteCard(n, i)).join('');
    // Attach drag/resize handlers after DOM render
    requestAnimationFrame(() => _initBoardNotes(container));
  } else {
    // List mode (mobile)
    container.classList.remove('notes-board');
    container.innerHTML = notes.map(n => renderNoteCard(n)).join('');
  }
}

function stripHtml(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
}

function renderNoteCard(note) {
  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isShared = note._shared;
  const canEdit = !isShared || note._canEdit;
  const timeAgo = getTimeAgo(note.updated_at);

  let linkedBadge = '';
  if (note.linked_profile_id) {
    const p = allProfiles.find(p => p.id === note.linked_profile_id);
    if (p) {
      linkedBadge = `<span onclick="event.stopPropagation();openProfileById('${note.linked_profile_id}')" style="font-size:10px;background:rgba(0,0,0,0.08);padding:1px 6px;border-radius:8px;cursor:pointer;color:${c.text};" title="Xem hồ sơ">🔗 ${escHtml(p.full_name || '?')}</span>`;
    }
  }

  let calBadge = '';
  if (note.cal_date) {
    calBadge = `<span style="font-size:10px;background:rgba(249,115,22,0.15);padding:1px 6px;border-radius:8px;color:#ea580c;">📅 ${note.cal_date.split('-').reverse().join('/')}</span>`;
  }

  let alarmBadge = '';
  if (note.reminder_at && !note.reminder_sent) {
    const rAt = new Date(note.reminder_at);
    const rTime = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
    const rDate = `${String(rAt.getDate()).padStart(2,'0')}/${String(rAt.getMonth()+1).padStart(2,'0')}`;
    alarmBadge = `<span style="font-size:10px;color:#fbbf24;background:rgba(251,191,36,0.12);padding:1px 6px;border-radius:8px;">🔔 ${rDate} ${rTime}</span>`;
  } else if (note.reminder_sent) {
    alarmBadge = `<span style="font-size:10px;color:var(--text3);background:var(--surface2);padding:1px 6px;border-radius:8px;">✅ Đã nhắc</span>`;
  }

  let sharedBadge = '';
  if (isShared) {
    const sharer = allStaff.find(s => s.staff_code === note._sharedBy);
    sharedBadge = `<span style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 6px;border-radius:8px;color:${c.dateTxt};">📤 ${escHtml(sharer?.full_name || note._sharedBy)}</span>`;
  }

  let shareCount = '';
  if (!isShared && note._isSharedByMe) {
    shareCount = `<span style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 6px;border-radius:8px;color:${c.dateTxt};" title="Bạn đã share note này">📤 Đã share</span>`;
  }

  const plainContent = stripHtml(note.content);
  const preview = plainContent.length > 120 ? plainContent.substring(0, 120) + '...' : plainContent;

  return `
  <div class="pnote-card" data-note-id="${note.id}" style="background:${c.bg};border-color:${c.border};" onclick="toggleNoteExpand(this)">
    <div class="pnote-header" style="background:${c.headerBg};">
      <div class="pnote-title-row">
        <span class="pnote-title" ${canEdit ? 'contenteditable="true"' : ''} onblur="saveNoteInlineTitle(this, '${note.id}')" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" onclick="event.stopPropagation();" style="color:${c.text};">${escHtml(note.title || 'Ghi chú')}</span>
      </div>
      <span class="pnote-time" style="color:${c.dateTxt};">${timeAgo}</span>
    </div>
    <div class="pnote-body" style="color:${c.text};">
      <div class="pnote-preview">${escHtml(preview)}</div>
      <div class="pnote-full" ${canEdit ? 'contenteditable="true"' : ''} oninput="debounceSaveNoteInline('${note.id}')" onblur="saveNoteInline('${note.id}')" onclick="event.stopPropagation();" style="display:none; outline:none; text-align:left; min-height:60px;">${note.content}</div>
    </div>
    <div class="pnote-footer">
      <div class="pnote-badges">${linkedBadge}${calBadge}${alarmBadge}${sharedBadge}${shareCount}</div>
      ${canEdit ? `
      <div class="pnote-actions">
        <button onclick="event.stopPropagation();openShareNoteModal('${note.id}')" title="Share" style="color:${c.dateTxt};">📤</button>
        <button onclick="event.stopPropagation();openEditNoteModal('${note.id}')" title="Sửa thuộc tính" style="color:${c.dateTxt};">⚙️</button>
        <button onclick="event.stopPropagation();deletePersonalNote('${note.id}')" title="Xoá" style="color:#dc2626;">🗑️</button>
      </div>` : `
      <div class="pnote-actions">
        <button onclick="event.stopPropagation();copyNoteContent('${note.id}')" title="Copy" style="color:${c.dateTxt};">📋</button>
      </div>`}
    </div>
  </div>`;
}

// ── Board Mode Cards ──
function renderBoardNoteCard(note, idx) {
  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isShared = note._shared;
  const canEdit = !isShared || note._canEdit;
  const timeAgo = getTimeAgo(note.updated_at);

  // Restore saved layout or use grid positions
  const saved = _notesBoardLayouts[note.id];
  const containerEl = document.getElementById('notesPanelList');
  const cw = containerEl ? containerEl.offsetWidth : 500;
  const cols = Math.max(2, Math.floor(cw / 180));
  const cardW = Math.floor((cw - (cols + 1) * 8) / cols);
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  const x = saved?.x ?? (8 + col * (cardW + 8));
  const y = saved?.y ?? (8 + row * 170);
  const w = saved?.w ?? cardW;
  const h = saved?.h ?? 155;

  // Linked profile badge
  let linkedBadge = '';
  if (note.linked_profile_id) {
    const p = allProfiles.find(p => p.id === note.linked_profile_id);
    if (p) {
      linkedBadge = `<span class="board-badge board-badge-link" onclick="event.stopPropagation();openProfileById('${note.linked_profile_id}')" title="Xem hồ sơ">🔗 ${escHtml(p.full_name || '?')}</span>`;
    }
  }

  // Shared badge
  let sharedBadge = '';
  if (isShared) {
    const sharer = allStaff.find(s => s.staff_code === note._sharedBy);
    sharedBadge = `<span class="board-badge">📤 ${escHtml(sharer?.full_name || note._sharedBy)}</span>`;
  } else if (note._isSharedByMe) {
    sharedBadge = `<span class="board-badge">📤 Đã share</span>`;
  }

  // Calendar date badge
  let calBadge = '';
  if (note.cal_date) {
    calBadge = `<span class="board-badge" style="color:#ea580c;background:rgba(249,115,22,0.15);">📅 ${note.cal_date.split('-').reverse().join('/')}</span>`;
  }

  // Alarm badge
  let alarmBadge = '';
  if (note.reminder_at && !note.reminder_sent) {
    const rAt = new Date(note.reminder_at);
    const rTime = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
    const rDate = `${String(rAt.getDate()).padStart(2,'0')}/${String(rAt.getMonth()+1).padStart(2,'0')}`;
    alarmBadge = `<span class="board-badge" style="color:#fbbf24;background:rgba(251,191,36,0.12);">🔔 ${rDate} ${rTime}</span>`;
  }

  // Restore floating coordinates if floated
  let isFloating = note._isFloating;
  if (_notesBoardLayouts[note.id]?.isFloating) {
    isFloating = true;
  }

  const floatBtn = canEdit ? `
    <button onclick="event.stopPropagation();toggleFloatNote('${note.id}')" title="${isFloating ? 'Ghim vào bảng' : 'Thả nổi ghi chú'}" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;" id="floatBtn-${note.id}">${isFloating ? '📌' : '📤'}</button>` : '';

  const maxBtn = canEdit ? `
    <button onclick="event.stopPropagation();toggleMaximizeNote('${note.id}')" title="Phóng to/Thu nhỏ" style="background:none;border:none;cursor:pointer;font-size:12px;padding:2px;" id="maxBtn-${note.id}">🔍</button>` : '';

  const actionBtns = canEdit ? `
    ${floatBtn}
    ${maxBtn}
    <button onclick="event.stopPropagation();openEditNoteModal('${note.id}')" title="Sửa thuộc tính">⚙️</button>
    <button onclick="event.stopPropagation();openShareNoteModal('${note.id}')" title="Share">📤</button>
    <button onclick="event.stopPropagation();deletePersonalNote('${note.id}')" title="Xoá" style="color:#dc2626;">🗑️</button>` : '';

  const floatingClass = isFloating ? 'board-note-floating' : '';
  const floatingStyles = isFloating ? `position:fixed; z-index:999999; left:${_notesBoardLayouts[note.id]?.fx ?? 200}px; top:${_notesBoardLayouts[note.id]?.fy ?? 200}px; width:${_notesBoardLayouts[note.id]?.fw ?? 350}px; height:${_notesBoardLayouts[note.id]?.fh ?? 280}px;` : `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;

  return `<div class="board-note ${floatingClass}" id="boardNote-${note.id}" data-note-id="${note.id}" 
    style="${floatingStyles}background:${c.bg};border-color:${c.border};">
    <div class="board-note-header" style="background:${c.headerBg};color:${c.text};">
      <span class="board-note-title" ${canEdit ? 'contenteditable="true"' : ''} onblur="saveNoteInlineTitle(this, '${note.id}')" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">${escHtml(note.title || 'Ghi chú')}</span>
      <span class="board-note-time" style="color:${c.dateTxt};">${timeAgo}</span>
    </div>
    
    ${canEdit ? `
    <!-- Note Editor Rich-Text Bottom Toolbar (Now Top Block under Header) -->
    <div class="note-toolbar" id="noteToolbar-${note.id}">
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('bold', '${note.id}')" title="In đậm"><b>B</b></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('italic', '${note.id}')" title="In nghiêng"><i>I</i></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('underline', '${note.id}')" title="Gạch chân"><u>U</u></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('strikeThrough', '${note.id}')" title="Gạch ngang"><s>ab</s></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('insertUnorderedList', '${note.id}')" title="Danh sách">☰</button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="toggleMediaLinkPopover(event, '${note.id}')" title="Chèn Ảnh/Video/Audio">🖼️</button>
    </div>
    <!-- Media link insert popover -->
    <div class="media-link-popover" id="mediaPopover-${note.id}" style="display:none;" onmousedown="event.stopPropagation();">
      <input type="text" placeholder="Dán link ảnh, mp3, mp4, youtube..." onkeydown="if(event.key==='Enter') { insertMediaUrl('${note.id}', this.value, this); this.value=''; }" style="width:100%; box-sizing:border-box; margin-bottom:4px;" />
      <div style="font-size:8px;color:var(--text3);margin-top:2px;font-weight:bold;text-align:left;">Mẫu thử nhanh:</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;">
        <button class="chip" onmousedown="event.preventDefault();" onclick="insertMediaUrl('${note.id}', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', this)" style="font-size:7px;padding:2px 4px;margin:1px 0;">🎵 Nhạc mp3</button>
        <button class="chip" onmousedown="event.preventDefault();" onclick="insertMediaUrl('${note.id}', 'https://www.w3schools.com/html/mov_bbb.mp4', this)" style="font-size:7px;padding:2px 4px;margin:1px 0;">📹 Video mp4</button>
        <button class="chip" onmousedown="event.preventDefault();" onclick="insertMediaUrl('${note.id}', 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300', this)" style="font-size:7px;padding:2px 4px;margin:1px 0;">🖼️ Ảnh đẹp</button>
      </div>
    </div>
    ` : ''}

    <div class="board-note-body" style="color:${c.text}; position:relative; overflow:auto; flex:1;">
      <div class="board-note-content" id="noteContent-${note.id}" ${canEdit ? 'contenteditable="true"' : ''} oninput="debounceSaveNoteInline('${note.id}')" onblur="saveNoteInline('${note.id}')" style="min-height:90px; outline:none; text-align:left; word-wrap:break-word; padding:4px;">${note.content}</div>
    </div>

    <div class="board-note-footer">
      <div class="board-note-badges">${linkedBadge}${calBadge}${alarmBadge}${sharedBadge}</div>
      <div class="board-note-actions" style="color:${c.dateTxt};">${actionBtns}</div>
    </div>
    <div class="board-note-resize"></div>
  </div>`;
}

// ── Board Interactions ──
let _boardClickOutHandler = null;

function _initBoardNotes(container) {
  // Show auto-arrange button
  const arrangeBtn = document.getElementById('btnAutoArrange');
  if (arrangeBtn) arrangeBtn.style.display = '';

  // Remove old click-outside handler
  if (_boardClickOutHandler) document.removeEventListener('mousedown', _boardClickOutHandler);

  // Click outside any expanded note → collapse it
  _boardClickOutHandler = (e) => {
    const expanded = container.querySelector('.board-note-expanded');
    if (!expanded) return;
    if (!expanded.contains(e.target)) {
      _collapseNote(expanded);
    }
  };
  document.addEventListener('mousedown', _boardClickOutHandler);

  // Clean old floating notes from body before moving them again
  document.querySelectorAll('body > .board-note-floating').forEach(el => {
    if (!container.querySelector(`[data-note-id="${el.dataset.noteId}"]`)) {
      el.remove();
    }
  });

  // Global click outside to close media popovers
  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.media-link-popover') && !e.target.closest('.note-toolbar-btn')) {
      document.querySelectorAll('.media-link-popover').forEach(p => p.style.display = 'none');
    }
  });

  container.querySelectorAll('.board-note').forEach(el => {
    const noteId = el.dataset.noteId;
    const isFloating = _notesBoardLayouts[noteId]?.isFloating;

    // Bind media handlers
    const contentEl = el.querySelector('.board-note-content');
    if (contentEl) {
      _initNoteEmbeddedMedia(contentEl, noteId);
    }

    if (isFloating) {
      document.body.appendChild(el);
      el.classList.add('board-note-floating');
    }

    const header = el.querySelector('.board-note-header');
    const resizeHandle = el.querySelector('.board-note-resize');

    // ─ Drag ─
    let dragState = null;
    let wasDragged = false;
    header.addEventListener('mousedown', e => {
      if (e.target.closest('button') || e.target.closest('.board-badge-link') || e.target.closest('.note-toolbar')) return;
      e.preventDefault();
      wasDragged = false;
      
      const rect = el.getBoundingClientRect();
      const parentRect = isFloating ? { left: 0, top: 0 } : container.getBoundingClientRect();
      
      dragState = { 
        offX: e.clientX - rect.left, 
        offY: e.clientY - rect.top,
        parentLeft: parentRect.left,
        parentTop: parentRect.top,
        startX: e.clientX,
        startY: e.clientY
      };
      
      el.style.zIndex = ++_boardZIndex;
      el.classList.add('board-note-dragging');
      document.body.classList.add('panel-resizing');

      let _raf = 0, _lastX = 0, _lastY = 0;
      const onMove = ev => {
        _lastX = ev.clientX; _lastY = ev.clientY;
        if (!dragState) return;
        if (Math.abs(_lastX - dragState.startX) > 3 || Math.abs(_lastY - dragState.startY) > 3) {
          wasDragged = true;
        }
        if (_raf) return;
        _raf = requestAnimationFrame(() => {
          _raf = 0;
          if (!dragState) return;
          const x = _lastX - dragState.parentLeft - dragState.offX;
          const y = _lastY - dragState.parentTop - dragState.offY;
          if (isFloating) {
            el.style.left = x + 'px';
            el.style.top = y + 'px';
          } else {
            el.style.left = Math.max(0, x) + 'px';
            el.style.top = Math.max(0, y) + 'px';
          }
        });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (_raf) { cancelAnimationFrame(_raf); _raf = 0; }
        el.classList.remove('board-note-dragging');
        document.body.classList.remove('panel-resizing');
        dragState = null;
        
        if (isFloating) {
          if (!_notesBoardLayouts[noteId]) _notesBoardLayouts[noteId] = { isFloating: true };
          _notesBoardLayouts[noteId].fx = parseInt(el.style.left) || 0;
          _notesBoardLayouts[noteId].fy = parseInt(el.style.top) || 0;
          try { localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts)); } catch(e) {}
        } else {
          _saveBoardLayout(container);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ─ Resize ─
    resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX, startY = e.clientY;
      const startW = el.offsetWidth, startH = el.offsetHeight;
      el.style.zIndex = ++_boardZIndex;
      document.body.classList.add('panel-resizing');

      let _raf2 = 0, _lastRX = 0, _lastRY = 0;
      const onMove = ev => {
        _lastRX = ev.clientX; _lastRY = ev.clientY;
        if (_raf2) return;
        _raf2 = requestAnimationFrame(() => {
          _raf2 = 0;
          const newW = Math.max(120, startW + (_lastRX - startX));
          const newH = Math.max(80, startH + (_lastRY - startY));
          el.style.width = newW + 'px';
          el.style.height = newH + 'px';
        });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (_raf2) { cancelAnimationFrame(_raf2); _raf2 = 0; }
        document.body.classList.remove('panel-resizing');
        
        if (isFloating) {
          if (!_notesBoardLayouts[noteId]) _notesBoardLayouts[noteId] = { isFloating: true };
          _notesBoardLayouts[noteId].fw = el.offsetWidth;
          _notesBoardLayouts[noteId].fh = el.offsetHeight;
          try { localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts)); } catch(e) {}
        } else {
          _saveBoardLayout(container);
        }
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ─ Click to expand (only for non-floating) ─
    el.addEventListener('click', e => {
      if (isFloating) return;
      if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.board-badge-link') || e.target.closest('.board-note-resize') || e.target.closest('.note-toolbar') || e.target.closest('.media-link-popover')) return;
      if (wasDragged) { wasDragged = false; return; }
      if (el.classList.contains('board-note-expanded')) {
        _collapseNote(el);
      } else {
        const prev = container.querySelector('.board-note-expanded');
        if (prev) _collapseNote(prev);
        _expandNote(el, container);
      }
    });
  });
}

function _expandNote(el, container) {
  el.dataset.origW = el.style.width;
  el.dataset.origH = el.style.height;
  el.classList.add('board-note-expanded');
  el.style.width = Math.min(380, container.offsetWidth - 20) + 'px';
  el.style.height = 'auto';
  el.style.minHeight = '180px';
  el.style.maxHeight = (container.offsetHeight - 40) + 'px';
  el.style.zIndex = ++_boardZIndex;
}

function _collapseNote(el) {
  el.classList.remove('board-note-expanded');
  el.classList.add('board-note-collapsing');
  el.style.width = el.dataset.origW || '160px';
  el.style.height = el.dataset.origH || '155px';
  el.style.minHeight = '';
  el.style.maxHeight = '';
  setTimeout(() => el.classList.remove('board-note-collapsing'), 300);
}

let _boardZIndex = 10;

function _saveBoardLayout(container) {
  if (!container) container = document.getElementById('notesPanelList');
  if (!container) return;
  container.querySelectorAll('.board-note').forEach(el => {
    if (el.classList.contains('board-note-expanded')) return; // don't save expanded size
    _notesBoardLayouts[el.dataset.noteId] = {
      x: parseInt(el.style.left) || 0,
      y: parseInt(el.style.top) || 0,
      w: el.offsetWidth,
      h: el.offsetHeight
    };
  });
  try { localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts)); } catch(e) {}
}

// ── Auto-arrange: reset notes to a tidy grid ──
function autoArrangeNotes() {
  const container = document.getElementById('notesPanelList');
  if (!container) return;
  const cards = container.querySelectorAll('.board-note');
  if (cards.length === 0) return;
  const cw = container.offsetWidth;
  const cols = Math.max(2, Math.floor(cw / 180));
  const cardW = Math.floor((cw - (cols + 1) * 8) / cols);
  cards.forEach((el, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Collapse if expanded
    if (el.classList.contains('board-note-expanded')) _collapseNote(el);
    el.style.transition = 'left 0.35s ease, top 0.35s ease, width 0.35s ease, height 0.35s ease';
    el.style.left = (8 + col * (cardW + 8)) + 'px';
    el.style.top = (8 + row * 170) + 'px';
    el.style.width = cardW + 'px';
    el.style.height = '155px';
  });
  // Clear saved layouts
  _notesBoardLayouts = {};
  try { localStorage.removeItem('cj_notes_board'); } catch(e) {}
  // Remove transition after animation
  setTimeout(() => {
    cards.forEach(el => el.style.transition = '');
    _saveBoardLayout(container);
  }, 400);
}

// ── UI Interactions (list mode) ──
function toggleNoteExpand(el) {
  const preview = el.querySelector('.pnote-preview');
  const full = el.querySelector('.pnote-full');
  if (!preview || !full) return;
  const isExpanded = full.style.display !== 'none';
  preview.style.display = isExpanded ? 'block' : 'none';
  full.style.display = isExpanded ? 'none' : 'block';
}

function setNotesFilter(filter, chipEl) {
  _notesFilter = filter;
  document.querySelectorAll('#notesFilterChips .chip').forEach(c => c.classList.remove('selected'));
  if (chipEl) chipEl.classList.add('selected');
  renderNotes();
}

// ── CRUD Operations ──
function openCreateNoteModal() {
  _editingNoteId = null;
  document.getElementById('pnoteModalTitle').textContent = '📝 Ghi chú mới';
  document.getElementById('pnote_title').value = '';
  document.getElementById('pnote_content').value = '';
  document.getElementById('pnote_link_profile').value = '';
  document.getElementById('pnote_cal_date').value = '';
  
  // Show content textarea container for new notes
  const contentGroup = document.getElementById('pnote_content')?.closest('.field-group');
  if (contentGroup) contentGroup.style.display = 'block';

  // Clear alarm fields
  const alarmDate = document.getElementById('pnote_alarm_date');
  const alarmTime = document.getElementById('pnote_alarm_time');
  if (alarmDate) alarmDate.value = '';
  if (alarmTime) alarmTime.value = '';
  // Reset color selection
  document.querySelectorAll('#pnoteColorPicker .pnote-color-opt').forEach(c => c.classList.remove('selected'));
  const defaultColor = document.querySelector('#pnoteColorPicker .pnote-color-opt[data-color="yellow"]');
  if (defaultColor) defaultColor.classList.add('selected');
  document.getElementById('pnoteDeleteBtn').style.display = 'none';
  document.getElementById('createNoteModal').classList.add('open');
}

function openEditNoteModal(noteId) {
  const note = _allMyNotes.find(n => n.id === noteId) || _sharedWithMeNotes.find(n => n.id === noteId);
  if (!note) return;
  _editingNoteId = noteId;
  document.getElementById('pnoteModalTitle').textContent = '✏️ Sửa ghi chú';
  document.getElementById('pnote_title').value = note.title || '';
  document.getElementById('pnote_content').value = note.content || '';

  // Hide content textarea container since notes are edited directly inline
  const contentGroup = document.getElementById('pnote_content')?.closest('.field-group');
  if (contentGroup) contentGroup.style.display = 'none';

  // Set linked profile
  const linkInput = document.getElementById('pnote_link_profile');
  if (note.linked_profile_id) {
    const p = allProfiles.find(p => p.id === note.linked_profile_id);
    linkInput.value = p ? p.full_name : '';
    linkInput.dataset.profileId = note.linked_profile_id;
  } else {
    linkInput.value = '';
    linkInput.dataset.profileId = '';
  }

  // Set color
  document.querySelectorAll('#pnoteColorPicker .pnote-color-opt').forEach(c => c.classList.remove('selected'));
  const colorEl = document.querySelector(`#pnoteColorPicker .pnote-color-opt[data-color="${note.color || 'yellow'}"]`);
  if (colorEl) colorEl.classList.add('selected');

  // Set cal_date
  const calDateInput = document.getElementById('pnote_cal_date');
  if (calDateInput) calDateInput.value = note.cal_date || '';

  // Set alarm fields
  const alarmDate = document.getElementById('pnote_alarm_date');
  const alarmTime = document.getElementById('pnote_alarm_time');
  if (note.reminder_at) {
    const rAt = new Date(note.reminder_at);
    if (alarmDate) alarmDate.value = `${rAt.getFullYear()}-${String(rAt.getMonth()+1).padStart(2,'0')}-${String(rAt.getDate()).padStart(2,'0')}`;
    if (alarmTime) alarmTime.value = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
  } else {
    if (alarmDate) alarmDate.value = '';
    if (alarmTime) alarmTime.value = '';
  }

  document.getElementById('pnoteDeleteBtn').style.display = 'block';
  document.getElementById('createNoteModal').classList.add('open');
}

function getSelectedNoteColor() {
  const sel = document.querySelector('#pnoteColorPicker .pnote-color-opt.selected');
  return sel ? sel.dataset.color : 'yellow';
}

function selectNoteColor(el) {
  document.querySelectorAll('#pnoteColorPicker .pnote-color-opt').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

async function savePersonalNote() {
  const sc = getEffectiveStaffCode();
  if (!sc) { showToast('Chưa xác định được tài khoản'); return; }

  const title = document.getElementById('pnote_title').value.trim();
  const color = getSelectedNoteColor();
  const linkInput = document.getElementById('pnote_link_profile');
  const rawId = (linkInput.dataset.profileId || '').trim();
  const linkedProfileId = rawId.length > 10 ? rawId : null; // uuid is 36 chars

  // Preserve existing rich HTML note content when editing properties in the modal
  let content = '';
  if (_editingNoteId) {
    const existing = _allMyNotes.find(n => n.id === _editingNoteId) || _sharedWithMeNotes.find(n => n.id === _editingNoteId);
    content = existing ? existing.content : '';
  } else {
    content = document.getElementById('pnote_content').value.trim();
    if (!content) { showToast('Vui lòng nhập nội dung'); return; }
  }

  const calDate = document.getElementById('pnote_cal_date')?.value || null;

  // Alarm fields
  const alarmD = document.getElementById('pnote_alarm_date')?.value;
  const alarmT = document.getElementById('pnote_alarm_time')?.value;
  let reminderAt = null;
  let reminderSent = undefined; // don't change unless we set a new reminder
  if (alarmD && alarmT) {
    reminderAt = new Date(`${alarmD}T${alarmT}:00`).toISOString();
    reminderSent = false; // reset sent flag for new/changed alarm
  } else if (!alarmD && !alarmT) {
    // User cleared alarm — null it out
    reminderAt = null;
    reminderSent = false;
  }

  const body = {
    title: title || null,
    content,
    color,
    linked_profile_id: linkedProfileId,
    cal_date: calDate || null,
    reminder_at: reminderAt,
    reminder_sent: reminderSent !== undefined ? reminderSent : false,
    updated_at: new Date().toISOString()
  };

  try {
    if (_editingNoteId) {
      // Update
      const res = await sbFetch(`/rest/v1/personal_notes?id=eq.${_editingNoteId}`, {
        method: 'PATCH',
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('💾 Đã cập nhật');
    } else {
      // Insert
      body.owner_staff_code = sc;
      const res = await sbFetch('/rest/v1/personal_notes', {
        method: 'POST',
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error(await res.text());
      showToast('📝 Đã tạo ghi chú');
    }
    closeModal('createNoteModal');
    _editingNoteId = null;
    await loadPersonalNotes();
    if (typeof invalidateCache === 'function') invalidateCache();
    if (typeof loadCalendar === 'function') loadCalendar(true);
  } catch(e) {
    console.error('[Notes] save error:', e);
    showToast('Lỗi lưu ghi chú');
  }
}

async function deletePersonalNote(noteId) {
  const ok = await showConfirmAsync('Xoá ghi chú này?');
  if (!ok) return;
  try {
    // Delete shares first (cascade should handle, but be safe)
    await sbFetch(`/rest/v1/note_shares?note_id=eq.${noteId}`, { method: 'DELETE' });
    const res = await sbFetch(`/rest/v1/personal_notes?id=eq.${noteId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    showToast('🗑️ Đã xoá');
    closeModal('createNoteModal');
    _editingNoteId = null;
    await loadPersonalNotes();
    if (typeof invalidateCache === 'function') invalidateCache();
    if (typeof loadCalendar === 'function') loadCalendar(true);
  } catch(e) {
    console.error('[Notes] delete error:', e);
    showToast('Lỗi xoá ghi chú');
  }
}

// Pin function removed — no longer used

function copyNoteContent(noteId) {
  const note = _allMyNotes.find(n => n.id === noteId) || _sharedWithMeNotes.find(n => n.id === noteId);
  if (!note) return;
  const text = (note.title ? note.title + '\n' : '') + note.content;
  copyToClipboard(text);
}

// ── Share System ──
async function openShareNoteModal(noteId) {
  document.getElementById('shareNoteId').value = noteId;
  document.getElementById('shareNoteStaff').value = '';
  document.getElementById('shareNoteCanEdit').checked = false;

  // Load existing shares for this note
  try {
    const res = await sbFetch(`/rest/v1/note_shares?note_id=eq.${noteId}&select=*`);
    const shares = res.ok ? await res.json() : [];
    const listEl = document.getElementById('shareNoteExistingList');

    if (shares.length === 0) {
      listEl.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:8px 0;">Chưa share cho ai</div>';
    } else {
      listEl.innerHTML = shares.map(s => {
        const staff = allStaff.find(st => st.staff_code === s.shared_with);
        const name = staff ? `${staff.full_name} (${s.shared_with})` : s.shared_with;
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
          <div>
            <span style="font-size:13px;font-weight:500;">${escHtml(name)}</span>
            <span style="font-size:10px;color:var(--text3);margin-left:6px;">${s.can_edit ? '✏️ Sửa được' : '👁️ Chỉ xem'}</span>
          </div>
          <button onclick="removeNoteShare('${s.id}','${noteId}')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:14px;padding:4px;" title="Huỷ share">✕</button>
        </div>`;
      }).join('');
    }
  } catch(e) {
    console.error('[Notes] load shares error:', e);
  }

  document.getElementById('shareNoteModal').classList.add('open');
}

async function addNoteShare() {
  const noteId = document.getElementById('shareNoteId').value;
  const staffInput = document.getElementById('shareNoteStaff').value.trim();
  const canEdit = document.getElementById('shareNoteCanEdit').checked;
  const sc = getEffectiveStaffCode();

  if (!staffInput) { showToast('Chọn TĐ để share'); return; }

  // Parse staff code from autocomplete (format: "name (CODE)" or just code)
  let targetCode = staffInput;
  const match = staffInput.match(/\(([^)]+)\)$/);
  if (match) targetCode = match[1];

  // Find staff
  const target = allStaff.find(s =>
    s.staff_code === targetCode ||
    s.staff_code === staffInput ||
    s.full_name === staffInput
  );
  if (!target) { showToast('Không tìm thấy TĐ'); return; }
  if (target.staff_code === sc) { showToast('Không thể share cho chính mình'); return; }

  try {
    const res = await sbFetch('/rest/v1/note_shares', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        note_id: noteId,
        shared_with: target.staff_code,
        shared_by: sc,
        can_edit: canEdit
      })
    });
    if (!res.ok) {
      const err = await res.text();
      if (err.includes('duplicate') || err.includes('unique')) {
        showToast('Đã share cho TĐ này rồi');
      } else {
        throw new Error(err);
      }
      return;
    }
    showToast(`📤 Đã share cho ${target.full_name}`);
    document.getElementById('shareNoteStaff').value = '';
    // Refresh the share list in modal
    await openShareNoteModal(noteId);
  } catch(e) {
    console.error('[Notes] share error:', e);
    showToast('Lỗi share ghi chú');
  }
}

async function removeNoteShare(shareId, noteId) {
  try {
    await sbFetch(`/rest/v1/note_shares?id=eq.${shareId}`, { method: 'DELETE' });
    showToast('Đã huỷ share');
    await openShareNoteModal(noteId);
  } catch(e) {
    console.error('[Notes] remove share error:', e);
  }
}

// ── Profile Link Autocomplete ──
function setupNotesProfileAutocomplete() {
  const input = document.getElementById('pnote_link_profile');
  if (!input || input.dataset.acInit) return;
  input.dataset.acInit = '1';

  const wrap = document.createElement('div');
  wrap.className = 'ac-wrap';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const list = document.createElement('div');
  list.className = 'ac-list';
  wrap.appendChild(list);

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q || q.length < 1) { list.classList.remove('show'); return; }
    const matches = allProfiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (matches.length === 0) { list.classList.remove('show'); return; }
    list.innerHTML = matches.map(p =>
      `<div class="ac-item" data-id="${p.id}" data-name="${escHtml(p.full_name || '')}">${escHtml(p.full_name || '?')}</div>`
    ).join('');
    list.classList.add('show');
  });

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.ac-item');
    if (!item) return;
    input.value = item.dataset.name;
    input.dataset.profileId = item.dataset.id;
    list.classList.remove('show');
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) list.classList.remove('show');
  });
}

// ── Polling for shared notes ──
function startNotesPoll() {
  if (_notesPollTimer) clearInterval(_notesPollTimer);
  _notesPollTimer = setInterval(() => {
    // Only poll if notes tab is visible
    const tabEl = document.getElementById('tab-notes');
    if (tabEl && tabEl.style.display !== 'none') {
      loadPersonalNotes();
    }
  }, 60000); // 60s
}

function stopNotesPoll() {
  if (_notesPollTimer) { clearInterval(_notesPollTimer); _notesPollTimer = null; }
}

// escHtml() → moved to utils.js

// ── Init (called when tab opens) ──
function initNotesTab() {
  setupNotesProfileAutocomplete();
  if (!isFresh('notes')) loadPersonalNotes();
  startNotesPoll();
}

// ── Note Alarm Helpers ──
function setNoteAlarmPreset(minutes) {
  const r = new Date(Date.now() + minutes * 60000);
  const dEl = document.getElementById('pnote_alarm_date');
  const tEl = document.getElementById('pnote_alarm_time');
  if (dEl) dEl.value = `${r.getFullYear()}-${String(r.getMonth()+1).padStart(2,'0')}-${String(r.getDate()).padStart(2,'0')}`;
  if (tEl) tEl.value = `${String(r.getHours()).padStart(2,'0')}:${String(r.getMinutes()).padStart(2,'0')}`;
}

function clearNoteAlarm() {
  const dEl = document.getElementById('pnote_alarm_date');
  const tEl = document.getElementById('pnote_alarm_time');
  if (dEl) dEl.value = '';
  if (tEl) tEl.value = '';
}

// ============ ADVANCED PERSONAL NOTES INTERACTION ENGINE ============
let _noteDebounceTimers = {};

async function saveNoteInlineTitle(el, noteId) {
  const title = el.textContent.trim();
  try {
    const res = await sbFetch(`/rest/v1/personal_notes?id=eq.${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: title || null,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(await res.text());
    
    // Update local cache
    const note = _allMyNotes.find(n => n.id === noteId) || _sharedWithMeNotes.find(n => n.id === noteId);
    if (note) note.title = title || null;
  } catch(e) {
    console.error('[Notes] save inline title error:', e);
    showToast('Lỗi lưu tiêu đề');
  }
}

function debounceSaveNoteInline(noteId) {
  if (_noteDebounceTimers[noteId]) clearTimeout(_noteDebounceTimers[noteId]);
  _noteDebounceTimers[noteId] = setTimeout(() => {
    delete _noteDebounceTimers[noteId];
    saveNoteInline(noteId);
  }, 1000);
}

async function saveNoteInline(noteId) {
  let content = '';
  const bEl = document.getElementById(`noteContent-${noteId}`);
  if (bEl) {
    content = bEl.innerHTML;
  } else {
    const mEl = document.querySelector(`.pnote-card[data-note-id="${noteId}"] .pnote-full`);
    if (mEl) content = mEl.innerHTML;
  }
  
  if (!bEl && !document.querySelector(`.pnote-card[data-note-id="${noteId}"] .pnote-full`)) return;

  try {
    const res = await sbFetch(`/rest/v1/personal_notes?id=eq.${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        content,
        updated_at: new Date().toISOString()
      })
    });
    if (!res.ok) throw new Error(await res.text());
    
    // Update cache
    const note = _allMyNotes.find(n => n.id === noteId) || _sharedWithMeNotes.find(n => n.id === noteId);
    if (note) {
      note.content = content;
      note.updated_at = new Date().toISOString();
    }
    
    // Update preview text
    const previewEl = document.querySelector(`.pnote-card[data-note-id="${noteId}"] .pnote-preview`);
    if (previewEl) {
      const plainContent = stripHtml(content);
      previewEl.textContent = plainContent.length > 120 ? plainContent.substring(0, 120) + '...' : plainContent;
    }
  } catch(e) {
    console.error('[Notes] save inline content error:', e);
  }
}

function execNoteCmd(cmd, noteId) {
  const el = document.getElementById(`noteContent-${noteId}`);
  if (el) {
    el.focus();
    document.execCommand(cmd, false, null);
    saveNoteInline(noteId);
  }
}

function toggleMediaLinkPopover(event, noteId) {
  event.stopPropagation();
  const pop = document.getElementById(`mediaPopover-${noteId}`);
  if (!pop) return;
  const isHidden = pop.style.display === 'none';
  
  document.querySelectorAll('.media-link-popover').forEach(p => p.style.display = 'none');
  
  if (isHidden) {
    pop.style.display = 'flex';
    const inp = pop.querySelector('input');
    if (inp) {
      inp.focus();
    }
  }
}

function insertMediaUrl(noteId, url, triggerEl) {
  url = (url || '').trim();
  if (!url) return;
  
  const container = document.getElementById(`noteContent-${noteId}`);
  if (!container) return;

  let html = '';
  let type = '';
  
  let ytId = '';
  const ytReg = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(ytReg);
  if (match) {
    ytId = match[1];
    type = 'youtube';
    html = `<iframe src="https://www.youtube.com/embed/${ytId}?enablejsapi=1&loop=1&playlist=${ytId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (/\.(mp3|wav|ogg|aac|m4a)(?:\?|$)/i.test(url)) {
    type = 'audio';
    html = `<audio src="${url}" controls></audio>`;
  } else if (/\.(mp4|webm|ogv|mov)(?:\?|$)/i.test(url)) {
    type = 'video';
    html = `<video src="${url}" controls playsinline></video>`;
  } else {
    type = 'image';
    html = `<img src="${url}" alt="Media" />`;
  }

  const wrapId = 'mediaWrap_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  const defaultWidth = type === 'audio' ? 240 : 200;
  const defaultHeight = type === 'audio' ? 44 : 140;

  const wrapperHtml = `
    <div class="embedded-media-wrapper" id="${wrapId}" contenteditable="false" style="position: absolute; left: 20px; top: 20px; width: ${defaultWidth}px; height: ${defaultHeight}px; z-index: 10;">
      ${html}
      <button class="media-loop-btn" onclick="event.stopPropagation();toggleMediaLoop(this);" title="Phát lại liên tục">🔁</button>
      <div class="media-resize-handle"></div>
    </div>
  `;

  container.focus();
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = wrapperHtml;
  const element = tempDiv.firstElementChild;
  container.appendChild(element);

  const pop = document.getElementById(`mediaPopover-${noteId}`);
  if (pop) pop.style.display = 'none';

  _initEmbeddedMediaHandlers(element, container, noteId);
  saveNoteInline(noteId);
}

function _initNoteEmbeddedMedia(contentEl, noteId) {
  contentEl.querySelectorAll('.embedded-media-wrapper').forEach(wrapper => {
    _initEmbeddedMediaHandlers(wrapper, contentEl, noteId);
  });
}

function _initEmbeddedMediaHandlers(wrapper, contentEl, noteId) {
  const resizeHandle = wrapper.querySelector('.media-resize-handle');
  
  wrapper.addEventListener('mousedown', e => {
    if (e.target.closest('.media-resize-handle') || e.target.closest('.media-loop-btn') || e.target.closest('audio') || e.target.closest('video') || e.target.closest('iframe')) return;
    if (e.target.tagName === 'IMG') e.preventDefault();
    e.stopPropagation();
    
    const rect = wrapper.getBoundingClientRect();
    const parentRect = contentEl.getBoundingClientRect();
    const offX = e.clientX - rect.left;
    const offY = e.clientY - rect.top;
    
    wrapper.style.zIndex = 100;
    
    const onMove = ev => {
      const x = ev.clientX - parentRect.left - offX;
      const y = ev.clientY - parentRect.top - offY;
      wrapper.style.left = x + 'px';
      wrapper.style.top = y + 'px';
    };
    
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      wrapper.style.zIndex = 10;
      saveNoteInline(noteId);
    };
    
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  
  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', e => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = wrapper.offsetWidth;
      const startH = wrapper.offsetHeight;
      
      const onMove = ev => {
        const newW = Math.max(60, startW + (ev.clientX - startX));
        const newH = Math.max(30, startH + (ev.clientY - startY));
        wrapper.style.width = newW + 'px';
        wrapper.style.height = newH + 'px';
      };
      
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveNoteInline(noteId);
      };
      
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }
  
  const mediaBtn = wrapper.querySelector('.media-loop-btn');
  if (mediaBtn) {
    const mediaEl = wrapper.querySelector('audio, video');
    const iframeEl = wrapper.querySelector('iframe');
    if (mediaEl && mediaEl.loop) {
      mediaBtn.classList.add('active');
    } else if (iframeEl && iframeEl.src.includes('loop=1')) {
      mediaBtn.classList.add('active');
    }
  }
}

function toggleMediaLoop(btn) {
  const wrapper = btn.closest('.embedded-media-wrapper');
  if (!wrapper) return;
  
  const isActive = btn.classList.toggle('active');
  const mediaEl = wrapper.querySelector('audio, video');
  const iframeEl = wrapper.querySelector('iframe');
  
  if (mediaEl) {
    if (isActive) {
      mediaEl.loop = true;
      mediaEl.setAttribute('loop', 'true');
    } else {
      mediaEl.loop = false;
      mediaEl.removeAttribute('loop');
    }
  } else if (iframeEl) {
    let src = iframeEl.src;
    if (isActive) {
      if (!src.includes('loop=1')) {
        const ytReg = /\/embed\/([^"?]+)/;
        const match = src.match(ytReg);
        const ytId = match ? match[1] : '';
        src += (src.includes('?') ? '&' : '?') + `loop=1&playlist=${ytId}`;
      }
    } else {
      src = src.replace(/[?&]loop=1/, '').replace(/[?&]playlist=[^&]+/, '');
    }
    iframeEl.src = src;
  }
  
  const noteId = wrapper.closest('.board-note')?.dataset.noteId;
  if (noteId) {
    saveNoteInline(noteId);
  }
}

let _maximizedNoteId = null;

function toggleMaximizeNote(noteId) {
  const el = document.getElementById(`boardNote-${noteId}`);
  if (!el) return;
  
  const isMaximized = el.classList.contains('board-note-maximized');
  
  if (isMaximized) {
    el.classList.remove('board-note-maximized');
    _maximizedNoteId = null;
    
    const backdrop = document.getElementById('noteBackdrop');
    if (backdrop) backdrop.remove();
    
    const saved = _notesBoardLayouts[noteId] || {};
    const isFloating = saved.isFloating;
    if (isFloating) {
      el.style.position = 'fixed';
      el.style.left = (saved.fx ?? 200) + 'px';
      el.style.top = (saved.fy ?? 200) + 'px';
      el.style.width = (saved.fw ?? 350) + 'px';
      el.style.height = (saved.fh ?? 280) + 'px';
    } else {
      el.style.position = 'absolute';
      el.style.left = el.dataset.origLeft || '';
      el.style.top = el.dataset.origTop || '';
      el.style.width = el.dataset.origW || '';
      el.style.height = el.dataset.origH || '';
    }
  } else {
    el.dataset.origLeft = el.style.left;
    el.dataset.origTop = el.style.top;
    el.dataset.origW = el.style.width;
    el.dataset.origH = el.style.height;
    
    el.classList.add('board-note-maximized');
    _maximizedNoteId = noteId;
    
    el.style.position = '';
    el.style.left = '';
    el.style.top = '';
    el.style.width = '';
    el.style.height = '';
    
    if (!document.getElementById('noteBackdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'noteBackdrop';
      backdrop.className = 'note-backdrop';
      backdrop.onclick = () => toggleMaximizeNote(noteId);
      document.body.appendChild(backdrop);
    }
  }
}

function toggleFloatNote(noteId) {
  const el = document.getElementById(`boardNote-${noteId}`);
  if (!el) return;
  
  if (!_notesBoardLayouts[noteId]) {
    _notesBoardLayouts[noteId] = {};
  }
  
  const isFloating = !_notesBoardLayouts[noteId].isFloating;
  _notesBoardLayouts[noteId].isFloating = isFloating;
  
  if (isFloating) {
    const rect = el.getBoundingClientRect();
    _notesBoardLayouts[noteId].fx = rect.left;
    _notesBoardLayouts[noteId].fy = rect.top;
    _notesBoardLayouts[noteId].fw = rect.width || 350;
    _notesBoardLayouts[noteId].fh = rect.height || 280;
  } else {
    delete _notesBoardLayouts[noteId].fx;
    delete _notesBoardLayouts[noteId].fy;
    delete _notesBoardLayouts[noteId].fw;
    delete _notesBoardLayouts[noteId].fh;
  }
  
  try {
    localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts));
  } catch(e) {}
  
  renderNotes();
}
