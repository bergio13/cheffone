import "./globals.css";

export const metadata = {
  title: "Cheffone — AI Recipe Parser from Social Videos",
  description: "Paste TikTok and Instagram links to instantly parse ingredients, instructions, nutritional facts, and generate beautiful recipe sketches.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
