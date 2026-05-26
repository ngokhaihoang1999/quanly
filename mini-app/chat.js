// ============ PROFILE CHAT MODULE ============
let _supabaseRealtimeClient = null;
let _profileChatSubscription = null;

// Global state cache for chat messages and reads
window._chatMessages = [];
window._chatReads = [];

// Common emojis for quick picking
const CHAT_COMMON_EMOJIS = [
  '😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '😎', '🤩', 
  '🤔', '😅', '😭', '😡', '😱', '👍', '👎', '👌', '👏', '🙌', 
  '🙏', '🤝', '💪', '🎉', '✨', '🌟', '🔥', '❤️', '💔', '✔️'
];

// Initialize and load chat history
async function loadProfileChat(profileId) {
  currentProfileId = profileId;
  const msgArea = document.getElementById('profileChatMessages');
  const countEl = document.getElementById('chatCount');
  if (!msgArea) return;

  msgArea.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">⌛ Đang tải cuộc thảo luận...</div>';
  
  try {
    // 1. Mark chat as read first so DB updates
    await markChatAsRead(profileId);

    // 2. Initialize memory state
    window._chatMessages = [];
    window._chatReads = [];

    // 3. Fetch messages and read states in parallel
    const [messagesRes, readsRes] = await Promise.all([
      sbFetch(`/rest/v1/profile_chats?profile_id=eq.${profileId}&select=*&order=created_at.asc`, {
        headers: { 'Cache-Control': 'no-cache' }
      }),
      sbFetch(`/rest/v1/profile_chat_reads?profile_id=eq.${profileId}&select=*`, {
        headers: { 'Cache-Control': 'no-cache' }
      })
    ]);

    const messages = await messagesRes.json();
    window._chatReads = await readsRes.json();
    window._chatMessages = messages;
    
    if (countEl) {
      countEl.textContent = `${messages.length} tin nhắn`;
    }
    
    msgArea.innerHTML = '';
    if (messages.length === 0) {
      msgArea.innerHTML = '<div id="chatEmptyState" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Chưa có thảo luận nào cho hồ sơ này.</div>';
    } else {
      messages.forEach(msg => addChatMessageToDOM(msg));
      // Calculate and display seen indicators
      updateSeenIndicators();
      msgArea.scrollTop = msgArea.scrollHeight;
    }
    
    // Setup Supabase Realtime for this profile chat
    setupSupabaseRealtimeForChat(profileId);
    
    // Close emoji picker if open
    const picker = document.getElementById('chatEmojiPicker');
    if (picker) picker.style.display = 'none';
  } catch(e) {
    msgArea.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">❌ Lỗi tải cuộc thảo luận.</div>';
    console.error('loadProfileChat:', e);
  }
}

