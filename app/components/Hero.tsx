"use client";

import Link from "next/link";
import { useNowSeconds } from "@/lib/useNow";
import { countdown } from "@/lib/format";
import { isDraftWindow, matchdayNumber, nextCloseSeconds } from "@/lib/gameweek";
import { Jersey } from "./Jersey";

/** Three kits fanned like cards on a table. The strongest colours in the set, and one of each position. */
const FAN: { ticker: string; rotate: number; x: number; y: number; z: number }[] = [
  { ticker: "TSLAc", rotate: -16, x: -66, y: 14, z: 1 },
  { ticker: "NVDAc", rotate: 0, x: 0, y: 0, z: 3 },
  { ticker: "AAPLc", rotate: 16, x: 66, y: 14, z: 2 },
];

/**
 * The front door: a stadium at night, three real kits, and the one sentence that explains the game.
 *
 * The headline is set the way a matchday poster sets it, tall and upper case, with the two words
 * that matter picked out in volt.
 */
export function Hero() {
  const now = useNowSeconds();

  return (
    <section
      className="rise relative"
      style={{ filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.55))" }}
    >
      <div className="stadium-hero cut relative overflow-hidden px-5 pb-6 pt-7">
        <div className="relative mx-auto h-[150px] w-[260px]">
          {FAN.map((k) => (
            <div
              key={k.ticker}
              className="lift absolute left-1/2 top-0"
              style={{
                transform: `translateX(calc(-50% + ${k.x}px)) translateY(${k.y}px) rotate(${k.rotate}deg)`,
                zIndex: k.z,
                transition: "transform 200ms var(--ease-out-soft)",
                filter: "drop-shadow(0 16px 24px rgba(0,0,0,0.6))",
              }}
            >
              <Jersey ticker={k.ticker} size={124} priority />
            </div>
          ))}
        </div>

        <p className="kicker relative mt-5">
          {now === null
            ? "Matchday"
            : isDraftWindow(now)
              ? `Matchday ${matchdayNumber(now)} · Team sheets open`
              : `Matchday ${matchdayNumber(now)} · Live`}
        </p>

        <h1 className="hed relative mt-3 text-display">
          Fantasy
          <br />
          football,
          <br />
          except the
          <br />
          players are
          <br />
          <span className="text-volt">real stocks.</span>
        </h1>

        <p className="relative mt-4 max-w-[34ch] text-[15px] leading-relaxed text-chalk-300">
          Pick five in a 1-2-2, name a captain, and they are bought into your own wallet on Base.
          Every percent they move is ten points.
        </p>

        <div className="relative mt-5 flex items-center gap-4">
          <Link
            href="/draft"
            className="btn cut-sm inline-flex items-center gap-2 bg-volt px-5 py-3 hed text-[19px] text-deep-950 hover:bg-volt-600"
          >
            Pick your side
            <span aria-hidden>→</span>
          </Link>
          <div className="leading-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-500">
              {now !== null && isDraftWindow(now) ? "Locks in" : "Settles in"}
            </p>
            <p className="num mt-1 text-[26px] text-chalk-100">
              {now === null ? "—" : countdown(nextCloseSeconds(now), now)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
