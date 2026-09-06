/**
 * Points.
 *
 * A percentage is a portfolio number. Points are a game number, and the difference is most of why
 * fantasy football is fun to talk about. So a round's return is shown as points, at ten points per
 * percent: a 5.3% day is 53 points, which lands in the same range as a real fantasy gameweek.
 *
 * Points are a presentation of the ratio the contract settles on, never a separate scoring system.
 * If they disagreed with the payout the table would be lying, so everything here derives from the
 * same navNow / navStart the contract uses.
 */

/** Ten points per percent, rounded. 10_000 bps is flat and scores nothing. */
export const pointsFromScore = (scoreBps: number): number => Math.round((scoreBps - 10_000) / 10);

/** Points contributed by one holding, given how much of the squad's value it started as. */
export function pointsFromHolding(pctMove: number, weight: number): number {
  return Math.round(pctMove * 10 * weight);
}

export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : `${points}`;
}

/**
 * The captain's stake is doubled, so their move counts twice.
 *
 * This is a real position size rather than a scoring multiplier bolted on top. The captain's
 * holding genuinely is twice the size, so the contract settles on it the same way the table shows
 * it, and nobody has to trust a number the chain does not know about.
 */
export const CAPTAIN_MULTIPLIER = 2n;

/**
 * Split a budget across a squad, with the captain taking a double share.
 *
 * Five picks with one captain is six shares, so a $1 budget is about 16 cents a pick and 33 for the
 * captain. Returned in USDC units, with any rounding dust left unspent rather than overshooting the
 * player's cap.
 */
export function splitBudget(budget: bigint, squadSize: number): { base: bigint; captain: bigint } {
  const shares = BigInt(squadSize) + CAPTAIN_MULTIPLIER - 1n;
  const base = budget / shares;
  return { base, captain: base * CAPTAIN_MULTIPLIER };
}
