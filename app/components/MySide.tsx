"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { readSide } from "@/lib/side";
import { useSquad } from "@/lib/useSquad";
import { FORMATION, type Position } from "@/lib/squad";
import { formatPoints, pointsFromScore } from "@/lib/points";
import { usd } from "@/lib/format";
import { Pitch, type PitchSlot } from "./Pitch";

/** Keeper at the back, then the two defenders, then the two forwards. */
const SLOT_ORDER: Position[] = ["GK", "DEF", "DEF", "FWD", "FWD"];

/**
 * The player's own side, live.
 *
 * Everything here is read from the wallet, so it is true even for someone who traded outside the
 * app. The team's points come from the same NAV ratio the contract settles on. The per-shirt
 * breakdown needs an entry price, which only this browser has, so it degrades to a plain team sheet
 * on another device rather than showing a number it cannot stand behind.
 */
export function MySide({
  wallet,
  scoreBps,
  heading = "Your side",
  onBack,
}: {
  wallet: `0x${string}`;
  /** The player's league score, once the round has locked. */
  scoreBps: number | null;
  heading?: string;
  /** Present when looking at somebody else's side. */
  onBack?: () => void;
}) {
  const stored = useSquad(wallet);

  const side = useQuery({
    queryKey: ["side", wallet, stored?.boughtAt ?? 0],
    queryFn: () => readSide(wallet, stored),
    refetchInterval: 30_000,
  });

  if (side.isPending) {
    return <div className="h-[360px] animate-pulse rounded-3xl border border-line-800 bg-deep-900/60" />;
  }

  const holdings = side.data?.holdings ?? [];

  if (holdings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line-800 px-4 py-6 text-center">
        <p className="text-sm text-chalk-300">
          {onBack ? "This player has not picked a side yet." : "You have not picked a side yet."}
        </p>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="mt-3 text-xs text-chalk-500 transition hover:text-chalk-300"
          >
            back to yours
          </button>
        ) : (
          <Link
            href="/draft"
            className="mt-3 inline-block rounded-xl bg-base-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-base-400"
          >
            Pick your side
          </Link>
        )}
      </div>
    );
  }

  // Slot holdings into the formation by position. Anything that does not fit, because a wallet can
  // hold whatever it likes, is listed underneath rather than hidden.
  const byPosition: Record<Position, typeof holdings> = { GK: [], DEF: [], FWD: [] };
  for (const h of holdings) byPosition[h.position].push(h);

  const used = new Set<string>();
  const slots: PitchSlot[] = SLOT_ORDER.map((position) => {
    const next = byPosition[position].find((h) => !used.has(h.ticker));
    if (!next) return { position, ticker: null };
    used.add(next.ticker);
    return {
      position,
      ticker: next.ticker,
      name: next.name,
      points: next.points,
      isCaptain: next.isCaptain,
    };
  });

  const bench = holdings.filter((h) => !used.has(h.ticker));
  const teamPoints = scoreBps === null ? null : pointsFromScore(scoreBps);
  const missingEntries = holdings.some((h) => h.points === null);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
          {heading}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-[11px] font-normal normal-case text-chalk-500 transition hover:text-chalk-300"
            >
              back to yours
            </button>
          )}
        </h2>
        <span className="text-right">
          {teamPoints === null ? (
            <span className="text-xs text-chalk-500">scores once the round locks</span>
          ) : (
            <>
              <span
                className={`tnum text-xl font-bold ${
                  teamPoints > 0 ? "text-up" : teamPoints < 0 ? "text-down" : "text-flat"
                }`}
              >
                {formatPoints(teamPoints)}
              </span>
              <span className="ml-1 text-[10px] text-chalk-500">pts</span>
            </>
          )}
        </span>
      </div>

      <Pitch slots={slots} />

      <div className="flex items-center justify-between rounded-xl border border-line-800 bg-deep-900/60 px-4 py-2.5 text-sm">
        <span className="text-chalk-500">Squad value</span>
        <span className="tnum font-semibold">{usd(side.data!.nav)}</span>
      </div>

      {bench.length > 0 && (
        <div className="rounded-xl border border-line-800 bg-deep-900/60 px-4 py-2.5">
          <p className="text-xs uppercase tracking-wide text-chalk-500">Also held</p>
          <ul className="mt-1 space-y-1">
            {bench.map((h) => (
              <li key={h.ticker} className="flex justify-between text-sm">
                <span className="font-mono">{h.ticker}</span>
                <span className="tnum text-chalk-300">{usd(h.value)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-chalk-500">
            More than the formation holds. Still counts towards your score.
          </p>
        </div>
      )}

      {missingEntries && (
        <p className="text-[11px] leading-relaxed text-chalk-500">
          Per-shirt points need the price you bought at, which only the browser you drafted in has.
          Your team score above is read from the chain and is always right.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-chalk-500">
        {FORMATION.GK}-{FORMATION.DEF}-{FORMATION.FWD}. Every percent your side moves is ten points,
        and the captain&rsquo;s stake is doubled so their move counts twice.
      </p>
    </section>
  );
}
