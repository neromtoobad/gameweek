"use client";

import { Jersey } from "./Jersey";
import { kitFor, POSITION_LABEL, positionOf } from "@/lib/squad";
import { sharePrice } from "@/lib/format";
import type { Listing } from "@/lib/tokens";

/**
 * One stock as a player card.
 *
 * A fantasy game sells you the player, not the row in a table. The shirt is the hero, the tile is
 * tinted with the kit's own colour so twelve of them read as twelve clubs rather than one list, the
 * corners are cut like a sticker, and the gap sits as a chip because it is the one number that
 * changes every time you look.
 */
export function KitTile({
  listing,
  price,
  gapBps,
  muted = false,
}: {
  listing: Listing;
  /** Chainlink close, 8 decimals. */
  price: bigint;
  /** Pool price against the close, in basis points. Null when there is no pool. */
  gapBps?: number | null;
  /** True for a listing with nothing minted, which cannot be fielded. */
  muted?: boolean;
}) {
  const kit = kitFor(listing.ticker);
  const position = positionOf(listing.ticker);
  const gap = gapBps ?? null;

  return (
    <div
      className={`lift h-full ${muted ? "opacity-50" : ""}`}
      style={{ filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.45))", transition: "transform 200ms var(--ease-out-soft)" }}
    >
      <div
        className="kit-tile cut-sm relative flex h-full flex-col overflow-hidden border p-3"
        style={{ ["--kit" as string]: kit.primary }}
      >
        <div className="flex items-start justify-between">
          <span className="hed rounded-sm bg-deep-950/70 px-1.5 py-0.5 text-[11px] tracking-[0.08em] text-chalk-300">
            {POSITION_LABEL[position]}
          </span>
          {gap !== null && !muted && (
            <span
              className={`num rounded-sm px-1.5 py-0.5 text-[13px] ${
                gap < 0 ? "bg-up/15 text-up" : gap > 0 ? "bg-down/15 text-down" : "bg-deep-800 text-chalk-300"
              }`}
            >
              {gap > 0 ? "+" : ""}
              {(gap / 100).toFixed(2)}%
            </span>
          )}
          {muted && (
            <span className="hed rounded-sm bg-deep-950/70 px-1.5 py-0.5 text-[11px] tracking-[0.08em] text-chalk-500">
              not minted
            </span>
          )}
        </div>

        <div className="mx-auto my-2.5" style={{ filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.5))" }}>
          <Jersey ticker={listing.ticker} size={88} />
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="hed truncate text-[24px] leading-none">{listing.ticker.replace(/c$/, "")}</p>
            <p className="mt-1 truncate text-[11px] text-chalk-500">{listing.name}</p>
          </div>
          <span className="num shrink-0 text-[17px]">{sharePrice(price)}</span>
        </div>
      </div>
    </div>
  );
}
