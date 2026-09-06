"use client";

import { logoFor } from "@/lib/logos";

/**
 * A company's own logo.
 *
 * Inlined as a vector, so the same mark is sharp on a 52px shirt and on a 1200px share card, and no
 * part of the pitch waits on an image host. Rendered in a single colour, the way a real kit prints
 * a sponsor: full-colour marks turn to mush at shirt size and fight the kit they sit on.
 */
export function BrandMark({
  ticker,
  size = 16,
  color = "currentColor",
  className,
}: {
  ticker: string;
  size?: number;
  color?: string;
  className?: string;
}) {
  const logo = logoFor(ticker);
  if (!logo) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={logo.title}
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path d={logo.path} fill={color} />
    </svg>
  );
}
