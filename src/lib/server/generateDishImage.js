import { GoogleGenAI } from '@google/genai';
import {
  DISH_VISUAL_VERSION,
  pickBackdropForTitle,
} from '@/lib/dishVisual';

const BACKDROP_COLOR_NAMES = {
  '#d9381e': 'warm tomato terracotta-red',
  '#fbe4c8': 'soft warm peach-cream',
  '#f3a824': 'bright warm golden-mustard',
  '#f8d4cc': 'soft pastel blush-pink',
  '#d7eadc': 'soft pastel sage-mint',
};

function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 100000;
}

function buildDishIllustrationPrompt(title, description, backdrop) {
  const colorName = BACKDROP_COLOR_NAMES[backdrop] || 'warm peach-cream';
  const subject = description?.trim()
    ? description.trim()
    : `A freshly prepared serving of ${title}, plated appetizingly on a cream ceramic plate or bowl with fresh herb garnish`;

  return [
    'Appetizing cozy hand-drawn bistro storybook illustration, Studio Ghibli food art meets modern Bon Appetit editorial spot illustration, delicate warm dark-brown ink outlines, soft gouache cel-shading.',
    `Subject centered (occupying ~68% of frame width with generous empty margin around the dish and empty top-right corner) viewed at a charming 35-degree isometric dining-table angle: ${subject}.`,
    `Floating cleanly over a completely flat uniform matte ${colorName} solid color background with subtle soft oval shadow directly under the dish.`,
    'Clean edges, NO table clutter, NO cutlery, NO hands, NO photography, NO text, NO words, NO signature, NO watermark.',
  ].join(' ');
}

/**
 * Uses Gemini text generation (free-tier friendly) to turn recipe titles and
 * optional ingredients into vivid, unmistakable visual plating descriptions
 * before passing them to the image generation model.
 */
export async function enhanceDishDescriptions(recipes, apiKey) {
  const cleanKey = apiKey?.trim();
  const out = {};
  if (!Array.isArray(recipes) || recipes.length === 0) return out;
  if (!cleanKey || cleanKey === 'your_gemini_api_key_here') return out;

  const needingEnhancement = recipes.filter(
    (r) => r?.id && r?.title && !r?.illustrationDescription
  );
  if (needingEnhancement.length === 0) return out;

  try {
    const ai = new GoogleGenAI({ apiKey: cleanKey });
    const prompt = `You are an art director for a modern cookbook app. For each recipe below, write ONE concise 30-to-40-word visual plating description of ONLY the finished dish so an illustrator draws it accurately and appetizingly.

Include:
- Exact vessel (shallow stoneware plate, deep ceramic ramen bowl, white shallow pasta plate, rustic wooden board, tall clear glass).
- Exact cooked form, key hero ingredients, sauce glaze, and vibrant herb garnish (e.g., folded golden French omelet filled with crispy roasted diced potatoes and chives; creamy swirled pasta with flaky salmon pieces, roasted feta, cherry tomatoes, and basil; crispy grilled triangular pita flatbreads filled with seasoned beef on an oval plate with tahini sauce and parsley).
- Use wholesome culinary phrasing; avoid words like meat-stuffed, smear, naked, breast, or photography/camera terms, backgrounds, or hex colors.

Recipes:
${JSON.stringify(
  needingEnhancement.map((r) => ({
    id: String(r.id),
    title: String(r.title).trim(),
    category: r.category || '',
    keyIngredients: Array.isArray(r.ingredients) ? r.ingredients.slice(0, 6) : [],
  }))
)}

Return a JSON object mapping each recipe "id" to its visual description string.`;

    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(res.text);
    if (parsed && typeof parsed === 'object') {
      for (const item of needingEnhancement) {
        const desc = parsed[String(item.id)];
        if (typeof desc === 'string' && desc.trim()) {
          out[String(item.id)] = desc.trim();
        }
      }
    }
  } catch (err) {
    console.warn('Non-fatal Gemini description enhancement fallback:', err?.message || err);
  }
  return out;
}

function extractGeminiImage(interaction) {
  const direct = interaction?.output_image;
  if (direct?.data) {
    return `data:${direct.mime_type || 'image/jpeg'};base64,${direct.data}`;
  }
  const outputs = Array.isArray(interaction?.outputs) ? interaction.outputs : [];
  for (let i = outputs.length - 1; i >= 0; i -= 1) {
    const item = outputs[i];
    if (item?.type === 'image' && item?.data) {
      return `data:${item.mime_type || 'image/jpeg'};base64,${item.data}`;
    }
  }
  return null;
}

