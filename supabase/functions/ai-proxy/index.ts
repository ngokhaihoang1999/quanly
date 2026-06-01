/**
 * AI Proxy Edge Function with Smart Hybrid Routing & Fallback
 * Features:
 * - 100% Free Groq pipeline (Llama 3.2 Vision OCR + Qwen 2.5 Coder 32B)
 * - Automatic Fallback to OpenAI (GPT-4o-mini Paid) if Groq fails or rate limits are hit
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') || '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { messages, model, temperature, max_tokens } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Identify if there is a base64 image in the request
    let hasImage = false;
    let imageBase64 = "";
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            hasImage = true;
            imageBase64 = part.image_url.url;
          }
        }
      }
    }

    let ocrText = "";
    let ocrSuccessful = false;

    // STEP 1: If there is an image and Groq key is present, perform free OCR using Llama 3.2 Vision
    if (hasImage && GROQ_API_KEY) {
      try {
        console.log("[AI Proxy] Performing free OCR via Groq Llama 3.2 Vision...");
        const ocrRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'llama-3.2-11b-vision-preview',
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'Bạn là trợ lý OCR chuyên nghiệp. Trích xuất chính xác toàn bộ nội dung chữ (tiếng Việt/tiếng Anh) xuất hiện trong hình ảnh bài tập/tài liệu này. Giữ nguyên định dạng câu hỏi và câu trả lời. TUYỆT ĐỐI không giải thích hay bình luận thêm, chỉ trả về nội dung chữ được trích xuất.'
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: imageBase64
                    }
                  }
                ]
              }
            ],
            temperature: 0.1,
            max_tokens: 1024,
          }),
        });

        if (ocrRes.ok) {
          const ocrData = await ocrRes.json();
          ocrText = ocrData.choices?.[0]?.message?.content || "";
          if (ocrText.trim()) {
            ocrSuccessful = true;
            console.log("[AI Proxy] OCR Success! Extracted text length:", ocrText.length);
          }
        } else {
          console.warn("[AI Proxy] Groq OCR failed with status:", ocrRes.status);
        }
      } catch (err) {
        console.error("[AI Proxy] Groq OCR exception:", err);
      }
    }

    // STEP 2: Try to call Qwen 2.5 Coder 32B on Groq for text reasoning (either native text, or image-to-text OCR result)
    // We only route to Groq if:
    // - There is no image OR OCR was successful
    // - GROQ_API_KEY is available
    if (GROQ_API_KEY && (!hasImage || ocrSuccessful)) {
      try {
        let processedMessages = messages;
        if (ocrSuccessful && ocrText) {
          // Replace image content with extracted text
          processedMessages = messages.map((msg: any) => {
            if (Array.isArray(msg.content)) {
              let textPart = "";
              for (const part of msg.content) {
                if (part.type === 'text') {
                  textPart += part.text + "\n";
                }
              }
              const combinedText = `${textPart}\n[Nội dung chữ trích xuất từ ảnh bài tập bằng OCR:\n${ocrText}\n]`;
              return { ...msg, content: combinedText };
            }
            return msg;
          });
        }

        console.log("[AI Proxy] Calling Groq Qwen 3 32B...");
        const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'qwen-32b',
            messages: processedMessages,
            temperature: Math.min(Math.max(temperature || 0.3, 0), 1),
            max_tokens: Math.min(max_tokens || 1000, 2000),
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          console.log("[AI Proxy] Groq Qwen call success!");
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          });
        }

        console.warn("[AI Proxy] Groq Qwen failed with status:", groqRes.status, "Falling back to OpenAI...");
      } catch (err) {
        console.error("[AI Proxy] Groq Qwen exception, falling back to OpenAI:", err);
      }
    }

    // STEP 3: Fallback / Native Vision pipeline via OpenAI GPT-4o-mini
    console.log("[AI Proxy] Routing request to OpenAI GPT-4o-mini (Paid)...");
    const safeMaxTokens = Math.min(max_tokens || 1000, 2000);
    const safeTemp = Math.min(Math.max(temperature || 0.3, 0), 1);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        temperature: safeTemp,
        max_tokens: safeMaxTokens,
      }),
    });

    const data = await openaiRes.json();

    if (!openaiRes.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || 'OpenAI error' }), {
        status: openaiRes.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