// Add a single chat message to DOM
function addChatMessageToDOM(msg) {
  const msgArea = document.getElementById('profileChatMessages');
  if (!msgArea) return;
  
  // Prevent duplicate rendering
  if (document.getElementById(`msg_${msg.id}`)) return;

  // Add to memory list if not present
  if (window._chatMessages && !window._chatMessages.some(m => m.id === msg.id)) {
    window._chatMessages.push(msg);
  }

  const emptyState = document.getElementById('chatEmptyState');
  if (emptyState) emptyState.remove();

  const myCode = getEffectiveStaffCode();
  const isMe = msg.sender_code === myCode;
  
  // Find sender profile details
  const sender = allStaff.find(s => s.staff_code === msg.sender_code);
  const displayName = sender ? (sender.nickname || sender.full_name) : msg.sender_code;
  const initial = displayName ? getNameInitial(displayName) : '?';
  const avatarColor = sender?.staff_avatar_color || '';
  
  // Render animated avatar using global function
  const avatarHtml = typeof renderAnimatedAvatar === 'function'
    ? renderAnimatedAvatar(initial, avatarColor, 'sm')
    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;">${initial}</div>`;

  // Format message time
  let timeStr = '';
  try {
    const d = new Date(msg.created_at);
    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch(e) {}

  // Determine styling based on category
  let bubbleClass = 'chat-message-bubble';
  if (isMe) bubbleClass += ' chat-message-bubble--me';
  if (msg.category === 'warning') bubbleClass += ' chat-message-bubble--warning';
  if (msg.category === 'strategy') bubbleClass += ' chat-message-bubble--strategy';
  if (msg.category === 'important') bubbleClass += ' chat-message-bubble--important';

  const rowClass = isMe ? 'chat-message-row chat-message-row--me' : 'chat-message-row';

  // Format mentions to be bold/colored
  let messageText = escHtml(msg.message);
  // Match @JD codes: @\d{6}-[A-Z]+
  messageText = messageText.replace(/@(\d{6}-[A-Z]+)/g, '<span class="chat-mention">@$1</span>');

  // Add category badge inside the bubble
  let categoryPrefix = '';
  let catIcon = '';
  if (msg.category === 'warning') {
    categoryPrefix = '<span class="chat-cat-badge chat-cat-badge--warning">⚠️ Cảnh báo</span>';
    catIcon = '⚠️';
  } else if (msg.category === 'strategy') {
    categoryPrefix = '<span class="chat-cat-badge chat-cat-badge--strategy">🧭 Chiến lược</span>';
    catIcon = '🧭';
  } else if (msg.category === 'important') {
    categoryPrefix = '<span class="chat-cat-badge chat-cat-badge--important">🔔 Quan trọng</span>';
    catIcon = '🔔';
  }

  // Format message body text (with icon on the left if applicable)
  let messageContentHtml = `<div class="chat-message-text">${messageText}</div>`;
  if (catIcon) {
    messageContentHtml = `
      <div class="chat-message-body-with-icon">
        <div class="chat-message-cat-icon chat-message-cat-icon--${msg.category}">${catIcon}</div>
        <div class="chat-message-text" style="flex: 1; padding-top: 2px;">${messageText}</div>
      </div>
    `;
  }

  const avatarHtmlBlock = isMe ? '' : `
    <div class="chat-message-avatar" onclick="showStaffCard('${msg.sender_code}')" style="cursor:pointer;" title="${displayName}">
      ${avatarHtml}
    </div>
  `;

  let timeHtml = `<div class="chat-message-time">${timeStr}</div>`;
  if (isMe) {
    timeHtml = `
      <div class="chat-message-time" style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <span class="chat-bubble-actions" id="actions_${msg.id}" style="display:none; gap:6px; font-size:9.5px; user-select:none;">
          <span onclick="event.stopPropagation(); startEditChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">✏️ Sửa</span>
          <span onclick="event.stopPropagation(); deleteChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">🗑️ Xoá</span>
        </span>
        <span style="flex-grow:1; text-align:right;">${timeStr}</span>
      </div>
    `;
  }

  const onclickHtml = isMe ? `onclick="toggleBubbleActions(event, '${msg.id}')" style="cursor:pointer;"` : '';

  const html = `
    <div class="${rowClass}" id="msg_${msg.id}" data-raw-text="${escHtml(msg.message)}">
      ${avatarHtmlBlock}
      <div class="chat-message-content">
        ${!isMe ? `<div class="chat-message-sender" onclick="showStaffCard('${msg.sender_code}')">${displayName} <span style="font-size:9px;color:var(--text3);font-weight:normal;">(${msg.sender_code})</span></div>` : ''}
        <div class="${bubbleClass}" ${onclickHtml}>
          ${categoryPrefix ? `<div style="margin-bottom: 5px;">${categoryPrefix}</div>` : ''}
          ${messageContentHtml}
          ${timeHtml}
        </div>
        <div class="chat-message-seen-container" id="seen_${msg.id}"></div>
      </div>
    </div>
  `;
  
  msgArea.insertAdjacentHTML('beforeend', html);
  
  // Keep scroll at bottom
  msgArea.scrollTop = msgArea.scrollHeight;
}

// Send chat message
async function sendProfileChatMessage() {
  if (window._editingMessageId) {
    saveEditChatMessage();
    return;
  }

  const input = document.getElementById('profileChatInput');
  const catSelect = document.getElementById('chat_category');
  if (!input || !currentProfileId) return;

  const text = input.value.trim();
  const category = catSelect ? catSelect.value : 'general';
  
  if (!text) return;

  input.value = ''; // clear input immediately to feel fast
  haptic('light');

  const sender = getEffectiveStaffCode();
  
  try {
    const res = await sbFetch('/rest/v1/profile_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        profile_id: currentProfileId,
        sender_code: sender,
        message: text,
        category: category
      })
    });
    
    const newMsgArr = await res.json();
    if (newMsgArr && newMsgArr[0]) {
      addChatMessageToDOM(newMsgArr[0]);
    }
    
    // Automatically update my read stamp for this profile chat
    await markChatAsRead(currentProfileId);

    // Parse tag/mentions and notify
    await parseMentionsAndNotify(text, currentProfileId);
  } catch(e) {
    showToast('❌ Lỗi gửi tin nhắn');
    console.error('sendProfileChatMessage:', e);
    input.value = text; // restore on error
  }
}

