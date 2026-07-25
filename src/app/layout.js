import "./globals.css";
import { AuthProvider } from "@/lib/authContext";

export const metadata = {
  title: "Cheffone - AI Recipe Parser & Social Kitchen",
  description:
    "Paste TikTok and Instagram links to instantly parse ingredients, instructions, and nutritional facts.",
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: '/icon.png',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
