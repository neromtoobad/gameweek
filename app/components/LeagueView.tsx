"use client";

import Image from "next/image";
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
  settling: { label: "Ready", hint: "The round is over. Anyone can settle it." },
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
    return <div className="h-64 animate-pulse rounded-2xl border border-line-800 bg-deep-900" />;
  }
  if (!league.data) {
    return (
      <p className="rounded-2xl border border-line-800 bg-deep-900 px-4 py-8 text-center text-sm text-chalk-500">
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
  const mine = wallet ? rows.find((r) => r.member.toLowerCase() === wallet.toLowerCase()) : undefined;

  const copy = PHASE_COPY[phase];

  return (
    <div className="flex flex-col gap-5">
      <section className="relative" style={{ filter: "drop-shadow(0 20px 36px rgba(0,0,0,0.55))" }}>
        <div className="arena cut relative overflow-hidden px-5 pb-5 pt-5">
          <div className="flex items-start justify-between gap-3">
            <p className="kicker">Matchday {matchdayNumber(now)}</p>
            <span
              className={`hed shrink-0 rounded-sm px-2 py-0.5 text-[12px] tracking-[0.1em] ${
                phase === "running" ? "bg-volt text-deep-950" : "border border-line-800 bg-deep-950/60 text-chalk-300"
              }`}
            >
              {copy.label}
            </span>
          </div>

          <h1 className="hed mt-2 text-[44px]">{l.name}</h1>
          <p className="mt-2 text-sm text-chalk-300">{copy.hint}</p>

          <div className="mt-5 flex items-end justify-between">
            <div className="flex items-end gap-3">
              <Image
                src="/trophy.png"
                alt=""
                width={38}
                height={66}
                className="h-[62px] w-auto"
                style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.6))" }}
              />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-500">Pot</p>
                <p className="num text-[40px] text-volt">{usd(l.pot)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-chalk-500">
                {phase === "drafting" ? "Locks in" : phase === "running" ? "Settles in" : "Window"}
              </p>
              <p className="num text-[28px]">
                {phase === "drafting"
                  ? countdown(l.startTime, now)
                  : phase === "running"
                    ? countdown(l.endTime, now)
                    : "closed"}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-chalk-500">
            {rows.length} of {l.maxMembers} players · pays 60/30/10 to the top three
          </p>
        </div>
      </section>

      {mine && mine.scoreBps !== null && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-800 bg-deep-900 px-4 py-3">
          <div>
            <p className="kicker">Your standing</p>
            <p className="hed mt-1 text-[26px]">
              {ordinal(mine.rank)} <span className="text-chalk-500">of {rows.length}</span>
            </p>
          </div>
          <p className={`num text-[40px] ${mine.scoreBps > 10_000 ? "text-up" : mine.scoreBps < 10_000 ? "text-down" : "text-flat"}`}>
            {Math.round((mine.scoreBps - 10_000) / 10) > 0 ? "+" : ""}
            {Math.round((mine.scoreBps - 10_000) / 10)}
            <span className="ml-1 font-sans text-[10px] font-bold uppercase tracking-wider text-chalk-500">pts</span>
          </p>
        </div>
      )}

      {shown && (
        <MySide
          key={shown}
          wallet={shown}
          scoreBps={rows.find((r) => r.member.toLowerCase() === shown.toLowerCase())?.scoreBps ?? null}
          heading={isOwnSide ? "Your side" : "Their side"}
          player={isOwnSide ? undefined : shortAddress(shown)}
          onBack={isOwnSide ? undefined : () => setViewing(null)}
        />
      )}

      {isOwnSide && wallet && (
        <ShareBar
          leagueId={id}
          leagueName={l.name}
          matchday={matchdayNumber(now)}
          rank={mine?.rank ?? 0}
          players={rows.length}
          points={mine?.scoreBps == null ? null : Math.round((mine.scoreBps - 10_000) / 10)}
          tickers={mine?.shirts ?? []}
        />
      )}

      <div>
        <div className="mb-3">
          <p className="kicker">Ranked by points</p>
          <h2 className="hed mt-1 text-[34px]">Table</h2>
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
        <div className="cut-sm relative overflow-hidden border border-volt/40 bg-deep-900 px-5 py-5">
          <Image
            src="/trophy.png"
            alt=""
            width={80}
            height={140}
            className="pointer-events-none absolute -right-1 -top-4 h-[150px] w-auto"
            style={{ filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.7))" }}
          />
          <div className="pr-24">
            <p className="kicker">Full time</p>
            <p className="hed mt-2 text-[34px]">Settled</p>
            <p className="mt-1 text-sm text-chalk-300">
              The pot went to the top three, paid in USDC by the contract.
            </p>
          </div>
        </div>
      )}

      {!spectator && (
        <div className="flex flex-col gap-2">
          {phase === "drafting" && !joined && wallet && !full && (
            <button
              type="button"
              onClick={() => run("join")}
              disabled={busy !== null}
              className="btn cut-sm bg-volt px-4 py-3.5 hed text-[20px] text-deep-950 hover:bg-volt-600 disabled:opacity-60"
            >
              {busy === "join" ? "Joining…" : "Join this league"}
            </button>
          )}

          {phase === "drafting" && joined && (
            <Link
              href="/draft"
              className="btn cut-sm bg-volt px-4 py-3.5 text-center hed text-[20px] text-deep-950 hover:bg-volt-600"
            >
              Pick your side
            </Link>
          )}

          {phase === "settling" && !l.locked && (
            <button
              type="button"
              onClick={() => run("lock")}
              disabled={busy !== null}
              className="btn cut-sm border border-line-800 bg-deep-900 px-4 py-3.5 hed text-[20px] text-chalk-100 hover:border-volt disabled:opacity-60"
            >
              {busy === "lock" ? "Locking…" : "Lock the league"}
            </button>
          )}

          {phase === "settling" && l.locked && (
            <button
              type="button"
              onClick={() => run("settle")}
              disabled={busy !== null}
              className="btn cut-sm bg-volt px-4 py-3.5 hed text-[20px] text-deep-950 hover:bg-volt-600 disabled:opacity-60"
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
        <p className="rounded-xl border border-line-800 bg-deep-900 px-4 py-2.5 text-[11px] leading-relaxed text-chalk-500">
          <span className="hed text-[14px] tracking-[0.06em] text-chalk-100">{STRATEGY_NAME}</span> is in this
          league. It is an agent with its own wallet and its own money. {STRATEGY_LINE} Beat it.
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-chalk-500">
        Locking and settling are open to anyone, so a league never depends on us being around. Every
        score is read from Chainlink at the moment of settlement.
      </p>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
