const URL_IN_TEXT_REGEX = /https?:\/\/[^\s]+/i;

function isInstagramUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'instagram.com' || host.endsWith('.instagram.com') || host === 'instagr.am';
  } catch {
    return false;
  }
}

/**
 * Parse launch query parameters from PWA shortcuts (`?action=scan|recipes|chat`)
 * and OS Web Share Target payloads (`?url=...&text=...&title=...`).
 */
export function parseLaunchIntent(search) {
  if (!search) return null;

  const params = new URLSearchParams(search);
  const action = params.get('action');

  if (action === 'scan') {
    return { type: 'open_scan' };
  }
  if (action === 'recipes') {
    return { type: 'open_recipes' };
  }
  if (action === 'chat') {
    return { type: 'open_chat' };
  }

  const sharedUrl = (params.get('url') || '').trim();
  const sharedText = (params.get('text') || '').trim();
  const sharedTitle = (params.get('title') || '').trim();

  if (!sharedUrl && !sharedText && !sharedTitle) {
    return null;
  }

  const candidateUrl = sharedUrl || sharedText.match(URL_IN_TEXT_REGEX)?.[0] || '';

  if (candidateUrl) {
    return {
      type: 'share_import',
      scanTab: isInstagramUrl(candidateUrl) ? 'text' : 'link',
      url: candidateUrl,
      rawText: isInstagramUrl(candidateUrl) && sharedText && sharedText !== candidateUrl ? sharedText : '',
    };
  }

  const combinedText = [sharedTitle, sharedText].filter(Boolean).join('\n\n').trim();
  if (!combinedText) return null;

  return {
    type: 'share_import',
    scanTab: 'text',
    url: '',
    rawText: combinedText,
  };
}
