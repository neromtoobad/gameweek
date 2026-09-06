"use client";

import { Jersey } from "./Jersey";
import { kitFor, POSITION_LABEL, positionOf } from "@/lib/squad";
import { sharePrice } from "@/lib/format";
import type { Listing } from "@/lib/tokens";

/**
 * One stock as a player card.
 *
 * A fantasy game sells you the player, not the row in a table. The shirt is the hero, the tile is
 * tinted with the kit's own colour so twelve of them read as twelve clubs rather than one list, and
 * the gap sits as a chip because it is the one number that changes every time you look.
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
      className={`kit-tile lift relative flex flex-col overflow-hidden rounded-2xl border p-3 ${
        muted ? "opacity-55" : ""
      }`}
      style={{ ["--kit" as string]: kit.primary, transition: "transform 200ms var(--ease-out-soft)" }}
    >
      <div className="flex items-start justify-between">
        <span className="rounded-md bg-deep-950/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-chalk-300">
          {POSITION_LABEL[position]}
        </span>
        {gap !== null && !muted && (
          <span
            className={`tnum rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
              gap < 0 ? "bg-up/15 text-up" : gap > 0 ? "bg-down/15 text-down" : "bg-deep-800 text-chalk-300"
            }`}
          >
            {gap > 0 ? "+" : ""}
            {(gap / 100).toFixed(2)}%
          </span>
        )}
        {muted && (
          <span className="rounded-md bg-deep-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-chalk-500">
            not minted
          </span>
        )}
      </div>

      <div className="mx-auto my-2.5" style={{ filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.4))" }}>
        <Jersey ticker={listing.ticker} size={84} />
      </div>

      <div className="mt-auto">
        <p className="truncate text-[15px] font-bold leading-tight">{listing.name}</p>
        <div className="mt-0.5 flex items-baseline justify-between">
          <span className="font-mono text-[11px] text-chalk-500">{listing.ticker}</span>
          <span className="tnum text-sm font-semibold">{sharePrice(price)}</span>
        </div>
      </div>
    </div>
  );
}
