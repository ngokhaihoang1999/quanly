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

// Beautiful distinct color palette for group chat sender nicknames (Telegram aesthetic)
const CHAT_SENDER_COLORS = [
  '#e91e63', // pink
  '#9c27b0', // purple
  '#673ab7', // deep purple
  '#3f51b5', // indigo
  '#2196f3', // blue
  '#00af9c', // teal
  '#0d9e4f', // green
  '#d97706', // orange
  '#ea580c'  // red-orange
];

function getChatSenderColor(str) {
  if (!str) return CHAT_SENDER_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CHAT_SENDER_COLORS.length;
  return CHAT_SENDER_COLORS[index];
}


// Initialize and load chat history
async function loadProfileChat(profileId) {
  currentProfileId = profileId;
  const msgArea = document.getElementById('profileChatMessages');
  const countEl = document.getElementById('chatCount');
  if (!msgArea) return;

  const searchInput = document.getElementById('cjMainChatSearchInput');
  if (searchInput) searchInput.value = '';

  // Smart caching check: if we are switching back to the same chat tab and it's already loaded, just mark read & scroll
  if (window._lastLoadedProfileChatId === profileId && msgArea.children.length > 0 && !msgArea.innerHTML.includes('Đang tải')) {
    try {
      await markChatAsRead(profileId);
      updateSeenIndicators();
      msgArea.scrollTop = msgArea.scrollHeight;
    } catch(e) {
      console.warn('loadProfileChat cached reentry error:', e);
    }
    return;
  }

  msgArea.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text3);font-size:13px;">⌛ Đang tải cuộc thảo luận...</div>';
  
  try {
    // 1. Mark chat as read first so DB updates
    await markChatAsRead(profileId);

    // 2. Initialize memory state
    window._chatMessages = [];
    window._chatReads = [];

    // 3. Fetch messages and read states in parallel
    const [messagesRes, readsRes] = await Promise.all([
      sbFetch(`/rest/v1/profile_chats?profile_id=eq.${profileId}&select=*&order=created_at.desc&limit=100`, {
        headers: { 'Cache-Control': 'no-cache' }
      }),
      sbFetch(`/rest/v1/profile_chat_reads?profile_id=eq.${profileId}&select=*`, {
        headers: { 'Cache-Control': 'no-cache' }
      })
    ]);

    const messages = await messagesRes.json();
    messages.reverse(); // Đảo ngược danh sách để hiển thị từ cũ đến mới (trên xuống dưới)
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

    // Update chat tab badge
    updateChatTabBadge();

    // Cache the last loaded profile ID
    window._lastLoadedProfileChatId = profileId;

    // Bind tag autocomplete once
    const input = document.getElementById('profileChatInput');
    if (input && !input.dataset.tagAutocompleteBound) {
      input.dataset.tagAutocompleteBound = '1';
      setupChatTagAutocomplete();
    }
    
    // Close emoji picker if open
    const picker = document.getElementById('chatEmojiPicker');
    if (picker) picker.style.display = 'none';
  } catch(e) {
    msgArea.innerHTML = '<div style="text-align:center;padding:16px;color:var(--red);font-size:13px;">❌ Lỗi tải cuộc thảo luận.</div>';
    console.error('loadProfileChat:', e);
  }
}

// Helper to detect if a message is purely a visual media URL (image/video) and doesn't contain other text
function isPureVisualMedia(text) {
  if (!text) return false;
  const trimmed = text.trim();
  // Check if it is a single URL (no spaces in between)
  const urlRegex = /^https?:\/\/[^\s<]+$/i;
  if (!urlRegex.test(trimmed)) return false;
  
  const url = trimmed;
  const isTelegramFile = url.includes('/file/bot') || url.includes('/functions/v1/telegram-bot');
  let isDocFile = false;
  let fileName = '';
  
  if (url.includes('/functions/v1/telegram-bot')) {
    try {
      const urlObj = new URL(url.replace(/&amp;/g, '&'));
      const nameParam = urlObj.searchParams.get('name');
      const fileParam = urlObj.searchParams.get('file') || '';
      fileName = nameParam ? decodeURIComponent(nameParam) : (fileParam.split('/').pop() || '');
      if (fileParam.includes('documents/') || !/\.(jpeg|jpg|gif|png|webp|svg)$/i.test(fileName)) {
        isDocFile = true;
      }
    } catch (e) {}
  } else {
    try {
      const urlObj = new URL(url);
      fileName = urlObj.pathname.split('/').pop() || '';
    } catch (e) {}
  }
  
  const isAudio = /\.(mp3|wav|m4a|ogg|aac|opus|flac)$/i.test(fileName) || 
                  url.includes('/audio/') || 
                  fileName.includes('voice_message') || 
                  fileName.includes('voice_note') || 
                  fileName.includes('audio_record') ||
                  (url.includes('/telegram-bot') && url.includes('voice'));
                  
  const isVideo = (/\.(mp4|webm|ogg|mov|m4v|3gp|quicktime)$/i.test(fileName) || url.includes('/video/')) && !isAudio;
  const isImage = (/\.(jpeg|jpg|gif|png|webp|svg)/i.test(url) || 
                  isTelegramFile || 
                  url.includes('imgbb.com') || 
                  url.includes('postimg.cc')) && !isDocFile && !isVideo && !isAudio;
                  
  return (isImage || isVideo) && !isDocFile;
}

// Preprocess chat message for Telegram username badges and media metadata links
function preprocessChatMessage(msg) {
  const isTelegramUser = msg.sender_code && msg.sender_code.startsWith('tg:');
  let displayName = msg.sender_code || '';
  let avatarColor = '';
  let clickHandler = '';
  let senderCodeHtml = '';

  if (isTelegramUser) {
    displayName = msg.tg_sender_name || msg.sender_code;
    avatarColor = 'linear-gradient(135deg, #2abeef, #0088cc)';
    senderCodeHtml = ` <span class="telegram-badge" style="font-size:9px; background:#0088cc; color:white; padding:1px 5px; border-radius:4px; font-weight:normal; margin-left:4px; display:inline-block; vertical-align:middle; line-height:1.2;">Telegram</span>`;
  } else {
    const sender = typeof allStaff !== 'undefined' ? allStaff.find(s => s.staff_code === msg.sender_code) : null;
    displayName = sender ? (sender.nickname || sender.full_name) : msg.sender_code;
    avatarColor = sender?.staff_avatar_color || '';
    clickHandler = `onclick="showStaffCard('${msg.sender_code}')" style="cursor:pointer;"`;
    senderCodeHtml = ` <span style="font-size:9px;color:var(--text3);font-weight:normal;">(${msg.sender_code})</span>`;
  }

  const initial = displayName ? getNameInitial(displayName) : '?';
  const avatarHtml = typeof renderAnimatedAvatar === 'function'
    ? renderAnimatedAvatar(initial, avatarColor, 'sm')
    : `<div style="width:32px;height:32px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;">${initial}</div>`;

  let chatText = msg.message || '';
  let mediaUrl = '';
  if (msg.media_metadata && msg.media_metadata.file_path) {
    const fileParam = msg.media_metadata.file_path;
    const nameParam = msg.media_metadata.name || (fileParam.split('/').pop() || 'file');
    mediaUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?file=${fileParam}&name=${encodeURIComponent(nameParam)}`;
    
    const isFallbackLabel = ['[📷 Ảnh]', '[🎥 Video]', '[🎙️ Voice Note]'].includes(msg.message) || (msg.message && msg.message.startsWith('[📄 Tài liệu]'));
    if (isFallbackLabel) {
      chatText = mediaUrl;
    } else {
      chatText = chatText + '\n' + mediaUrl;
    }
  }

  const isPureMedia = isPureVisualMedia(chatText);
  const isMediaLink = chatText.includes('/file/bot') || chatText.includes('/functions/v1/telegram-bot') || /\.(jpeg|jpg|gif|png|webp|svg|mp3|wav|m4a|ogg|aac|opus|flac|mp4|webm|mov|m4v|3gp|quicktime)/i.test(chatText) || chatText.includes('imgbb.com') || chatText.includes('postimg.cc');

  return {
    isTelegramUser,
    displayName,
    avatarColor,
    clickHandler,
    senderCodeHtml,
    initial,
    avatarHtml,
    chatText,
    isPureMedia,
    isMediaLink
  };
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
  
  // Preprocess message details
  const p = preprocessChatMessage(msg);
  
  // Format message time
  let timeStr = '';
  try {
    const d = new Date(msg.created_at);
    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch(e) {}

  // Determine styling based on category
  let bubbleClass = 'chat-message-bubble';
  if (p.isPureMedia) {
    bubbleClass += ' chat-message-bubble--media-only';
  } else {
    if (isMe) bubbleClass += ' chat-message-bubble--me';
    if (msg.category === 'warning') bubbleClass += ' chat-message-bubble--warning';
    if (msg.category === 'strategy') bubbleClass += ' chat-message-bubble--strategy';
    if (msg.category === 'important') bubbleClass += ' chat-message-bubble--important';
  }

  const rowClass = isMe ? 'chat-message-row chat-message-row--me' : 'chat-message-row';

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

  let messageText = '';
  let messageContentHtml = '';

  const isEdited = msg.updated_at && (new Date(msg.updated_at) - new Date(msg.created_at) > 2000);
  const editedHtml = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.6; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>` : '';
  const mediaTimeWithEdited = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.7; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>${timeStr}` : timeStr;

  if (p.isPureMedia) {
    messageText = formatChatMessageText(p.chatText, mediaTimeWithEdited, isMe, msg.id, false);
    messageContentHtml = `<div class="chat-message-text" style="display:inline-block; line-height:0; vertical-align:middle;">${messageText}</div>`;
  } else {
    messageText = formatChatMessageText(p.chatText);

    const actionsHtml = isMe ? `
      <span class="chat-bubble-actions" id="actions_${msg.id}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
        ${!p.isMediaLink ? `<span onclick="event.stopPropagation(); startEditChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">✏️ Sửa</span>` : ''}
        <span onclick="event.stopPropagation(); deleteChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">🗑️ Xoá</span>
      </span>
    ` : '';

    const metaHtml = `
      <span class="chat-message-meta-inline" style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; margin-left: 8px; margin-top: 4px; user-select: none; line-height: 1; vertical-align: bottom; white-space: nowrap; float: none;">
        ${editedHtml}
        ${actionsHtml}
        <span class="chat-message-time-val">${timeStr}</span>
      </span>
    `;

    if (catIcon) {
      messageContentHtml = `
        <div class="chat-message-body-with-icon" style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
          <div class="chat-message-cat-icon chat-message-cat-icon--${msg.category}">${catIcon}</div>
          <div class="chat-message-text" style="flex: 1; display: inline-flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; min-width: 0; max-width: 100%;">
            <span style="flex: 1; min-width: 0; white-space: pre-wrap; padding-top: 2px;">${messageText}</span>
            ${metaHtml}
          </div>
        </div>
      `;
    } else {
      messageContentHtml = `
        <div class="chat-message-text" style="display: inline-flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; max-width: 100%;">
          <span style="flex: 1; min-width: 0; white-space: pre-wrap;">${messageText}</span>
          ${metaHtml}
        </div>
      `;
    }
  }

  const avatarHtmlBlock = isMe ? '' : `
    <div class="chat-message-avatar" ${p.clickHandler} title="${p.displayName}">
      ${p.avatarHtml}
    </div>
  `;

  const onclickBubble = p.isPureMedia ? '' : `onclick="handleBubbleClick(event, '${msg.id}', ${isMe})"`;

  let bubbleInline = 'cursor:pointer; height:auto !important; min-height:0 !important; flex:0 0 auto !important;';
  if (p.isPureMedia) {
    bubbleInline = 'display:block; border-radius:12px; border:none; background:transparent; padding:0; margin:0; box-shadow:none; height:auto !important; min-height:0 !important; flex:0 0 auto !important;';
  }

  const reactionsHtml = typeof renderMessageReactionsHtml === 'function' ? renderMessageReactionsHtml(msg.reactions, msg.id, isMe, false) : '';

  const rowInline = 'height:auto !important; min-height:0 !important; flex:0 0 auto !important; max-height:none !important;';
  const contentInline = 'height:auto !important; min-height:0 !important; flex:1 1 auto !important;';

  const html = `
    <div class="${rowClass}" id="msg_${msg.id}" data-raw-text="${escHtml(p.chatText)}" style="${rowInline}">
      ${avatarHtmlBlock}
      <div class="chat-message-content" style="${contentInline}">
        ${!isMe ? `<div class="chat-message-sender" ${p.clickHandler} style="color: ${getChatSenderColor(msg.sender_code)}; font-weight: 700;">${p.displayName}${p.senderCodeHtml}</div>` : ''}
        <div class="${bubbleClass}" ${onclickBubble} style="${bubbleInline}">
          ${categoryPrefix ? `<div style="margin-bottom: 5px;">${categoryPrefix}</div>` : ''}
          ${messageContentHtml}
        </div>
        ${reactionsHtml}
        <div class="chat-message-seen-container" id="seen_${msg.id}"></div>
      </div>
    </div>
  `;
  
  msgArea.insertAdjacentHTML('beforeend', html);
  
  // Keep scroll at bottom
  msgArea.scrollTop = msgArea.scrollHeight;
}

// Global media staging state
window._tempUploadMediaUrl = null;

function showTempMediaPreview(url, fileName) {
  const container = document.getElementById('chatTempMediaPreview');
  const thumbContainer = document.getElementById('chatTempMediaThumbnailContainer');
  const nameEl = document.getElementById('chatTempMediaFileName');
  
  if (!container || !thumbContainer || !nameEl) return;
  
  window._tempUploadMediaUrl = url;
  
  // Choose icon / image preview
  let thumbnailHtml = '';
  const isImage = /\.(jpeg|jpg|gif|png|webp|svg)/i.test(url) || url.includes('image');
  const isVideo = /\.(mp4|webm|mov|m4v|3gp)/i.test(url);
  const isAudio = /\.(mp3|wav|m4a|ogg|aac|opus)/i.test(url);
  
  if (isImage) {
    thumbnailHtml = `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:4px;" />`;
  } else if (isVideo) {
    thumbnailHtml = `<span style="font-size:18px;">🎥</span>`;
  } else if (isAudio) {
    thumbnailHtml = `<span style="font-size:18px;">🎵</span>`;
  } else {
    thumbnailHtml = `<span style="font-size:18px;">📄</span>`;
  }
  
  thumbContainer.innerHTML = thumbnailHtml;
  nameEl.textContent = fileName || 'Tệp đính kèm';
  container.style.display = 'flex';
}

