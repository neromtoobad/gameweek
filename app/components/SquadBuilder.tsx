"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { readDexQuotes } from "@/lib/pools";
import { readQuotes } from "@/lib/prices";
import { DEFAULT_BUDGET, buildDeck, makePick, quoteStake, squadStakes, type Card } from "@/lib/draft";
import { FORMATION, POSITION_LABEL, SQUAD_SIZE, type Position } from "@/lib/squad";
import { useAccounts } from "@/lib/useAccounts";
import { draftReadiness, submitDraft } from "@/lib/execute";
import { txUrl } from "@/lib/config";
import { saveSquad } from "@/lib/squadStore";
import { usd } from "@/lib/format";
import { SwipeCard } from "./SwipeCard";
import { Pitch, type PitchSlot } from "./Pitch";

/** Keeper first, then the back two, then the front two. */
const SLOT_ORDER: Position[] = ["GK", "DEF", "DEF", "FWD", "FWD"];

type Submission =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; id: string }
  | { state: "failed"; message: string };

export function SquadBuilder() {
  const { accounts } = useAccounts();
  const leagueWallet = accounts?.league ?? null;

  const [chosen, setChosen] = useState<(Card | null)[]>(() => SLOT_ORDER.map(() => null));
  const [captain, setCaptain] = useState<number | null>(null);
  const [cursor, setCursor] = useState(0);
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
  const filled = chosen.filter((c): c is Card => c !== null);
  const complete = filled.length === SQUAD_SIZE;

  // The first empty slot decides which position is being picked, and therefore which cards show.
  const openSlot = chosen.findIndex((c) => c === null);
  const needed: Position | null = openSlot === -1 ? null : SLOT_ORDER[openSlot];
  // Candidates for the slot being filled: right position, not already in the side.
  const candidates = useMemo(() => {
    if (needed === null) return [];
    const taken = new Set(chosen.flatMap((c) => (c ? [c.listing.ticker] : [])));
    return deck.filter((c) => c.position === needed && !taken.has(c.listing.ticker));
  }, [deck, needed, chosen]);

  const card = candidates[cursor % Math.max(1, candidates.length)];
  const { base, captain: captainStake } = squadStakes(DEFAULT_BUDGET);
  const readiness = draftReadiness(leagueWallet);

  function pick(c: Card) {
    if (openSlot === -1) return;
    setChosen((prev) => prev.map((existing, i) => (i === openSlot ? c : existing)));
    setCursor(0);
  }

  function clearSlot(index: number) {
    if (complete) {
      // Once the side is picked, tapping a shirt hands them the armband instead of removing them.
      setCaptain(index);
      return;
    }
    setChosen((prev) => prev.map((existing, i) => (i === index ? null : existing)));
    setCaptain((c) => (c === index ? null : c));
  }

  function reset() {
    setChosen(SLOT_ORDER.map(() => null));
    setCaptain(null);
    setCursor(0);
    setSubmission({ state: "idle" });
  }

  async function submit() {
    if (!leagueWallet || !complete) return;
    setSubmission({ state: "sending" });
    try {
      const picks = filled.map((c, i) =>
        makePick(c, i === captain ? captainStake : base, i === captain),
      );
      const id = await submitDraft(picks, leagueWallet);

      // Remember what each shirt cost, so the league page can break the score down per stock. The
      // chain knows the wallet's value but not what it paid, and this is the only copy.
      saveSquad({
        wallet: leagueWallet,
        entries: filled.map((c, i) => ({
          ticker: c.listing.ticker,
          entryPrice: c.price.toString(),
          stake: (i === captain ? captainStake : base).toString(),
          isCaptain: i === captain,
        })),
      });

      setSubmission({ state: "sent", id });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Draft failed";
      const rejected = /reject|denied|cancel/i.test(message);
      setSubmission(rejected ? { state: "idle" } : { state: "failed", message });
    }
  }

  const slots: PitchSlot[] = chosen.map((c, i) => ({
    position: SLOT_ORDER[i],
    ticker: c?.listing.ticker ?? null,
    name: c?.listing.name,
    isCaptain: captain === i,
  }));

  if (market.isPending) {
    return <div className="h-[520px] animate-pulse rounded-3xl border border-line-800 bg-pitch-900/60" />;
  }

  if (market.isError || deck.length === 0) {
    return (
      <div className="rounded-3xl border border-line-800 bg-pitch-900/60 p-6 text-center">
        <p className="text-sm text-chalk-300">No draftable stocks right now.</p>
        <p className="mt-1 text-xs text-chalk-500">
          A stock is only draftable once it has an onchain pool to buy it from.
        </p>
      </div>
    );
  }

  // Sum the same numbers the list shows. Before an armband is handed out nobody is on a double
  // stake yet, and a total that already assumed one would read as a bug.
  const totalStake = filled.reduce(
    (sum, _, i) => sum + (i === captain ? captainStake : base),
    0n,
  );

  return (
    <section className="flex flex-col gap-4">
      <Pitch slots={slots} onSlotClick={clearSlot} activePosition={needed} />

      <div className="flex items-center justify-between text-xs text-chalk-500">
        <span>
          {complete
            ? captain === null
              ? "Tap a shirt to give them the armband"
              : "Squad set"
            : `${POSITION_LABEL[needed!]} · ${filled.length + 1} of ${SQUAD_SIZE}`}
        </span>
        <button type="button" onClick={reset} className="transition hover:text-chalk-300">
          Start again
        </button>
      </div>

      {!complete && card && (
        <>
          <div className="relative h-[300px]">
            {candidates
              .slice(cursor, cursor + 3)
              .map((c, depth) => (
                <SwipeCard
                  key={c.listing.ticker}
                  card={c}
                  depth={depth}
                  stake={base}
                  expectedShares={quoteStake(c, base).expectedShares}
                  affordable
                  onDraft={() => pick(c)}
                  onSkip={() => setCursor((i) => (i + 1) % candidates.length)}
                />
              ))
              .reverse()}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setCursor((i) => (i + 1) % candidates.length)}
              className="flex-1 rounded-xl border border-line-800 px-4 py-3 font-semibold text-chalk-300 transition hover:text-chalk-100"
            >
              Next
            </button>
            <button
              type="button"
              onClick={() => pick(card)}
              className="flex-1 rounded-xl bg-turf-500 px-4 py-3 font-semibold text-pitch-950 transition hover:bg-turf-400"
            >
              Pick {card.listing.name}
            </button>
          </div>

          <p className="text-center text-[11px] text-chalk-500">
            {candidates.length} {POSITION_LABEL[needed!].toLowerCase()}
            {candidates.length === 1 ? "" : "s"} available · {FORMATION[needed!]} needed
          </p>
        </>
      )}

      {complete && (
        <div className="rounded-2xl border border-line-800 bg-pitch-900/60 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-chalk-300">Your side</h3>

          <ul className="mt-2 divide-y divide-line-900">
            {filled.map((c, i) => (
              <li key={c.listing.ticker} className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2">
                  <span className="font-mono text-sm">{c.listing.ticker}</span>
                  {captain === i && (
                    <span className="rounded bg-chalk-100 px-1 text-[9px] font-bold text-pitch-950">
                      C
                    </span>
                  )}
                </span>
                <span className="tnum text-sm text-chalk-300">
                  {usd(i === captain ? captainStake : base)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-center justify-between border-t border-line-900 pt-2 text-sm">
            <span className="text-chalk-500">Total</span>
            <span className="tnum font-semibold">{usd(totalStake)}</span>
          </div>

          {captain === null ? (
            <p className="mt-3 rounded-xl border border-dashed border-line-800 px-3 py-2 text-center text-xs text-chalk-500">
              Pick a captain. Their stake is doubled, so their move counts twice.
            </p>
          ) : readiness.ready ? (
            <button
              type="button"
              onClick={submit}
              disabled={submission.state === "sending"}
              className="mt-3 w-full rounded-xl bg-turf-500 px-4 py-3 font-semibold text-pitch-950 transition hover:bg-turf-400 disabled:opacity-60"
            >
              {submission.state === "sending" ? "Confirming…" : `Buy the squad · ${usd(totalStake)}`}
            </button>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-line-800 px-3 py-2 text-center text-xs text-chalk-500">
              {readiness.reason}
            </p>
          )}

          {submission.state === "sent" && (
            <p className="mt-2 text-center text-xs text-up">
              Squad bought.{" "}
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
        Prices are read live from Aerodrome pools on Base. Every pick is a real swap into your own
        wallet, with a floor price the trade will not go below.
      </p>
    </section>
  );
}
