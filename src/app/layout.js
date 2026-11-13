import { Plus_Jakarta_Sans, Lilita_One } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#d9381e' },
    { media: '(prefers-color-scheme: dark)', color: '#141210' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
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
  other: {
    'mobile-web-app-capable': 'yes',
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

const fontSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans-loaded',
  display: 'swap',
});

const fontDisplay = Lilita_One({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display-loaded',
  display: 'swap',
});

// Runs before paint to avoid a theme flash.
const themeInit = `try{var t=localStorage.getItem('cheffone_theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontDisplay.variable}`} suppressHydrationWarning>
      <body>
        <AuthProvider>{children}</AuthProvider>
        <Script
          id="cheffone-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInit }}
        />
      </body>
    </html>
  );
}
