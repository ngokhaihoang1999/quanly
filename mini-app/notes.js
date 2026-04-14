// ============ PERSONAL NOTES ============
// Personal sticky notes with sharing between staff members

let _allMyNotes = [];
let _sharedWithMeNotes = [];
let _notesFilter = 'all'; // all | pinned | shared
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
    const res1 = await sbFetch(`/rest/v1/personal_notes?owner_staff_code=eq.${encodeURIComponent(sc)}&order=pinned.desc,updated_at.desc`);
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
function renderNotes() {
  const container = document.getElementById('notesPanelList');
  if (!container) return;

  let notes = [];
  if (_notesFilter === 'pinned') {
    notes = _allMyNotes.filter(n => n.pinned);
  } else if (_notesFilter === 'shared') {
    const myShared = _allMyNotes.filter(n => n._isSharedByMe);
    const setIds = new Set(myShared.map(n => n.id));
    // Combine notes shared BY me + notes shared WITH me
    notes = [...myShared, ..._sharedWithMeNotes.filter(n => !setIds.has(n.id))];
  } else {
    // All = my notes + shared notes, deduplicated
    const myIds = new Set(_allMyNotes.map(n => n.id));
    notes = [..._allMyNotes, ..._sharedWithMeNotes.filter(n => !myIds.has(n.id))];
  }

  // Sort: pinned first, then by updated_at desc
  notes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.updated_at) - new Date(a.updated_at);
  });

  const countEl = document.getElementById('notesCount');
  if (countEl) countEl.textContent = notes.length;

  if (notes.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${_notesFilter === 'shared' ? '📤' : '📝'}</div><div class="empty-sub">${_notesFilter === 'shared' ? 'Chưa có ghi chú được share' : 'Chưa có ghi chú nào'}</div></div>`;
    return;
  }

  container.innerHTML = notes.map(n => renderNoteCard(n)).join('');
}

function renderNoteCard(note) {
  const c = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
  const isShared = note._shared;
  const canEdit = !isShared || note._canEdit;
  const timeAgo = getTimeAgo(note.updated_at);

  // Find linked profile name
  let linkedBadge = '';
  if (note.linked_profile_id) {
    const p = allProfiles.find(p => p.id === note.linked_profile_id);
    if (p) {
      linkedBadge = `<span onclick="event.stopPropagation();openProfileById('${note.linked_profile_id}')" style="font-size:10px;background:rgba(0,0,0,0.08);padding:1px 6px;border-radius:8px;cursor:pointer;color:${c.text};" title="Xem hồ sơ">🔗 ${escHtml(p.full_name || '?')}</span>`;
    }
  }

  // Shared badge
  let sharedBadge = '';
  if (isShared) {
    const sharer = allStaff.find(s => s.staff_code === note._sharedBy);
    sharedBadge = `<span style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 6px;border-radius:8px;color:${c.dateTxt};">📤 ${escHtml(sharer?.full_name || note._sharedBy)}</span>`;
  }

  // Shares count/badge (for my own notes)
  let shareCount = '';
  if (!isShared && note._isSharedByMe) {
    shareCount = `<span style="font-size:10px;background:rgba(0,0,0,0.06);padding:1px 6px;border-radius:8px;color:${c.dateTxt};" title="Bạn đã share note này">📤 Đã share</span>`;
  }

  const title = note.title ? escHtml(note.title) : escHtml(note.content.substring(0, 40)) + (note.content.length > 40 ? '...' : '');
  const preview = note.content.length > 120 ? note.content.substring(0, 120) + '...' : note.content;

  return `
  <div class="pnote-card" data-note-id="${note.id}" style="background:${c.bg};border-color:${c.border};" onclick="toggleNoteExpand(this)">
    <div class="pnote-header" style="background:${c.headerBg};">
      <div class="pnote-title-row">
        ${note.pinned ? '<span style="font-size:12px;" title="Đã ghim">📌</span>' : ''}
        <span class="pnote-title" style="color:${c.text};">${title}</span>
      </div>
      <span class="pnote-time" style="color:${c.dateTxt};">${timeAgo}</span>
    </div>
    <div class="pnote-body" style="color:${c.text};">
      <div class="pnote-preview">${escHtml(preview)}</div>
      <div class="pnote-full" style="display:none;">${escHtml(note.content)}</div>
    </div>
    <div class="pnote-footer">
      <div class="pnote-badges">${linkedBadge}${sharedBadge}${shareCount}</div>
      ${canEdit ? `
      <div class="pnote-actions">
        <button onclick="event.stopPropagation();toggleNotePin('${note.id}',${!note.pinned})" title="${note.pinned ? 'Bỏ ghim' : 'Ghim'}" style="color:${c.dateTxt};">${note.pinned ? '📌' : '📍'}</button>
        <button onclick="event.stopPropagation();openShareNoteModal('${note.id}')" title="Share" style="color:${c.dateTxt};">📤</button>
        <button onclick="event.stopPropagation();openEditNoteModal('${note.id}')" title="Sửa" style="color:${c.dateTxt};">✏️</button>
        <button onclick="event.stopPropagation();deletePersonalNote('${note.id}')" title="Xoá" style="color:#dc2626;">🗑️</button>
      </div>` : `
      <div class="pnote-actions">
        <button onclick="event.stopPropagation();copyNoteContent('${note.id}')" title="Copy" style="color:${c.dateTxt};">📋</button>
      </div>`}
    </div>
  </div>`;
}

// ── UI Interactions ──
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
  const content = document.getElementById('pnote_content').value.trim();
  const color = getSelectedNoteColor();
  const linkInput = document.getElementById('pnote_link_profile');
  const rawId = (linkInput.dataset.profileId || '').trim();
  const linkedProfileId = rawId.length > 10 ? rawId : null; // uuid is 36 chars

  if (!content) { showToast('Vui lòng nhập nội dung'); return; }

  const body = {
    title: title || null,
    content,
    color,
    linked_profile_id: linkedProfileId,
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
  } catch(e) {
    console.error('[Notes] delete error:', e);
    showToast('Lỗi xoá ghi chú');
  }
}

async function toggleNotePin(noteId, pinned) {
  try {
    await sbFetch(`/rest/v1/personal_notes?id=eq.${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ pinned, updated_at: new Date().toISOString() })
    });
    showToast(pinned ? '📌 Đã ghim' : '📍 Đã bỏ ghim');
    await loadPersonalNotes();
  } catch(e) {
    console.error('[Notes] pin error:', e);
  }
}

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

// ── escHtml helper (safe to redefine — notification.js doesn't have this) ──
function escHtml(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ── Init (called when tab opens) ──
function initNotesTab() {
  setupNotesProfileAutocomplete();
  if (!isFresh('notes')) loadPersonalNotes();
  startNotesPoll();
}