function clearTempMediaPreview() {
  window._tempUploadMediaUrl = null;
  window._tempUploadMediaMetadata = null;
  const container = document.getElementById('chatTempMediaPreview');
  if (container) container.style.display = 'none';
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
  const mediaUrl = window._tempUploadMediaUrl;
  const mediaMetadata = window._tempUploadMediaMetadata || null;
  const category = catSelect ? catSelect.value : 'general';
  
  if (!text && !mediaUrl) return;

  // Combine media and caption text into a single message
  let finalMessageText = '';
  if (mediaUrl) {
    finalMessageText = mediaUrl + (text ? '\n' + text : '');
  } else {
    finalMessageText = text;
  }

  input.value = ''; // clear input immediately to feel fast
  input.dispatchEvent(new Event('input', { bubbles: true }));
  haptic('light');

  // Hide and reset temp media preview
  clearTempMediaPreview();

  const sender = getEffectiveStaffCode();
  
  try {
    const res = await sbFetch('/rest/v1/profile_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        profile_id: currentProfileId,
        sender_code: sender,
        message: finalMessageText,
        category: category,
        media_metadata: mediaMetadata
      })
    });
    
    const newMsgArr = await res.json();
    if (newMsgArr && newMsgArr[0]) {
      addChatMessageToDOM(newMsgArr[0]);
    }
    
    // Automatically update my read stamp for this profile chat
    await markChatAsRead(currentProfileId);

    // Parse tag/mentions and notify
    await parseMentionsAndNotify(finalMessageText, currentProfileId);
  } catch(e) {
    showToast('❌ Lỗi gửi tin nhắn');
    console.error('sendProfileChatMessage:', e);
    input.value = text; // restore on error
    if (mediaUrl) {
      showTempMediaPreview(mediaUrl, 'Khôi phục tệp');
    }
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
    await createNotification(
      mentions, 
      'chat_mention', 
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
    if (window.unreadChatMentionProfileIds) {
      window.unreadChatMentionProfileIds.delete(profileId);
    }
    
    // Update chat tab badge
    if (typeof updateChatTabBadge === 'function') updateChatTabBadge();
    
    // Trigger visual list updates to hide unread badges
    if (typeof filterProfiles === 'function') filterProfiles();
    if (typeof updateFloatingChatUI === 'function') updateFloatingChatUI();
    
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
          
          // Check if message mentions user
          const isMention = msg.message && msg.message.includes(`@${myCode}`);
          if (isMention) {
            if (window.unreadChatMentionProfileIds) {
              window.unreadChatMentionProfileIds.add(msg.profile_id);
            } else {
              window.unreadChatMentionProfileIds = new Set([msg.profile_id]);
            }
          }
          
          // Update chat tab badge if this matches current open profile
          if (currentProfileId === msg.profile_id) {
            updateChatTabBadge();
          }
          
          // Re-render list elements to show the badge
          if (typeof filterProfiles === 'function') filterProfiles();
          if (typeof renderPersonalList === 'function' && window._activePersonalListType) {
            renderPersonalList(window._activePersonalListType);
          }
          if (typeof updateFloatingChatUI === 'function') {
            updateFloatingChatUI();
          }
          
          // Trigger shake/bump animation on chat head if collapsed and profile is pinned
          if (window._pinnedChatProfileIds && window._pinnedChatProfileIds.includes(msg.profile_id)) {
            const win = document.getElementById('cjFloatingChatWindow');
            const isCollapsed = !win || win.style.display === 'none' || win.style.display === '';
            if (isCollapsed) {
              const avatarDiv = document.getElementById('cjFloatingChatHeadAvatar');
              if (avatarDiv) {
                avatarDiv.classList.remove('chat-head-bump');
                void avatarDiv.offsetWidth; // trigger reflow to restart animation
                avatarDiv.classList.add('chat-head-bump');
                avatarDiv.onanimationend = () => {
                  avatarDiv.classList.remove('chat-head-bump');
                };
              }
            }
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
    window.unreadChatMentionProfileIds = new Set((data || []).filter(d => d.has_mention).map(d => d.profile_id));
  } catch(e) {
    console.warn('loadUnreadChats error:', e);
    window.unreadChatProfileIds = new Set();
    window.unreadChatMentionProfileIds = new Set();
  }
  
  // Update current chat tab badge if open
  updateChatTabBadge();
  
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
    input.placeholder = 'Nhập tin nhắn... (@ để tag)';
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
  const myCode = getEffectiveStaffCode();
  const isMe = msg.sender_code === myCode;

  // Preprocess message details
  const p = preprocessChatMessage(msg);

  // Update memory list
  if (window._chatMessages) {
    const idx = window._chatMessages.findIndex(m => m.id === msg.id);
    if (idx !== -1) {
      window._chatMessages[idx] = msg;
    }
  }
  
  if (row) {
    row.setAttribute('data-raw-text', p.chatText);
    
    const bubble = row.querySelector('.chat-message-bubble');
    if (bubble) {
      let timeStr = '';
      try {
        const d = new Date(msg.created_at);
        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch(e) {}

      // Determine category badge / prefix
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

      // Set bubble class and inline styles to bypass WebView caching
      bubble.className = 'chat-message-bubble';
      if (p.isPureMedia) {
        bubble.classList.add('chat-message-bubble--media-only');
        bubble.style.cssText = 'display: block; border-radius: 12px; border: none; background: transparent; padding: 0; margin: 0; box-shadow: none;';
      } else {
        if (isMe) bubble.classList.add('chat-message-bubble--me');
        if (msg.category === 'warning') bubble.classList.add('chat-message-bubble--warning');
        if (msg.category === 'strategy') bubble.classList.add('chat-message-bubble--strategy');
        if (msg.category === 'important') bubble.classList.add('chat-message-bubble--important');
        bubble.style.cssText = '';
      }

      let messageText = '';
      let messageContentHtml = '';

      const isEdited = msg.updated_at && (new Date(msg.updated_at) - new Date(msg.created_at) > 2000);
      const editedHtml = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.6; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>` : '';
      const displayTimeStr = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.7; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>${timeStr}` : timeStr;

      if (p.isPureMedia) {
        messageText = formatChatMessageText(p.chatText, displayTimeStr, isMe, msg.id, false);
        messageContentHtml = `<div class="chat-message-text" style="display:inline-block; line-height:0; vertical-align:middle;">${messageText}</div>`;
      } else {
        messageText = formatChatMessageText(p.chatText);
        
        const actionsHtml = isMe ? `
          <span class="chat-bubble-actions" id="actions_${msg.id}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
            <span onclick="event.stopPropagation(); startEditChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">✏️ Sửa</span>
            <span onclick="event.stopPropagation(); deleteChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">🗑️ Xoá</span>
          </span>
        ` : '';

        const metaHtml = `
          <span class="chat-message-meta-inline" style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; margin-left: 8px; margin-top: 4px; user-select: none; line-height: 1; vertical-align: bottom; white-space: nowrap; float: none;">
            ${editedHtml}
            ${actionsHtml}
            <span class="chat-message-time-val">${timeStr}</span>
          </span>
        `;

        if (catIcon) {
          messageContentHtml = `
            <div class="chat-message-body-with-icon" style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
              <div class="chat-message-cat-icon chat-message-cat-icon--${msg.category}">${catIcon}</div>
              <div class="chat-message-text" style="flex: 1; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; min-width: 0;">
                <span style="flex: 1; min-width: 0; white-space: pre-wrap; padding-top: 2px;">${messageText}</span>
                ${metaHtml}
              </div>
            </div>
          `;
        } else {
          messageContentHtml = `
            <div class="chat-message-text" style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; width: 100%;">
              <span style="flex: 1; min-width: 0; white-space: pre-wrap;">${messageText}</span>
              ${metaHtml}
            </div>
          `;
        }
      }

      bubble.innerHTML = `
        ${categoryPrefix ? `<div style="margin-bottom: 5px;">${categoryPrefix}</div>` : ''}
        ${messageContentHtml}
      `;
      
      // update click handler
      if (!p.isPureMedia) {
        bubble.setAttribute('onclick', `handleBubbleClick(event, '${msg.id}', ${isMe})`);
        bubble.style.cursor = 'pointer';
      } else {
        bubble.removeAttribute('onclick');
        bubble.style.cursor = 'default';
      }
    }

    // Update reactions for main chat
    const contentContainer = row.querySelector('.chat-message-content');
    if (contentContainer) {
      const oldReactions = contentContainer.querySelector('.chat-message-reactions');
      if (oldReactions) oldReactions.remove();
      
      const reactionsHtml = typeof renderMessageReactionsHtml === 'function' ? renderMessageReactionsHtml(msg.reactions, msg.id, isMe, false) : '';
      if (reactionsHtml) {
        const seenContainer = contentContainer.querySelector('.chat-message-seen-container');
        if (seenContainer) {
          seenContainer.insertAdjacentHTML('beforebegin', reactionsHtml);
        } else {
          contentContainer.insertAdjacentHTML('beforeend', reactionsHtml);
        }
      }
    }
  }

  // Update floating chat message if exists in DOM
  const flRow = document.getElementById(`fl_msg_${msg.id}`);
  if (flRow) {
    flRow.setAttribute('data-raw-text', p.chatText);
    const flBubble = flRow.querySelector('.chat-message-bubble');
    if (flBubble) {
      let timeStr = '';
      try {
        const d = new Date(msg.created_at);
        timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      } catch(e) {}

      // Determine category badge / prefix
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

      flBubble.className = 'chat-message-bubble';
      if (p.isPureMedia) {
        flBubble.classList.add('chat-message-bubble--media-only');
        flBubble.style.cssText = 'display: block; border-radius: 12px; border: none; background: transparent; padding: 0; margin: 0; box-shadow: none;';
      } else {
        if (isMe) flBubble.classList.add('chat-message-bubble--me');
        if (msg.category === 'warning') flBubble.classList.add('chat-message-bubble--warning');
        if (msg.category === 'strategy') flBubble.classList.add('chat-message-bubble--strategy');
        if (msg.category === 'important') flBubble.classList.add('chat-message-bubble--important');
        flBubble.style.cssText = '';
      }

      let messageText = '';
      let messageContentHtml = '';

      const isEdited = msg.updated_at && (new Date(msg.updated_at) - new Date(msg.created_at) > 2000);
      const editedHtml = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.6; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>` : '';
      const displayTimeStr = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.7; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>${timeStr}` : timeStr;

      if (p.isPureMedia) {
        messageText = formatChatMessageText(p.chatText, displayTimeStr, isMe, msg.id, true);
        messageContentHtml = `<div class="chat-message-text" style="display:inline-block; line-height:0; vertical-align:middle;">${messageText}</div>`;
      } else {
        messageText = formatChatMessageText(p.chatText);
        const actionsHtml = isMe ? `
          <span class="chat-bubble-actions" id="actions_fl_${msg.id}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
            <span onclick="event.stopPropagation(); deleteChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.85'">🗑️ Xoá</span>
          </span>
        ` : '';

        const metaHtml = `
          <span class="chat-message-meta-inline" style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; margin-left: 8px; margin-top: 4px; user-select: none; line-height: 1; vertical-align: bottom; white-space: nowrap; float: none;">
            ${editedHtml}
            ${actionsHtml}
            <span class="chat-message-time-val">${timeStr}</span>
          </span>
        `;

        if (catIcon) {
          messageContentHtml = `
            <div class="chat-message-body-with-icon" style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
              <div class="chat-message-cat-icon chat-message-cat-icon--${msg.category}">${catIcon}</div>
              <div class="chat-message-text" style="flex: 1; display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; min-width: 0;">
                <span style="flex: 1; min-width: 0; white-space: pre-wrap; padding-top: 2px;">${messageText}</span>
                ${metaHtml}
              </div>
            </div>
          `;
        } else {
          messageContentHtml = `
            <div class="chat-message-text" style="display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; width: 100%;">
              <span style="flex: 1; min-width: 0; white-space: pre-wrap;">${messageText}</span>
              ${metaHtml}
            </div>
          `;
        }
      }

      flBubble.innerHTML = `
        ${categoryPrefix ? `<div style="margin-bottom: 5px;">${categoryPrefix}</div>` : ''}
        ${messageContentHtml}
      `;

      if (!p.isPureMedia) {
        flBubble.setAttribute('onclick', `handleBubbleClick(event, 'fl_${msg.id}', ${isMe})`);
        flBubble.style.cursor = 'pointer';
      } else {
        flBubble.removeAttribute('onclick');
        flBubble.style.cursor = 'default';
      }
    }

    // Update reactions for floating row
    const flContent = flRow.querySelector('.chat-message-content');
    if (flContent) {
      const oldFlReactions = flContent.querySelector('.chat-message-reactions');
      if (oldFlReactions) oldFlReactions.remove();
      
      const flReactionsHtml = typeof renderMessageReactionsHtml === 'function' ? renderMessageReactionsHtml(msg.reactions, msg.id, isMe, true) : '';
      if (flReactionsHtml) {
        flContent.insertAdjacentHTML('beforeend', flReactionsHtml);
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

// Format message text: Mentions, links, and inline images/documents/videos/audios (Secure Telegram Proxy)
function formatChatMessageText(text, mediaTimeStr = '', isMe = false, msgId = '', isFloating = false) {
  let messageText = escHtml(text);
  
  // 1. Format mentions
  messageText = messageText.replace(/@(\d{6}-[A-Z]+)/g, '<span class="chat-mention">@$1</span>');

  // 2. Format links and check if they are images, videos, audios, or documents
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  messageText = messageText.replace(urlRegex, (url) => {
    const isTelegramFile = url.includes('/file/bot') || url.includes('/functions/v1/telegram-bot');
    
    let isDocFile = false;
    let fileName = 'Tệp tin đính kèm';
    let fileParam = '';
    
    if (url.includes('/functions/v1/telegram-bot')) {
      try {
        const urlObj = new URL(url.replace(/&amp;/g, '&'));
        const nameParam = urlObj.searchParams.get('name');
        fileParam = urlObj.searchParams.get('file') || '';
        
        if (nameParam) {
          fileName = decodeURIComponent(nameParam);
        } else {
          fileName = fileParam.split('/').pop() || 'Tệp tin';
        }
        
        if (fileParam.includes('documents/') || !/\.(jpeg|jpg|gif|png|webp|svg)$/i.test(fileName)) {
          isDocFile = true;
        }
      } catch (e) {
        console.warn('URL parsing failed:', e);
      }
    } else {
      // Extrapolate filename for non-telegram links
      try {
        const urlObj = new URL(url);
        fileName = urlObj.pathname.split('/').pop() || 'Tệp tin';
      } catch (e) {}
    }

    let displayUrl = url;
    if (isTelegramFile && !url.includes('/functions/v1/telegram-bot')) {
      const match = url.match(/\/file\/bot[^/]+\/(.+)/i);
      if (match && match[1]) {
        const filePath = match[1];
        displayUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?file=${filePath}`;
      }
    }

    // Detect media types
    const isAudio = /\.(mp3|wav|m4a|ogg|aac|opus|flac)$/i.test(fileName) || 
                    url.includes('/audio/') || 
                    fileName.includes('voice_message') || 
                    fileName.includes('voice_note') || 
                    fileName.includes('audio_record') ||
                    (fileParam && fileParam.includes('voice'));

    const isVideo = (/\.(mp4|webm|ogg|mov|m4v|3gp|quicktime)$/i.test(fileName) || url.includes('/video/')) && !isAudio;

    const isImage = (/\.(jpeg|jpg|gif|png|webp|svg)/i.test(url) || 
                    isTelegramFile || 
                    url.includes('imgbb.com') || 
                    url.includes('postimg.cc')) && !isDocFile && !isVideo && !isAudio;
    
    if (isImage) {
      let overlayHtml = '';
      if (mediaTimeStr) {
        let actionsHtml = '';
        if (isMe && msgId) {
          const actId = isFloating ? `actions_fl_${msgId}` : `actions_${msgId}`;
          const toggleId = isFloating ? `fl_${msgId}` : msgId;
          actionsHtml = `
            <span class="chat-bubble-actions" id="${actId}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
              <span onclick="event.stopPropagation(); deleteChatMessage('${msgId}')" style="cursor:pointer; color:#ff6b6b; font-weight:700; text-decoration:underline;">🗑️ Xoá</span>
            </span>
          `;
        }
        const toggleId = isFloating ? `fl_${msgId}` : msgId;
        overlayHtml = `
          <div class="chat-message-media-time-overlay" onclick="event.stopPropagation(); ${isMe ? `toggleBubbleActions(event, '${toggleId}')` : ''}">
            ${actionsHtml}
            <span>${mediaTimeStr}</span>
          </div>
        `;
      }
      
      let deleteBtnHtml = '';
      if (isMe && msgId) {
        deleteBtnHtml = `
          <button type="button" onclick="event.stopPropagation(); deleteChatMessage('${msgId}')" style="
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: #ff6b6b;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            padding: 0;
            margin: 0;
          " onmouseover="this.style.background='rgba(239, 68, 68, 0.9)'; this.style.color='#fff'; this.style.borderColor='rgba(255,255,255,0.4)';" onmouseout="this.style.background='rgba(0, 0, 0, 0.6)'; this.style.color='#ff6b6b'; this.style.borderColor='rgba(255,255,255,0.25)';">
            🗑️
          </button>
        `;
      }

      return `
        <div class="chat-image-wrap" style="margin-top: 0px; border-radius: 12px; overflow: hidden; max-width: 280px; cursor: pointer; position: relative; border: 1px solid var(--border);" onclick="openChatImageModal('${displayUrl}')">
          <img src="${displayUrl}" style="width: 100%; max-height: 240px; object-fit: cover; display: block; border-radius: 12px;" onerror="this.onerror=null; this.src='https://placehold.co/240x150?text=Hình+ảnh+lỗi';" />
          ${deleteBtnHtml}
          ${overlayHtml}
        </div>
      `;
    } else if (isVideo) {
      let overlayHtml = '';
      if (mediaTimeStr) {
        let actionsHtml = '';
        if (isMe && msgId) {
          const actId = isFloating ? `actions_fl_${msgId}` : `actions_${msgId}`;
          const toggleId = isFloating ? `fl_${msgId}` : msgId;
          actionsHtml = `
            <span class="chat-bubble-actions" id="${actId}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
              <span onclick="event.stopPropagation(); deleteChatMessage('${msgId}')" style="cursor:pointer; color:#ff6b6b; font-weight:700; text-decoration:underline;">🗑️ Xoá</span>
            </span>
          `;
        }
        const toggleId = isFloating ? `fl_${msgId}` : msgId;
        overlayHtml = `
          <div class="chat-message-media-time-overlay" onclick="event.stopPropagation(); ${isMe ? `toggleBubbleActions(event, '${toggleId}')` : ''}">
            ${actionsHtml}
            <span>${mediaTimeStr}</span>
          </div>
        `;
      }

      let deleteBtnHtml = '';
      if (isMe && msgId) {
        deleteBtnHtml = `
          <button type="button" onclick="event.stopPropagation(); deleteChatMessage('${msgId}')" style="
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.25);
            color: #ff6b6b;
            font-size: 13px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 20;
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            padding: 0;
            margin: 0;
          " onmouseover="this.style.background='rgba(239, 68, 68, 0.9)'; this.style.color='#fff'; this.style.borderColor='rgba(255,255,255,0.4)';" onmouseout="this.style.background='rgba(0, 0, 0, 0.6)'; this.style.color='#ff6b6b'; this.style.borderColor='rgba(255,255,255,0.25)';">
            🗑️
          </button>
        `;
      }

      return `
        <div class="chat-video-wrap" style="margin-top: 0px; border-radius: 12px; overflow: hidden; max-width: 280px; position: relative;">
          <video src="${displayUrl}" class="chat-video-player" style="border-radius: 12px; max-height: 240px; display: block;" controls playsinline preload="metadata"></video>
          ${deleteBtnHtml}
          ${overlayHtml}
        </div>
      `;
    } else if (isAudio) {
      const safeId = 'v_' + Math.random().toString(36).substr(2, 9);
      
      // Extract duration from filename or URL query parameter
      const durMatch = fileName.match(/_dur(\d+)/i) || url.match(/[?&]dur=(\d+)/i);
      const extractedDuration = durMatch ? parseInt(durMatch[1]) : '';

      // Initialize the audio player dynamic bindings in standard javascript
      setTimeout(() => {
        if (typeof initCustomAudioPlayer === 'function') {
          initCustomAudioPlayer(safeId);
        }
      }, 50);

      return `
        <div class="voice-player" id="voice_player_${safeId}">
          <audio id="audio_${safeId}" src="${displayUrl}" preload="metadata" data-duration="${extractedDuration}" style="display:none;"></audio>
          <button type="button" class="voice-player-play-btn" id="play_btn_${safeId}" onclick="toggleVoicePlayerPlay('${safeId}')">
            <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" class="play-icon" style="margin-left: 2px;"><path d="M1.5 12.3V1.7c0-.9 1-1.4 1.8-.9l8 5.3c.7.4.7 1.4 0 1.9l-8 5.3c-.8.5-1.8 0-1.8-.9z"/></svg>
          </button>
          <div class="voice-player-body">
            <div class="voice-player-waves" id="waves_${safeId}" onclick="seekVoicePlayerByWaves(event, '${safeId}')"></div>
            <div class="voice-player-meta-row">
              <span class="voice-player-time" id="time_${safeId}">0:00</span>
              <span class="voice-player-divider">/</span>
              <span class="voice-player-duration" id="dur_${safeId}">0:00</span>
              <button type="button" class="voice-player-speed-btn" id="speed_${safeId}" onclick="toggleVoicePlayerSpeed('${safeId}')">1x</button>
            </div>
          </div>
        </div>
      `;
    } else if (isDocFile) {
      return `
        <div class="chat-file-card" onclick="window.open('${url}', '_blank')" style="display:flex; align-items:center; gap:10px; background:var(--surface2); padding:10px; border-radius:8px; border:1px solid var(--border); cursor:pointer; margin-top:6px; max-width:280px; transition:background 0.15s; user-select:none;" onmouseover="this.style.background='var(--border)'" onmouseout="this.style.background='var(--surface2)'">
          <div style="font-size:24px;">📄</div>
          <div style="flex:1; min-width:0; text-align:left;">
             <div style="font-size:12px; font-weight:700; color:var(--text); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${fileName}">${fileName}</div>
             <div style="font-size:10px; color:var(--text3);">Bấm để tải xuống</div>
          </div>
        </div>
      `;
    } else {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="chat-link" style="color: inherit; text-decoration: underline; font-weight: 600; word-break: break-all;">${url}</a>`;
    }
  });

  return messageText;
}

// Fullscreen image viewer modal
function openChatImageModal(url) {
  let modal = document.getElementById('chatImageModal');
  if (!modal) {
    const html = `
      <div id="chatImageModal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.95); z-index:999999; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(5px); -webkit-backdrop-filter:blur(5px);" onclick="this.style.display='none'">
        <span style="position:absolute; top:20px; right:20px; font-size:32px; color:white; cursor:pointer; font-weight:bold; user-select:none; width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.1); border-radius:50%;">&times;</span>
        <img id="chatImageModalImg" src="" style="max-width:100%; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.6); animation: zoomFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;" onclick="event.stopPropagation();" />
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    modal = document.getElementById('chatImageModal');
  }
  const img = document.getElementById('chatImageModalImg');
  if (img) {
    img.src = url;
  }
  modal.style.display = 'flex';
}

// Upload selected file/media to Telegram CDN via Edge Function POST proxy
async function uploadChatImage(input) {
  const file = input.files?.[0];
  if (!file || !currentProfileId) return;

  // Clear input value so selecting the same image again triggers onchange
  input.value = '';

  const triggerBtn = document.getElementById('chatImageTrigger');
  const originalText = triggerBtn ? triggerBtn.textContent : '📎';
  
  if (triggerBtn) {
    triggerBtn.textContent = '⌛';
    triggerBtn.disabled = true;
    triggerBtn.style.opacity = '0.5';
  }

  showToast('⌛ Đang tải tệp đính kèm...');

  try {
    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }

    const data = await res.json();
    if (data && data.url) {
      // Stage the URL in our temp preview box
      showTempMediaPreview(data.url, file.name);
      
      const fileType = file.type || '';
      let mediaType = 'document';
      if (fileType.startsWith('image/')) mediaType = 'photo';
      else if (fileType.startsWith('video/')) mediaType = 'video';
      else if (fileType.startsWith('audio/')) mediaType = 'voice';
      
      window._tempUploadMediaMetadata = {
        type: mediaType,
        file_path: data.file_path,
        name: file.name
      };
      
      showToast('✅ Tệp đã sẵn sàng, nhập nội dung và bấm gửi');
    } else {
      throw new Error('No URL returned from proxy server');
    }
  } catch (e) {
    showToast('❌ Gửi tệp thất bại');
    console.error('uploadChatImage error:', e);
  } finally {
    if (triggerBtn) {
      triggerBtn.textContent = originalText;
      triggerBtn.disabled = false;
      triggerBtn.style.opacity = '1';
    }
  }
}

// Save the secure proxy URL as message text to the profile chat database
async function sendProxyImageMessage(imageUrl, mediaMetadata = null) {
  const sender = getEffectiveStaffCode();
  const catSelect = document.getElementById('chat_category');
  const category = catSelect ? catSelect.value : 'general';
  
  try {
    const res = await sbFetch('/rest/v1/profile_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        profile_id: currentProfileId,
        sender_code: sender,
        message: imageUrl,
        category: category,
        media_metadata: mediaMetadata
      })
    });
    
    const newMsgArr = await res.json();
    if (newMsgArr && newMsgArr[0]) {
      addChatMessageToDOM(newMsgArr[0]);
    }
    
    // Automatically update my read stamp
    await markChatAsRead(currentProfileId);
  } catch(e) {
    showToast('❌ Lỗi gửi tin nhắn');
    console.error('sendProxyImageMessage:', e);
  }
}

// ============ CHAT TAG AUTOCOMPLETE LOGIC ============
let _chatMatchingStaff = [];
let _chatActiveSuggestionIndex = -1;

function setupChatTagAutocomplete() {
  const input = document.getElementById('profileChatInput');
  const suggestionsBox = document.getElementById('chatTagSuggestions');
  if (!input || !suggestionsBox) return;

  input.addEventListener('input', () => {
    const val = input.value;
    const selectionStart = input.selectionStart || 0;
    
    const textBeforeCursor = val.substring(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : ' ';
      if (charBeforeAt === ' ' || charBeforeAt === '\n') {
        const textAfterAt = textBeforeCursor.substring(lastAtIdx + 1);
        if (!textAfterAt.includes(' ')) {
          showTagSuggestions(textAfterAt, lastAtIdx);
          return;
        }
      }
    }
    
    suggestionsBox.style.display = 'none';
    _chatActiveSuggestionIndex = -1;
  });

  input.addEventListener('keydown', (e) => {
    if (suggestionsBox.style.display === 'flex') {
      const items = suggestionsBox.querySelectorAll('.tag-suggestion-item');
      if (items.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          _chatActiveSuggestionIndex = (_chatActiveSuggestionIndex + 1) % items.length;
          updateActiveSuggestion(items);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          _chatActiveSuggestionIndex = (_chatActiveSuggestionIndex - 1 + items.length) % items.length;
          updateActiveSuggestion(items);
        } else if (e.key === 'Enter') {
          if (_chatActiveSuggestionIndex >= 0 && _chatActiveSuggestionIndex < items.length) {
            e.preventDefault();
            items[_chatActiveSuggestionIndex].click();
          }
        } else if (e.key === 'Escape') {
          e.preventDefault();
          suggestionsBox.style.display = 'none';
          _chatActiveSuggestionIndex = -1;
        }
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#chatTagSuggestions') && e.target !== input) {
      suggestionsBox.style.display = 'none';
      _chatActiveSuggestionIndex = -1;
    }
  });
}

function updateActiveSuggestion(items) {
  items.forEach((item, idx) => {
    if (idx === _chatActiveSuggestionIndex) {
      item.style.background = 'var(--surface2)';
      item.classList.add('active-suggestion');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.style.background = '';
      item.classList.remove('active-suggestion');
    }
  });
}

function showTagSuggestions(query, atIndex) {
  const suggestionsBox = document.getElementById('chatTagSuggestions');
  if (!suggestionsBox) return;

  // Get assigned staff codes for this profile
  const assignedCodes = new Set();
  const p = allProfiles.find(x => x.id === currentProfileId);
  if (p) {
    if (p.ndd_staff_code) assignedCodes.add(p.ndd_staff_code.trim());
    if (p.gvbb_staff_code) assignedCodes.add(p.gvbb_staff_code.trim());
    if (p.tvv_staff_code) {
      p.tvv_staff_code.split(',').forEach(c => {
        const code = c.trim();
        if (code) assignedCodes.add(code);
      });
    }
    if (p.la_staff_code) {
      p.la_staff_code.split(',').forEach(c => {
        const code = c.trim();
        if (code) assignedCodes.add(code);
      });
    }
  }

  const q = query.toLowerCase().trim();
  const matches = allStaff.filter(s => {
    // Only allow if this staff code is assigned to the profile
    if (!assignedCodes.has(s.staff_code)) return false;

    const name = (s.full_name || '').toLowerCase();
    const nickname = (s.nickname || '').toLowerCase();
    const code = (s.staff_code || '').toLowerCase();
    return name.includes(q) || nickname.includes(q) || code.includes(q);
  }).slice(0, 5);

  if (matches.length === 0) {
    suggestionsBox.style.display = 'none';
    _chatActiveSuggestionIndex = -1;
    return;
  }

  _chatMatchingStaff = matches;
  _chatActiveSuggestionIndex = 0; // Default to first item highlighted
  suggestionsBox.innerHTML = matches.map((staff, idx) => {
    const displayName = staff.nickname || staff.full_name || staff.staff_code;
    const initial = getNameInitial(displayName);
    return `
      <div class="tag-suggestion-item" onclick="insertChatTag('${staff.staff_code}', ${atIndex})" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:6px; cursor:pointer; font-size:12px; transition:background 0.15s; user-select:none;" onmouseover="_chatActiveSuggestionIndex = ${idx}; updateActiveSuggestion(this.parentElement.querySelectorAll('.tag-suggestion-item'))">
        <div style="width:24px; height:24px; border-radius:50%; background:${staff.staff_avatar_color || 'var(--accent)'}; color:white; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:700; flex-shrink:0;">
          ${initial}
        </div>
        <div style="flex:1; font-weight:600; text-align:left; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${displayName}</div>
        <div style="font-size:10px; color:var(--text3); flex-shrink:0;">${staff.staff_code}</div>
      </div>
    `;
  }).join('');

  suggestionsBox.style.display = 'flex';
  updateActiveSuggestion(suggestionsBox.querySelectorAll('.tag-suggestion-item'));
}

function insertChatTag(staffCode, atIndex) {
  const input = document.getElementById('profileChatInput');
  const suggestionsBox = document.getElementById('chatTagSuggestions');
  if (!input) return;

  const val = input.value;
  const cursorStart = input.selectionStart || 0;
  
  const before = val.substring(0, atIndex);
  const after = val.substring(cursorStart);
  const tagText = `@${staffCode} `;
  
  input.value = before + tagText + after;
  
  const newCursorPos = atIndex + tagText.length;
  input.focus();
  input.setSelectionRange(newCursorPos, newCursorPos);
  
  if (suggestionsBox) {
    suggestionsBox.style.display = 'none';
  }
}

// Update the badge text for "Thảo luận" tab inside profile detail switcher
function updateChatTabBadge() {
  const tab = document.getElementById('tabProfileChat');
  if (!tab) return;
  
  if (currentProfileId && window.unreadChatProfileIds && window.unreadChatProfileIds.has(currentProfileId)) {
    const isMention = window.unreadChatMentionProfileIds && window.unreadChatMentionProfileIds.has(currentProfileId);
    if (isMention) {
      tab.innerHTML = '💬 Thảo luận <span style="background:var(--red); color:white; font-size:9px; font-weight:700; padding:1px 4px; border-radius:4px; margin-left:3px; animation: pulse 2s infinite;">@</span>';
    } else {
      tab.innerHTML = '💬 Thảo luận <span style="background:var(--red); color:white; font-size:9px; font-weight:700; padding:1px 4px; border-radius:4px; margin-left:3px; animation: pulse 2s infinite;">Mới</span>';
    }
  } else {
    tab.innerHTML = '💬 Thảo luận';
  }
}

// ============ FLOATING MULTI-CHAT MODULE ============
window._pinnedChatProfileIds = [];
window._activeFloatingProfileId = null;
window._floatingActiveChatSubscription = null;

// Ensure pinned profile details are fetched and stored in allProfiles
async function ensureFloatingProfilesLoaded() {
  if (!window._pinnedChatProfileIds || window._pinnedChatProfileIds.length === 0) return;
  
  const missingIds = window._pinnedChatProfileIds.filter(id => {
    return !window.allProfiles || !window.allProfiles.some(p => p.id === id);
  });
  
  if (missingIds.length === 0) return;
  
  try {
    const res = await sbFetch(`/rest/v1/profiles?id=in.(${missingIds.join(',')})&select=*`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        if (!window.allProfiles) window.allProfiles = [];
        data.forEach(p => {
          if (!window.allProfiles.some(x => x.id === p.id)) {
            window.allProfiles.push(p);
          }
        });
      }
    }
  } catch (e) {
    console.error('ensureFloatingProfilesLoaded error:', e);
  }
}

// Constrain coordinates to current viewport limits to prevent off-screen leakage
function constrainPositionToViewport(x, y, w, h) {
  const maxX = window.innerWidth - w;
  const maxY = window.innerHeight - h;
  const finalX = Math.max(0, Math.min(maxX, x));
  const finalY = Math.max(0, Math.min(maxY, y));
  return { x: finalX, y: finalY };
}

// Automatically snap elements to screen borders during viewport resize
window.addEventListener('resize', () => {
  const head = document.getElementById('cjFloatingChatHead');
  if (head) {
    const curX = parseInt(head.style.left);
    const curY = parseInt(head.style.top);
    if (!isNaN(curX) && !isNaN(curY)) {
      const pos = constrainPositionToViewport(curX, curY, 56, 56);
      head.style.left = pos.x + 'px';
      head.style.top = pos.y + 'px';
    }
  }
  
  const win = document.getElementById('cjFloatingChatWindow');
  if (win && win.style.display === 'flex' && window.innerWidth > 600) {
    const curX = parseInt(win.style.left);
    const curY = parseInt(win.style.top);
    if (!isNaN(curX) && !isNaN(curY)) {
      const rect = win.getBoundingClientRect();
      const pos = constrainPositionToViewport(curX, curY, rect.width || 330, rect.height || 420);
      win.style.left = pos.x + 'px';
      win.style.top = pos.y + 'px';
    }
  }
});

// Initialize floating chat head positioning and drag handlers
function initFloatingChat() {
  try {
    const saved = localStorage.getItem('cj_pinned_chat_profile_ids');
    if (saved) {
      window._pinnedChatProfileIds = JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading pinned chats:', e);
    window._pinnedChatProfileIds = [];
  }

  const head = document.getElementById('cjFloatingChatHead');
  if (head) {
    const savedX = localStorage.getItem('cj_floating_chat_pos_x');
    const savedY = localStorage.getItem('cj_floating_chat_pos_y');
    if (savedX !== null && savedY !== null) {
      const pos = constrainPositionToViewport(parseInt(savedX), parseInt(savedY), 56, 56);
      head.style.left = pos.x + 'px';
      head.style.top = pos.y + 'px';
      head.style.right = 'auto';
      head.style.bottom = 'auto';
    } else {
      head.style.right = '20px';
      head.style.bottom = '120px';
      head.style.left = 'auto';
      head.style.top = 'auto';
    }
    makeFloatingHeadDraggable(head);
  }

  const win = document.getElementById('cjFloatingChatWindow');
  if (win) {
    makeFloatingWindowInteractive(win);
  }

  if (window._pinnedChatProfileIds.length > 0) {
    window._activeFloatingProfileId = window._pinnedChatProfileIds[0];
  }

  updateFloatingChatUI();
}

// Bind drag and drop functionality with GPU translation, boundary checks, and click distinction
function makeFloatingHeadDraggable(head) {
  let startX = 0, startY = 0;
  let initialX = 0, initialY = 0;
  let isDragging = false;
  let startTime = 0;

  head.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
    startTime = Date.now();
    
    const rect = head.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    head.style.left = initialX + 'px';
    head.style.top = initialY + 'px';
    head.style.right = 'auto';
    head.style.bottom = 'auto';
    
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    head.style.cursor = 'grabbing';
  });

  head.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    // GPU-accelerated dragging to prevent reflow lag
    head.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      head.dataset.dragged = '1';
    }
  });

  head.addEventListener('pointerup', (e) => {
    if (!isDragging) return;
    head.releasePointerCapture(e.pointerId);
    isDragging = false;
    head.style.cursor = 'grab';
    
    const duration = Date.now() - startTime;
    const isClick = (head.dataset.dragged !== '1') && (duration < 300);
    delete head.dataset.dragged;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    head.style.transform = '';

    let finalX = initialX + dx;
    let finalY = initialY + dy;
    
    const rect = head.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width;
    const maxY = window.innerHeight - rect.height;
    
    if (finalX < 0) finalX = 0;
    if (finalX > maxX) finalX = maxX;
    if (finalY < 0) finalY = 0;
    if (finalY > maxY) finalY = maxY;
    
    head.style.left = finalX + 'px';
    head.style.top = finalY + 'px';

    localStorage.setItem('cj_floating_chat_pos_x', finalX);
    localStorage.setItem('cj_floating_chat_pos_y', finalY);
    
    const win = document.getElementById('cjFloatingChatWindow');
    if (win && win.style.display === 'flex') {
      positionFloatingChatWindow();
    }

    if (isClick) {
      toggleFloatingChatWindow();
    }
  });

  head.addEventListener('pointercancel', (e) => {
    if (isDragging) {
      head.releasePointerCapture(e.pointerId);
      isDragging = false;
      head.style.cursor = 'grab';
      head.style.transform = '';
      delete head.dataset.dragged;
    }
  });
}

// Expand or collapse floating window
function toggleFloatingChatWindow() {
  const win = document.getElementById('cjFloatingChatWindow');
  if (!win) return;
  if (win.style.display === 'none' || win.style.display === '') {
    expandFloatingChat();
  } else {
    collapseFloatingChat();
  }
}

function expandFloatingChat() {
  const win = document.getElementById('cjFloatingChatWindow');
  if (!win) return;
  
  win.style.display = 'flex';
  positionFloatingChatWindow();
  
  if (window._activeFloatingProfileId) {
    selectFloatingChat(window._activeFloatingProfileId);
  } else if (window._pinnedChatProfileIds.length > 0) {
    selectFloatingChat(window._pinnedChatProfileIds[0]);
  }
}

function collapseFloatingChat() {
  const win = document.getElementById('cjFloatingChatWindow');
  if (win) {
    win.style.display = 'none';
    win.style.height = '';
    win.style.width = '';
    win.style.top = '';
    win.style.left = '';
  }
  if (window._floatingActiveChatSubscription) {
    window._floatingActiveChatSubscription.unsubscribe();
    window._floatingActiveChatSubscription = null;
  }
}

// Close active pinned chat (unpin it)
function closeActiveFloatingChat() {
  if (window._activeFloatingProfileId) {
    unpinChatFromFloating(window._activeFloatingProfileId);
  }
}

// Visual Viewport keyboard/dimensions adjustment for mobile platforms
function adjustFloatingLayoutForViewport() {
  const win = document.getElementById('cjFloatingChatWindow');
  if (!win || win.style.display !== 'flex') return;
  
  const isMobile = window.innerWidth <= 600;
  if (isMobile) {
    const vv = window.visualViewport;
    if (vv) {
      win.style.height = vv.height + 'px';
      win.style.top = vv.offsetTop + 'px';
      win.style.left = vv.offsetLeft + 'px';
      win.style.width = vv.width + 'px';
      
      const msgArea = document.getElementById('cjFloatingChatMessages');
      if (msgArea) {
        msgArea.scrollTop = msgArea.scrollHeight;
      }
    }
  } else {
    win.style.height = '';
    win.style.width = '';
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', adjustFloatingLayoutForViewport);
  window.visualViewport.addEventListener('scroll', adjustFloatingLayoutForViewport);
}

// Make the expanded floating window draggable and resizable
function makeFloatingWindowInteractive(win) {
  makeFloatingWindowDraggable(win);
  makeFloatingWindowResizable(win);
}

function makeFloatingWindowDraggable(win) {
  // We drag via .floating-chat-header
  const header = win.querySelector('.floating-chat-header');
  if (!header) return;
  
  let startX = 0, startY = 0;
  let initialX = 0, initialY = 0;
  let isDragging = false;
  
  header.addEventListener('pointerdown', (e) => {
    // Prevent drag trigger if clicking on inputs, select, buttons or avatars list inside the header
    if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input') || e.target.closest('#cjFloatingChatAvatarsRow')) {
      return;
    }
    e.preventDefault();
    header.setPointerCapture(e.pointerId);
    
    const rect = win.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    
    win.style.left = initialX + 'px';
    win.style.top = initialY + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
    
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    header.style.cursor = 'grabbing';
  });
  
  header.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    const rect = win.getBoundingClientRect();
    const targetX = initialX + dx;
    const targetY = initialY + dy;
    const pos = constrainPositionToViewport(targetX, targetY, rect.width || 330, rect.height || 420);
    
    win.style.left = pos.x + 'px';
    win.style.top = pos.y + 'px';
  });
  
  const endDrag = (e) => {
    if (!isDragging) return;
    header.releasePointerCapture(e.pointerId);
    isDragging = false;
    header.style.cursor = 'move';
    
    const rect = win.getBoundingClientRect();
    localStorage.setItem('cj_floating_win_pos_x', Math.round(rect.left));
    localStorage.setItem('cj_floating_win_pos_y', Math.round(rect.top));
  };
  
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', endDrag);
}

function makeFloatingWindowResizable(win) {
  // Clear any existing handles
  win.querySelectorAll('.fl-resize-handle').forEach(h => h.remove());

  // 8-direction handles mapping
  const handles = [
    { type: 'l', cursor: 'w-resize', style: 'left:-4px; top:0; bottom:0; width:8px;' },
    { type: 'r', cursor: 'e-resize', style: 'right:-4px; top:0; bottom:0; width:8px;' },
    { type: 't', cursor: 'n-resize', style: 'top:-4px; left:0; right:0; height:8px;' },
    { type: 'b', cursor: 's-resize', style: 'bottom:-4px; left:0; right:0; height:8px;' },
    { type: 'tl', cursor: 'nw-resize', style: 'left:-6px; top:-6px; width:12px; height:12px;' },
    { type: 'tr', cursor: 'ne-resize', style: 'right:-6px; top:-6px; width:12px; height:12px;' },
    { type: 'bl', cursor: 'sw-resize', style: 'left:-6px; bottom:-6px; width:12px; height:12px;' },
    { type: 'br', cursor: 'se-resize', style: 'right:-6px; bottom:-6px; width:12px; height:12px;' }
  ];

  let startWidth = 0, startHeight = 0;
  let startLeft = 0, startTop = 0;
  let startX = 0, startY = 0;
  let activeHandle = null;

  function onPointerMove(e) {
    if (!activeHandle) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    if (activeHandle.includes('l')) {
      newWidth = startWidth - dx;
      newLeft = startLeft + dx;
      if (newWidth < 280) {
        newLeft = startLeft + (startWidth - 280);
        newWidth = 280;
      }
    } else if (activeHandle.includes('r')) {
      newWidth = startWidth + dx;
      if (newWidth < 280) {
        newWidth = 280;
      }
    }

    if (activeHandle.includes('t')) {
      newHeight = startHeight - dy;
      newTop = startTop + dy;
      if (newHeight < 300) {
        newTop = startTop + (startHeight - 300);
        newHeight = 300;
      }
    } else if (activeHandle.includes('b')) {
      newHeight = startHeight + dy;
      if (newHeight < 300) {
        newHeight = 300;
      }
    }

    win.style.width = newWidth + 'px';
    win.style.height = newHeight + 'px';
    win.style.left = newLeft + 'px';
    win.style.top = newTop + 'px';
  }

  function onPointerUp(e) {
    if (!activeHandle) return;
    activeHandle = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);

    const rect = win.getBoundingClientRect();
    localStorage.setItem('cj_floating_win_width', Math.round(rect.width));
    localStorage.setItem('cj_floating_win_height', Math.round(rect.height));
    localStorage.setItem('cj_floating_win_pos_x', Math.round(rect.left));
    localStorage.setItem('cj_floating_win_pos_y', Math.round(rect.top));
  }

  handles.forEach(h => {
    const handleEl = document.createElement('div');
    handleEl.className = 'fl-resize-handle';
    handleEl.style.cssText = `position:absolute; ${h.style} cursor:${h.cursor}; z-index:100000;`;
    
    handleEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const rect = win.getBoundingClientRect();
      startWidth = rect.width;
      startHeight = rect.height;
      startLeft = rect.left;
      startTop = rect.top;
      
      startX = e.clientX;
      startY = e.clientY;
      activeHandle = h.type;

      win.style.left = startLeft + 'px';
      win.style.top = startTop + 'px';
      win.style.right = 'auto';
      win.style.bottom = 'auto';
      win.style.width = startWidth + 'px';
      win.style.height = startHeight + 'px';

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });

    win.appendChild(handleEl);
  });
}


// Calculate and position the expanded window near the bubble head without overflowing
function positionFloatingChatWindow() {
  const head = document.getElementById('cjFloatingChatHead');
  const win = document.getElementById('cjFloatingChatWindow');
  if (!head || !win) return;
  
  const isMobile = window.innerWidth <= 600;
  if (isMobile) {
    adjustFloatingLayoutForViewport();
    return;
  }
  
  // Restore user defined width & height if available
  const savedW = localStorage.getItem('cj_floating_win_width');
  const savedH = localStorage.getItem('cj_floating_win_height');
  if (savedW) win.style.width = savedW + 'px';
  if (savedH) win.style.height = savedH + 'px';
  
  // Restore user defined coordinates if available
  const savedX = localStorage.getItem('cj_floating_win_pos_x');
  const savedY = localStorage.getItem('cj_floating_win_pos_y');
  if (savedX !== null && savedY !== null) {
    const w = parseInt(savedW) || 330;
    const h = parseInt(savedH) || 420;
    const pos = constrainPositionToViewport(parseInt(savedX), parseInt(savedY), w, h);
    win.style.left = pos.x + 'px';
    win.style.top = pos.y + 'px';
    win.style.right = 'auto';
    win.style.bottom = 'auto';
    return;
  }
  
  // Otherwise, default calculate position near the bubble head
  const headRect = head.getBoundingClientRect();
  const winWidth = parseInt(savedW) || 330;
  const winHeight = parseInt(savedH) || 420;
  
  let left = 0;
  let top = 0;
  
  if (headRect.left + headRect.width / 2 > window.innerWidth / 2) {
    left = headRect.right - winWidth;
  } else {
    left = headRect.left;
  }
  
  if (headRect.top + headRect.height / 2 > window.innerHeight / 2) {
    top = headRect.top - winHeight - 10;
  } else {
    top = headRect.bottom + 10;
  }
  
  const pos = constrainPositionToViewport(left, top, winWidth, winHeight);
  
  win.style.left = pos.x + 'px';
  win.style.top = pos.y + 'px';
  win.style.right = 'auto';
  win.style.bottom = 'auto';
}

// Pin a chat profile to floating stack
function pinChatToFloating(profileId) {
  const pid = profileId || currentProfileId;
  if (!pid) {
    showToast('⚠️ Không tìm thấy học viên để ghim');
    return;
  }
  
  if (!window._pinnedChatProfileIds.includes(pid)) {
    window._pinnedChatProfileIds.push(pid);
    localStorage.setItem('cj_pinned_chat_profile_ids', JSON.stringify(window._pinnedChatProfileIds));
  }
  
  window._activeFloatingProfileId = pid;
  showToast('💬 Đã ghim bong bóng chat');
  updateFloatingChatUI();
}

// Unpin a chat profile from floating stack
function unpinChatFromFloating(profileId) {
  window._pinnedChatProfileIds = window._pinnedChatProfileIds.filter(id => id !== profileId);
  localStorage.setItem('cj_pinned_chat_profile_ids', JSON.stringify(window._pinnedChatProfileIds));
  
  if (window._activeFloatingProfileId === profileId) {
    if (window._pinnedChatProfileIds.length > 0) {
      window._activeFloatingProfileId = window._pinnedChatProfileIds[0];
    } else {
      window._activeFloatingProfileId = null;
    }
  }
  
  updateFloatingChatUI();
  
  if (window._pinnedChatProfileIds.length === 0) {
    collapseFloatingChat();
  } else if (window._activeFloatingProfileId) {
    selectFloatingChat(window._activeFloatingProfileId);
  }
}

// Render floating UI elements using currently available memory cache (synchronous, 0ms latency)
function renderFloatingChatUIElements() {
  const head = document.getElementById('cjFloatingChatHead');
  const win = document.getElementById('cjFloatingChatWindow');
  if (!head) return;

  head.style.display = 'flex';

  // Constrain bubble position to current viewport immediately upon rendering/showing
  const curX = parseInt(head.style.left);
  const curY = parseInt(head.style.top);
  if (!isNaN(curX) && !isNaN(curY)) {
    const pos = constrainPositionToViewport(curX, curY, 56, 56);
    head.style.left = pos.x + 'px';
    head.style.top = pos.y + 'px';
  } else {
    // If not set in absolute position yet, check if there are saved coordinates in localStorage
    const savedX = localStorage.getItem('cj_floating_chat_pos_x');
    const savedY = localStorage.getItem('cj_floating_chat_pos_y');
    if (savedX !== null && savedY !== null) {
      const pos = constrainPositionToViewport(parseInt(savedX), parseInt(savedY), 56, 56);
      head.style.left = pos.x + 'px';
      head.style.top = pos.y + 'px';
      head.style.right = 'auto';
      head.style.bottom = 'auto';
    } else {
      // Default initial layout values if no custom dragging is recorded
      head.style.right = '20px';
      head.style.bottom = '120px';
      head.style.left = 'auto';
      head.style.top = 'auto';
    }
  }
  
  const backHead = document.getElementById('cjFloatingChatHeadBack');
  if (backHead) {
    backHead.style.display = window._pinnedChatProfileIds.length > 1 ? 'block' : 'none';
  }
  
  if (!window._activeFloatingProfileId || !window._pinnedChatProfileIds.includes(window._activeFloatingProfileId)) {
    window._activeFloatingProfileId = window._pinnedChatProfileIds[0];
  }
  
  const activeProfile = window.allProfiles ? window.allProfiles.find(x => x.id === window._activeFloatingProfileId) : null;
  const avatarDiv = document.getElementById('cjFloatingChatHeadAvatar');
  
  if (avatarDiv) {
    if (activeProfile) {
      const displayName = activeProfile.nickname || activeProfile.full_name || 'Học viên';
      const initial = getNameInitial(displayName);
      const avatarHtml = typeof renderAnimatedAvatar === 'function'
        ? renderAnimatedAvatar(initial, activeProfile.avatar_color || '', 'md')
        : `<div style="width:100%;height:100%;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:14px;">${initial}</div>`;
      avatarDiv.innerHTML = avatarHtml;
    } else {
      avatarDiv.innerHTML = '💬';
    }
  }
  
  const badge = document.getElementById('cjFloatingChatHeadBadge');
  if (badge) {
    let hasUnread = false;
    let unreadCount = 0;
    if (window.unreadChatProfileIds) {
      window._pinnedChatProfileIds.forEach(id => {
        if (window.unreadChatProfileIds.has(id)) {
          hasUnread = true;
          unreadCount++;
        }
      });
    }
    if (hasUnread) {
      badge.style.display = 'block';
      badge.textContent = unreadCount > 1 ? unreadCount : 'Mới';
    } else {
      badge.style.display = 'none';
    }
  }
  
  const avatarsRow = document.getElementById('cjFloatingChatAvatarsRow');
  if (avatarsRow && win && win.style.display === 'flex') {
    avatarsRow.innerHTML = '';
    
    window._pinnedChatProfileIds.forEach(id => {
      const p = window.allProfiles ? window.allProfiles.find(x => x.id === id) : null;
      if (!p) return;
      
      const displayName = p.nickname || p.full_name || 'Học viên';
      const initial = getNameInitial(displayName);
      const isActive = id === window._activeFloatingProfileId;
      
      const avatarHtml = typeof renderAnimatedAvatar === 'function'
        ? renderAnimatedAvatar(initial, p.avatar_color || '', 'sm')
        : `<div class="floating-avatar-circle" style="background:var(--accent);">${initial}</div>`;
      
      const hasUnread = window.unreadChatProfileIds && window.unreadChatProfileIds.has(id);
      
      const item = document.createElement('div');
      item.className = 'floating-avatar-item' + (isActive ? ' active' : '');
      item.dataset.profileId = id;
      item.title = displayName;
      item.onclick = () => selectFloatingChat(id);
      
      item.innerHTML = `
        <div class="floating-avatar-wrapper" style="position:relative;">
          ${avatarHtml}
          ${hasUnread ? '<div class="floating-avatar-unread"></div>' : ''}
          <div class="floating-avatar-close" onclick="event.stopPropagation(); unpinChatFromFloating('${id}')">✕</div>
        </div>
      `;
      avatarsRow.appendChild(item);
    });
  }
}

// Update the floating bubble stack and switcher row instantly + load profiles in background
function updateFloatingChatUI() {
  const head = document.getElementById('cjFloatingChatHead');
  const win = document.getElementById('cjFloatingChatWindow');
  if (!head) return;
  
  if (!window._pinnedChatProfileIds || window._pinnedChatProfileIds.length === 0) {
    head.style.display = 'none';
    if (win) win.style.display = 'none';
    collapseFloatingChat();
    return;
  }
  
  // 1. Draw UI instantly using whatever is loaded in window.allProfiles cache (lag-free)
  renderFloatingChatUIElements();
  
  // 2. Fetch missing items in background and redraw only on completion
  ensureFloatingProfilesLoaded().then(() => {
    renderFloatingChatUIElements();
  });
}

// Switch active chat in floating mode
async function selectFloatingChat(profileId) {
  window._activeFloatingProfileId = profileId;
  setupFloatingChatRealtime(profileId);
  await loadFloatingChatMessages(profileId);
  updateFloatingChatUI();
}

// Load message history for floating panel
async function loadFloatingChatMessages(profileId) {
  const msgArea = document.getElementById('cjFloatingChatMessages');
  if (!msgArea) return;

  const searchInput = document.getElementById('cjFloatingChatSearchInput');
  if (searchInput) searchInput.value = '';
  
  msgArea.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text3);font-size:11px;">⌛ Đang tải...</div>';
  
  try {
    await markChatAsRead(profileId);
    
    const res = await sbFetch(`/rest/v1/profile_chats?profile_id=eq.${profileId}&select=*&order=created_at.desc&limit=100`, {
      headers: { 'Cache-Control': 'no-cache' }
    });
    
    const messages = await res.json();
    messages.reverse(); // Đảo ngược để hiển thị từ cũ đến mới (trên xuống dưới)
    msgArea.innerHTML = '';
    
    if (!messages || messages.length === 0) {
      msgArea.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:11px;">Chưa có tin nhắn.</div>';
    } else {
      messages.forEach(msg => {
        addFloatingChatMessageToDOM(msg);
      });
      msgArea.scrollTop = msgArea.scrollHeight;
    }
  } catch (e) {
    console.error('loadFloatingChatMessages error:', e);
    msgArea.innerHTML = '<div style="text-align:center;padding:12px;color:var(--red);font-size:11px;">❌ Lỗi tải tin nhắn.</div>';
  }
}

// Append single message to floating DOM
function addFloatingChatMessageToDOM(msg) {
  const msgArea = document.getElementById('cjFloatingChatMessages');
  if (!msgArea) return;
  if (document.getElementById(`fl_msg_${msg.id}`)) return;
  
  const myCode = getEffectiveStaffCode();
  const isMe = msg.sender_code === myCode;
  
  // Preprocess message details
  const p = preprocessChatMessage(msg);
    
  let timeStr = '';
  try {
    const d = new Date(msg.created_at);
    timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch (e) {}
  
  let bubbleClass = 'chat-message-bubble';
  if (p.isPureMedia) {
    bubbleClass += ' chat-message-bubble--media-only';
  } else {
    if (isMe) bubbleClass += ' chat-message-bubble--me';
    if (msg.category === 'warning') bubbleClass += ' chat-message-bubble--warning';
    if (msg.category === 'strategy') bubbleClass += ' chat-message-bubble--strategy';
    if (msg.category === 'important') bubbleClass += ' chat-message-bubble--important';
  }
  
  const rowClass = isMe ? 'chat-message-row chat-message-row--me' : 'chat-message-row';
  
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
  
  let messageText = '';
  let messageContentHtml = '';

  const isEdited = msg.updated_at && (new Date(msg.updated_at) - new Date(msg.created_at) > 2000);
  const editedHtml = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.6; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>` : '';
  const mediaTimeWithEdited = isEdited ? `<span class="chat-message-edited-tag" style="opacity:0.7; margin-right:4px; font-size:8.5px; font-style:italic;">(đã sửa)</span>${timeStr}` : timeStr;

  if (p.isPureMedia) {
    messageText = formatChatMessageText(p.chatText, mediaTimeWithEdited, isMe, msg.id, true);
    messageContentHtml = `<div class="chat-message-text" style="display:inline-block; line-height:0; vertical-align:middle;">${messageText}</div>`;
  } else {
    messageText = formatChatMessageText(p.chatText);
    const actionsHtml = isMe ? `
      <span class="chat-bubble-actions" id="actions_fl_${msg.id}" style="display:none; gap:6px; font-size:9.5px; user-select:none; margin-right:6px;">
        <span onclick="event.stopPropagation(); deleteChatMessage('${msg.id}')" style="cursor:pointer; opacity:0.85; font-weight:700; color:inherit; text-decoration:underline;">🗑️ Xoá</span>
      </span>
    ` : '';

    const metaHtml = `
      <span class="chat-message-meta-inline" style="display: inline-flex; align-items: center; gap: 4px; font-size: 9px; margin-left: 8px; margin-top: 4px; user-select: none; line-height: 1; vertical-align: bottom; white-space: nowrap; float: none;">
        ${editedHtml}
        ${actionsHtml}
        <span class="chat-message-time-val">${timeStr}</span>
      </span>
    `;

    if (catIcon) {
      messageContentHtml = `
        <div class="chat-message-body-with-icon" style="display: flex; gap: 8px; align-items: flex-start; width: 100%;">
          <div class="chat-message-cat-icon chat-message-cat-icon--${msg.category}">${catIcon}</div>
          <div class="chat-message-text" style="flex: 1; display: inline-flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; min-width: 0; max-width: 100%;">
            <span style="flex: 1; min-width: 0; white-space: pre-wrap; padding-top: 2px;">${messageText}</span>
            ${metaHtml}
          </div>
        </div>
      `;
    } else {
      messageContentHtml = `
        <div class="chat-message-text" style="display: inline-flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 8px; word-break: break-word; overflow-wrap: break-word; max-width: 100%;">
          <span style="flex: 1; min-width: 0; white-space: pre-wrap;">${messageText}</span>
          ${metaHtml}
        </div>
      `;
    }
  }
  
  const avatarHtmlBlock = isMe ? '' : `
    <div class="chat-message-avatar" title="${p.displayName}">
      ${p.avatarHtml}
    </div>
  `;
  
  const onclickBubble = p.isPureMedia ? '' : `onclick="handleBubbleClick(event, 'fl_${msg.id}', ${isMe})"`;
  
  let bubbleInline = 'cursor:pointer; height:auto !important; min-height:0 !important; flex:0 0 auto !important;';
  if (p.isPureMedia) {
    bubbleInline = 'display:block; border-radius:12px; border:none; background:transparent; padding:0; margin:0; box-shadow:none; height:auto !important; min-height:0 !important; flex:0 0 auto !important;';
  }

  const reactionsHtml = typeof renderMessageReactionsHtml === 'function' ? renderMessageReactionsHtml(msg.reactions, msg.id, isMe, true) : '';

  const rowInline = 'height:auto !important; min-height:0 !important; flex:0 0 auto !important; max-height:none !important;';
  const contentInline = 'height:auto !important; min-height:0 !important; flex:1 1 auto !important;';

  const html = `
    <div class="${rowClass}" id="fl_msg_${msg.id}" data-raw-text="${escHtml(p.chatText)}" style="${rowInline}">
      ${avatarHtmlBlock}
      <div class="chat-message-content" style="${contentInline}">
        ${!isMe ? `<div class="chat-message-sender" style="color: ${getChatSenderColor(msg.sender_code)}; font-weight: 700;">${p.displayName}${p.senderCodeHtml}</div>` : ''}
        <div class="${bubbleClass}" ${onclickBubble} style="${bubbleInline}">
          ${categoryPrefix ? `<div style="margin-bottom:5px;">${categoryPrefix}</div>` : ''}
          ${messageContentHtml}
        </div>
        ${reactionsHtml}
      </div>
    </div>
  `;
  
  msgArea.insertAdjacentHTML('beforeend', html);
  msgArea.scrollTop = msgArea.scrollHeight;
}

// Send text message from floating input
async function sendFloatingChatMessage() {
  const input = document.getElementById('cjFloatingChatInput');
  const catSelect = document.getElementById('cjFloatingChatCategory');
  const profileId = window._activeFloatingProfileId;
  
  if (!input || !profileId) return;
  const text = input.value.trim();
  if (!text) return;
  
  const category = catSelect ? catSelect.value : 'general';
  const sender = getEffectiveStaffCode();
  
  input.value = '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  
  try {
    const res = await sbFetch('/rest/v1/profile_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        profile_id: profileId,
        sender_code: sender,
        message: text,
        category: category
      })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data[0]) {
        addFloatingChatMessageToDOM(data[0]);
        await markChatAsRead(profileId);
      }
    } else {
      showToast('❌ Gửi tin nhắn thất bại');
    }
  } catch (e) {
    console.error('sendFloatingChatMessage error:', e);
    showToast('❌ Lỗi kết nối');
  }
}

// Upload file proxy streaming for floating chat
async function uploadFloatingChatFile(input) {
  const file = input.files?.[0];
  const profileId = window._activeFloatingProfileId;
  if (!file || !profileId) return;
  
  input.value = '';
  showToast('⌛ Đang tải tệp lên...');
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.statusText}`);
    }
    
    const data = await res.json();
    if (data && data.url) {
      const sender = getEffectiveStaffCode();
      const catSelect = document.getElementById('cjFloatingChatCategory');
      const category = catSelect ? catSelect.value : 'general';
      
      const dbRes = await sbFetch('/rest/v1/profile_chats', {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify({
          profile_id: profileId,
          sender_code: sender,
          message: data.url,
          category: category
        })
      });
      
      if (dbRes.ok) {
        const newMsgArr = await dbRes.json();
        if (newMsgArr && newMsgArr[0]) {
          addFloatingChatMessageToDOM(newMsgArr[0]);
          await markChatAsRead(profileId);
          showToast('✅ Đã gửi tệp đính kèm');
        }
      }
    } else {
      throw new Error('No URL returned');
    }
  } catch (e) {
    showToast('❌ Gửi tệp thất bại');
    console.error('uploadFloatingChatFile error:', e);
  }
}

// Setup floating active chat realtime channel
function setupFloatingChatRealtime(profileId) {
  if (typeof window.supabase === 'undefined') return;
  
  if (window._floatingActiveChatSubscription) {
    window._floatingActiveChatSubscription.unsubscribe();
    window._floatingActiveChatSubscription = null;
  }
  
  if (!_supabaseRealtimeClient) {
    _supabaseRealtimeClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  
  window._floatingActiveChatSubscription = _supabaseRealtimeClient
    .channel(`floating-chat-realtime:${profileId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'profile_chats',
      filter: `profile_id=eq.${profileId}`
    }, (payload) => {
      if (payload.eventType === 'INSERT') {
        const msg = payload.new;
        addFloatingChatMessageToDOM(msg);
        if (msg.sender_code !== getEffectiveStaffCode()) {
          markChatAsRead(profileId);
        }
      }
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`Floating active realtime subscribed for profile:${profileId}`);
      }
    });
}

