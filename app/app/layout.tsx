import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { BASE_APP_ID } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Gameweek",
  description:
    "A daily fantasy league where the players are real Coinbase Tokenized Stocks on Base. Pick five, name a captain, settle in 24 hours.",
  // Renders <meta name="base:app_id"> on every page, which is how Base App recognises the site as a
  // registered app and attributes it on the weekly leaderboards.
  other: { "base:app_id": BASE_APP_ID },
};

export const viewport: Viewport = {
  themeColor: "#06110c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
