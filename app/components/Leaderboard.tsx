"use client";

import { addressUrl, BOT_ADDRESS } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";
import { formatPoints, pointsFromScore } from "@/lib/points";
import { useCountUp } from "@/lib/useCountUp";
import type { Standing } from "@/lib/leagues";
import { Jersey } from "./Jersey";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The league table.
 *
 * Scores are the same ratio the contract settles on, capped the same way, so what a player watches
 * all week is exactly what decides the pot. Every row carries the shirts that wallet is holding,
 * because a fantasy table you cannot read the teams off is just a list of numbers.
 */
export function Leaderboard({
  standings,
  you,
  showPayout,
  onSelect,
  selected,
}: {
  standings: Standing[];
  you?: `0x${string}` | null;
  /** After settlement, mark who the podium actually paid. */
  showPayout?: boolean;
  /** Open a player's side, the way a fantasy table lets you look at any manager's team. */
  onSelect?: (member: `0x${string}`) => void;
  selected?: `0x${string}` | null;
}) {
  if (standings.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-line-800 px-4 py-6 text-center text-sm text-chalk-500">
        Nobody has joined yet.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800 bg-deep-900/60">
      {standings.map((s, i) => {
        const isYou = you && s.member.toLowerCase() === you.toLowerCase();
        const isSelected = selected && s.member.toLowerCase() === selected.toLowerCase();
        const isBot = BOT_ADDRESS && s.member.toLowerCase() === BOT_ADDRESS;
        const delta = s.scoreBps === null ? null : (s.scoreBps - 10_000) / 100;
        const tone = delta === null ? "text-flat" : delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-flat";
        const leader = s.rank === 1 && s.scoreBps !== null;

        const row = (
          <>
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold ${
                showPayout && s.rank <= 3
                  ? "bg-base-500 text-white"
                  : leader
                    ? "bg-cyan-400 text-deep-950"
                    : "bg-deep-800 text-chalk-300"
              }`}
            >
              {showPayout && s.rank <= 3 ? MEDALS[s.rank - 1] : s.rank}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-mono text-sm">{shortAddress(s.member)}</span>
                {isYou && (
                  <span className="rounded bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-400">
                    you
                  </span>
                )}
                {isBot && (
                  <span className="rounded bg-chalk-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-chalk-300">
                    bot
                  </span>
                )}
              </p>
              {s.shirts.length > 0 ? (
                <span className="mt-1.5 flex items-center gap-0.5" aria-label={`Holding ${s.shirts.join(", ")}`}>
                  {s.shirts.slice(0, 6).map((t) => (
                    <Jersey key={t} ticker={t} size={26} />
                  ))}
                  {s.shirts.length > 6 && (
                    <span className="ml-1 text-[10px] text-chalk-500">+{s.shirts.length - 6}</span>
                  )}
                </span>
              ) : (
                <p className="mt-1 text-[11px] text-chalk-500">
                  {s.scoreBps === null ? "not funded, will be skipped" : "no shirts held"}
                </p>
              )}
            </div>

            <div className="shrink-0 text-right">
              <p className={`tnum text-2xl font-extrabold leading-none tracking-tight ${tone}`}>
                {s.scoreBps === null ? "—" : <Points value={pointsFromScore(s.scoreBps)} />}
                <span className="ml-1 text-[10px] font-semibold text-chalk-500">pts</span>
              </p>
              <p className="tnum mt-1 text-[11px] text-chalk-500">
                {delta === null ? usd(s.navNow) : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}% · ${usd(s.navNow)}`}
              </p>
            </div>
          </>
        );

        const className = `rise flex w-full items-center gap-3 px-4 py-3 text-left ${
          isYou ? "bg-base-500/10" : ""
        } ${isSelected ? "bg-deep-800" : ""}`;

        return (
          <li key={s.member} style={{ ["--i" as string]: i }}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(s.member)}
                aria-pressed={Boolean(isSelected)}
                className={`${className} transition hover:bg-deep-800/70`}
              >
                {row}
              </button>
            ) : (
              <a
                href={addressUrl(s.member)}
                target="_blank"
                rel="noreferrer"
                className={`${className} transition hover:bg-deep-800/70`}
              >
                {row}
              </a>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Counts up on mount, so a score lands like a result rather than a label. */
function Points({ value }: { value: number }) {
  const shown = useCountUp(value);
  return <>{formatPoints(shown)}</>;
}