// Client-side instant chat messages search filtering (0ms latency)
function searchChatMessages(keyword, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  
  const kw = keyword.toLowerCase().trim();
  const rows = container.querySelectorAll('.chat-message-row');
  
  rows.forEach(row => {
    const textEl = row.querySelector('.chat-message-text');
    const text = textEl ? textEl.textContent.toLowerCase() : '';
    const rawText = row.getAttribute('data-raw-text') ? row.getAttribute('data-raw-text').toLowerCase() : '';
    
    if (!kw || text.includes(kw) || rawText.includes(kw)) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });
}

// ==========================================================================
// CUSTOM VOICE/AUDIO PLAYER CONTROLLERS (TELEGRAM / ZALO UX)
// ==========================================================================

const VOICE_PLAY_SVG = `<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor" style="margin-left: 2px;"><path d="M1.5 12.3V1.7c0-.9 1-1.4 1.8-.9l8 5.3c.7.4.7 1.4 0 1.9l-8 5.3c-.8.5-1.8 0-1.8-.9z"/></svg>`;
const VOICE_PAUSE_SVG = `<svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor"><path d="M1 0h2c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H1c-.6 0-1-.4-1-1V1c0-.6.4-1 1-1zm6 0h2c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H7c-.6 0-1-.4-1-1V1c0-.6.4-1 1-1z"/></svg>`;