// Parse tags `@000142-NKH` and notify mentioned users
async function parseMentionsAndNotify(message, profileId) {
  const mentions = [];
  const regex = /@(\d{6}-[A-Z]+)/g;
  let match;
  
  while ((match = regex.exec(message)) !== null) {
    const code = match[1];
    // Check if the staff code exists in the system
    if (isStaffRegistered(code)) {
      mentions.push(code);
    }
  }

  if (mentions.length > 0) {
    const p = allProfiles.find(x => x.id === profileId);
    const pName = p?.full_name || 'Học viên';
    const sender = getEffectiveStaffCode();
    
    // Notify mentioned users
    // Use 'reminder' (⏰) or 'chot_tv' (📅) which routes user to the profile detail page in notifications.js
    await createNotification(
      mentions, 
      'reminder', 
      `💬 Bạn được nhắc tới trong Thảo luận`, 
      `Trái: ${pName} · Từ ${sender}: ${message}`, 
      profileId
    );
  }
}

// Mark chat as read for user
async function markChatAsRead(profileId) {
  const myCode = getEffectiveStaffCode();
  if (!profileId || !myCode) return;
  
  try {
    await sbFetch('/rest/v1/profile_chat_reads', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        profile_id: profileId,
        staff_code: myCode,
        last_read_at: new Date().toISOString()
      })
    });
    
    // Remove from unread cache Set
    if (window.unreadChatProfileIds) {
      window.unreadChatProfileIds.delete(profileId);
    }
    
    // Trigger visual list updates to hide unread badges
    if (typeof filterProfiles === 'function') filterProfiles();
    
    const countEl = document.getElementById('notifBadge');
    if (countEl && typeof loadNotifCount === 'function') loadNotifCount();
  } catch(e) {
    console.warn('markChatAsRead error:', e);
  }
}

// Supabase Realtime Listener setup
function setupSupabaseRealtimeForChat(profileId) {
  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase JS Client is not loaded. Realtime disabled.');
    return;
  }
  
  // Unsubscribe old channel
  if (_profileChatSubscription) {
    _profileChatSubscription.unsubscribe();
    _profileChatSubscription = null;
  }
  
  if (!_supabaseRealtimeClient) {
    _supabaseRealtimeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  
  _profileChatSubscription = _supabaseRealtimeClient
    .channel(`profile-chat-realtime:${profileId}`)
    .on('postgres_changes', {
      event: '*', // Listen to INSERT, UPDATE, DELETE
      schema: 'public',
      table: 'profile_chats',
      filter: `profile_id=eq.${profileId}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') {
        addChatMessageToDOM(payload.new);
        
        // If we are currently active on the chat tab, update our own read stamp
        const chatTabActive = document.querySelector('#profileTabs .form-tab.active')?.getAttribute('onclick')?.includes('chatTab');
        if (chatTabActive && payload.new.sender_code !== getEffectiveStaffCode()) {
          markChatAsRead(profileId);
        }

        const countEl = document.getElementById('chatCount');
        if (countEl) {
          // Increment message count locally
          const text = countEl.textContent || '0';
          const match = text.match(/(\d+)/);
          if (match) {
            const currentCount = parseInt(match[1]) + 1;
            countEl.textContent = `${currentCount} tin nhắn`;
          }
        }
        updateSeenIndicators();
      } else if (payload.eventType === 'UPDATE') {
        updateChatMessageInDOM(payload.new);
        updateSeenIndicators();
      } else if (payload.eventType === 'DELETE') {
        removeChatMessageFromDOM(payload.old.id);
        updateSeenIndicators();
      }
    })
    .on('postgres_changes', {
      event: '*', // Listen to INSERT, UPDATE, DELETE on reads
      schema: 'public',
      table: 'profile_chat_reads',
      filter: `profile_id=eq.${profileId}`
    }, (payload) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        const read = payload.new;
        if (window._chatReads) {
          const idx = window._chatReads.findIndex(r => r.staff_code === read.staff_code);
          if (idx !== -1) {
            window._chatReads[idx] = read;
          } else {
            window._chatReads.push(read);
          }
          updateSeenIndicators();
        }
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Realtime subscribed for profile:${profileId}`);
      }
    });
}

