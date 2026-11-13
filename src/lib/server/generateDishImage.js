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
    : `a freshly plated serving of ${title} on a round cream ceramic plate with fresh green herb garnish`;

  return [
    'Flat 2D vector food sticker illustration in a bold neo-brutalist modern diner app icon style:',
    `${subject}.`,
    'Thick uniform dark-charcoal black ink outlines (#1F1E1D), crisp flat solid cel-color fills, simplified clean geometric shapes, minimal flat highlight shapes, cheerful pop-art editorial menu badge aesthetic.',
    `Single centered dish taking ~65% of the frame with generous empty margin over a completely flat solid uniform ${colorName} background and one crisp flat dark oval shadow directly under the plate.`,
    'Strictly flat 2D graphic vector art matching a bold outlined mascot icon. NO painterly brushwork, NO watercolor, NO gouache, NO soft shading, NO gradients, NO 3D render, NO photography, NO cutlery, NO text, NO watermark.',
  ].join(' ');
}

/**
 * Uses Gemini text generation (free-tier friendly) to turn recipe titles and
 * optional ingredients into crisp, iconic shape-and-color dish descriptions
 * matching Cheffone's flat 2D vector style before image generation.
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
    const prompt = `You are an art director for a bold neo-brutalist recipe app with flat 2D vector icon illustrations. For each recipe below, write ONE concise 25-to-35-word visual description of ONLY the finished dish so a vector icon artist draws it clearly.

Include:
- Simple light-colored vessel (round cream ceramic plate, deep cream ceramic bowl, rustic wood board, tall clear glass — never dark slate).
- Distinct recognizable food shape, vibrant flat hero ingredient colors, sauce drizzle, and fresh green garnish (e.g., golden folded French omelet topped with crispy diced potatoes and green chives on a cream plate; deep cream bowl of swirled pasta with orange salmon chunks, red cherry tomatoes, white feta cubes, and green basil).
- Use wholesome culinary phrasing; avoid camera/shot/lighting words, backgrounds, or hex colors.

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
      signal: AbortSignal.timeout(15000),
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
      // FLUX.1-schnell (4 steps, no `seed` param allowed by schema) keeps daily neuron usage low and runs in ~1-2s
      return await runCloudflareModel(
        accountId,
        apiToken,
        '@cf/black-forest-labs/flux-1-schnell',
        { prompt: activePrompt, steps: 4 },
        'cloudflare-flux-schnell'
      );
    } catch (fluxErr) {
      if (fluxErr?.status === 429) {
        throw fluxErr;
      }
      if (activePrompt !== fallbackPrompt && fluxErr?.status === 400) {
        console.warn('Retrying Cloudflare with simplified culinary prompt after 400:', fluxErr.message);
        continue;
      }
      console.warn('FLUX schnell fallback to Lucid Origin:', fluxErr?.message || fluxErr);
    }

    try {
      return await runCloudflareModel(
        accountId,
        apiToken,
        '@cf/leonardo/lucid-origin',
        { prompt: activePrompt, width: 512, height: 512, steps: 10, seed },
        'cloudflare-lucid-origin'
      );
    } catch (lucidErr) {
      if (activePrompt !== fallbackPrompt && lucidErr?.status === 400) {
        console.warn('Retrying Cloudflare with simplified culinary prompt after 400:', lucidErr.message);
        continue;
      }
      throw lucidErr;
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
  if (process.env.ENABLE_GEMINI_IMAGE !== 'true') return null;
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
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
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