// Toggle Play/Pause for a Custom Voice Player
function toggleVoicePlayerPlay(safeId) {
  const audio = document.getElementById(`audio_${safeId}`);
  const btn = document.getElementById(`play_btn_${safeId}`);
  if (!audio || !btn) return;

  // Pause all other audio players to prevent multiple audio overlaps
  document.querySelectorAll('audio').forEach(el => {
    if (el.id !== `audio_${safeId}` && !el.paused) {
      el.pause();
      const otherSafeId = el.id.replace('audio_', '');
      const otherBtn = document.getElementById(`play_btn_${otherSafeId}`);
      if (otherBtn) otherBtn.innerHTML = VOICE_PLAY_SVG;
    }
  });

  if (audio.paused) {
    audio.play().then(() => {
      btn.innerHTML = VOICE_PAUSE_SVG;
    }).catch(err => {
      console.error('Play failed:', err);
    });
  } else {
    audio.pause();
    btn.innerHTML = VOICE_PLAY_SVG;
  }
}

// Seek/Tua inside a Custom Voice Player by clicking the waves
function seekVoicePlayerByWaves(event, safeId) {
  const wavesContainer = document.getElementById(`waves_${safeId}`);
  const audio = document.getElementById(`audio_${safeId}`);
  if (!wavesContainer || !audio || !audio.duration) return;

  const rect = wavesContainer.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const width = rect.width;
  const pct = Math.max(0, Math.min(1, clickX / width));
  
  audio.currentTime = pct * audio.duration;
}

