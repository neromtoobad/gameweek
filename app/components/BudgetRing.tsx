"use client";

import { usd } from "@/lib/format";

/**
 * The weekly budget, drawn as a ring that empties as picks are made.
 *
 * It doubles as the responsible-play signal: the number in the middle is the cap the player set,
 * and nothing in the app can spend past it.
 */
export function BudgetRing({ remaining, budget }: { remaining: bigint; budget: bigint }) {
  const fraction = budget > 0n ? Number(remaining) / Number(budget) : 0;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * Math.max(0, Math.min(1, fraction));
  const spent = budget - remaining;

  return (
    <div className="flex items-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden className="-rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="var(--color-line-800)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="var(--color-base-500)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: "stroke-dasharray 300ms ease-out" }}
        />
      </svg>
      <div>
        <p className="text-xs uppercase tracking-wide text-chalk-500">Budget left</p>
        <p className="tnum text-xl font-semibold">{usd(remaining)}</p>
        <p className="tnum text-[11px] text-chalk-500">
          {usd(spent)} of {usd(budget)} drafted
        </p>
      </div>
    </div>
  );
}
