import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DISH_BACKDROPS,
  DISH_VISUAL_VERSION,
  needsDishVisualBackfill,
  pickBackdropForTitle,
  resolveDishVisual,
  sanitizeDishVisual,
} from './dishVisual.js';

const SAMPLE_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/';

test('uses valid v3 title-matched AI image dishVisual when present', () => {
  const res = resolveDishVisual({
    title: 'Crispy Korean Cauliflower',
    dishVisual: {
      version: DISH_VISUAL_VERSION,
      forTitle: 'Crispy Korean Cauliflower',
      backdrop: '#d9381e',
      imageUrl: SAMPLE_IMAGE,
    },
  });
  assert.equal(res.backdrop, '#d9381e');
  assert.equal(res.imageUrl, SAMPLE_IMAGE);
});

test('marks legacy SVG v1/v2, empty imageUrl, and renamed titles for retroactive backfill', () => {
  const legacyV2 = {
    title: 'Spicy Tuna Bowl',
    dishVisual: { version: 2, forTitle: 'Spicy Tuna Bowl', dishKey: 'salmon', backdrop: '#f8d4cc' },
  };
  assert.equal(needsDishVisualBackfill(legacyV2), true);
  assert.equal(resolveDishVisual(legacyV2).imageUrl, null);

  const renamed = {
    title: 'Double Smash Cheeseburger',
    dishVisual: {
      version: DISH_VISUAL_VERSION,
      forTitle: 'Old Salad',
      backdrop: '#d7eadc',
      imageUrl: SAMPLE_IMAGE,
    },
  };
  assert.equal(needsDishVisualBackfill(renamed), true);
  assert.equal(resolveDishVisual(renamed).imageUrl, null);

  const badUrl = {
    title: 'Double Smash Cheeseburger',
    dishVisual: {
      version: DISH_VISUAL_VERSION,
      forTitle: 'Double Smash Cheeseburger',
      backdrop: '#d9381e',
      imageUrl: 'https://cdn.example.com/thumbnail.jpg',
    },
  };
  assert.equal(needsDishVisualBackfill(badUrl), true);

  const fresh = {
    title: 'Double Smash Cheeseburger',
    dishVisual: {
      version: DISH_VISUAL_VERSION,
      forTitle: 'Double Smash Cheeseburger',
      backdrop: '#d9381e',
      imageUrl: SAMPLE_IMAGE,
    },
  };
  assert.equal(needsDishVisualBackfill(fresh), false);
});

test('sanitizeDishVisual validates backdrop and data:image URL', () => {
  const clean = sanitizeDishVisual(
    { backdrop: '#000000', imageUrl: 'https://evil.example/img.png' },
    'Matcha Tiramisu Cake'
  );
  assert.equal(clean.version, DISH_VISUAL_VERSION);
  assert.equal(clean.forTitle, 'Matcha Tiramisu Cake');
  assert.ok(DISH_BACKDROPS.includes(clean.backdrop));
  assert.equal(clean.imageUrl, undefined);

  const withDataUrl = sanitizeDishVisual(
    { backdrop: '#fbe4c8', imageUrl: SAMPLE_IMAGE },
    'Matcha Tiramisu Cake'
  );
  assert.equal(withDataUrl.backdrop, '#fbe4c8');
  assert.equal(withDataUrl.imageUrl, SAMPLE_IMAGE);
});

test('picks deterministic warm bistro backdrops by recipe title', () => {
  const b1 = pickBackdropForTitle('Gourmet Crispy Potato & Omelet');
  const b2 = pickBackdropForTitle('Gourmet Crispy Potato & Omelet');
  assert.equal(b1, b2);
  assert.ok(DISH_BACKDROPS.includes(b1));
});
