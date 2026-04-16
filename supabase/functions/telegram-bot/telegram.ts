import { BOT_TOKEN, ADMIN_STAFF_CODE, supabase } from "./config.ts";

// ============ TELEGRAM API HELPERS ============

export async function sendText(chatId: number, text: string, extra: any = {}) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", ...extra })
  });
}

export async function sendKeyboard(chatId: number, text: string, keyboard: any[]) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, reply_markup: { inline_keyboard: keyboard }, parse_mode: "Markdown" })
  });
}

export async function forwardMessage(fromChatId: number, toChatId: number, messageId: number) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/forwardMessage`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId })
  });
}

export async function editMessageReplyMarkup(chatId: number, messageId: number, replyMarkup: any = null) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageReplyMarkup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, reply_markup: replyMarkup })
  });
}

export async function editMessageText(chatId: number, messageId: number, text: string, keyboard: any[] | null = null) {
  const payload: any = { chat_id: chatId, message_id: messageId, text, parse_mode: "Markdown" };
  if (keyboard) payload.reply_markup = { inline_keyboard: keyboard };
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function getChatAdmins(chatId: number) {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatAdministrators?chat_id=${chatId}`).then(r => r.json());
  return res.ok ? res.result : [];
}

export async function getChatMember(chatId: number, userId: number) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${userId}`).then(r => r.json());
    return res.ok ? res.result : null;
  } catch { return null; }
}

export async function getBotId(): Promise<number | null> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getMe`).then(r => r.json());
  return res.result?.id || null;
}

export async function exportChatInviteLink(chatId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/exportChatInviteLink`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId })
    }).then(r => r.json());
    return res.ok ? res.result : null;
  } catch { return null; }
}

export async function sendDocument(chatId: number, fileBuffer: Uint8Array | ArrayBuffer, fileName: string, caption: string = '') {
  const form = new FormData();
  form.append('chat_id', String(chatId));
  form.append('document', new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), fileName);
  if (caption) {
    form.append('caption', caption);
    form.append('parse_mode', 'Markdown');
  }
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: form
  });
}

// ============ DATA HELPERS ============

export async function getAdminTelegramId(): Promise<number | null> {
  const { data } = await supabase.from('staff').select('telegram_id').eq('staff_code', ADMIN_STAFF_CODE).single();
  return data?.telegram_id || null;
}

export async function getStaffByTelegramId(tid: number) {
  const { data } = await supabase.from('staff').select('*').eq('telegram_id', tid).single();
  return data;
}