// Toggle Playback Rate Speed multiplier (1x -> 1.5x -> 2x -> 1x)
function toggleVoicePlayerSpeed(safeId) {
  const audio = document.getElementById(`audio_${safeId}`);
  const btn = document.getElementById(`speed_${safeId}`);
  if (!audio || !btn) return;

  let currentRate = audio.playbackRate;
  let newRate = 1.0;

  if (currentRate === 1.0) {
    newRate = 1.5;
  } else if (currentRate === 1.5) {
    newRate = 2.0;
  } else {
    newRate = 1.0;
  }

  audio.playbackRate = newRate;
  btn.textContent = `${newRate}x`;
  
  // Highlight speed button with accent border if speed is elevated
  if (newRate !== 1.0) {
    btn.style.fontWeight = 'bold';
    btn.style.borderColor = 'var(--accent)';
  } else {
    btn.style.fontWeight = 'normal';
    btn.style.borderColor = 'var(--border)';
  }
}

// Initialize event listeners on dynamically inserted Custom Audio Player DOM
function initCustomAudioPlayer(safeId) {
  const audio = document.getElementById(`audio_${safeId}`);
  const wavesContainer = document.getElementById(`waves_${safeId}`);
  const timeEl = document.getElementById(`time_${safeId}`);
  const durEl = document.getElementById(`dur_${safeId}`);
  const btn = document.getElementById(`play_btn_${safeId}`);
  
  if (!audio || !wavesContainer || !timeEl || !durEl) return;

  // 1. Generate Waveform static bars
  const barCount = 28;
  const presetHeights = [6, 8, 12, 16, 10, 6, 8, 14, 18, 22, 16, 12, 10, 14, 20, 18, 14, 10, 8, 12, 16, 14, 10, 6, 8, 12, 10, 8];
  
  wavesContainer.innerHTML = '';
  for (let i = 0; i < barCount; i++) {
    const height = presetHeights[i % presetHeights.length];
    const bar = document.createElement('span');
    bar.className = 'voice-player-wave-bar';
    bar.style.height = `${height}px`;
    wavesContainer.appendChild(bar);
  }

  const durAttr = audio.getAttribute('data-duration');
  const parsedDuration = durAttr ? parseInt(durAttr) : null;

  function formatTime(secs) {
    if (isNaN(secs) || secs === Infinity) {
      return parsedDuration ? formatTime(parsedDuration) : '0:00';
    }
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  // Display duration when metadata is fully loaded
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && audio.duration !== Infinity) {
      durEl.textContent = formatTime(audio.duration);
    } else if (parsedDuration) {
      durEl.textContent = formatTime(parsedDuration);
    }
  });

  // Display immediately if duration is already cached by browser or passed by attribute
  if (audio.duration && audio.duration !== Infinity) {
    durEl.textContent = formatTime(audio.duration);
  } else if (parsedDuration) {
    durEl.textContent = formatTime(parsedDuration);
  }

  // Fallback if metadata load is slow, check periodically
  const durCheck = setInterval(() => {
    if (audio.duration && audio.duration !== Infinity) {
      durEl.textContent = formatTime(audio.duration);
      clearInterval(durCheck);
    }
  }, 300);
  setTimeout(() => clearInterval(durCheck), 5000); // safety timeout

  // Update time and waveform active coloring during playback
  audio.addEventListener('timeupdate', () => {
    const activeDuration = (audio.duration && audio.duration !== Infinity) ? audio.duration : parsedDuration;
    if (activeDuration) {
      const pct = audio.currentTime / activeDuration;
      const activeCount = Math.floor(pct * barCount);
      
      const bars = wavesContainer.querySelectorAll('.voice-player-wave-bar');
      bars.forEach((bar, idx) => {
        if (idx < activeCount) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });
    }
    timeEl.textContent = formatTime(audio.currentTime);
  });

  // Handle audio end
  audio.addEventListener('ended', () => {
    const bars = wavesContainer.querySelectorAll('.voice-player-wave-bar');
    bars.forEach(bar => bar.classList.remove('active'));
    timeEl.textContent = '0:00';
    if (btn) btn.innerHTML = VOICE_PLAY_SVG;
  });

  // Handle errors gracefully
  audio.addEventListener('error', () => {
    durEl.textContent = 'Lỗi';
  });
}

