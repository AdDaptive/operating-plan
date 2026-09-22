import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "AdDaptive OS",
  description: "Objectives, key results, and tasks in one place.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  // iOS ignores manifest.json for a lot of this -- these meta tags are what
  // actually makes "Add to Home Screen" open full-screen (no Safari chrome)
  // with the right title, rather than just bookmarking the page.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AdDaptive OS",
  },
};

// A separate `viewport` export (not part of `metadata`) is what Next 14's
// App Router wants this in. `viewportFit: "cover"` plus `themeColor` are
// what let the installed app's status bar/home-indicator area blend with
// the UI instead of showing as a plain white/black bar, and are also what
// makes the `env(safe-area-inset-*)` CSS in MobileNav.tsx meaningful.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4338CA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
