"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { hasContract, phaseOf, readLeagues } from "@/lib/leagues";
import { useNowSeconds } from "@/lib/useNow";
import { countdown, usd } from "@/lib/format";

const PHASE_LABEL = {
  drafting: "Drafting",
  running: "Live",
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
    return <div className="h-24 animate-pulse rounded-2xl border border-line-800 bg-deep-900" />;
  }

  if (leagues.isError || (leagues.data?.length ?? 0) === 0) {
    return (
      <div className="cut-sm relative overflow-hidden border border-line-800 bg-deep-900 p-5">
        <Image
          src="/trophy.png"
          alt=""
          width={92}
          height={160}
          className="pointer-events-none absolute -right-2 -top-3 h-[150px] w-auto opacity-40"
          style={{ filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.6))" }}
        />
        <p className="kicker">Leagues</p>
        <p className="hed mt-2 text-[30px]">No round open yet</p>
        <p className="mt-1 max-w-[26ch] text-sm text-chalk-500">
          The first one opens today. Pick a side now so it is ready when the round locks.
        </p>
      </div>
    );
  }

  return (
    <section>
      <div className="mb-3">
        <p className="kicker">Join one, pick a side, settle in 24 hours</p>
        <h2 className="hed mt-1 text-[34px]">Leagues</h2>
      </div>
      <ul className="leather divide-y divide-line-900 overflow-hidden rounded-2xl border border-line-800">
        {leagues.data!.map((l) => {
          const phase = phaseOf(l, now);
          const target = phase === "drafting" ? l.startTime : l.endTime;
          return (
            <li key={l.id}>
              <Link
                href={`/league/${l.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-deep-800/60"
              >
                <div className="min-w-0">
                  <p className="hed truncate text-[24px]">{l.name}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-chalk-500">
                    <span
                      className={`hed rounded-sm px-1.5 py-0.5 text-[11px] tracking-[0.08em] ${
                        phase === "running"
                          ? "bg-volt text-deep-950"
                          : phase === "drafting"
                            ? "bg-base-500 text-white"
                            : "bg-deep-800 text-chalk-300"
                      }`}
                    >
                      {PHASE_LABEL[phase]}
                    </span>
                    {phase !== "settled" && phase !== "settling" && (
                      <span className="tnum">{countdown(target, now)}</span>
                    )}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-chalk-500">Pot</p>
                  <p className="num text-[22px]">{usd(l.pot)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
