"use client";

import Image from "next/image";
import { kitFor, kitImageFor } from "@/lib/squad";
import { BrandMark } from "./BrandMark";
import { logoFor } from "@/lib/logos";

/**
 * A stock's shirt.
 *
 * Every tradeable listing plays in its own kit: a sash, hoops, pinstripes, quarters, halves, a
 * chevron. No two share a pattern, because at 52px on a crowded pitch colour alone will not tell
 * them apart, which is the same reason real clubs do it.
 *
 * The kits are photographed with no lettering at all, so the company's own logo can be printed
 * large across the chest the way a kit carries its sponsor.
 *
 * Anything without a photograph falls back to a drawn shirt, so a newly listed stock still appears
 * on the pitch the moment it is registered rather than leaving a hole.
 */
export function Jersey({
  ticker,
  size = 44,
  priority = false,
}: {
  ticker: string;
  size?: number;
  /** True for the shirts above the fold on the front page, so they are not lazy-loaded. */
  priority?: boolean;
}) {
  const label = ticker.replace(/c$/, "");
  const src = kitImageFor(ticker);

  if (src) {
    return (
      <span style={{ position: "relative", display: "block", width: size, height: size }}>
        <Image
          src={src}
          alt={`${label} shirt`}
          width={size}
          height={size}
          // The pitch never shows these larger than a phone's width, so no source bigger is useful.
          sizes={`${size}px`}
          style={{ display: "block", objectFit: "contain" }}
          priority={priority}
        />
        {/* The mark, printed large across the chest the way a kit carries its sponsor. These kits
            are generated without any lettering precisely so the real logo can own the shirt. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "42%",
            transform: "translate(-50%, -50%)",
            display: "block",
          }}
        >
          <BrandMark ticker={ticker} size={Math.round(size * 0.36)} color={kitFor(ticker).text} />
        </span>
      </span>
    );
  }

  return <DrawnJersey ticker={ticker} size={size} />;
}

/** The brand mark as a bare path, for embedding inside another SVG. */
function BrandMarkPath({ ticker, fill }: { ticker: string; fill: string }) {
  const logo = logoFor(ticker);
  if (!logo) return null;
  return <path d={logo.path} fill={fill} />;
}

/** The fallback: a flat shirt drawn from the kit's colours, for a listing with no photograph. */
function DrawnJersey({ ticker, size }: { ticker: string; size: number }) {
  const kit = kitFor(ticker);
  const label = ticker.replace(/c$/, "");

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
      <g transform="translate(16 18) scale(0.66)">
        <BrandMarkPath ticker={ticker} fill={kit.text} />
      </g>
    </svg>
  );
}
