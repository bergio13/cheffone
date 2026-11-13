export const DISH_VISUAL_VERSION = 5;

export const DISH_BACKDROPS = [
  '#d9381e', // Terracotta red
  '#fbe4c8', // Warm apricot cream
  '#f3a824', // Golden honey amber
  '#f8d4cc', // Soft blush coral
  '#d7eadc', // Fresh herb sage
];

function hashTitle(title = '') {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Picks a warm bistro backdrop from the Cheffone palette deterministically by title.
 */
export function pickBackdropForTitle(title = '') {
  if (!title.trim()) return DISH_BACKDROPS[0];
  return DISH_BACKDROPS[hashTitle(title.trim().toLowerCase()) % DISH_BACKDROPS.length];
}

export function isValidDishImageUrl(url) {
  return typeof url === 'string' && url.startsWith('data:image/');
}

/**
 * Normalizes a persisted image-model dishVisual payload for a recipe title.
 */
export function sanitizeDishVisual(raw, title, backdropOverride) {
  const cleanTitle = typeof title === 'string' ? title : '';
  const candidateBackdrop = backdropOverride || raw?.backdrop;
  const backdrop = DISH_BACKDROPS.includes(candidateBackdrop)
    ? candidateBackdrop
    : pickBackdropForTitle(cleanTitle);
  const imageUrl = isValidDishImageUrl(raw?.imageUrl) ? raw.imageUrl : null;

  return {
    version: DISH_VISUAL_VERSION,
    forTitle: cleanTitle,
    backdrop,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

/**
 * Resolves a recipe's bistro illustration strictly from persisted title-based
 * image-model artwork. Returns null imageUrl while awaiting generation.
 */
export function resolveDishVisual(recipe) {
  const dv = recipe?.dishVisual;
  const title = recipe?.title || '';

  if (
    dv &&
    dv.version === DISH_VISUAL_VERSION &&
    (!dv.forTitle || dv.forTitle === title) &&
    isValidDishImageUrl(dv.imageUrl)
  ) {
    return {
      backdrop: DISH_BACKDROPS.includes(dv.backdrop)
        ? dv.backdrop
        : pickBackdropForTitle(title),
      imageUrl: dv.imageUrl,
    };
  }

  return {
    backdrop: pickBackdropForTitle(title),
    imageUrl: null,
  };
}

/**
 * Returns true if the recipe needs a title-based Gemini image-model illustration
 * (missing, legacy SVG/thumbnail v1/v2, or recipe title changed).
 */
export function needsDishVisualBackfill(recipe) {
  if (!recipe?.title) return false;
  const dv = recipe?.dishVisual;
  return (
    dv?.version !== DISH_VISUAL_VERSION ||
    dv?.forTitle !== recipe.title ||
    !isValidDishImageUrl(dv?.imageUrl)
  );
}
