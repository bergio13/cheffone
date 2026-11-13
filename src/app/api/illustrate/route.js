import { NextResponse } from 'next/server';
import {
  enhanceDishDescriptions,
  generateDishImage,
  hasFastImageProvider,
} from '@/lib/server/generateDishImage';

const MAX_BATCH = 3;

export async function POST(request) {
  try {
    const body = await request.json();
    const limit = hasFastImageProvider() ? MAX_BATCH : 1;
    const inputList = Array.isArray(body?.recipes)
      ? body.recipes
          .filter((r) => r && r.id && typeof r.title === 'string' && r.title.trim())
          .slice(0, limit)
      : [];

    if (inputList.length === 0) {
      return NextResponse.json({ visuals: {} });
    }

    const activeApiKey = process.env.GEMINI_API_KEY?.trim();
    const enhancedMap = await enhanceDishDescriptions(inputList, activeApiKey);

    const settled = await Promise.allSettled(
      inputList.map(async (item) => {
        const id = String(item.id);
        const description =
          (typeof item.illustrationDescription === 'string' && item.illustrationDescription.trim()) ||
          enhancedMap[id] ||
          '';
        const visual = await generateDishImage({
          title: item.title,
          description,
          apiKey: activeApiKey,
        });
        return [id, visual];
      })
    );

    const visuals = {};
    const errors = [];
    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        const [id, visual] = outcome.value;
        visuals[id] = visual;
      } else {
        errors.push({
          status: outcome.reason?.status,
          retryAfterSeconds: outcome.reason?.retryAfterSeconds,
          message: outcome.reason?.message || 'Image generation failed',
        });
      }
    }

    if (Object.keys(visuals).length === 0 && errors.length > 0) {
      const firstErr = errors[0];
      const status =
        firstErr.status === 429 || firstErr.message.includes('429') ? 429 : 502;
      return NextResponse.json(
        {
          error: firstErr.message,
          ...(firstErr.retryAfterSeconds ? { retryAfterSeconds: firstErr.retryAfterSeconds } : {}),
        },
        { status }
      );
    }

    return NextResponse.json({ visuals });
  } catch (err) {
    console.error('API Error in /api/illustrate:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate dish illustrations' },
      { status: 500 }
    );
  }
}
