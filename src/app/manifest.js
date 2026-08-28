export default function manifest() {
  return {
    name: 'Cheffone - AI Recipe Parser & Social Kitchen',
    short_name: 'Cheffone',
    description:
      'Paste TikTok and Instagram links to instantly parse ingredients, instructions, nutritional facts, and cook with friends.',
    start_url: '/',
    display: 'standalone',
    background_color: '#faf9f6',
    theme_color: '#d9381e',
    orientation: 'portrait-primary',
    scope: '/',
    id: '/',
    categories: ['food', 'lifestyle', 'productivity', 'utilities'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
    shortcuts: [
      {
        name: 'Scan Recipe',
        short_name: 'Scan',
        description: 'Scan a recipe from TikTok or Instagram',
        url: '/?action=scan',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Saved Recipes',
        short_name: 'Recipes',
        description: 'View your saved kitchen recipes',
        url: '/?action=recipes',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Kitchen Chat',
        short_name: 'Chat',
        description: 'Chat and cook with friends',
        url: '/?action=chat',
        icons: [{ src: '/icon-192x192.png', sizes: '192x192' }],
      },
    ],
  };
}
