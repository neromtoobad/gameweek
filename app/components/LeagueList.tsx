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
    return <div className="h-24 animate-pulse rounded-2xl border border-line-800 bg-deep-900/60" />;
  }

  if (leagues.isError || (leagues.data?.length ?? 0) === 0) {
    return (
      <div className="rounded-2xl border border-line-800 bg-deep-900/60 p-5 text-center">
        <p className="text-base font-bold tracking-tight">No round open yet</p>
        <p className="mt-1 text-sm text-chalk-500">
          The first one opens today. Pick a side now so it is ready when the round locks.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-2">
        <h2 className="text-xl font-bold tracking-tight">Leagues</h2>
        <p className="text-xs text-chalk-500">Join one, pick a side, settle in 24 hours.</p>
      </div>
      <ul className="divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800 bg-deep-900/60">
        {leagues.data!.map((l) => {
          const phase = phaseOf(l, now);
          const target = phase === "drafting" ? l.startTime : l.endTime;
          return (
            <li key={l.id}>
              <Link
                href={`/league/${l.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-deep-800/60"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{l.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-chalk-500">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        phase === "running"
                          ? "bg-up/15 text-up"
                          : phase === "drafting"
                            ? "bg-base-500/20 text-cyan-400"
                            : "bg-deep-800 text-chalk-300"
                      }`}
                    >
                      {PHASE_LABEL[phase]}
                    </span>
                    {phase !== "settled" && phase !== "settling" && <>{countdown(target, now)}</>}
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
