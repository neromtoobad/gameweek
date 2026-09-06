"use client";

import { useQuery } from "@tanstack/react-query";
import { readQuotes } from "@/lib/prices";
import { readDexQuotes } from "@/lib/pools";
import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";
import { isDraftWindow, matchdayNumber, nextCloseSeconds } from "@/lib/gameweek";

/**
 * The ticker tape along the top of the front page.
 *
 * A stadium has one running along the hoardings and a trading floor has one along the wall. This
 * one carries the matchday, the clock and the weekend gap on every stock, so the page opens on
 * something moving. The queries are the same ones the board uses, so it costs no extra reads.
 */
export function Marquee() {
  const now = useNowSeconds();
  const quotes = useQuery({ queryKey: ["quotes"], queryFn: () => readQuotes(), refetchInterval: 60_000 });
  const dex = useQuery({ queryKey: ["dex"], queryFn: () => readDexQuotes(), refetchInterval: 60_000 });

  const closeByTicker = new Map((quotes.data ?? []).map((q) => [q.listing.ticker, q.price]));
  const gaps = (dex.data ?? []).flatMap((d) => {
    const close = closeByTicker.get(d.listing.ticker);
    if (!close || close === 0n) return [];
    const gap = Number(((d.price - close / 100n) * 10_000n) / (close / 100n)) / 100;
    return [{ ticker: d.listing.ticker.replace(/c$/, ""), gap }];
  });

  const items: { text: string; tone?: "volt" | "up" | "down" }[] = [];
  if (now !== null) {
    items.push({ text: `Matchday ${matchdayNumber(now)}`, tone: "volt" });
    items.push({
      text: isDraftWindow(now)
        ? `Team sheets open · locks in ${countdown(nextCloseSeconds(now), now)}`
        : `Live · settles in ${countdown(nextCloseSeconds(now), now)}`,
    });
  }
  items.push({ text: "Five picks · one captain · ten points a percent" });
  for (const g of gaps) {
    items.push({ text: `${g.ticker} ${g.gap > 0 ? "+" : ""}${g.gap.toFixed(2)}%`, tone: g.gap > 0 ? "down" : g.gap < 0 ? "up" : undefined });
  }
  items.push({ text: "Real stocks · real swaps · your wallet", tone: "volt" });

  const tape = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-line-900 bg-deep-900/70 py-2" aria-hidden>
      <div className="marquee">
        {tape.map((item, i) => (
          <span key={i} className="flex items-center">
            <span
              className={`hed whitespace-nowrap text-[14px] tracking-[0.08em] ${
                item.tone === "volt"
                  ? "text-volt"
                  : item.tone === "up"
                    ? "text-up"
                    : item.tone === "down"
                      ? "text-down"
                      : "text-chalk-300"
              }`}
            >
              {item.text}
            </span>
            <span className="mx-4 inline-block h-1.5 w-1.5 rotate-45 bg-volt/70" />
          </span>
        ))}
      </div>
    </div>
  );
}
