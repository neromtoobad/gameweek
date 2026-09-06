"use client";

import { addressUrl } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";
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
}: {
  standings: Standing[];
  you?: `0x${string}` | null;
  /** After settlement, mark who the podium actually paid. */
  showPayout?: boolean;
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
        const delta = s.scoreBps === null ? null : (s.scoreBps - 10_000) / 100;
        const tone = delta === null ? "text-flat" : delta > 0 ? "text-up" : delta < 0 ? "text-down" : "text-flat";

        return (
          <li
            key={s.member}
            className={`flex items-center gap-3 px-4 py-3 ${isYou ? "bg-turf-500/10" : ""}`}
          >
            <span className="w-6 shrink-0 text-center text-sm text-chalk-500">
              {showPayout && s.rank <= 3 ? MEDALS[s.rank - 1] : s.rank}
            </span>

            <div className="min-w-0 flex-1">
              <a
                href={addressUrl(s.member)}
                target="_blank"
                rel="noreferrer"
                className="truncate font-mono text-sm underline-offset-2 hover:underline"
              >
                {shortAddress(s.member)}
              </a>
              {isYou && <span className="ml-2 text-xs text-turf-400">you</span>}
              {s.scoreBps === null && (
                <p className="text-[11px] text-chalk-500">not funded, will be skipped</p>
              )}
            </div>

            <div className="text-right">
              <p className={`tnum text-sm font-semibold ${tone}`}>
                {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(2)}%`}
              </p>
              <p className="tnum text-[11px] text-chalk-500">{usd(s.navNow)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
