import type { Card } from "./draft";
import { FORMATION, type Position } from "./squad";

/**
 * How the bot picks a side.
 *
 * Deterministic, and readable from the chain alone. It could have called a model, but a bot whose
 * side depends on an HTTP request is a bot that fails to field a team the one evening the API is
 * slow, and "the model liked it" is not a strategy anyone can check. This is:
 *
 *   Buy what the weekend left behind.
 *
 * Every stock on the board carries a gap, the distance between what it trades for on Base right now
 * and where Wall Street left it at the Friday close. The bot fills each position with the names
 * carrying the smallest gap, on the view that the ones which have already run are the ones with
 * least left to give. The captain's armband goes to the largest discount on the board.
 *
 * It is a real position, and it can be wrong. That is the point: it gives a human something to beat
 * and a reason to disagree.
 */
export const STRATEGY_NAME = "Gap Hunter";
export const STRATEGY_LINE = "Buys whatever the weekend left behind, captains the biggest discount.";

/**
 * Two sanity checks, because the gap is only a signal when the price behind it is real.
 *
 * Liquidity is compared against the deepest pool only to exclude dust. It is in-range liquidity
 * rather than dollars, and it is not comparable between stocks at different prices, so it is a poor
 * ranking tool and a decent floor. An early version used it at two percent and threw out pools with
 * six figures of depth, which left the bot unable to field a full side.
 *
 * The gap itself is the better filter. One listing quoted 9.5% away from its Friday close on a
 * hundredth of the depth of the deepest pool. No stock gapped nine percent over a weekend; that is
 * a thin quote, and a strategy that ranks on the gap would walk straight into it.
 */
export const MIN_LIQUIDITY_SHARE = 0.002;
export const MAX_ABS_GAP_BPS = 500;

export type BotPick = { card: Card; isCaptain: boolean };

/** Cards whose price can be trusted enough to rank on. */
export function tradeable(cards: Card[]): Card[] {
  if (cards.length === 0) return [];
  const deepest = cards.reduce((max, c) => (c.liquidity > max ? c.liquidity : max), 0n);
  const floor =
    deepest === 0n ? 0n : (deepest * BigInt(Math.round(MIN_LIQUIDITY_SHARE * 1_000_000))) / 1_000_000n;

  return cards.filter(
    (c) =>
      c.gapBps !== null && Math.abs(c.gapBps) <= MAX_ABS_GAP_BPS && c.liquidity >= floor,
  );
}

/**
 * Pick a legal 1-2-2 and name a captain.
 *
 * Returns fewer than a full side if a position has nobody liquid enough to field, rather than
 * reaching for a pool it should not touch.
 */
export function pickSide(cards: Card[]): BotPick[] {
  const pool = tradeable(cards);

  const chosen: Card[] = [];
  for (const position of ["GK", "DEF", "FWD"] as Position[]) {
    const ranked = pool
      .filter((c) => c.position === position)
      .sort((a, b) => (a.gapBps ?? 0) - (b.gapBps ?? 0));
    chosen.push(...ranked.slice(0, FORMATION[position]));
  }
  if (chosen.length === 0) return [];

  // The armband follows the deepest discount, wherever on the pitch it is.
  const captain = chosen.reduce((best, c) => ((c.gapBps ?? 0) < (best.gapBps ?? 0) ? c : best));

  return chosen.map((card) => ({ card, isCaptain: card.listing.ticker === captain.listing.ticker }));
}

/** One line explaining a pick, for the log and for the league page. */
export function explainPick({ card, isCaptain }: BotPick): string {
  const gap = ((card.gapBps ?? 0) / 100).toFixed(2);
  const sign = (card.gapBps ?? 0) > 0 ? "+" : "";
  return `${card.listing.ticker.padEnd(7)} ${card.position.padEnd(3)} ${sign}${gap}% vs close${isCaptain ? "  (C)" : ""}`;
}
