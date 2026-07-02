import "./globals.css";
import { AuthProvider } from "@/lib/authContext";

export const metadata = {
  title: "Cheffone",
  description:
    "Paste TikTok and Instagram links to instantly parse ingredients, instructions, and nutritional facts.",
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
