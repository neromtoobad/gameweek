"use client";

import { kitFor } from "@/lib/squad";

/**
 * A stock's shirt.
 *
 * Drawn rather than fetched, so the pitch renders instantly, works offline, and cannot fail
 * mid-demo because an image host is slow. Each kit is the company's own brand colour with the
 * ticker across the front, the way a fantasy football side shows a player.
 */
export function Jersey({ ticker, size = 44 }: { ticker: string; size?: number }) {
  const kit = kitFor(ticker);
  const label = ticker.replace(/c$/, "");
  // Long tickers need to shrink to stay inside the shirt.
  const fontSize = label.length > 4 ? 7.5 : label.length > 3 ? 9 : 10.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${label} shirt`}
      style={{ display: "block" }}
    >
      {/* body and sleeves as one silhouette */}
      <path
        d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
        fill={kit.primary}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
      />
      {/* collar */}
      <path d="M16 7 Q24 12 32 7 L29 6 Q24 9 19 6 Z" fill={kit.secondary} opacity="0.95" />
      {/* a single sleeve stripe, enough to read as a kit without becoming a logo */}
      <path d="M10 10 L5 18 L11 22 L13 19 Z" fill={kit.secondary} opacity="0.55" />
      <path d="M38 10 L43 18 L37 22 L35 19 Z" fill={kit.secondary} opacity="0.55" />
      <text
        x="24"
        y="30"
        textAnchor="middle"
        fontSize={fontSize}
        fontWeight="800"
        fill={kit.text}
        letterSpacing="0.2"
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        {label}
      </text>
    </svg>
  );
}
