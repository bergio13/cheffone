import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatIngredientUnit,
  formatScaledQuantity,
  formatCompactDuration,
  scaleNutritionValue,
} from './recipeFormat.js';

test('formatIngredientUnit strips raw "unit" variants', () => {
  assert.equal(formatIngredientUnit('unit'), '');
  assert.equal(formatIngredientUnit('Unit'), '');
  assert.equal(formatIngredientUnit(' UNITS '), '');
  assert.equal(formatIngredientUnit(''), '');
  assert.equal(formatIngredientUnit(null), '');
  assert.equal(formatIngredientUnit('tbsp'), 'tbsp');
  assert.equal(formatIngredientUnit(' g '), 'g');
});

test('formatScaledQuantity scales and formats clean decimals', () => {
  assert.equal(formatScaledQuantity(1, 2, 2), '1');
  assert.equal(formatScaledQuantity(1, 2, 1), '0.5');
  assert.equal(formatScaledQuantity(0.5, 2, 1), '0.25');
  assert.equal(formatScaledQuantity(1, 2, 3), '1.5');
  assert.equal(formatScaledQuantity(2, 2, 7), '7');
  assert.equal(formatScaledQuantity(null, 2, 4), '');
});

test('formatCompactDuration shortens minute and hour labels', () => {
  assert.equal(formatCompactDuration('45 mins'), '45m');
  assert.equal(formatCompactDuration('15 minutes'), '15m');
  assert.equal(formatCompactDuration('1 hr 20 mins'), '1h 20m');
  assert.equal(formatCompactDuration(''), 'N/A');
});

test('scaleNutritionValue preserves suffix and scales numeric macros', () => {
  assert.equal(scaleNutritionValue(450, 1), '450');
  assert.equal(scaleNutritionValue(450, 4), '1800');
  assert.equal(scaleNutritionValue('25g', 3), '75g');
  assert.equal(scaleNutritionValue('12.5 g', 2), '25 g');
  assert.equal(scaleNutritionValue(undefined, 2), '—');
});
