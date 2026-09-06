"use client";

import Link from "next/link";
import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";
import { isDraftWindow, matchdayNumber, nextCloseSeconds } from "@/lib/gameweek";
import { Jersey } from "./Jersey";

/** Three kits fanned like cards on a table. The strongest colours in the set, and one of each position. */
const FAN: { ticker: string; rotate: number; x: number; y: number; z: number }[] = [
  { ticker: "TSLAc", rotate: -14, x: -58, y: 10, z: 1 },
  { ticker: "NVDAc", rotate: 0, x: 0, y: 0, z: 3 },
  { ticker: "AAPLc", rotate: 14, x: 58, y: 10, z: 2 },
];

/**
 * The front door.
 *
 * A fantasy game's front page shows you the players, not a paragraph about them. Three real kits
 * fanned out say "this is a squad game about stocks" faster than any sentence, and the sentence
 * underneath only has to confirm it.
 */
export function Hero() {
  const now = useNowSeconds();

  return (
    <section className="hero-wash rise relative overflow-hidden rounded-3xl border border-line-800 px-5 pb-6 pt-7">
      <div className="relative mx-auto h-[128px] w-[240px]">
        {FAN.map((k) => (
          <div
            key={k.ticker}
            className="lift absolute left-1/2 top-0"
            style={{
              transform: `translateX(calc(-50% + ${k.x}px)) translateY(${k.y}px) rotate(${k.rotate}deg)`,
              zIndex: k.z,
              transition: "transform 200ms var(--ease-out-soft)",
              filter: "drop-shadow(0 14px 22px rgba(0,0,0,0.45))",
            }}
          >
            <Jersey ticker={k.ticker} size={112} priority />
          </div>
        ))}
      </div>

      <p className="relative mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-400">
        {now === null
          ? " "
          : isDraftWindow(now)
            ? `Matchday ${matchdayNumber(now)} · Team sheets open`
            : `Matchday ${matchdayNumber(now)} · Live`}
      </p>

      <h1 className="relative mt-2 text-display">
        Fantasy football, except the players are real stocks.
      </h1>

      <p className="relative mt-3 max-w-[34ch] text-[15px] leading-relaxed text-chalk-300">
        Pick five in a 1-2-2, name a captain, and they are bought into your own wallet on Base.
        Every percent they move is ten points.
      </p>

      <div className="relative mt-5 flex items-center gap-3">
        <Link
          href="/draft"
          className="btn rounded-xl bg-base-500 px-5 py-3 text-[15px] font-bold text-white shadow-lg shadow-base-500/30 hover:bg-base-400"
        >
          Pick your side
        </Link>
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="text-chalk-500">Settles in</span>
          <span className="tnum font-mono font-semibold text-chalk-100">
            {now === null ? "—" : countdown(nextCloseSeconds(now), now)}
          </span>
        </div>
      </div>
    </section>
  );
}
