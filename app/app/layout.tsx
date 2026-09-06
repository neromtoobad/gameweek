import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sunday League",
  description:
    "A weekly fantasy league where the picks are real Coinbase Tokenized Stocks on Base. Draft on Sunday, settle on Friday.",
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
