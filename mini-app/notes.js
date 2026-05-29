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

    // Fetch ALL share records involving me, joining the corresponding notes
    const encodedSc = encodeURIComponent(sc);
    const res2 = await sbFetch(`/rest/v1/note_shares?or=(shared_with.eq.${encodedSc},shared_by.eq.${encodedSc})&select=*,personal_notes(*)`);
    const shares = res2.ok ? await res2.json() : [];
    
    // Separate shares
    const sharesWithMe = shares.filter(s => s.shared_with === sc && s.personal_notes);
    const sharesByMe = shares.filter(s => s.shared_by === sc);

    // Tag my own notes that I've shared
    const mySharedNoteIds = new Set(sharesByMe.map(s => s.note_id));
    _allMyNotes.forEach(n => {
      n._isSharedByMe = mySharedNoteIds.has(n.id);
    });

    _sharedWithMeNotes = sharesWithMe.map(s => ({
      ...s.personal_notes,
      _shared: true,
      _sharedBy: s.shared_by,
      _canEdit: s.can_edit,
      _shareId: s.id
    }));

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

  if (!_isNotesOnBoard()) {
    // Mobile/small screen: clean up all floating/maximized notes from the body
    clearAllFloatingNotes();
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

function parseNoteContent(rawContent) {
  const doc = new DOMParser().parseFromString(rawContent || '', 'text/html');
  const textLayer = doc.querySelector('.note-text-layer');
  const mediaLayer = doc.querySelector('.note-media-layer');
  
  if (textLayer && mediaLayer) {
    return {
      text: textLayer.innerHTML,
      media: mediaLayer.innerHTML
    };
  }
  
  // Backward compatibility: extract media wrappers from text content
  const wrappers = doc.querySelectorAll('.embedded-media-wrapper');
  let mediaHtml = '';
  wrappers.forEach(w => {
    mediaHtml += w.outerHTML;
    w.remove();
  });
  
  return {
    text: doc.body.innerHTML,
    media: mediaHtml
  };
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
      linkedBadge = `<span class="board-badge board-badge-link" onclick="event.stopPropagation();openProfileById('${note.linked_profile_id}')" title="Xem hồ sơ">🔗 ${escHtml(p.full_name || '?')}</span>`;
    }
  }

  let sharedBadge = '';
  if (isShared) {
    const sharer = allStaff.find(s => s.staff_code === note._sharedBy);
    sharedBadge = `<span class="board-badge">📤 ${escHtml(sharer?.full_name || note._sharedBy)}</span>`;
  } else if (note._isSharedByMe) {
    sharedBadge = `<span class="board-badge">📤 Đã share</span>`;
  }

  let calBadge = '';
  if (note.cal_date) {
    calBadge = `<span class="board-badge" style="color:#ea580c;background:rgba(249,115,22,0.15);">📅 ${note.cal_date.split('-').reverse().join('/')}</span>`;
  }

  let alarmBadge = '';
  if (note.reminder_at && !note.reminder_sent) {
    const rAt = new Date(note.reminder_at);
    const rTime = `${String(rAt.getHours()).padStart(2,'0')}:${String(rAt.getMinutes()).padStart(2,'0')}`;
    const rDate = `${String(rAt.getDate()).padStart(2,'0')}/${String(rAt.getMonth()+1).padStart(2,'0')}`;
    alarmBadge = `<span class="board-badge" style="color:#fbbf24;background:rgba(251,191,36,0.12);">🔔 ${rDate} ${rTime}</span>`;
  }

  const plainContent = stripHtml(note.content);
  const preview = plainContent.length > 120 ? plainContent.substring(0, 120) + '...' : plainContent;

  const toolbarHtml = canEdit ? `
    <div class="note-toolbar" id="noteToolbar-${note.id}" style="display:none; margin-top: 4px;">
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('bold', '${note.id}')" title="In đậm"><b>B</b></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('italic', '${note.id}')" title="In nghiêng"><i>I</i></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('underline', '${note.id}')" title="Gạch chân"><u>U</u></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('strikeThrough', '${note.id}')" title="Gạch ngang"><s>ab</s></button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="execNoteCmd('insertUnorderedList', '${note.id}')" title="Danh sách">☰</button>
      <button class="note-toolbar-btn" onmousedown="event.preventDefault();" onclick="toggleMediaLinkPopover(event, '${note.id}')" title="Chèn Ảnh/Video/Audio">🖼️</button>
    </div>
    <div class="media-link-popover" id="mediaPopover-${note.id}" style="display:none;" onmousedown="event.stopPropagation();">
      <input type="text" placeholder="Dán link ảnh, mp3, mp4, youtube..." onkeydown="if(event.key==='Enter') { insertMediaUrl('${note.id}', this.value, this); this.value=''; }" style="width:100%; box-sizing:border-box; margin-bottom:4px;" />
      <input type="file" accept="image/*,audio/*,video/*" onchange="uploadNoteMedia(this, '${note.id}')" style="display:none;" id="noteMediaUpload-${note.id}" />
      <button class="chip" onmousedown="event.preventDefault();" onclick="document.getElementById('noteMediaUpload-${note.id}').click()" style="font-size:10px;padding:4px 8px;margin-top:2px;width:100%;text-align:center;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">📤 Tải tệp lên</button>
    </div>
  ` : '';

  const parsed = parseNoteContent(note.content);

  return `
  <div class="pnote-card" data-note-id="${note.id}" style="background:${c.bg};border-color:${c.border}; display: flex; flex-direction: column;" onclick="toggleNoteExpand(this, event)">
    <div class="pnote-header" style="background:${c.headerBg};">
      <div class="pnote-title-row">
        <span class="pnote-title" ${canEdit ? 'contenteditable="true"' : ''} onblur="saveNoteInlineTitle(this, '${note.id}')" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" onclick="event.stopPropagation();" style="color:${c.text};">${escHtml(note.title || 'Ghi chú')}</span>
      </div>
      <span class="pnote-time" style="color:${c.dateTxt};">${timeAgo}</span>
    </div>
    
    ${toolbarHtml}

    <div class="pnote-body" style="color:${c.text}; position:relative; display:flex; flex-direction:column; flex:1;">
      <!-- Collapsed state preview -->
      <div class="pnote-preview">${escHtml(preview)}</div>
      
      <!-- Expanded state editor (Text + Media layered overlay, naturally fitting mobile card stack) -->
      <div class="pnote-full-editor" style="display:none; flex-direction:column; flex:1; position:relative; outline:none; text-align:left; min-height:120px;">
        <div class="board-note-body" style="position:relative; overflow:hidden; display:flex; flex-direction:column; flex:1; cursor:text; min-height:120px;" onclick="document.getElementById('noteContent-${note.id}')?.focus();">
          <div class="board-note-content" id="noteContent-${note.id}" ${canEdit ? 'contenteditable="true"' : ''} oninput="debounceSaveNoteInline('${note.id}')" onblur="saveNoteInline('${note.id}')" style="flex:1; overflow:auto; outline:none; word-wrap:break-word; padding:8px; cursor:text; min-height:120px;">${parsed.text}</div>
          <div class="board-note-media-canvas" id="noteMediaCanvas-${note.id}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 5;">
            ${parsed.media}
          </div>
        </div>
      </div>
    </div>

    <div class="pnote-footer" style="padding-top: 4px;">
      <div class="pnote-badges">${linkedBadge}${calBadge}${alarmBadge}${sharedBadge}</div>
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

  const isPinningBack = _notesBoardLayouts[note.id]?.isPinningBack;
  const pinBackStyles = isPinningBack ? 'opacity:0; pointer-events:none;' : '';
  const floatingClass = isFloating ? 'board-note-floating' : '';
  const floatingStyles = isFloating ? `position:fixed; z-index:999999; left:${_notesBoardLayouts[note.id]?.fx ?? 200}px; top:${_notesBoardLayouts[note.id]?.fy ?? 200}px; width:${_notesBoardLayouts[note.id]?.fw ?? 350}px; height:${_notesBoardLayouts[note.id]?.fh ?? 280}px;` : `left:${x}px;top:${y}px;width:${w}px;height:${h}px;`;

  return `<div class="board-note ${floatingClass}" id="boardNote-${note.id}" data-note-id="${note.id}" 
    style="${floatingStyles}${pinBackStyles}background:${c.bg};border-color:${c.border};">
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
      <input type="file" accept="image/*,audio/*,video/*" onchange="uploadNoteMedia(this, '${note.id}')" style="display:none;" id="noteMediaUpload-${note.id}" />
      <button class="chip" onmousedown="event.preventDefault();" onclick="document.getElementById('noteMediaUpload-${note.id}').click()" style="font-size:10px;padding:4px 8px;margin-top:2px;width:100%;text-align:center;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">📤 Tải tệp lên</button>
    </div>
    ` : ''}

    <!-- Separate Layers: Text writing vs Media drag canvas -->
    <div class="board-note-body" style="color:${c.text}; position:relative; overflow:hidden; display:flex; flex-direction:column; flex:1; cursor:text;" onclick="document.getElementById('noteContent-${note.id}')?.focus();">
      <!-- Text writing layer (fully scrollable, editable, and occupies full height) -->
      <div class="board-note-content" id="noteContent-${note.id}" ${canEdit ? 'contenteditable="true"' : ''} oninput="debounceSaveNoteInline('${note.id}')" onblur="saveNoteInline('${note.id}')" style="flex:1; overflow:auto; outline:none; text-align:left; word-wrap:break-word; padding:8px; cursor:text; min-height:100px;">${parseNoteContent(note.content).text}</div>
      
      <!-- Media canvas layer (absolutely overlayed, pointer-events: none, so typing click is transparent) -->
      <div class="board-note-media-canvas" id="noteMediaCanvas-${note.id}" style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; overflow: hidden; z-index: 5;">
        ${parseNoteContent(note.content).media}
      </div>
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

  // Clean all old floating notes from body before moving them again
  document.querySelectorAll('body > .board-note-floating').forEach(el => {
    el.remove();
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

    // Bind media handlers inside the transparent overlay canvas layer, NOT the text content layer!
    const mediaCanvas = el.querySelector('.board-note-media-canvas');
    if (mediaCanvas) {
      _initNoteEmbeddedMedia(mediaCanvas, noteId);
    }

    // Bind click-anywhere-to-type handler (2D space alignment)
    const bodyEl = el.querySelector('.board-note-body');
    const contentEl = el.querySelector('.board-note-content');
    setupClickAnywhereToType(bodyEl, contentEl, noteId);

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

    // Click-to-expand card click listener removed to prevent unwanted card resizing on focus
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
function placeCaretAtEnd(el) {
  el.focus();
  if (typeof window.getSelection !== "undefined" && typeof document.createRange !== "undefined") {
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function setupClickAnywhereToType(bodyEl, contentEl, noteId) {
  if (!bodyEl || !contentEl || bodyEl.dataset.autofocusBound) return;
  bodyEl.dataset.autofocusBound = '1';
  
  bodyEl.addEventListener('mousedown', e => {
    if (e.target.closest('button') || 
        e.target.closest('.embedded-media-wrapper') || 
        e.target.closest('.media-link-popover') || 
        e.target.closest('.note-toolbar') ||
        e.target.closest('.board-note-resize') ||
        e.target.closest('.pnote-actions')) {
      return;
    }
    
    // Dynamically measure the precise space width and line height of contentEl
    const tempSpan = document.createElement('span');
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.position = 'absolute';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.innerHTML = '&nbsp;'.repeat(20);
    contentEl.appendChild(tempSpan);
    const spaceWidth = tempSpan.getBoundingClientRect().width / 20 || 8;
    contentEl.removeChild(tempSpan);

    const tempDiv = document.createElement('div');
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.position = 'absolute';
    tempDiv.innerHTML = '&nbsp;';
    contentEl.appendChild(tempDiv);
    const lineHeight = tempDiv.getBoundingClientRect().height || 20;
    contentEl.removeChild(tempDiv);

    const rect = contentEl.getBoundingClientRect();
    const style = window.getComputedStyle(contentEl);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    
    const clickX = e.clientX - rect.left - paddingLeft;
    const clickY = e.clientY - rect.top - paddingTop;
    
    let contentBottom = 0;
    if (contentEl.children.length > 0) {
      const lastChild = contentEl.children[contentEl.children.length - 1];
      const lastChildRect = lastChild.getBoundingClientRect();
      contentBottom = lastChildRect.bottom - rect.top - paddingTop;
    } else {
      contentBottom = contentEl.clientHeight - paddingTop;
    }
    
    // Case A: Click is below the text bottom
    if (clickY > contentBottom + lineHeight / 2) {
      e.preventDefault();
      const gapY = clickY - contentBottom;
      const linesToAdd = Math.round(gapY / lineHeight);
      if (linesToAdd > 0) {
        if (contentEl.children.length === 0 && contentEl.textContent.trim() === '') {
          contentEl.innerHTML = '';
        }
        
        for (let i = 0; i < linesToAdd - 1; i++) {
          const div = document.createElement('div');
          div.innerHTML = '<br>';
          contentEl.appendChild(div);
        }
        const lastDiv = document.createElement('div');
        const spacesCount = Math.max(0, Math.round(clickX / spaceWidth));
        lastDiv.innerHTML = '&nbsp;'.repeat(spacesCount) + '<br>';
        contentEl.appendChild(lastDiv);
        
        saveNoteInline(noteId);
        
        setTimeout(() => {
          placeCaretAtEnd(lastDiv);
        }, 10);
      }
    } 
    // Case B: Click is on or to the right of an existing line
    else {
      const children = contentEl.children;
      let targetLine = null;
      
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const childRect = child.getBoundingClientRect();
        const childTop = childRect.top - rect.top - paddingTop;
        const childBottom = childRect.bottom - rect.top - paddingTop;
        if (clickY >= childTop && clickY <= childBottom) {
          targetLine = child;
          break;
        }
      }
      
      // Fallback: if click in vertical gap, pick closest line
      if (!targetLine && children.length > 0) {
        let minDistance = Infinity;
        for (let i = 0; i < children.length; i++) {
          const child = children[i];
          const childRect = child.getBoundingClientRect();
          const childCenter = (childRect.top + childRect.bottom) / 2 - rect.top - paddingTop;
          const dist = Math.abs(clickY - childCenter);
          if (dist < minDistance) {
            minDistance = dist;
            targetLine = child;
          }
        }
      }
      
      if (children.length === 0) {
        e.preventDefault();
        const div = document.createElement('div');
        const spacesCount = Math.max(0, Math.round(clickX / spaceWidth));
        div.innerHTML = '&nbsp;'.repeat(spacesCount) + '<br>';
        contentEl.appendChild(div);
        
        saveNoteInline(noteId);
        
        setTimeout(() => {
          placeCaretAtEnd(div);
        }, 10);
        return;
      }
      
      if (targetLine) {
        try {
          const range = document.createRange();
          range.selectNodeContents(targetLine);
          const rangeRect = range.getBoundingClientRect();
          const textRight = rangeRect.right;
          
          if (e.clientX > textRight + spaceWidth / 2) {
            e.preventDefault();
            const gapX = e.clientX - textRight;
            const spacesToAdd = Math.max(0, Math.round(gapX / spaceWidth));
            if (spacesToAdd > 0) {
              const br = targetLine.querySelector('br');
              const spacesHtml = '&nbsp;'.repeat(spacesToAdd);
              if (br) {
                const span = document.createElement('span');
                span.innerHTML = spacesHtml;
                targetLine.insertBefore(span, br);
              } else {
                const span = document.createElement('span');
                span.innerHTML = spacesHtml;
                targetLine.appendChild(span);
              }
              
              saveNoteInline(noteId);
              
              setTimeout(() => {
                placeCaretAtEnd(targetLine);
              }, 10);
            }
          }
        } catch(err) {
          console.error('[Autofocus] targetLine range error:', err);
        }
      }
    }
  });
}

function toggleNoteExpand(el, event) {
  const preview = el.querySelector('.pnote-preview');
  const full = el.querySelector('.pnote-full-editor') || el.querySelector('.pnote-full');
  const toolbar = el.querySelector('.note-toolbar');
  if (!preview || !full) return;
  
  const isExpanded = full.style.display !== 'none';
  
  if (event && isExpanded) {
    // If note is already expanded, only collapse if the user clicks on the header (or its children)
    if (!event.target.closest('.pnote-header')) {
      return;
    }
  }
  
  preview.style.display = isExpanded ? 'block' : 'none';
  full.style.display = isExpanded ? 'none' : (full.classList.contains('pnote-full-editor') ? 'flex' : 'block');
  
  if (toolbar) {
    toolbar.style.display = isExpanded ? 'none' : 'flex';
  }
  
  // Bind handlers when expanding mobile card editors
  if (!isExpanded && full.classList.contains('pnote-full-editor')) {
    const noteId = el.dataset.noteId;
    
    const mediaCanvas = el.querySelector('.board-note-media-canvas');
    if (mediaCanvas) {
      _initNoteEmbeddedMedia(mediaCanvas, noteId);
    }
    
    const bodyEl = el.querySelector('.board-note-body');
    const contentEl = el.querySelector('.board-note-content');
    setupClickAnywhereToType(bodyEl, contentEl, noteId);
  }
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
  const textEl = document.getElementById(`noteContent-${noteId}`);
  const mediaEl = document.getElementById(`noteMediaCanvas-${noteId}`);
  
  if (textEl && mediaEl) {
    // Keep separated layered format in database
    content = `<div class="note-text-layer">${textEl.innerHTML}</div><div class="note-media-layer">${mediaEl.innerHTML}</div>`;
  } else if (textEl) {
    content = `<div class="note-text-layer">${textEl.innerHTML}</div>`;
  } else {
    const mEl = document.querySelector(`.pnote-card[data-note-id="${noteId}"] .pnote-full`);
    if (mEl) content = mEl.innerHTML;
  }
  
  if (!textEl && !document.querySelector(`.pnote-card[data-note-id="${noteId}"] .pnote-full`)) return;

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
  
  const container = document.getElementById(`noteMediaCanvas-${noteId}`);
  if (!container) return;

  let html = '';
  let type = '';
  
  if (url.startsWith('data:')) {
    if (url.startsWith('data:image/') || url.startsWith('data:img/')) {
      type = 'image';
      html = `<img src="${url}" alt="Media" />`;
    } else if (url.startsWith('data:audio/')) {
      type = 'audio';
      html = `<audio src="${url}" controls></audio>`;
    } else if (url.startsWith('data:video/')) {
      type = 'video';
      html = `<video src="${url}" controls playsinline></video>`;
    } else {
      type = 'image';
      html = `<img src="${url}" alt="Media" />`;
    }
  } else {
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
  }

  const wrapId = 'mediaWrap_' + Date.now() + '_' + Math.floor(Math.random()*1000);
  const defaultWidth = type === 'audio' ? 240 : (type === 'youtube' ? 280 : 240);
  const defaultHeight = type === 'audio' ? 54 : (type === 'youtube' ? 157 : 135);

  const wrapperHtml = `<div class="embedded-media-wrapper" id="${wrapId}" contenteditable="false" style="position: absolute; left: 20px; top: 20px; width: ${defaultWidth}px; height: ${defaultHeight}px; z-index: 10;">${html}<button class="media-loop-btn" onclick="event.stopPropagation();toggleMediaLoop(this);" title="Phát lại liên tục">🔁</button><button class="media-delete-btn" onclick="event.stopPropagation();this.closest('.embedded-media-wrapper').remove();saveNoteInline('${noteId}');" title="Xoá media">✕</button><div class="media-resize-handle"></div></div>`;

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
  
  // Ensure delete button exists (adds support dynamically for old & new notes)
  let deleteBtn = wrapper.querySelector('.media-delete-btn');
  if (!deleteBtn) {
    deleteBtn = document.createElement('button');
    deleteBtn.className = 'media-delete-btn';
    deleteBtn.title = 'Xoá media';
    deleteBtn.innerHTML = '✕';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      wrapper.remove();
      saveNoteInline(noteId);
    };
    wrapper.appendChild(deleteBtn);
  }

  wrapper.addEventListener('mousedown', e => {
    if (e.target.closest('.media-resize-handle') || e.target.closest('.media-loop-btn') || e.target.closest('.media-delete-btn') || e.target.closest('audio') || e.target.closest('video') || e.target.closest('iframe')) return;
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
  const el = document.querySelector(`body > .board-note-maximized[data-note-id="${noteId}"]`) || document.getElementById(`boardNote-${noteId}`);
  if (!el) return;
  
  const isMaximized = el.classList.contains('board-note-maximized');
  const container = document.getElementById('notesPanelList');
  
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
      if (container) {
        container.appendChild(el);
      }
      el.style.position = 'absolute';
      el.style.left = el.dataset.origLeft || '';
      el.style.top = el.dataset.origTop || '';
      el.style.width = el.dataset.origW || '';
      el.style.height = el.dataset.origH || '';
    }
    // Remove temporary maximize styling overrides
    el.style.transform = '';
    el.style.maxWidth = '';
    el.style.maxHeight = '';
  } else {
    el.dataset.origLeft = el.style.left;
    el.dataset.origTop = el.style.top;
    el.dataset.origW = el.style.width;
    el.dataset.origH = el.style.height;
    
    // Append to document.body to break out of rights panel layout containment!
    document.body.appendChild(el);
    
    el.classList.add('board-note-maximized');
    _maximizedNoteId = noteId;
    
    el.style.position = 'fixed';
    el.style.left = '50%';
    el.style.top = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.width = '85vw';
    el.style.height = '80vh';
    el.style.maxWidth = '950px';
    el.style.maxHeight = '750px';
    el.style.zIndex = '1000000';
    
    if (!document.getElementById('noteBackdrop')) {
      const backdrop = document.createElement('div');
      backdrop.id = 'noteBackdrop';
      backdrop.className = 'note-backdrop';
      backdrop.onclick = () => toggleMaximizeNote(noteId);
      document.body.appendChild(backdrop);
    }
  }
}

function clearAllFloatingNotes() {
  document.querySelectorAll('body > .board-note').forEach(el => el.remove());
  const backdrop = document.getElementById('noteBackdrop');
  if (backdrop) backdrop.remove();
  _maximizedNoteId = null;
}

function toggleFloatNote(noteId) {
  // Target the exact floating element on body first to avoid getting the static one inside container!
  const floatEl = document.querySelector(`body > .board-note-floating[data-note-id="${noteId}"]`) || document.getElementById(`boardNote-${noteId}`);
  if (!floatEl) return;
  
  if (!_notesBoardLayouts[noteId]) {
    _notesBoardLayouts[noteId] = {};
  }
  
  const isFloating = !_notesBoardLayouts[noteId].isFloating;
  
  if (!isFloating) {
    const container = document.getElementById('notesPanelList');
    if (container) {
      // 1. Mark that we are pinning this back so renderNotes renders it as invisible placeholder
      _notesBoardLayouts[noteId].isPinningBack = true;
      _notesBoardLayouts[noteId].isFloating = false;
      delete _notesBoardLayouts[noteId].fx;
      delete _notesBoardLayouts[noteId].fy;
      delete _notesBoardLayouts[noteId].fw;
      delete _notesBoardLayouts[noteId].fh;
      try { localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts)); } catch(e) {}
      
      // 2. Render all notes, creating the static slot in notesPanelList
      renderNotes();
      
      // 3. Find the newly rendered static card inside the container
      const staticEl = container.querySelector(`#boardNote-${noteId}`);
      if (staticEl) {
        // Hide the static card temporarily so the transition is seamless
        staticEl.style.opacity = '0';
        staticEl.style.pointerEvents = 'none';
        
        // 4. Calculate its viewport relative coordinates
        const staticRect = staticEl.getBoundingClientRect();
        
        // 5. Animate the floating card from its current position to the static placeholder's position
        floatEl.style.transition = 'left 0.45s cubic-bezier(0.16, 1, 0.3, 1), top 0.45s cubic-bezier(0.16, 1, 0.3, 1), width 0.45s cubic-bezier(0.16, 1, 0.3, 1), height 0.45s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s';
        
        requestAnimationFrame(() => {
          floatEl.style.left = staticRect.left + 'px';
          floatEl.style.top = staticRect.top + 'px';
          floatEl.style.width = staticRect.width + 'px';
          floatEl.style.height = staticRect.height + 'px';
          floatEl.style.opacity = '0.8';
        });
        
        // 6. After transition, swap static visibility and clean up floating card
        setTimeout(() => {
          delete _notesBoardLayouts[noteId].isPinningBack;
          staticEl.style.opacity = '';
          staticEl.style.pointerEvents = '';
          floatEl.remove();
          // Render once more to clean up inline styles of the static card
          renderNotes();
        }, 450);
      } else {
        // Fallback if static element wasn't rendered
        floatEl.remove();
        renderNotes();
      }
      return;
    }
  }
  
  _notesBoardLayouts[noteId].isFloating = isFloating;
  if (isFloating) {
    const rect = floatEl.getBoundingClientRect();
    _notesBoardLayouts[noteId].fx = rect.left;
    _notesBoardLayouts[noteId].fy = rect.top;
    _notesBoardLayouts[noteId].fw = rect.width || 350;
    _notesBoardLayouts[noteId].fh = rect.height || 280;
  }
  
  try {
    localStorage.setItem('cj_notes_board', JSON.stringify(_notesBoardLayouts));
  } catch(e) {}
  
  renderNotes();
}

function uploadNoteMedia(input, noteId) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 3 * 1024 * 1024) {
    showToast('⚠️ Vui lòng chọn tệp nhỏ hơn 3MB!');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    insertMediaUrl(noteId, e.target.result, input);
  };
  reader.readAsDataURL(file);
  input.value = '';
}
