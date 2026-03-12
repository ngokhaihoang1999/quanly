import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
const SUPABASE_URL = 'https://smzoomekyvllsgppgvxw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || '';

// Khởi tạo Supabase client (dùng SERVICE_ROLE để có Full quyền khi Bot chạy backend)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function sendText(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, parse_mode: "Markdown" })
  });
}

async function sendKeyboard(chatId: number, text: string, keyboard: any[]) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: text, reply_markup: { inline_keyboard: keyboard }, parse_mode: "Markdown" })
  });
}

Deno.serve(async (req) => {
  try {
    const update = await req.json();

    const msg = update.message || update.callback_query?.message;
    if (!msg) return new Response("OK");

    const chatId = msg.chat.id;
    // Telegram gửi theo callback_query hoặc message bình thường
    const telegramId = update.message ? update.message.from.id : update.callback_query.from.id;
    const text = update.message ? update.message.text : null;

    // 1. Nhận diện nhân viên
    const { data: staffData } = await supabase
      .from('staff')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    // 2. Nếu CHƯA nhận diện, yêu cầu đăng ký Mã NV
    if (!staffData) {
      if (text && text.startsWith('/register')) {
        const code = text.split(" ")[1];
        if (!code) {
           await sendText(chatId, "⚠️ Vui lòng gõ đúng định dạng: `/register [Mã_NV]`");
           return new Response("OK");
        }
        
        const { data: existingStaff } = await supabase
          .from('staff')
          .select('*')
          .eq('staff_code', code)
          .single();

        if (!existingStaff) {
          await sendText(chatId, "❌ Mã nhân viên không tồn tại.");
          return new Response("OK");
        }

        const { error: updateError } = await supabase
          .from('staff')
          .update({ telegram_id: telegramId })
          .eq('staff_code', code);

        if (updateError) {
          await sendText(chatId, "❌ Lỗi hệ thống khi đăng ký mã nhân viên.");
          return new Response("OK");
        }

        await sendText(chatId, `✅ Khớp kết nối thành công! Mừng ${existingStaff.full_name} (${code}) tham gia hệ thống.\nDùng lệnh /menu để xem chức năng.`);
        return new Response("OK");
      }
      
      await sendText(chatId, "⚠️ Chưa nhận diện thiết bị!\n\nHệ thống quản lý Maize Tracking cần khớp Mã Nhân Viên của bạn với tài khoản Telegram.\n👉 Vui lòng nhắn: `/register [Mã_NV]` (VD: `/register ADMIN01`).");
      return new Response("OK");
    }

    // Tới bước này, Bot đã biết ai là ai thông qua staffData (NV001, Admin, NDD...)

    // 3. Xử lý Nút bấm (Callback Query)
    if (update.callback_query) {
      const data = update.callback_query.data;
      
      if (data === "list_profiles") {
        const { data: profiles } = await supabase.from('profiles').select('*').limit(10);
        if (!profiles || profiles.length === 0) {
          await sendText(chatId, "Chưa có hồ sơ cá nào trong hệ thống.");
          return new Response("OK");
        }
        const keyboard = profiles.map((p: any) => [{ text: `👤 ${p.full_name}`, callback_data: `view_p_${p.id}` }]);
        await sendKeyboard(chatId, "📋 Danh sách các hồ sơ gần đây:", keyboard);
      }
      return new Response("OK");
    }

    // 4. Xử lý Lệnh Text 
    if (text === '/start' || text === '/menu') {
      const keyboard = [
        [{ text: "📋 Danh bạ & Hồ sơ", callback_data: "list_profiles" }],
        // Ở phase sau Web App sẽ cấu hình URL Mini App của Telegram vào đây 
        [{ text: "🖥 Mở Quản Lý Nâng Cao (Web App)", web_app: { url: "https://google.com" } }]
      ];
      await sendKeyboard(chatId, `Xin chào, **${staffData.full_name}** - Quyền truy cập: ${staffData.role.toUpperCase()}\n\nBạn có thể quản lý nhanh qua Bot hoặc mở Mini App bên dưới để nhập các form phiếu (Tờ 1, 2, 3, 4) dễ dàng hơn nhé!`, keyboard);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response("Hệ thống quá tải hoặc lỗi.", { status: 500 });
  }
});
