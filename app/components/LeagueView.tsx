"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { readLeague, readPodium, readStandings, phaseOf } from "@/lib/leagues";
import { useAccounts } from "@/lib/useAccounts";
import { sendLeagueAction } from "@/lib/leagueActions";
import { useNowSeconds } from "@/lib/useNow";
import { matchdayNumber } from "@/lib/gameweek";
import { countdown, shortAddress, usd } from "@/lib/format";
import { BOT_ADDRESS } from "@/lib/config";
import { STRATEGY_LINE, STRATEGY_NAME } from "@/lib/strategy";
import { txUrl } from "@/lib/config";
import { Leaderboard } from "./Leaderboard";
import { MySide } from "./MySide";
import { ShareBar } from "./ShareBar";

const PHASE_COPY = {
  drafting: { label: "Team sheets", hint: "Sides can be picked until the round locks." },
  running: { label: "Live", hint: "Locked. Every percent your side moves is ten points." },
  settling: { label: "Ready", hint: "The week is over. Anyone can settle it." },
  settled: { label: "Settled", hint: "The pot has been paid." },
} as const;

export function LeagueView({ id, spectator = false }: { id: number; spectator?: boolean }) {
  const now = useNowSeconds();
  const { accounts } = useAccounts();
  const wallet = accounts?.league ?? null;
  const [busy, setBusy] = useState<string | null>(null);
  // Which player's side is on show. Defaults to yours, the way a fantasy table lets you open any
  // manager's team and then come back.
  const [viewing, setViewing] = useState<`0x${string}` | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const league = useQuery({ queryKey: ["league", id], queryFn: () => readLeague(id) });
  const standings = useQuery({
    queryKey: ["standings", id],
    queryFn: () => readStandings(id),
    refetchInterval: 30_000,
  });
  const podium = useQuery({
    queryKey: ["podium", id],
    queryFn: () => readPodium(id),
    enabled: Boolean(league.data?.settled),
  });

  // Wait for the clock as well as the data. Which phase a league is in depends on the current
  // time, and reading it during render would be impure.
  if (league.isPending || now === null) {
    return <div className="h-64 animate-pulse rounded-2xl border border-line-800 bg-deep-900/60" />;
  }
  if (!league.data) {
    return (
      <p className="rounded-2xl border border-line-800 bg-deep-900/60 px-4 py-8 text-center text-sm text-chalk-500">
        No league with that number.
      </p>
    );
  }

  const l = league.data;
  const phase = phaseOf(l, now);
  const rows = standings.data ?? [];
  const joined = Boolean(wallet && rows.some((r) => r.member.toLowerCase() === wallet.toLowerCase()));
  const full = rows.length >= l.maxMembers;

  async function run(action: "join" | "lock" | "settle") {
    if (!wallet) return;
    setBusy(action);
    setError(null);
    try {
      const txId = await sendLeagueAction(action, id, wallet);
      setSent(txId);
      await Promise.all([league.refetch(), standings.refetch()]);
    } catch (e) {
      const message = e instanceof Error ? e.message : "That did not go through";
      if (!/reject|denied|cancel/i.test(message)) setError(message);
    } finally {
      setBusy(null);
    }
  }

  // Show the selected player if one was tapped, otherwise your own side once you have joined.
  const shown = viewing ?? (joined ? wallet : null);
  const botIsPlaying = Boolean(BOT_ADDRESS) && rows.some((r) => r.member.toLowerCase() === BOT_ADDRESS);
  const isOwnSide = Boolean(shown && wallet && shown.toLowerCase() === wallet.toLowerCase());

  const copy = PHASE_COPY[phase];

  return (
    <div className="flex flex-col gap-4">
      <section className="hero-wash relative overflow-hidden rounded-2xl border border-line-800 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              Matchday {matchdayNumber(now)}
            </p>
            <h1 className="mt-1 text-[26px] font-bold leading-[1.15] tracking-tight">{l.name}</h1>
          </div>
          <span className="shrink-0 rounded-lg border border-line-800 px-2 py-1 text-xs text-chalk-300">
            {copy.label}
          </span>
        </div>

        <p className="mt-2 text-sm text-chalk-300">{copy.hint}</p>

        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-chalk-500">Pot</p>
            <p className="tnum text-2xl font-semibold">{usd(l.pot)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-chalk-500">
              {phase === "drafting" ? "Locks in" : phase === "running" ? "Settles in" : "Window"}
            </p>
            <p className="tnum font-mono text-sm">
              {phase === "drafting"
                ? countdown(l.startTime, now)
                : phase === "running"
                  ? countdown(l.endTime, now)
                  : "closed"}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] text-chalk-500">
          {rows.length} of {l.maxMembers} players · pays 60/30/10 to the top three
        </p>
      </section>

      {shown && (
        <MySide
          key={shown}
          wallet={shown}
          scoreBps={rows.find((r) => r.member.toLowerCase() === shown.toLowerCase())?.scoreBps ?? null}
          heading={isOwnSide ? "Your side" : `${shortAddress(shown)}'s side`}
          onBack={isOwnSide ? undefined : () => setViewing(null)}
        />
      )}

      {isOwnSide && wallet && (
        <ShareBar
          leagueId={id}
          leagueName={l.name}
          matchday={matchdayNumber(now)}
          rank={rows.find((r) => r.member.toLowerCase() === wallet.toLowerCase())?.rank ?? 0}
          players={rows.length}
          points={
            (() => {
              const bps = rows.find((r) => r.member.toLowerCase() === wallet.toLowerCase())?.scoreBps;
              return bps == null ? null : Math.round((bps - 10_000) / 10);
            })()
          }
          tickers={[]}
        />
      )}

      <div>
        <div className="mb-2">
          <h2 className="text-base font-bold tracking-tight">Table</h2>
          <p className="text-xs text-chalk-500">Ranked by points, the same number the contract settles on.</p>
        </div>
        <Leaderboard
          standings={rows}
          you={wallet}
          showPayout={l.settled}
          onSelect={setViewing}
          selected={shown}
        />
      </div>

      {l.settled && podium.data && (
        <p className="rounded-2xl border border-base-500/40 bg-base-500/10 px-4 py-3 text-center text-sm">
          Settled. The pot went to the top three.
        </p>
      )}

      {!spectator && (
        <div className="flex flex-col gap-2">
          {phase === "drafting" && !joined && wallet && !full && (
            <button
              type="button"
              onClick={() => run("join")}
              disabled={busy !== null}
              className="rounded-xl bg-base-500 px-4 py-3 font-bold text-white shadow-lg shadow-base-500/25 transition hover:bg-base-400 disabled:opacity-60"
            >
              {busy === "join" ? "Joining…" : "Join this league"}
            </button>
          )}

          {phase === "drafting" && joined && (
            <Link
              href="/draft"
              className="rounded-xl bg-base-500 px-4 py-3 text-center font-bold text-white transition hover:bg-base-400"
            >
              Pick your side
            </Link>
          )}

          {phase === "settling" && !l.locked && (
            <button
              type="button"
              onClick={() => run("lock")}
              disabled={busy !== null}
              className="rounded-xl border border-line-800 px-4 py-3 font-semibold text-chalk-100 transition hover:border-base-500 disabled:opacity-60"
            >
              {busy === "lock" ? "Locking…" : "Lock the league"}
            </button>
          )}

          {phase === "settling" && l.locked && (
            <button
              type="button"
              onClick={() => run("settle")}
              disabled={busy !== null}
              className="rounded-xl bg-base-500 px-4 py-3 font-bold text-white shadow-lg shadow-base-500/25 transition hover:bg-base-400 disabled:opacity-60"
            >
              {busy === "settle" ? "Settling…" : "Settle and pay the pot"}
            </button>
          )}

          {full && phase === "drafting" && !joined && (
            <p className="text-center text-xs text-chalk-500">This league is full.</p>
          )}
          {!wallet && (
            <p className="rounded-xl border border-dashed border-line-800 px-3 py-2 text-center text-xs text-chalk-500">
              Connect on the home screen to join or settle.
            </p>
          )}
        </div>
      )}

      {sent && (
        <p className="text-center text-xs text-up">
          Done.{" "}
          <a href={txUrl(sent)} target="_blank" rel="noreferrer" className="underline underline-offset-2">
            View on Basescan
          </a>
        </p>
      )}
      {error && <p className="text-center text-xs text-down">{error}</p>}

      {botIsPlaying && (
        <p className="rounded-xl border border-line-800 bg-deep-900/60 px-4 py-2.5 text-[11px] leading-relaxed text-chalk-500">
          <span className="font-semibold text-chalk-300">{STRATEGY_NAME}</span> is in this league. It
          is an agent with its own wallet and its own money. {STRATEGY_LINE} Beat it.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-chalk-500">
        Locking and settling are open to anyone, so a league never depends on us being around. Every
        score is read from Chainlink at the moment of settlement.
      </p>
    </div>
  );
}