// ==========================================================================
// VOICE RECORDER MODULE USING MEDIARECORDER API (ZERO SUPABASE STORAGE INLINE)
// ==========================================================================

let _mediaRecorder = null;
let _audioChunks = [];
let _recordingTimer = null;
let _recordingSeconds = 0;
let _recordingStream = null;

// Toggles Voice Recording UI and state
async function toggleVoiceRecording() {
  const row = document.getElementById('chatVoiceRecordRow');
  const inputRow = document.getElementById('chatInputRow');
  if (!row || !inputRow) return;

  if (row.style.display === 'none') {
    await startVoiceRecording();
  } else {
    await stopAndSendVoiceRecording();
  }
}

// Start capturing mic and record audio
async function startVoiceRecording() {
  const row = document.getElementById('chatVoiceRecordRow');
  const inputRow = document.getElementById('chatInputRow');
  const timerEl = document.getElementById('chatVoiceTimer');
  const statusEl = document.getElementById('chatVoiceStatus');
  
  if (!row || !inputRow || !timerEl || !currentProfileId) {
    showToast('⚠️ Vui lòng chọn học viên trước');
    return;
  }

  try {
    // Request microphone access from user
    _recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Choose optimized compressed format (WebM/Opus or fallbacks)
    let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm', audioBitsPerSecond: 24000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 24000 };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          // Fallback to default browser capability
          options = {};
        }
      }
    }

    _audioChunks = [];
    _mediaRecorder = new MediaRecorder(_recordingStream, options);
    
    _mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        _audioChunks.push(event.data);
      }
    };

    _mediaRecorder.onstop = () => {
      if (_recordingStream) {
        _recordingStream.getTracks().forEach(t => t.stop());
        _recordingStream = null;
      }
    };

    // Slice recorder chunks every 400ms for safety
    _mediaRecorder.start(400);

    // Switch UI display to recording state
    inputRow.style.display = 'none';
    row.style.display = 'flex';
    
    if (typeof haptic === 'function') haptic('medium');

    // Run recording timer
    _recordingSeconds = 0;
    timerEl.textContent = '00:00';
    if (statusEl) statusEl.textContent = 'Đang ghi âm...';
    
    clearInterval(_recordingTimer);
    _recordingTimer = setInterval(() => {
      _recordingSeconds++;
      const m = Math.floor(_recordingSeconds / 60);
      const s = _recordingSeconds % 60;
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      
      // Auto-stop at 2 minutes (120 seconds) to guarantee small files (<300KB)
      if (_recordingSeconds >= 120) {
        showToast('⚠️ Đạt giới hạn 2 phút ghi âm');
        stopAndSendVoiceRecording();
      }
    }, 1000);

  } catch (err) {
    console.error('Failed to start voice recording:', err);
    showToast('❌ Không thể truy cập micro của bạn');
  }
}

