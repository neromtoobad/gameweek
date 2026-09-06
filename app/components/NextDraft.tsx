"use client";

import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";

/**
 * The weekly rhythm, stated plainly.
 *
 * A league locks and settles at the Friday US close, 21:00 UTC. Between that close and Monday's
 * open the equity feeds hold their last price while Base keeps trading, which is the window the
 * whole product is built around, and the reason draft night is Sunday.
 */
function nextFridayCloseSeconds(nowSeconds: number): number {
  const target = new Date(nowSeconds * 1000);
  target.setUTCHours(21, 0, 0, 0);
  const daysUntilFriday = (5 - target.getUTCDay() + 7) % 7;
  target.setUTCDate(target.getUTCDate() + daysUntilFriday);
  let seconds = Math.floor(target.getTime() / 1000);
  if (seconds <= nowSeconds) seconds += 7 * 86400;
  return seconds;
}

export function NextDraft() {
  const now = useNowSeconds();
  const day = now === null ? null : new Date(now * 1000).getUTCDay();
  const isWeekend = day === 0 || day === 6;

  return (
    <section className="rounded-2xl border border-line-800 bg-gradient-to-b from-pitch-800 to-pitch-900 p-5">
      <p className="text-xs uppercase tracking-wide text-turf-400">
        {isWeekend ? "Draft night" : "This week"}
      </p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight">
        Fantasy football, except the picks are real stocks.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-chalk-300">
        Draft three from the board. They are bought into your own wallet on Base. A leaderboard ranks
        your league all week and the pot pays the top three.
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Next settlement</span>
        <span className="tnum font-mono text-sm text-chalk-100">
          {now === null ? "—" : countdown(nextFridayCloseSeconds(now), now)}
        </span>
      </div>
    </section>
  );
}
