import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Lounge",
  description: "private floors. loud rooms.",
  applicationName: "The Lounge",
  appleWebApp: { capable: true, title: "The Lounge", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121214",
};

const accent = process.env.NEXT_PUBLIC_LOUNGE_ACCENT;
const accentCss = accent && /^#[0-9a-f]{3,8}$/i.test(accent) ? `:root{--lounge-accent:${accent}}` : "";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>{accentCss ? <style>{accentCss}</style> : null}</head>
      <body>{children}</body>
    </html>
  );
}
