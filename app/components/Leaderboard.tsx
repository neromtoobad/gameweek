"use client";

import { addressUrl } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";
import { formatPoints, pointsFromScore } from "@/lib/points";
import type { Standing } from "@/lib/leagues";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * The league table.
 *
 * Scores are the same ratio the contract settles on, capped the same way, so what a player watches
 * all week is exactly what decides the pot.
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
    <ul className="divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800 bg-pitch-900/60">
      {standings.map((s) => {
        const isYou = you && s.member.toLowerCase() === you.toLowerCase();
        const isSelected = selected && s.member.toLowerCase() === selected.toLowerCase();
        const delta = s.scoreBps === null ? null : (s.scoreBps - 10_000) / 100;
        const tone = delta === null ? "text-flat" : delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-flat";

        return (
          <li
            key={s.member}
            className={`flex items-center gap-3 px-4 py-3 ${
              isYou ? "bg-turf-500/10" : ""
            } ${isSelected ? "bg-pitch-800" : ""}`}
          >
            <span className="w-6 shrink-0 text-center text-sm text-chalk-500">
              {showPayout && s.rank <= 3 ? MEDALS[s.rank - 1] : s.rank}
            </span>

            <div className="min-w-0 flex-1">
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(s.member)}
                  className="truncate font-mono text-sm underline-offset-2 hover:underline"
                >
                  {shortAddress(s.member)}
                </button>
              ) : (
                <a
                  href={addressUrl(s.member)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-sm underline-offset-2 hover:underline"
                >
                  {shortAddress(s.member)}
                </a>
              )}
              {isYou && <span className="ml-2 text-xs text-turf-400">you</span>}
              {s.scoreBps === null && (
                <p className="text-[11px] text-chalk-500">not funded, will be skipped</p>
              )}
            </div>

            <div className="text-right">
              <p className={`tnum text-base font-bold ${tone}`}>
                {s.scoreBps === null ? "—" : formatPoints(pointsFromScore(s.scoreBps))}
                <span className="ml-1 text-[10px] font-normal text-chalk-500">pts</span>
              </p>
              <p className="tnum text-[11px] text-chalk-500">
                {delta === null ? usd(s.navNow) : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}% · ${usd(s.navNow)}`}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
