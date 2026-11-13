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

async function runCloudflareLucidOrigin(accountId, apiToken, prompt, seed) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/leonardo/lucid-origin`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, width: 512, height: 512, steps: 16, seed }),
      signal: AbortSignal.timeout(15000),
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.result?.image) {
    const msg = data?.errors?.[0]?.message || `HTTP ${res.status}`;
    const err = new Error(`Cloudflare (@cf/leonardo/lucid-origin) error: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return {
    provider: 'cloudflare-lucid-origin',
    imageUrl: `data:image/jpeg;base64,${data.result.image}`,
  };
}

export function hasFastImageProvider() {
  return Boolean(
    process.env.CLOUDFLARE_ACCOUNT_ID?.trim() && process.env.CLOUDFLARE_API_TOKEN?.trim()
  );
}

/**
 * Generates a title-and-description-based bistro plate illustration strictly via
 * Cloudflare Workers AI (@cf/leonardo/lucid-origin) with no fallback models.
 */
export async function generateDishImage({ title, description }) {
  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  if (!cleanTitle) {
    throw new Error('Recipe title is required to generate an illustration.');
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!accountId || !apiToken) {
    throw new Error('Cloudflare Workers AI credentials (CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN) are missing.');
  }

  const backdrop = pickBackdropForTitle(cleanTitle);
  const prompt = buildDishIllustrationPrompt(cleanTitle, description, backdrop);
  const fallbackPrompt = buildDishIllustrationPrompt(cleanTitle, null, backdrop);
  const seed = hashSeed(cleanTitle);

  let result = null;
  try {
    result = await runCloudflareLucidOrigin(accountId, apiToken, prompt, seed);
  } catch (err) {
    if (err?.status === 400 && fallbackPrompt !== prompt) {
      result = await runCloudflareLucidOrigin(accountId, apiToken, fallbackPrompt, seed);
    } else {
      throw err;
    }
  }

  return {
    version: DISH_VISUAL_VERSION,
    forTitle: cleanTitle,
    backdrop,
    provider: result.provider,
    ...(description?.trim() ? { illustrationDescription: description.trim() } : {}),
    imageUrl: result.imageUrl,
  };
}
