"use client";

import { useQuery } from "@tanstack/react-query";
import { marketState, readQuotes } from "@/lib/prices";
import { LISTINGS } from "@/lib/tokens";
import { ago, sharePrice } from "@/lib/format";
import { BrandMark } from "./BrandMark";

/**
 * The 13 listed stocks with live Chainlink prices.
 *
 * The feeds run 24/5. When US markets are shut they hold the last close, which is exactly the
 * window Gameweek is built around, so the board says so rather than hiding it.
 */
export function MarketBoard() {
  const quotes = useQuery({
    queryKey: ["quotes"],
    queryFn: () => readQuotes(),
    refetchInterval: 60_000,
  });

  // With no quotes at all there is no market state to report, only an empty board.
  const state = quotes.data && quotes.data.length > 0 ? marketState(quotes.data) : null;

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-chalk-300">The board</h2>
        {state && (
          <span className="text-xs text-chalk-500">
            {state.open ? (
              <span className="text-up">Market open</span>
            ) : (
              <>Holding Friday close · {ago(state.youngest)}</>
            )}
          </span>
        )}
      </div>

      <ul className="divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800 bg-pitch-900/60">
        {quotes.isPending &&
          LISTINGS.map((l) => (
            <li key={l.ticker} className="flex h-[58px] items-center px-4">
              <div className="h-3 w-24 animate-pulse rounded bg-line-800" />
            </li>
          ))}

        {quotes.data?.map(({ listing, price }) => (
          <li key={listing.ticker} className="flex items-center justify-between px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandMark ticker={listing.ticker} size={20} color="var(--color-chalk-300)" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{listing.name}</p>
                <p className="font-mono text-xs text-chalk-500">{listing.ticker}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="tnum font-semibold">{sharePrice(price)}</p>
              {!listing.live && (
                <p className="text-[11px] text-chalk-500">not minted yet</p>
              )}
            </div>
          </li>
        ))}

        {(quotes.isError || quotes.data?.length === 0) && (
          <li className="px-4 py-6 text-center text-sm text-chalk-500">
            No prices right now.
          </li>
        )}
      </ul>

      <p className="mt-2 text-[11px] leading-relaxed text-chalk-500">
        Prices from Chainlink equity feeds on Base. Three listings have no supply yet, so nothing can
        be traded into them.
      </p>
    </section>
  );
}
