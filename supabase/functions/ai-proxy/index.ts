/**
 * AI Proxy Edge Function with Smart Routing & Fallback
 * Primary: DeepSeek-V3 (deepseek-chat) for text tasks
 * Vision/OCR: OpenAI GPT-4o-mini (multimodal)
 * Fallback: OpenAI GPT-4o-mini for any text failures
 */

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || '';
const DEEPSEEK_API_KEY = Deno.env.get('DEEPSEEK_API_KEY') || '';

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

    console.log("[AI Proxy] Received request. OPENAI_API_KEY exists:", !!OPENAI_API_KEY, "| DEEPSEEK_API_KEY exists:", !!DEEPSEEK_API_KEY);
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
    for (const msg of messages) {
      if (Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'image_url' && part.image_url?.url) {
            hasImage = true;
          }
        }
      }
    }

    const safeMaxTokens = Math.min(max_tokens || 1000, 2000);
    const safeTemp = Math.min(Math.max(temperature || 0.3, 0), 1);

    // CASE 1: Request contains an image (OCR / Homework BTVN)
    // DeepSeek-V3 is text-only, so we route multimodal queries directly to OpenAI GPT-4o-mini
    if (hasImage) {
      console.log("[AI Proxy] Image detected. Routing directly to OpenAI GPT-4o-mini (Multimodal)...");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OpenAI API key missing on server' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

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
        console.error("[AI Proxy] OpenAI image request failed:", data.error?.message);
        return new Response(JSON.stringify({ error: data.error?.message || 'OpenAI error' }), {
          status: openaiRes.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      // Add actual model used for Admin transparency
      data.model = 'gpt-4o-mini';
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // CASE 2: Text-only request (Mindmap, Chat Lacie, AI Parse Text)
    // Primary: DeepSeek-V3
    let responseData = null;
    let deepseekSuccess = false;

    // Determine target DeepSeek model (default to deepseek-v4-pro if not specified)
    const targetModel = (model === 'deepseek-v4-flash' || model === 'deepseek-v4-pro') ? model : 'deepseek-v4-pro';

    if (DEEPSEEK_API_KEY) {
      try {
        console.log(`[AI Proxy] Routing to DeepSeek model: ${targetModel}...`);
        const deepseekRes = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: targetModel,
            messages,
            temperature: safeTemp,
            max_tokens: safeMaxTokens,
          }),
        });

        if (deepseekRes.ok) {
          responseData = await deepseekRes.json();
          deepseekSuccess = true;
          console.log(`[AI Proxy] DeepSeek model ${targetModel} response success!`);
        } else {
          const errText = await deepseekRes.text();
          console.warn(`[AI Proxy] DeepSeek model ${targetModel} failed with status:`, deepseekRes.status, "Body:", errText);
        }
      } catch (err) {
        console.error(`[AI Proxy] DeepSeek model ${targetModel} fetch exception:`, err);
      }
    } else {
      console.log("[AI Proxy] DEEPSEEK_API_KEY is not configured. Skipping...");
    }

    // Fallback: OpenAI GPT-4o-mini (Paid) if DeepSeek fails or is not configured
    if (!deepseekSuccess) {
      console.log("[AI Proxy] Falling back to OpenAI GPT-4o-mini...");
      if (!OPENAI_API_KEY) {
        return new Response(JSON.stringify({ error: 'OpenAI API key missing on server' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

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
        console.error("[AI Proxy] OpenAI fallback failed:", data.error?.message);
        return new Response(JSON.stringify({ error: data.error?.message || 'OpenAI error' }), {
          status: openaiRes.status,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      data.model = 'gpt-4o-mini';
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Return DeepSeek successful response
    if (responseData) {
      responseData.model = targetModel;
      return new Response(JSON.stringify(responseData), {
        status: 200,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('No AI response was generated');

  } catch (e) {
    console.error("[AI Proxy] Edge Function Exception:", e);
    return new Response(JSON.stringify({ error: e.message || 'Server error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
