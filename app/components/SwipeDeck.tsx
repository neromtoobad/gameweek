"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readDexQuotes } from "@/lib/pools";
import { readQuotes } from "@/lib/prices";
import {
  DEFAULT_BUDGET,
  STAKES,
  buildDeck,
  canAfford,
  makePick,
  quoteStake,
  remainingBudget,
  type Pick,
} from "@/lib/draft";
import { useAccounts } from "@/lib/useAccounts";
import { draftReadiness, submitDraft } from "@/lib/execute";
import { txUrl } from "@/lib/config";
import { usd } from "@/lib/format";
import { SwipeCard } from "./SwipeCard";
import { BudgetRing } from "./BudgetRing";

type Submission =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; id: string }
  | { state: "failed"; message: string };

export function SwipeDeck() {
  const { accounts } = useAccounts();
  const leagueWallet = accounts?.league ?? null;

  const [index, setIndex] = useState(0);
  const [stake, setStake] = useState<bigint>(STAKES[1]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [submission, setSubmission] = useState<Submission>({ state: "idle" });

  const market = useQuery({
    queryKey: ["deck"],
    queryFn: async () => {
      const [dex, oracle] = await Promise.all([readDexQuotes(), readQuotes()]);
      return buildDeck(dex, oracle);
    },
    refetchInterval: 60_000,
  });

  const deck = useMemo(() => market.data ?? [], [market.data]);
  const remaining = remainingBudget(picks, DEFAULT_BUDGET);
  const card = deck[index];
  const affordable = canAfford(picks, DEFAULT_BUDGET, stake);
  const readiness = draftReadiness(leagueWallet);

  function draft() {
    if (!card || !affordable) return;
    setPicks((p) => [...p, makePick(card, stake)]);
    setIndex((i) => i + 1);
  }

  function skip() {
    setIndex((i) => i + 1);
  }

  function undo() {
    setPicks((p) => p.slice(0, -1));
    setSubmission({ state: "idle" });
  }

  async function submit() {
    if (!leagueWallet || picks.length === 0) return;
    setSubmission({ state: "sending" });
    try {
      const id = await submitDraft(picks, leagueWallet);
      setSubmission({ state: "sent", id });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Draft failed";
      const rejected = /reject|denied|cancel/i.test(message);
      setSubmission(rejected ? { state: "idle" } : { state: "failed", message });
    }
  }

  if (market.isPending) {
    return <div className="h-[420px] animate-pulse rounded-3xl border border-line-800 bg-pitch-900/60" />;
  }

  if (market.isError || deck.length === 0) {
    return (
      <div className="rounded-3xl border border-line-800 bg-pitch-900/60 p-6 text-center">
        <p className="text-sm text-chalk-300">No draftable stocks right now.</p>
        <p className="mt-1 text-xs text-chalk-500">
          A stock is draftable only once it has an onchain pool to buy it from.
        </p>
      </div>
    );
  }

  const done = index >= deck.length;

  return (
    <section className="flex flex-col gap-4">
      <BudgetRing remaining={remaining} budget={DEFAULT_BUDGET} />

      <div className="flex gap-2">
        {STAKES.map((s) => (
          <button
            key={s.toString()}
            type="button"
            onClick={() => setStake(s)}
            className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              stake === s
                ? "border-turf-500 bg-turf-500/15 text-turf-400"
                : "border-line-800 text-chalk-300 hover:text-chalk-100"
            }`}
          >
            {usd(s, { cents: false })}
          </button>
        ))}
      </div>

      {/* The stack. Height is fixed so the layout does not jump as cards leave. */}
      <div className="relative h-[360px]">
        {done ? (
          <div className="absolute inset-x-0 top-0 rounded-3xl border border-line-800 bg-pitch-900/60 p-8 text-center">
            <p className="text-sm text-chalk-300">That is the whole board.</p>
            <button
              type="button"
              onClick={() => setIndex(0)}
              className="mt-3 rounded-xl border border-line-800 px-4 py-2 text-sm text-chalk-300 transition hover:text-chalk-100"
            >
              Run through it again
            </button>
          </div>
        ) : (
          deck
            .slice(index, index + 3)
            .map((c, depth) => (
              <SwipeCard
                key={c.listing.ticker}
                card={c}
                depth={depth}
                stake={stake}
                expectedShares={quoteStake(c, stake).expectedShares}
                affordable={affordable}
                onDraft={draft}
                onSkip={skip}
              />
            ))
            .reverse()
        )}
      </div>

      {!done && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={skip}
            className="flex-1 rounded-xl border border-line-800 px-4 py-3 font-semibold text-chalk-300 transition hover:text-chalk-100"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={draft}
            disabled={!affordable}
            className="flex-1 rounded-xl bg-turf-500 px-4 py-3 font-semibold text-pitch-950 transition hover:bg-turf-400 disabled:opacity-40"
          >
            Draft {usd(stake, { cents: false })}
          </button>
        </div>
      )}

      {picks.length > 0 && (
        <div className="rounded-2xl border border-line-800 bg-pitch-900/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-chalk-300">
              Your picks
            </h3>
            <button
              type="button"
              onClick={undo}
              className="text-xs text-chalk-500 transition hover:text-chalk-300"
            >
              Undo last
            </button>
          </div>

          <ul className="mt-2 divide-y divide-line-900">
            {picks.map((p, i) => (
              <li key={`${p.ticker}-${i}`} className="flex items-center justify-between py-2">
                <span className="font-mono text-sm">{p.ticker}</span>
                <span className="tnum text-sm text-chalk-300">{usd(p.stake)}</span>
              </li>
            ))}
          </ul>

          {readiness.ready ? (
            <button
              type="button"
              onClick={submit}
              disabled={submission.state === "sending"}
              className="mt-3 w-full rounded-xl bg-turf-500 px-4 py-3 font-semibold text-pitch-950 transition hover:bg-turf-400 disabled:opacity-60"
            >
              {submission.state === "sending"
                ? "Confirming…"
                : `Buy ${picks.length} pick${picks.length === 1 ? "" : "s"}`}
            </button>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line-800 px-3 py-2 text-center text-xs text-chalk-500">
              {readiness.reason}
            </p>
          )}

          {submission.state === "sent" && (
            <p className="mt-2 text-center text-xs text-up">
              Draft submitted.{" "}
              {submission.id && (
                <a
                  href={txUrl(submission.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  View on Basescan
                </a>
              )}
            </p>
          )}
          {submission.state === "failed" && (
            <p className="mt-2 text-center text-xs text-down">{submission.message}</p>
          )}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-chalk-500">
        Prices are read live from Aerodrome pools on Base. Each pick is a real swap into your own
        wallet, with a floor price the trade will not go below.
      </p>
    </section>
  );
}
