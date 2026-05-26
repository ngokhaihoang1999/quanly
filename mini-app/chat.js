// ============ PROFILE CHAT MODULE ============
let _supabaseRealtimeClient = null;
let _profileChatSubscription = null;

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
    const res = await sbFetch(`/rest/v1/profile_chats?profile_id=eq.${profileId}&select=*&order=created_at.asc`);
    const messages = await res.json();
    
    if (countEl) {
      countEl.textContent = `${messages.length} tin nhắn`;
    }
    
    msgArea.innerHTML = '';
    if (messages.length === 0) {
      msgArea.innerHTML = '<div id="chatEmptyState" style="text-align:center;padding:32px;color:var(--text3);font-size:13px;">Chưa có thảo luận nào cho hồ sơ này.</div>';
    } else {
      messages.forEach(msg => addChatMessageToDOM(msg));
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

  const html = `
    <div class="${rowClass}" id="msg_${msg.id}">
      <div class="chat-message-avatar" onclick="showStaffCard('${msg.sender_code}')" style="cursor:pointer;" title="${displayName}">
        ${avatarHtml}
      </div>
      <div class="chat-message-content">
        ${!isMe ? `<div class="chat-message-sender" onclick="showStaffCard('${msg.sender_code}')">${displayName} <span style="font-size:9px;color:var(--text3);font-weight:normal;">(${msg.sender_code})</span></div>` : ''}
        <div class="${bubbleClass}">
          <div class="chat-message-text">${messageText}</div>
          <div class="chat-message-time">${timeStr}</div>
        </div>
      </div>
    </div>
  `;
  
  msgArea.insertAdjacentHTML('beforeend', html);
  
  // Keep scroll at bottom
  msgArea.scrollTop = msgArea.scrollHeight;
}

// Send chat message
async function sendProfileChatMessage() {
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
      event: 'INSERT',
      schema: 'public',
      table: 'profile_chats',
      filter: `profile_id=eq.${profileId}`
    }, (payload) => {
      // Direct render
      addChatMessageToDOM(payload.new);
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
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Realtime subscribed for profile:${profileId}`);
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
}
