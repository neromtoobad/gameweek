"use client";

import Image from "next/image";
import { kitFor, kitImageFor } from "@/lib/squad";

/**
 * A stock's shirt.
 *
 * Every tradeable listing has a photographed kit in its company's colours with the ticker across
 * the chest. Shirts rather than logos: it is what fantasy football actually shows, and it keeps
 * company marks out of artwork we made.
 *
 * Anything without a photograph falls back to a drawn shirt, so a newly listed stock still appears
 * on the pitch the moment it is registered, rather than leaving a hole until someone shoots a kit.
 */
export function Jersey({ ticker, size = 44 }: { ticker: string; size?: number }) {
  const label = ticker.replace(/c$/, "");
  const src = kitImageFor(ticker);

  if (src) {
    return (
      <Image
        src={src}
        alt={`${label} shirt`}
        width={size}
        height={size}
        // The pitch never shows these larger than a phone's width, so no source bigger is useful.
        sizes={`${size}px`}
        style={{ display: "block", objectFit: "contain" }}
        priority={false}
      />
    );
  }

  return <DrawnJersey ticker={ticker} size={size} />;
}

/** The fallback: a flat shirt drawn from the kit's colours, for a listing with no photograph. */
function DrawnJersey({ ticker, size }: { ticker: string; size: number }) {
  const kit = kitFor(ticker);
  const label = ticker.replace(/c$/, "");
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
      <path
        d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
        fill={kit.primary}
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="0.8"
      />
      <path d="M16 7 Q24 12 32 7 L29 6 Q24 9 19 6 Z" fill={kit.secondary} opacity="0.95" />
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