let _globalChatSubscription = null;

function setupGlobalChatRealtime() {
  if (typeof window.supabase === 'undefined') {
    console.warn('Supabase JS Client is not loaded. Global realtime disabled.');
    return;
  }
  
  if (!_supabaseRealtimeClient) {
    _supabaseRealtimeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  
  if (_globalChatSubscription) return; // already subscribed
  
  _globalChatSubscription = _supabaseRealtimeClient
    .channel('global-profile-chats')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'profile_chats'
    }, (payload) => {
      const msg = payload.new;
      const myCode = getEffectiveStaffCode();
      
      // If it's a message from someone else
      if (msg.sender_code !== myCode) {
        // If we are currently viewing the profile of this message
        if (currentProfileId === msg.profile_id) {
          // If the chat tab is currently active, mark as read immediately
          const chatTabActive = document.querySelector('#profileTabs .form-tab.active')?.getAttribute('onclick')?.includes('chatTab');
          if (chatTabActive) {
            markChatAsRead(msg.profile_id);
            return;
          }
        }
        
        // Check if the profile belongs to the loaded profiles list
        const hasAccess = typeof allProfiles !== 'undefined' && allProfiles.some(p => p.id === msg.profile_id);
        if (hasAccess) {
          if (window.unreadChatProfileIds) {
            window.unreadChatProfileIds.add(msg.profile_id);
          } else {
            window.unreadChatProfileIds = new Set([msg.profile_id]);
          }
          
          // Re-render list elements to show the badge
          if (typeof filterProfiles === 'function') filterProfiles();
          if (typeof renderPersonalList === 'function' && window._activePersonalListType) {
            renderPersonalList(window._activePersonalListType);
          }
        }
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Global profile chat realtime subscribed.');
      }
    });
}

// Emoji Picker toggle and generation
function toggleChatEmojiPicker() {
  const picker = document.getElementById('chatEmojiPicker');
  if (!picker) return;
  
  if (picker.style.display === 'none') {
    // Generate grid content
    picker.innerHTML = CHAT_COMMON_EMOJIS.map(emoji => `
      <div onclick="insertChatEmoji('${emoji}')" style="font-size:20px; text-align:center; padding:4px; cursor:pointer; user-select:none; border-radius:6px; transition:background 0.15s;" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
        ${emoji}
      </div>
    `).join('');
    picker.style.display = 'grid';
  } else {
    picker.style.display = 'none';
  }
}

// Insert emoji into text input
function insertChatEmoji(emoji) {
  const input = document.getElementById('profileChatInput');
  const picker = document.getElementById('chatEmojiPicker');
  if (input) {
    const text = input.value;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    input.value = text.substring(0, start) + emoji + text.substring(end);
    input.focus();
    // Move selection point after the emoji
    const newPos = start + emoji.length;
    input.setSelectionRange(newPos, newPos);
  }
  if (picker) {
    picker.style.display = 'none';
  }
}

