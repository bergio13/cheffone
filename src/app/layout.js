import "./globals.css";
import { AuthProvider } from "@/lib/authContext";

export const viewport = {
  themeColor: '#d9381e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata = {
  title: "Cheffone - AI Recipe Parser & Social Kitchen",
  description:
    "Paste TikTok and Instagram links to instantly parse ingredients, instructions, and nutritional facts.",
  applicationName: "Cheffone",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cheffone",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