// Discards current recording
function cancelVoiceRecording() {
  const row = document.getElementById('chatVoiceRecordRow');
  const inputRow = document.getElementById('chatInputRow');
  
  clearInterval(_recordingTimer);
  
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
  }
  
  if (_recordingStream) {
    _recordingStream.getTracks().forEach(t => t.stop());
    _recordingStream = null;
  }

  // Restore main UI
  if (row) row.style.display = 'none';
  if (inputRow) inputRow.style.display = 'flex';
  
  _audioChunks = [];
  showToast('🗑️ Đã huỷ bản ghi âm');
}

// Stops and submits recorded voice file
async function stopAndSendVoiceRecording() {
  const row = document.getElementById('chatVoiceRecordRow');
  const inputRow = document.getElementById('chatInputRow');
  const timerEl = document.getElementById('chatVoiceTimer');
  const statusEl = document.getElementById('chatVoiceStatus');
  
  clearInterval(_recordingTimer);
  
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') {
    if (row) row.style.display = 'none';
    if (inputRow) inputRow.style.display = 'flex';
    return;
  }

  if (statusEl) statusEl.textContent = '⌛ Đang nén âm thanh...';

  // Wait for mediarecorder to finish stop sequences
  const recorderStopped = new Promise((resolve) => {
    _mediaRecorder.onstop = () => {
      if (_recordingStream) {
        _recordingStream.getTracks().forEach(t => t.stop());
        _recordingStream = null;
      }
      resolve();
    };
  });

  _mediaRecorder.stop();
  await recorderStopped;

  if (_audioChunks.length === 0) {
    showToast('❌ Ghi âm thất bại, thử lại');
    if (row) row.style.display = 'none';
    if (inputRow) inputRow.style.display = 'flex';
    return;
  }

  // Assemble blob
  const mimeType = _mediaRecorder.mimeType || 'audio/webm';
  const audioBlob = new Blob(_audioChunks, { type: mimeType });
  
  // Decide extension matching mimetype
  let ext = 'webm';
  if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('mp4') || mimeType.includes('aac')) ext = 'mp4';
  else if (mimeType.includes('mpeg')) ext = 'mp3';
  else if (mimeType.includes('wav')) ext = 'wav';

  const fileName = `voice_note_${currentProfileId}_${Date.now()}.${ext}`;
  const audioFile = new File([audioBlob], fileName, { type: mimeType });

  // Reset UI early for visual snappy response
  if (row) row.style.display = 'none';
  if (inputRow) inputRow.style.display = 'flex';

  showToast('⌛ Đang tải lên tin nhắn thoại...');

  try {
    const formData = new FormData();
    formData.append('file', audioFile);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Upload voice failed: ${res.statusText}`);
    }

    const data = await res.json();
    if (data && data.url) {
      let finalUrl = data.url;
      // Append duration query parameter for seamless timeline render on client-side
      const recordingSecs = typeof _recordingSeconds !== 'undefined' ? _recordingSeconds : 0;
      if (finalUrl.includes('?')) {
        finalUrl += `&dur=${recordingSecs}`;
      } else {
        finalUrl += `?dur=${recordingSecs}`;
      }
      
      const mediaMetadata = {
        type: 'voice',
        file_path: data.file_path,
        name: fileName,
        duration: recordingSecs
      };
      
      // Send the secure bot proxy url directly as message content
      await sendProxyImageMessage(finalUrl, mediaMetadata);
      showToast('✅ Đã gửi tin nhắn thoại');
    } else {
      throw new Error('No URL returned from bot server');
    }
  } finally {
    _audioChunks = [];
  }
}

// ==========================================================================
// FLOATING CHAT VOICE RECORDER MODULE
// ==========================================================================

let _floatingRecordingTimer = null;
let _floatingRecordingSeconds = 0;

// Toggles Voice Recording UI and state in the Floating Chat
async function toggleFloatingVoiceRecording() {
  const row = document.getElementById('cjFloatingChatVoiceRecordRow');
  const inputRow = document.getElementById('cjFloatingChatInputRow');
  if (!row || !inputRow) return;

  if (row.style.display === 'none') {
    await startFloatingVoiceRecording();
  } else {
    await stopAndSendFloatingVoiceRecording();
  }
}

// Start capturing mic and record audio in the Floating Chat
async function startFloatingVoiceRecording() {
  const row = document.getElementById('cjFloatingChatVoiceRecordRow');
  const inputRow = document.getElementById('cjFloatingChatInputRow');
  const timerEl = document.getElementById('cjFloatingChatVoiceTimer');
  const profileId = window._activeFloatingProfileId;

  if (!row || !inputRow || !timerEl || !profileId) {
    showToast('⚠️ Vui lòng mở hội thoại nổi trước');
    return;
  }

  try {
    _recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    let options = { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 24000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/webm', audioBitsPerSecond: 24000 };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/ogg;codecs=opus', audioBitsPerSecond: 24000 };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = {};
        }
      }
    }

    _audioChunks = [];
    _mediaRecorder = new MediaRecorder(_recordingStream, options);
    
    _mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        _audioChunks.push(event.data);
      }
    };

    _mediaRecorder.onstop = () => {
      if (_recordingStream) {
        _recordingStream.getTracks().forEach(t => t.stop());
        _recordingStream = null;
      }
    };

    _mediaRecorder.start(400);

    inputRow.style.display = 'none';
    row.style.display = 'flex';
    
    if (typeof haptic === 'function') haptic('medium');

    _floatingRecordingSeconds = 0;
    timerEl.textContent = '00:00';
    
    clearInterval(_floatingRecordingTimer);
    _floatingRecordingTimer = setInterval(() => {
      _floatingRecordingSeconds++;
      const m = Math.floor(_floatingRecordingSeconds / 60);
      const s = _floatingRecordingSeconds % 60;
      timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      
      if (_floatingRecordingSeconds >= 120) {
        showToast('⚠️ Đạt giới hạn 2 phút ghi âm');
        stopAndSendFloatingVoiceRecording();
      }
    }, 1000);

  } catch (err) {
    console.error('Failed to start floating voice recording:', err);
    showToast('❌ Không thể truy cập micro của bạn');
  }
}

// Discards current floating recording
function cancelFloatingVoiceRecording() {
  const row = document.getElementById('cjFloatingChatVoiceRecordRow');
  const inputRow = document.getElementById('cjFloatingChatInputRow');
  
  clearInterval(_floatingRecordingTimer);
  
  if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
    _mediaRecorder.stop();
  }
  
  if (_recordingStream) {
    _recordingStream.getTracks().forEach(t => t.stop());
    _recordingStream = null;
  }

  if (row) row.style.display = 'none';
  if (inputRow) inputRow.style.display = 'flex';
  
  _audioChunks = [];
  showToast('🗑️ Đã huỷ bản ghi âm');
}

// Stops and submits recorded voice file for Floating Chat
async function stopAndSendFloatingVoiceRecording() {
  const row = document.getElementById('cjFloatingChatVoiceRecordRow');
  const inputRow = document.getElementById('cjFloatingChatInputRow');
  const profileId = window._activeFloatingProfileId;
  
  clearInterval(_floatingRecordingTimer);
  
  if (!_mediaRecorder || _mediaRecorder.state === 'inactive') {
    if (row) row.style.display = 'none';
    if (inputRow) inputRow.style.display = 'flex';
    return;
  }

  const recorderStopped = new Promise((resolve) => {
    _mediaRecorder.onstop = () => {
      if (_recordingStream) {
        _recordingStream.getTracks().forEach(t => t.stop());
        _recordingStream = null;
      }
      resolve();
    };
  });

  _mediaRecorder.stop();
  await recorderStopped;

  if (_audioChunks.length === 0) {
    showToast('❌ Ghi âm thất bại, thử lại');
    if (row) row.style.display = 'none';
    if (inputRow) inputRow.style.display = 'flex';
    return;
  }

  const mimeType = _mediaRecorder.mimeType || 'audio/webm';
  const audioBlob = new Blob(_audioChunks, { type: mimeType });
  
  let ext = 'webm';
  if (mimeType.includes('ogg')) ext = 'ogg';
  else if (mimeType.includes('mp4') || mimeType.includes('aac')) ext = 'mp4';
  else if (mimeType.includes('mpeg')) ext = 'mp3';
  else if (mimeType.includes('wav')) ext = 'wav';

  const fileName = `voice_note_${profileId}_${Date.now()}.${ext}`;
  const audioFile = new File([audioBlob], fileName, { type: mimeType });

  if (row) row.style.display = 'none';
  if (inputRow) inputRow.style.display = 'flex';

  showToast('⌛ Đang tải lên tin nhắn thoại...');

  try {
    const formData = new FormData();
    formData.append('file', audioFile);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      throw new Error(`Upload voice failed: ${res.statusText}`);
    }

    const data = await res.json();
    if (data && data.url) {
      let finalUrl = data.url;
      // Append duration query parameter for seamless timeline render on client-side
      const recordingSecs = typeof _floatingRecordingSeconds !== 'undefined' ? _floatingRecordingSeconds : 0;
      if (finalUrl.includes('?')) {
        finalUrl += `&dur=${recordingSecs}`;
      } else {
        finalUrl += `?dur=${recordingSecs}`;
      }
      // Send the secure bot proxy url directly as message content to floating chat
      await sendFloatingProxyImageMessage(finalUrl);
      showToast('✅ Đã gửi tin nhắn thoại');
    } else {
      throw new Error('No URL returned from bot server');
    }
  } catch (e) {
    showToast('❌ Gửi tin nhắn thoại thất bại');
    console.error('stopAndSendFloatingVoiceRecording error:', e);
  } finally {
    _audioChunks = [];
  }
}

// Post a proxy file URL to floating chat
async function sendFloatingProxyImageMessage(imageUrl) {
  const profileId = window._activeFloatingProfileId;
  const sender = getEffectiveStaffCode();
  const catSelect = document.getElementById('cjFloatingChatCategory');
  const category = catSelect ? catSelect.value : 'general';
  
  try {
    const res = await sbFetch('/rest/v1/profile_chats', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        profile_id: profileId,
        sender_code: sender,
        message: imageUrl,
        category: category
      })
    });
    
    if (res.ok) {
      const newMsgArr = await res.json();
      if (newMsgArr && newMsgArr[0]) {
        addFloatingChatMessageToDOM(newMsgArr[0]);
        await markChatAsRead(profileId);
      }
    }
  } catch(e) {
    showToast('❌ Lỗi gửi tin nhắn');
    console.error('sendFloatingProxyImageMessage:', e);
  }
}

// ============================================================
// REALTIME PERFORMANCE OPTIMIZATION (Page Visibility API)
// ============================================================
function pauseAllChatRealtime() {
  console.log('[Realtime] Pausing all realtime subscriptions due to page hidden');
  
  if (typeof _profileChatSubscription !== 'undefined' && _profileChatSubscription) {
    _profileChatSubscription.unsubscribe();
    _profileChatSubscription = null;
  }
  
  if (window._floatingActiveChatSubscription) {
    window._floatingActiveChatSubscription.unsubscribe();
    window._floatingActiveChatSubscription = null;
  }
  
  if (typeof _globalChatSubscription !== 'undefined' && _globalChatSubscription) {
    _globalChatSubscription.unsubscribe();
    _globalChatSubscription = null;
  }
}

async function resumeAllChatRealtime() {
  console.log('[Realtime] Resuming all realtime subscriptions due to page visible');
  
  // 1. Re-subscribe global channel
  if (typeof setupGlobalChatRealtime === 'function') {
    setupGlobalChatRealtime();
  }
  
  // 2. Re-subscribe active chat detail channel if detailView is open on chat tab
  const detailView = document.getElementById('detailView');
  const isDetailOpen = detailView && detailView.style.display !== 'none';
  const chatTabActive = document.querySelector('#profileTabs .form-tab.active')?.getAttribute('onclick')?.includes('chatTab');
  
  if (isDetailOpen && chatTabActive && currentProfileId) {
    if (typeof setupSupabaseRealtimeForChat === 'function') {
      setupSupabaseRealtimeForChat(currentProfileId);
    }
  }
  
  // 3. Re-subscribe floating active chat detail if it is open
  const floatingChat = document.getElementById('floatingChatModal');
  const isFloatingOpen = floatingChat && floatingChat.classList.contains('open');
  const activeFloatingProfileId = window._activeFloatingProfileId;
  if (isFloatingOpen && activeFloatingProfileId) {
    if (typeof setupFloatingChatRealtime === 'function') {
      setupFloatingChatRealtime(activeFloatingProfileId);
    }
  }
  
  // 4. Force reload unread chats status to catch up with anything missed
  if (typeof loadUnreadChats === 'function') {
    await loadUnreadChats();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    pauseAllChatRealtime();
  } else {
    resumeAllChatRealtime();
  }
});

// ============================================================
// FULLSCREEN VIDEO EXIT HANDLER (Fixes frozen floating bubble chat UI after video fullscreen)
// ============================================================
function handleFullscreenExit() {
  const isFullscreen = document.fullscreenElement || 
                       document.webkitFullscreenElement || 
                       document.mozFullScreenElement || 
                       document.msFullscreenElement;
  
  if (!isFullscreen) {
    console.log('[Fullscreen] Exit fullscreen detected, forcing UI and scroll recovery');
    
    // 1. Force restore normal overflow to body and HTML elements
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // 2. Unlock pointer events on the floating bubble chat elements
    const head = document.getElementById('cjFloatingChatHead');
    const win = document.getElementById('cjFloatingChatWindow');
    if (head) {
      head.style.pointerEvents = 'auto';
      head.style.cursor = 'grab';
    }
    if (win) {
      win.style.pointerEvents = 'auto';
    }
    
    // 3. Guarantee scroll containers inside chat are scrollable
    const floatMsgs = document.getElementById('cjFloatingChatMessages');
    if (floatMsgs) {
      floatMsgs.style.overflowY = 'auto';
      floatMsgs.style.webkitOverflowScrolling = 'touch';
    }
    const mainMsgs = document.getElementById('profileChatMessages');
    if (mainMsgs) {
      mainMsgs.style.overflowY = 'auto';
      mainMsgs.style.webkitOverflowScrolling = 'touch';
    }
  }
}

// Bind to all standard and vendor prefixed fullscreen events
document.addEventListener('fullscreenchange', handleFullscreenExit);
document.addEventListener('webkitfullscreenchange', handleFullscreenExit);
document.addEventListener('mozfullscreenchange', handleFullscreenExit);
document.addEventListener('MSFullscreenChange', handleFullscreenExit);

// ============ GLOBAL CLIPBOARD IMAGES PASTE UPLOAD HANDLER ============
document.addEventListener('paste', async (event) => {
  let file = null;

  // Try files first
  const files = event.clipboardData?.files || event.originalEvent?.clipboardData?.files;
  if (files && files.length > 0) {
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        file = f;
        break;
      }
    }
  }

  // Fallback to items
  if (!file) {
    const items = (event.clipboardData || event.originalEvent?.clipboardData)?.items;
    if (items) {
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          file = item.getAsFile();
          break;
        }
      }
    }
  }

  if (!file) return; // No image in clipboard

  const activeEl = document.activeElement;

  // DIRECT CHAT INPUT FOCUS DETECTION (100% RELIABLE)
  if (activeEl && activeEl.id === 'profileChatInput') {
    event.preventDefault();
    if (currentProfileId) {
      await uploadChatClipboardImageDirectly(file, currentProfileId, 'profileChatInput', 'chat_category', false);
    }
    return;
  }
  if (activeEl && activeEl.id === 'cjFloatingChatInput') {
    event.preventDefault();
    const profileId = window._activeFloatingProfileId;
    if (profileId) {
      await uploadChatClipboardImageDirectly(file, profileId, 'cjFloatingChatInput', 'cjFloatingChatCategory', true);
    }
    return;
  }
  
  // 1. If Record Modal is open
  const recordModal = document.getElementById('addRecordModal');
  const isRecordModalOpen = recordModal && recordModal.classList.contains('open');
  if (isRecordModalOpen) {
    event.preventDefault();
    await uploadRecordClipboardImageDirectly(file);
    return;
  }

  // 2. If Floating Chat Window is open and active
  const floatingWin = document.getElementById('cjFloatingChatWindow');
  if (floatingWin && floatingWin.style.display === 'flex') {
    event.preventDefault();
    const profileId = window._activeFloatingProfileId;
    if (profileId) {
      await uploadChatClipboardImageDirectly(file, profileId, 'cjFloatingChatInput', 'cjFloatingChatCategory', true);
    }
    return;
  }

  // 3. If Profile Detail View is open
  if (document.body.classList.contains('detail-view-open')) {
    // Check if a Note is focused
    if (activeEl && activeEl.classList.contains('board-note-content')) {
      event.preventDefault();
      const noteId = activeEl.id.replace('noteContent-', '');
      if (noteId) {
        await uploadNoteClipboardImageDirectly(file, noteId, activeEl);
      }
      return;
    }

    // Check if the Chat tab is active
    const chatTab = document.getElementById('chatTab');
    if (chatTab && chatTab.classList.contains('active')) {
      event.preventDefault();
      if (currentProfileId) {
        await uploadChatClipboardImageDirectly(file, currentProfileId, 'profileChatInput', 'chat_category', false);
      }
      return;
    }
  }

  // 4. General Note editor focused (e.g. on Notes board tab)
  if (activeEl && activeEl.classList.contains('board-note-content')) {
    event.preventDefault();
    const noteId = activeEl.id.replace('noteContent-', '');
    if (noteId) {
      await uploadNoteClipboardImageDirectly(file, noteId, activeEl);
    }
    return;
  }
});

// Helper for pasting inside main chat and floating chat
async function uploadChatClipboardImageDirectly(file, profileId, inputId, catSelectId, isFloating = false) {
  showToast('⏳ Đang tải ảnh từ clipboard...');
  try {
    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

    const data = await res.json();
    if (data && data.url) {
      if (isFloating) {
        const sender = getEffectiveStaffCode();
        const catSelect = document.getElementById(catSelectId);
        const category = catSelect ? catSelect.value : 'general';

        const dbRes = await sbFetch('/rest/v1/profile_chats', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify({
            profile_id: profileId,
            sender_code: sender,
            message: data.url,
            category: category
          })
        });

        if (dbRes.ok) {
          const newMsgArr = await dbRes.json();
          if (newMsgArr && newMsgArr[0]) {
            if (typeof addFloatingChatMessageToDOM === 'function') addFloatingChatMessageToDOM(newMsgArr[0]);
            await markChatAsRead(profileId);
            showToast('✅ Đã gửi ảnh từ clipboard');
          }
        }
      } else {
        // Stage in our temp preview box
        showTempMediaPreview(data.url, file.name || 'clipboard_image.png');
        showToast('✅ Đã tải ảnh clipboard lên bộ nhớ tạm chat');
      }
    }
  } catch (e) {
    showToast('❌ Gửi ảnh clipboard thất bại');
    console.error('uploadChatClipboardImageDirectly error:', e);
  }
}

// Helper for pasting inside the Report (Record) Modal (with instant local preview!)
async function uploadRecordClipboardImageDirectly(file) {
  if (file.size > 3 * 1024 * 1024) {
    showToast('⚠️ Vui lòng chọn ảnh nhỏ hơn 3MB!');
    return;
  }

  // Instant local preview for immediate visual feedback
  let localUrl = '';
  try {
    localUrl = URL.createObjectURL(file);
    const preview = document.getElementById('rm_image_preview');
    if (preview) preview.src = localUrl;
    const container = document.getElementById('rm_image_preview_container');
    if (container) {
      container.style.display = 'block';
      container.style.opacity = '0.6'; // show uploading state
    }
  } catch (e) {
    console.warn('Failed to create local Object URL:', e);
  }

  showToast('⏳ Đang tải ảnh từ clipboard lên...');
  try {
    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot?document=true`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

    const data = await res.json();
    if (data && data.url) {
      const urlEl = document.getElementById('rm_image_url');
      if (urlEl) urlEl.value = data.url;
      const preview = document.getElementById('rm_image_preview');
      if (preview) preview.src = data.url;
      const container = document.getElementById('rm_image_preview_container');
      if (container) {
        container.style.display = 'block';
        container.style.opacity = '1';
      }
      showToast('✅ Đã dán và tải ảnh thành công!');
    }
  } catch (e) {
    showToast('❌ Tải ảnh clipboard thất bại');
    console.error('uploadRecordClipboardImageDirectly error:', e);
    const container = document.getElementById('rm_image_preview_container');
    if (container) container.style.display = 'none';
  } finally {
    if (localUrl) {
      try { URL.revokeObjectURL(localUrl); } catch (e) {}
    }
  }
}

