/**
 * Pure formatting and scaling helpers for recipe ingredients, metadata, and nutrition values.
 */

const STRIP_UNITS = new Set(['unit', 'units']);

/**
 * Format an ingredient unit string, stripping meaningless placeholder units like "unit".
 * @param {string | null | undefined} unit
 * @returns {string}
 */
export function formatIngredientUnit(unit) {
  if (typeof unit !== 'string') return '';
  const trimmed = unit.trim();
  if (!trimmed) return '';
  if (STRIP_UNITS.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

/**
 * Scale an ingredient quantity by adjustedServings / originalServings with clean decimal rounding.
 * @param {number | string | null | undefined} quantity
 * @param {number | null | undefined} originalServings
 * @param {number} adjustedServings
 * @returns {string}
 */
export function formatScaledQuantity(quantity, originalServings, adjustedServings) {
  if (quantity === null || quantity === undefined || quantity === '') return '';
  const num = typeof quantity === 'number' ? quantity : Number(String(quantity).trim());
  if (!Number.isFinite(num)) return String(quantity).trim();

  const base = Number(originalServings) > 0 ? Number(originalServings) : 2;
  const target = Number(adjustedServings) > 0 ? Number(adjustedServings) : base;
  const scaled = num * (target / base);
  const rounded = Math.round(scaled * 100) / 100;
  return String(rounded);
}

/**
 * Compact verbose duration strings for tight mobile metadata cells (e.g. "45 mins" -> "45m").
 * @param {string | null | undefined} duration
 * @returns {string}
 */
export function formatCompactDuration(duration) {
  if (typeof duration !== 'string') return 'N/A';
  const trimmed = duration.trim();
  if (!trimmed) return 'N/A';
  return trimmed
    .replace(/\bhours?\b|\bhrs?\b/gi, 'h')
    .replace(/\bminutes?\b|\bmins?\b/gi, 'm')
    .replace(/\bseconds?\b|\bsecs?\b/gi, 's')
    .replace(/(\d)\s+([hms])\b/gi, '$1$2');
}

/**
 * Scale a numeric or unit-suffixed nutrition value (e.g. 450, "25g", "620mg") by a multiplier.
 * @param {number | string | null | undefined} value
 * @param {number} multiplier
 * @returns {string}
 */
export function scaleNutritionValue(value, multiplier = 1) {
  if (value === null || value === undefined || value === '') return '—';
  const factor = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    return String(Math.round(value * factor * 10) / 10);
  }
  const str = String(value).trim();
  if (!str) return '—';
  const match = str.match(/^(-?\d+(?:\.\d+)?)(.*)$/);
  if (!match) return str;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return str;
  const scaled = Math.round(num * factor * 10) / 10;
  return `${scaled}${match[2]}`;
}
