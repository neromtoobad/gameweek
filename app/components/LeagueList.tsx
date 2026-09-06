"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { hasContract, phaseOf, readLeagues } from "@/lib/leagues";
import { useNowSeconds } from "@/lib/useNow";
import { countdown, usd } from "@/lib/format";

const PHASE_LABEL = {
  drafting: "Drafting",
  running: "Running",
  settling: "Ready to settle",
  settled: "Settled",
} as const;

export function LeagueList() {
  const now = useNowSeconds();
  const leagues = useQuery({
    queryKey: ["leagues"],
    queryFn: readLeagues,
    enabled: hasContract(),
    refetchInterval: 60_000,
  });

  if (!hasContract()) {
    return (
      <p className="rounded-xl border border-dashed border-line-800 px-4 py-3 text-xs leading-relaxed text-chalk-500">
        Leagues appear here once the contract is deployed. The board below is live either way.
      </p>
    );
  }

  // The clock decides which phase each league shows, so wait for it rather than reading the time
  // during render.
  if (leagues.isPending || now === null) {
    return <div className="h-24 animate-pulse rounded-2xl border border-line-800 bg-pitch-900/60" />;
  }

  if (leagues.isError || (leagues.data?.length ?? 0) === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-800 px-4 py-3 text-xs text-chalk-500">
        No leagues open yet.
      </p>
    );
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-chalk-300">Leagues</h2>
      <ul className="divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800 bg-pitch-900/60">
        {leagues.data!.map((l) => {
          const phase = phaseOf(l, now);
          const target = phase === "drafting" ? l.startTime : l.endTime;
          return (
            <li key={l.id}>
              <Link
                href={`/league/${l.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-pitch-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="text-xs text-chalk-500">
                    {PHASE_LABEL[phase]}
                    {phase !== "settled" && phase !== "settling" && (
                      <> · {countdown(target, now)}</>
                    )}
                  </p>
                </div>
                <span className="tnum shrink-0 text-sm text-chalk-300">{usd(l.pot)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