// Helper for pasting inside Notes (Ghi chú)
async function uploadNoteClipboardImageDirectly(file, noteId, triggerEl) {
  if (file.size > 3 * 1024 * 1024) {
    showToast('⚠️ Vui lòng chọn ảnh nhỏ hơn 3MB!');
    return;
  }

  showToast('⏳ Đang tải ảnh từ clipboard...');
  try {
    const formData = new FormData();
    formData.append('file', file);

    const uploadUrl = `${SUPABASE_URL}/functions/v1/telegram-bot`;
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);

    const data = await res.json();
    if (data && data.url) {
      if (typeof insertMediaUrl === 'function') {
        insertMediaUrl(noteId, data.url, triggerEl);
        showToast('✅ Đã dán ảnh thành công!');
      }
    }
  } catch (e) {
    showToast('❌ Dán ảnh thất bại, đang dùng chế độ dự phòng...');
    console.error('uploadNoteClipboardImageDirectly error:', e);

    // Fallback to base64 DataURL
    const reader = new FileReader();
    reader.onload = function(ev) {
      if (typeof insertMediaUrl === 'function') {
        insertMediaUrl(noteId, ev.target.result, triggerEl);
      }
    };
    reader.readAsDataURL(file);
  }
}

// Auto-resizing textarea & chat input key handlers
function handleChatInputKeyDown(event, isFloating) {
  if (event.key === 'Enter') {
    if (!event.shiftKey) {
      event.preventDefault();
      if (isFloating) {
        sendFloatingChatMessage();
      } else {
        sendProfileChatMessage();
      }
    }
  } else if (event.key === 'Escape' && !isFloating) {
    cancelEditChatMessage();
  }
}

function initAutoResizeTextarea(textareaId, defaultHeightStr) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  
  if (textarea._autoResizeInitialized) return;
  textarea._autoResizeInitialized = true;

  const adjustHeight = () => {
    textarea.style.height = defaultHeightStr;
    const newHeight = Math.min(textarea.scrollHeight, 150);
    textarea.style.height = newHeight + 'px';
  };

  textarea.addEventListener('input', adjustHeight);
  textarea.addEventListener('change', adjustHeight);
  
  textarea.resetHeight = () => {
    textarea.style.height = defaultHeightStr;
  };
  
  adjustHeight();
}

function adjustAllTextareaHeights() {
  document.querySelectorAll('.auto-resize-textarea').forEach(textarea => {
    textarea.style.height = '38px';
    const newHeight = textarea.scrollHeight;
    if (newHeight > 38) {
      textarea.style.height = newHeight + 'px';
    }
  });
}

// Auto-initialize chat inputs
document.addEventListener('DOMContentLoaded', () => {
  initAutoResizeTextarea('profileChatInput', '36px');
  initAutoResizeTextarea('cjFloatingChatInput', '32px');
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(() => {
    initAutoResizeTextarea('profileChatInput', '36px');
    initAutoResizeTextarea('cjFloatingChatInput', '32px');
  }, 100);
}

// ============ REACTION SYSTEM FOR CHAT BUBBLES ============

// Unified click handler for chat bubble
function handleBubbleClick(event, idStr, isMe) {
  event.stopPropagation();
  
  // Extract clean msgId (without fl_ prefix)
  const isFloating = idStr.startsWith('fl_');
  const msgId = isFloating ? idStr.substring(3) : idStr;
  
  // Show quick reaction picker
  showQuickReactionPicker(event, msgId, isMe, isFloating);
  
  // Toggle standard actions if isMe
  if (isMe) {
    toggleBubbleActions(event, idStr);
  }
}

// Show premium floating quick reaction picker
function showQuickReactionPicker(event, msgId, isMe, isFloating = false) {
  event.stopPropagation();
  closeAllChatPopups();

  const bubble = event.currentTarget;
  const rect = bubble.getBoundingClientRect();
  
  const picker = document.createElement('div');
  picker.className = 'quick-reaction-picker';
  
  const pickerWidth = 240;
  // Adjust top offset to position above bubble
  const topPos = window.scrollY + rect.top - 46;
  
  // Center relative to bubble, but clamp within viewport limits to prevent overflowing on mobile
  let leftPos = window.scrollX + rect.left + (rect.width - pickerWidth) / 2;
  const maxLeft = window.scrollX + window.innerWidth - pickerWidth - 10;
  leftPos = Math.max(10, Math.min(leftPos, maxLeft));
  
  picker.style.cssText = `
    position: absolute;
    top: ${topPos}px;
    left: ${leftPos}px;
    display: flex;
    gap: 8px;
    padding: 6px 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0,0,0,0.15);
    z-index: 999999;
    animation: scaleFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    user-select: none;
  `;
  
  const emojis = ['👍', '❤️', '🔥', '👏', '😂', '😮', '😢', '🙏'];
  let buttonsHtml = '';
  
  emojis.forEach(emoji => {
    buttonsHtml += `
      <span onclick="selectReaction(event, '${msgId}', '${emoji}')" style="
        font-size: 18px;
        cursor: pointer;
        transition: transform 0.15s;
        display: inline-block;
      " onmouseover="this.style.transform='scale(1.35)'" onmouseout="this.style.transform='scale(1)'">
        ${emoji}
      </span>
    `;
  });
  
  picker.innerHTML = buttonsHtml;
  document.body.appendChild(picker);
}

// Select reaction callback
function selectReaction(event, msgId, emoji) {
  event.stopPropagation();
  toggleMessageReaction(msgId, emoji);
  closeAllChatPopups();
}

// Toggle a message reaction in Supabase Rest API
async function toggleMessageReaction(msgId, emoji) {
  const myCode = getEffectiveStaffCode();
  if (!myCode) return;

  try {
    // 1. Fetch current reactions
    const res = await sbFetch(`/rest/v1/profile_chats?id=eq.${msgId}&select=reactions`);
    const data = await res.json();
    if (!data || !data[0]) return;

    let reactions = data[0].reactions || {};
    if (typeof reactions !== 'object' || reactions === null) {
      reactions = {};
    }

    // 2. Toggle user reaction
    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    const idx = reactions[emoji].indexOf(myCode);
    if (idx !== -1) {
      reactions[emoji].splice(idx, 1);
      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }
    } else {
      reactions[emoji].push(myCode);
    }

    // 3. Update database row
    await sbFetch(`/rest/v1/profile_chats?id=eq.${msgId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reactions: reactions })
    });
  } catch (e) {
    console.error('toggleMessageReaction error:', e);
  }
}

// Render reaction badges below the bubble
function renderMessageReactionsHtml(reactions, msgId, isMe, isFloating = false) {
  if (!reactions || typeof reactions !== 'object' || reactions === null || Object.keys(reactions).length === 0) {
    return '';
  }

  const alignStyle = isMe ? 'align-self: flex-end; margin-right: 12px; margin-left: 0;' : 'align-self: flex-start; margin-left: 12px; margin-right: 0;';
  
  let html = `<div class="chat-message-reactions" style="${alignStyle}">`;
  
  let hasActiveReactions = false;
  for (const [emoji, users] of Object.entries(reactions)) {
    if (users && users.length > 0) {
      hasActiveReactions = true;
      const count = users.length;
      const countStr = count > 1 ? `<span style="font-size: 9px; font-weight: bold; margin-left: 2px; color: var(--text2);">${count}</span>` : '';
      
      const myCode = getEffectiveStaffCode();
      const didIReact = users.includes(myCode);
      const activeStyle = didIReact ? 'background: rgba(124, 106, 247, 0.15); border-radius: 6px; padding: 1px 4px; border: 1px solid rgba(124,106,247,0.3);' : '';

      // Generate overlapping avatars row
      let avatarsHtml = '<div class="chat-reaction-avatars-row">';
      users.forEach(uCode => {
        const staffObj = allStaff.find(s => s.staff_code === uCode);
        const uName = staffObj ? (staffObj.nickname || staffObj.full_name) : uCode;
        const uInitial = uName ? getNameInitial(uName) : '?';
        const uColor = staffObj?.staff_avatar_color || 'var(--accent)';
        avatarsHtml += `
          <div class="chat-reaction-avatar" style="background: ${uColor};" title="${uName} (${uCode})">
            ${uInitial}
          </div>
        `;
      });
      avatarsHtml += '</div>';

      html += `
        <span onclick="event.stopPropagation(); toggleMessageReaction('${msgId}', '${emoji}')" style="cursor: pointer; display: inline-flex; align-items: center; gap: 2px; ${activeStyle}" title="${users.join(', ')}">
          ${emoji}${countStr}${avatarsHtml}
        </span>
      `;
    }
  }
  
  html += `</div>`;
  return hasActiveReactions ? html : '';
}

// Close reaction picker popups
function closeAllChatPopups() {
  document.querySelectorAll('.quick-reaction-picker').forEach(el => el.remove());
}

// Close on clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.quick-reaction-picker')) {
    closeAllChatPopups();
  }
});