async function responseToImageDataUrl(res, providerName) {
  const contentType = res.headers.get('content-type') || '';
  if (!res.ok || !contentType.startsWith('image/')) {
    const bodyText = await res.text().catch(() => '');
    const err = new Error(`${providerName} error (${res.status}): ${bodyText.slice(0, 200)}`);
    err.status = res.status === 402 ? 429 : res.status;
    const retryMatch = bodyText.match(/Retry after (\d+)s/i);
    if (retryMatch) {
      err.retryAfterSeconds = Number(retryMatch[1]);
    }
    throw err;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const mime = contentType.split(';')[0].trim() || 'image/jpeg';
  return `data:${mime};base64,${buf.toString('base64')}`;
}

async function runCloudflareModel(accountId, apiToken, model, body, providerName) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${model}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.result?.image) {
    const msg = data?.errors?.[0]?.message || `HTTP ${res.status}`;
    const err = new Error(`Cloudflare (${model}) error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return {
    provider: providerName,
    imageUrl: `data:image/jpeg;base64,${data.result.image}`,
  };
}

async function tryCloudflareProviders(prompt, fallbackPrompt, seed) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) return null;

  for (const activePrompt of [prompt, fallbackPrompt]) {
    try {
      return await runCloudflareModel(
        accountId,
        apiToken,
        '@cf/leonardo/lucid-origin',
        { prompt: activePrompt, width: 512, height: 512, steps: 16, seed },
        'cloudflare-lucid-origin'
      );
    } catch (lucidErr) {
      console.warn('Lucid Origin fallback to FLUX schnell:', lucidErr?.message || lucidErr);
    }

    try {
      return await runCloudflareModel(
        accountId,
        apiToken,
        '@cf/black-forest-labs/flux-1-schnell',
        { prompt: activePrompt, steps: 8, seed },
        'cloudflare-flux-schnell'
      );
    } catch (fluxErr) {
      // Retry with the minimal clean fallback prompt only on content-filter 400 errors
      if (activePrompt !== fallbackPrompt && fluxErr?.status === 400) {
        console.warn('Retrying Cloudflare with simplified culinary prompt after 400:', fluxErr.message);
        continue;
      }
      throw fluxErr;
    }
  }
  return null;
}

async function tryHuggingFaceFlux(prompt) {
  const hfToken = process.env.HF_TOKEN?.trim();
  if (!hfToken) return null;

  const res = await fetch(
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { num_inference_steps: 8, width: 512, height: 512 },
      }),
    }
  );
  const imageUrl = await responseToImageDataUrl(res, 'Hugging Face');
  return { provider: 'huggingface-flux-schnell', imageUrl };
}

async function tryPollinationsKeyed(prompt, seed) {
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (!key) return null;

  const url = `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?model=flux&width=512&height=512&seed=${seed}&nologo=true`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const imageUrl = await responseToImageDataUrl(res, 'Pollinations (keyed)');
  return { provider: 'pollinations-keyed', imageUrl };
}

async function tryGeminiImage(prompt, apiKey) {
  const cleanKey = apiKey?.trim();
  if (!cleanKey || cleanKey === 'your_gemini_api_key_here') return null;

  const ai = new GoogleGenAI({ apiKey: cleanKey });
  const configs = [
    {
      model: 'gemini-3.1-flash-lite-image',
      response_format: {
        type: 'image',
        aspect_ratio: '1:1',
        mime_type: 'image/jpeg',
        image_size: '512',
      },
    },
    {
      model: 'gemini-nano-banana-2.1',
      response_format: {
        type: 'image',
        aspect_ratio: '1:1',
        mime_type: 'image/jpeg',
        image_size: '1K',
      },
    },
  ];

  let lastErr = null;
  for (const cfg of configs) {
    try {
      const interaction = await ai.interactions.create({
        model: cfg.model,
        input: prompt,
        response_format: cfg.response_format,
      });
      const imageUrl = extractGeminiImage(interaction);
      if (imageUrl) {
        return { provider: cfg.model, imageUrl };
      }
    } catch (err) {
      lastErr = err;
    }
  }
  if (lastErr) throw lastErr;
  return null;
}

async function tryPollinationsAnonymous(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?model=flux&width=512&height=512&seed=${seed}&nologo=true`;
  const res = await fetch(url);
  const imageUrl = await responseToImageDataUrl(res, 'Pollinations (free)');
  return { provider: 'pollinations-free', imageUrl };
}

/**
 * Returns true if a dedicated free/paid image provider token is configured
 * (allowing concurrent batch generation without anonymous IP cooldowns).
 */
export function hasFastImageProvider() {
  return Boolean(
    (process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim()) ||
      process.env.HF_TOKEN?.trim() ||
      process.env.POLLINATIONS_API_KEY?.trim()
  );
}

/**
 * Generates a title-and-description-based bistro plate illustration across
 * configured providers: Cloudflare Workers AI (Lucid Origin / FLUX schnell) ->
 * Hugging Face -> Pollinations (keyed) -> Gemini Nano Banana -> Pollinations (free).
 */
export async function generateDishImage({ title, description, apiKey }) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) {
    throw new Error('Recipe title is required to generate an illustration.');
  }

  const backdrop = pickBackdropForTitle(cleanTitle);
  const prompt = buildDishIllustrationPrompt(cleanTitle, description, backdrop);
  const fallbackPrompt = buildDishIllustrationPrompt(cleanTitle, null, backdrop);
  const seed = hashSeed(cleanTitle);

  const attempts = [
    () => tryCloudflareProviders(prompt, fallbackPrompt, seed),
    () => tryHuggingFaceFlux(prompt),
    () => tryPollinationsKeyed(prompt, seed),
    () => tryGeminiImage(prompt, apiKey ?? process.env.GEMINI_API_KEY),
    () => tryPollinationsAnonymous(prompt, seed),
  ];

  let lastError = null;
  for (const runProvider of attempts) {
    try {
      const result = await runProvider();
      if (result?.imageUrl) {
        return {
          version: DISH_VISUAL_VERSION,
          forTitle: cleanTitle,
          backdrop,
          provider: result.provider,
          ...(description?.trim() ? { illustrationDescription: description.trim() } : {}),
          imageUrl: result.imageUrl,
        };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All image generation providers failed');
}
