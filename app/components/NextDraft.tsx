"use client";

import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";
import { gameweekNumber, isDraftWindow, nextCloseSeconds } from "@/lib/gameweek";

export function NextDraft() {
  const now = useNowSeconds();

  return (
    <section className="rounded-2xl border border-line-800 bg-gradient-to-b from-pitch-800 to-pitch-900 p-5">
      <p className="text-xs uppercase tracking-wide text-turf-400">
        {now === null
          ? " "
          : isDraftWindow(now)
            ? `Gameweek ${gameweekNumber(now)} · Draft night`
            : `Gameweek ${gameweekNumber(now)}`}
      </p>
      <h1 className="mt-1 text-2xl font-semibold leading-tight">
        Fantasy football, except the picks are real stocks.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-chalk-300">
        Draft three from the board. They are bought into your own wallet on Base. A leaderboard ranks
        your league all week and the pot pays the top three.
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Settles in</span>
        <span className="tnum font-mono text-sm text-chalk-100">
          {now === null ? "—" : countdown(nextCloseSeconds(now), now)}
        </span>
      </div>
    </section>
  );
}