// Load all profile IDs with unread chat messages for the current user
async function loadUnreadChats() {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;
  try {
    const res = await sbFetch('/rpc/get_unread_chats', {
      method: 'POST',
      body: JSON.stringify({ user_code: myCode })
    });
    const data = await res.json();
    window.unreadChatProfileIds = new Set((data || []).map(d => d.profile_id));
  } catch(e) {
    console.warn('loadUnreadChats error:', e);
    window.unreadChatProfileIds = new Set();
  }
  
  // Set up global realtime listener for new chat messages
  setupGlobalChatRealtime();
}

// Edit and Delete Message Utilities
window._editingMessageId = null;

function startEditChatMessage(msgId) {
  const row = document.getElementById(`msg_${msgId}`);
  if (!row) return;

  const rawText = row.getAttribute('data-raw-text') || '';
  const input = document.getElementById('profileChatInput');
  const indicator = document.getElementById('chatEditIndicator');
  const sendBtn = document.querySelector('.chat-send-btn');
  
  if (input && indicator && sendBtn) {
    window._editingMessageId = msgId;
    input.value = rawText;
    input.placeholder = 'Đang chỉnh sửa tin nhắn...';
    sendBtn.textContent = 'Lưu';
    indicator.style.display = 'flex';
    input.focus();
    
    // Close emoji picker
    const picker = document.getElementById('chatEmojiPicker');
    if (picker) picker.style.display = 'none';
  }
}

function cancelEditChatMessage() {
  const input = document.getElementById('profileChatInput');
  const indicator = document.getElementById('chatEditIndicator');
  const sendBtn = document.querySelector('.chat-send-btn');
  
  window._editingMessageId = null;
  if (input) {
    input.value = '';
    input.placeholder = 'Nhập tin nhắn... tag @JD để thông báo';
  }
  if (sendBtn) {
    sendBtn.textContent = 'Gửi';
  }
  if (indicator) {
    indicator.style.display = 'none';
  }
}

