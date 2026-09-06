"use client";

import { addressUrl, BOT_ADDRESS } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";
import { formatPoints, pointsFromScore } from "@/lib/points";
import { useCountUp } from "@/lib/useCountUp";
import type { Standing } from "@/lib/leagues";
import { Jersey } from "./Jersey";

/** Gold, silver, bronze, for the three places the pot pays. */
const PODIUM = ["bg-[#e9c64a] text-deep-950", "bg-[#cfd3dc] text-deep-950", "bg-[#c98d5e] text-deep-950"];

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
    <ul className="leather divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800">
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
              className={`num flex h-10 w-9 shrink-0 items-center justify-center rounded-md text-[22px] ${
                showPayout && s.rank <= 3
                  ? PODIUM[s.rank - 1]
                  : leader
                    ? "bg-volt text-deep-950"
                    : "bg-deep-800 text-chalk-300"
              }`}
            >
              {s.rank}
            </span>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="truncate font-mono text-[13px]">{shortAddress(s.member)}</span>
                {isYou && <span className="sticker !text-[11px]">you</span>}
                {isBot && (
                  <span className="hed rounded-sm bg-chalk-500/20 px-1.5 py-0.5 text-[11px] tracking-[0.08em] text-chalk-300">
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
              <p className={`num text-[34px] ${tone}`}>
                {s.scoreBps === null ? "—" : <Points value={pointsFromScore(s.scoreBps)} />}
                <span className="ml-1 font-sans text-[10px] font-bold uppercase tracking-wider text-chalk-500">pts</span>
              </p>
              <p className="tnum mt-0.5 text-[11px] text-chalk-500">
                {delta === null ? usd(s.navNow) : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}% · ${usd(s.navNow)}`}
              </p>
            </div>
          </>
        );

        const className = `rise flex w-full items-center gap-3 px-3.5 py-3 text-left ${
          isYou ? "bg-volt/[0.07]" : ""
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
