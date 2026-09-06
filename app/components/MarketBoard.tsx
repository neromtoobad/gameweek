"use client";

import { useQuery } from "@tanstack/react-query";
import { marketState, readQuotes } from "@/lib/prices";
import { readDexQuotes } from "@/lib/pools";
import { LISTINGS } from "@/lib/tokens";
import { positionOf, type Position } from "@/lib/squad";
import { ago } from "@/lib/format";
import { KitTile } from "./KitTile";

/**
 * The board: every listed stock as a player card.
 *
 * Priced from Chainlink, with the pool's gap against that close on each card. The feeds run 24/5
 * and hold the last close when US markets are shut, which is exactly the window this game is built
 * around, so the board says so rather than hiding it.
 */
const POSITION_ORDER: Record<Position, number> = { GK: 0, DEF: 1, FWD: 2 };

export function MarketBoard() {
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => readQuotes(), refetchInterval: 60_000 });
  const dex = useQuery({ queryKey: ["dex"], queryFn: () => readDexQuotes(), refetchInterval: 60_000 });

  const state = quotes.data && quotes.data.length > 0 ? marketState(quotes.data) : null;
  const closeByTicker = new Map((quotes.data ?? []).map((q) => [q.listing.ticker, q]));
  const gapByTicker = new Map(
    (dex.data ?? []).map((d) => {
      const close = closeByTicker.get(d.listing.ticker)?.price;
      const closeUsd6 = close ? close / 100n : null;
      const gap = closeUsd6 && closeUsd6 > 0n ? Number(((d.price - closeUsd6) * 10_000n) / closeUsd6) : null;
      return [d.listing.ticker, gap];
    }),
  );

  // Keepers, then defenders, then forwards, the way a team sheet reads. Anything that cannot be
  // fielded goes to the end rather than sitting between two shirts that can.
  const cards = [...(quotes.data ?? [])].sort(
    (a, b) =>
      Number(!a.listing.live) - Number(!b.listing.live) ||
      POSITION_ORDER[positionOf(a.listing.ticker)] - POSITION_ORDER[positionOf(b.listing.ticker)] ||
      a.listing.name.localeCompare(b.listing.name),
  );

  return (
    <section id="board" className="rise" style={{ ["--i" as string]: 3 }}>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="kicker whitespace-nowrap">Priced from Chainlink</p>
          <h2 className="hed mt-1 whitespace-nowrap text-[34px]">The board</h2>
        </div>
        {state && (
          <span className="hed flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-1 text-right text-[12px] tracking-[0.1em] text-chalk-500">
            {state.open ? (
              <>
                <span className="live-dot h-2 w-2 rounded-full bg-volt" />
                <span className="text-volt">Live</span>
              </>
            ) : (
              <>Friday close · {ago(state.youngest)}</>
            )}
          </span>
        )}
      </div>

      {quotes.isPending ? (
        <div className="grid grid-cols-2 gap-3">
          {LISTINGS.slice(0, 6).map((l) => (
            <div key={l.ticker} className="h-[196px] animate-pulse rounded-2xl border border-line-800 bg-deep-900" />
          ))}
        </div>
      ) : quotes.isError || (quotes.data?.length ?? 0) === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-800 px-4 py-8 text-center text-sm text-chalk-500">
          No prices right now.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {cards.map(({ listing, price }, i) => (
            <div key={listing.ticker} className="rise" style={{ ["--i" as string]: 4 + i }}>
              <KitTile
                listing={listing}
                price={price}
                gapBps={gapByTicker.get(listing.ticker) ?? null}
                muted={!listing.live}
              />
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-chalk-500">
        The chip is the gap between what a stock trades for on Base right now and where it closed on
        Friday. Three listings have nothing minted, so nothing can be traded into them.
      </p>
    </section>
  );
}