async function saveEditChatMessage() {
  const msgId = window._editingMessageId;
  const input = document.getElementById('profileChatInput');
  if (!msgId || !input) return;

  const newText = input.value.trim();
  if (!newText) return;

  try {
    const res = await sbFetch(`/rest/v1/profile_chats?id=eq.${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ message: newText })
    });
    
    if (res.ok) {
      cancelEditChatMessage();
      showToast('✅ Đã cập nhật tin nhắn');
    } else {
      const err = await res.text();
      console.error('saveEditChatMessage error:', err);
      showToast('❌ Lỗi sửa tin nhắn');
    }
  } catch(e) {
    console.error('saveEditChatMessage:', e);
    showToast('❌ Lỗi sửa tin nhắn');
  }
}

async function deleteChatMessage(msgId) {
  if (!confirm('Bạn có chắc chắn muốn xoá tin nhắn này không?')) return;

  try {
    const res = await sbFetch(`/rest/v1/profile_chats?id=eq.${msgId}`, {
      method: 'DELETE'
    });
    
    if (res.ok) {
      showToast('🗑️ Đã xoá tin nhắn');
      const el = document.getElementById(`msg_${msgId}`);
      if (el) el.remove();
    } else {
      showToast('❌ Lỗi xoá tin nhắn');
    }
  } catch(e) {
    console.error('deleteChatMessage:', e);
    showToast('❌ Lỗi xoá tin nhắn');
  }
}

function updateChatMessageInDOM(msg) {
  const row = document.getElementById(`msg_${msg.id}`);
  if (!row) return;

  // Update memory list
  if (window._chatMessages) {
    const idx = window._chatMessages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      window._chatMessages[idx] = msg;
    }
  }
  
  row.setAttribute('data-raw-text', msg.message);
  
  const textEl = row.querySelector('.chat-message-text');
  if (textEl) {
    let messageText = escHtml(msg.message);
    messageText = messageText.replace(/@(\d{6}-[A-Z]+)/g, '<span class="chat-mention">@$1</span>');
    textEl.innerHTML = messageText;
    
    // Add (đã sửa) tag
    const timeEl = row.querySelector('.chat-message-time');
    if (timeEl && !row.querySelector('.chat-message-edited-tag')) {
      const tagHtml = '<span class="chat-message-edited-tag" style="opacity:0.6; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>';
      const lastChild = timeEl.lastElementChild || timeEl.firstChild;
      if (lastChild === timeEl) {
        timeEl.insertAdjacentHTML('afterbegin', tagHtml);
      } else {
        timeEl.insertBefore(document.createRange().createContextualFragment(tagHtml), lastChild);
      }
    }
  }
}

function removeChatMessageFromDOM(msgId) {
  const row = document.getElementById(`msg_${msgId}`);
  if (row) {
    row.remove();
    
    // Update memory list
    if (window._chatMessages) {
      window._chatMessages = window._chatMessages.filter(m => m.id !== msgId);
    }

    const countEl = document.getElementById('chatCount');
    if (countEl) {
      const text = countEl.textContent || '0';
      const match = text.match(/(\d+)/);
      if (match) {
        const currentCount = Math.max(0, parseInt(match[1]) - 1);
        countEl.textContent = `${currentCount} tin nhắn`;
      }
    }
  }
}

// Update miniature seen indicators below messages
function updateSeenIndicators() {
  document.querySelectorAll('.chat-message-seen-container').forEach(el => {
    el.innerHTML = '';
  });

  if (!window._chatMessages || !window._chatMessages.length || !window._chatReads || !window._chatReads.length) return;

  const myCode = getEffectiveStaffCode();
  const seenMap = {}; // msgId -> array of staff_codes

  window._chatReads.forEach(read => {
    if (read.staff_code === myCode) return;

    const readTime = new Date(read.last_read_at).getTime();
    
    // Find last message read by this staff member
    for (let i = window._chatMessages.length - 1; i >= 0; i--) {
      const msg = window._chatMessages[i];
      const msgTime = new Date(msg.created_at).getTime();
      if (msgTime <= readTime) {
        if (!seenMap[msg.id]) {
          seenMap[msg.id] = [];
        }
        seenMap[msg.id].push(read.staff_code);
        break; // found the latest message read by them
      }
    }
  });

  // Render avatars in containers
  Object.keys(seenMap).forEach(msgId => {
    const container = document.getElementById(`seen_${msgId}`);
    if (container) {
      const avatarsHtml = seenMap[msgId]
        .map(code => renderTinySeenAvatar(code))
        .join('');
      container.innerHTML = avatarsHtml;
    }
  });
}

// Render a tiny staff avatar
function renderTinySeenAvatar(staffCode) {
  const staff = allStaff.find(s => s.staff_code === staffCode);
  const displayName = staff ? (staff.nickname || staff.full_name) : staffCode;
  const initial = displayName ? getNameInitial(displayName) : '?';
  const avatarColor = staff?.staff_avatar_color || '';

  return `
    <div class="chat-seen-avatar" style="background:${avatarColor || 'var(--accent)'};" title="${displayName} (${staffCode})">
      ${initial}
    </div>
  `;
}

// Toggle actions for own message bubble
function toggleBubbleActions(event, msgId) {
  event.stopPropagation();
  
  const targetActions = document.getElementById(`actions_${msgId}`);
  if (!targetActions) return;

  const isOpen = targetActions.style.display === 'inline-flex';

  // Close all other actions
  document.querySelectorAll('.chat-bubble-actions').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('chat-bubble-actions-animate');
  });

  if (!isOpen) {
    targetActions.style.display = 'inline-flex';
    targetActions.classList.add('chat-bubble-actions-animate');
  }
}

// Global click handler to close actions when clicking away
document.addEventListener('click', (e) => {
  if (e.target.closest('.chat-bubble-actions')) return;

  document.querySelectorAll('.chat-bubble-actions').forEach(el => {
    el.style.display = 'none';
    el.classList.remove('chat-bubble-actions-animate');
  });
});

// Cleanup sub and data on tab exit
function unsubscribeProfileChat() {
  if (_profileChatSubscription) {
    _profileChatSubscription.unsubscribe();
    _profileChatSubscription = null;
  }
  window._chatMessages = [];
  window._chatReads = [];
  currentProfileId = null;
  console.log('Cleaned up profile chat resources.');
}
