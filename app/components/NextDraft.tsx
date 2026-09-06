"use client";

import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";
import { isDraftWindow, matchdayNumber, nextCloseSeconds } from "@/lib/gameweek";

export function NextDraft() {
  const now = useNowSeconds();

  return (
    <section className="hero-wash relative overflow-hidden rounded-2xl border border-line-800 p-5">
      <p className="relative text-xs font-semibold uppercase tracking-wider text-cyan-400">
        {now === null
          ? " "
          : isDraftWindow(now)
            ? `Matchday ${matchdayNumber(now)} · Team sheets open`
            : `Matchday ${matchdayNumber(now)} · Live`}
      </p>
      <h1 className="relative mt-1.5 text-[26px] font-bold leading-[1.15] tracking-tight">
        Fantasy football, except the players are real stocks.
      </h1>
      <p className="relative mt-2.5 text-sm leading-relaxed text-chalk-300">
        Pick five in a 1-2-2, name a captain, and they are bought into your own wallet on Base. Every
        percent they move is ten points. Twenty-four hours, then the pot pays the top three.
      </p>

      <div className="relative mt-5 flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Settles in</span>
        <span className="tnum font-mono text-sm text-chalk-100">
          {now === null ? "—" : countdown(nextCloseSeconds(now), now)}
        </span>
      </div>
    </section>
  );
}
