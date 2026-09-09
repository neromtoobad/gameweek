import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "@/components/Providers";
import { MiniAppReady } from "@/components/MiniAppReady";
import { TabBar } from "@/components/TabBar";
import { APP_URL, BASE_APP_ID } from "@/lib/config";
import "./globals.css";

// A tall condensed face for names and scores, a quiet sans for everything else, and a mono for
// tickers and addresses. The condensed face is what makes a number look like a scoreline. Both are
// served from this repo rather than fetched from Google at build time, so a demo never waits on a
// font host and a build never fails because one was unreachable.
const display = localFont({
  src: "./fonts/BigShoulders.woff2",
  variable: "--font-big-shoulders",
  weight: "100 900",
  display: "swap",
});
const sans = localFont({
  src: "./fonts/Manrope.woff2",
  variable: "--font-manrope",
  weight: "200 800",
  display: "swap",
});
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gameweek",
  description:
    "A daily fantasy league where the players are real Coinbase Tokenized Stocks on Base. Pick five, name a captain, settle in 24 hours.",
  // Renders <meta name="base:app_id"> on every page, which is how Base App recognises the site as a
  // registered app and attributes it on the weekly leaderboards.
  other: {
    "base:app_id": BASE_APP_ID,
    // Lets a shared link open as a mini app instead of a plain web page.
    "fc:miniapp": JSON.stringify({
      version: "1",
      imageUrl: `${APP_URL}/opengraph-image`,
      button: {
        title: "Pick your side",
        action: { type: "launch_miniapp", name: "Gameweek", url: APP_URL },
      },
    }),
  },
};

export const viewport: Viewport = {
  themeColor: "#08080b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
        <Providers>
          <MiniAppReady />
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:max-w-6xl">{children}</div>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
