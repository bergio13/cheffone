import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLaunchIntent } from './shareIntent.js';

test('returns null when search is empty or unrelated', () => {
  assert.equal(parseLaunchIntent(''), null);
  assert.equal(parseLaunchIntent('?foo=bar'), null);
});

test('handles PWA manifest shortcut actions', () => {
  assert.deepEqual(parseLaunchIntent('?action=scan'), { type: 'open_scan' });
  assert.deepEqual(parseLaunchIntent('?action=recipes'), { type: 'open_recipes' });
  assert.deepEqual(parseLaunchIntent('?action=chat'), { type: 'open_chat' });
});

test('extracts direct TikTok URL from share_target url param', () => {
  assert.deepEqual(
    parseLaunchIntent('?url=https%3A%2F%2Fwww.tiktok.com%2F%40chef%2Fvideo%2F123'),
    {
      type: 'share_import',
      scanTab: 'link',
      url: 'https://www.tiktok.com/@chef/video/123',
      rawText: '',
    }
  );
});

test('extracts TikTok URL embedded inside Android share_target text param', () => {
  assert.deepEqual(
    parseLaunchIntent('?text=Look%20at%20this%20https%3A%2F%2Fvm.tiktok.com%2FZGe123%2F'),
    {
      type: 'share_import',
      scanTab: 'link',
      url: 'https://vm.tiktok.com/ZGe123/',
      rawText: '',
    }
  );
});

test('routes Instagram shared URLs to text tab and preserves extra caption text', () => {
  assert.deepEqual(
    parseLaunchIntent('?url=https%3A%2F%2Fwww.instagram.com%2Freel%2Fabc123%2F&text=Pasta%20ingredients'),
    {
      type: 'share_import',
      scanTab: 'text',
      url: 'https://www.instagram.com/reel/abc123/',
      rawText: 'Pasta ingredients',
    }
  );
});

test('falls back to rawText when shared payload has no URL', () => {
  assert.deepEqual(
    parseLaunchIntent('?title=Grandma%20Pasta&text=200g%20flour%2C%202%20eggs'),
    {
      type: 'share_import',
      scanTab: 'text',
      url: '',
      rawText: 'Grandma Pasta\n\n200g flour, 2 eggs',
    }
  );
});
