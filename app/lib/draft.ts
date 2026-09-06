import type { DexQuote } from "./pools";
import type { Quote } from "./prices";
import type { Listing } from "./tokens";

/**
 * Stake sizes offered on the deck, in USDC units.
 *
 * Deliberately small. Base gas is a fraction of a cent and the router fee is 50 basis points, so a
 * twenty-five cent pick is not a toy, it is the whole point: a gameweek costs about a dollar. That
 * is the difference between a market a Lagos student can join and one they can only read about.
 */
export const STAKES = [250_000n, 500_000n, 1_000_000n] as const;

/** Default weekly budget a player drafts with. One dollar buys a full three-pick gameweek. */
export const DEFAULT_BUDGET = 1_000_000n;

/** Router fee, in basis points. Mirrors GameweekRouter.feeBps and funds league pots. */
export const FEE_BPS = 50n;

/** How far the fill may drift before the swap reverts. */
export const SLIPPAGE_BPS = 100n;

const BPS = 10_000n;

export type Card = {
  listing: Listing;
  pool: `0x${string}`;
  /** Live pool price, USDC per share with 6 decimals. */
  price: bigint;
  /** Friday close from Chainlink, 8 decimals, or null when the feed is unavailable. */
  close: bigint | null;
  /** How far the pool sits from the close, in basis points. Positive means a premium. */
  gapBps: number | null;
  liquidity: bigint;
};

/**
 * Build the deck.
 *
 * Only listings with a pool are draftable: a stock nobody has minted cannot be bought at any price,
 * so offering it would be a dead card. Deepest liquidity first, because a thin pool moves on a
 * small order and that is not the pick we want to put in front of someone first.
 */
export function buildDeck(dex: DexQuote[], oracle: Quote[]): Card[] {
  const closeByTicker = new Map(oracle.map((q) => [q.listing.ticker, q.price]));

  return dex
    .map((q) => {
      const close = closeByTicker.get(q.listing.ticker) ?? null;
      // The close carries 8 decimals and the pool price 6, so scale before comparing.
      const closeUsd6 = close === null ? null : close / 100n;
      const gapBps =
        closeUsd6 && closeUsd6 > 0n
          ? Number(((q.price - closeUsd6) * BPS) / closeUsd6)
          : null;
      return {
        listing: q.listing,
        pool: q.pool,
        price: q.price,
        close,
        gapBps,
        liquidity: q.liquidity,
      };
    })
    .sort((a, b) => (b.liquidity > a.liquidity ? 1 : b.liquidity < a.liquidity ? -1 : 0));
}

export type Pick = {
  ticker: string;
  listing: Listing;
  pool: `0x${string}`;
  /** USDC committed, 6 decimals. */
  stake: bigint;
  /** Shares expected at the quoted price, 8 decimals. */
  expectedShares: bigint;
  /** The floor the swap will accept, 8 decimals. */
  minShares: bigint;
};

/**
 * Price a stake.
 *
 * The router takes its fee off the input before swapping, so the shares a player is promised are
 * quoted on what actually reaches the pool. `minShares` is the only slippage protection the swap
 * has, which is why it is derived here and carried all the way into the transaction.
 */
export function quoteStake(card: Card, stake: bigint) {
  const afterFee = (stake * (BPS - FEE_BPS)) / BPS;
  const expectedShares = card.price > 0n ? (afterFee * 10n ** 8n) / card.price : 0n;
  const minShares = (expectedShares * (BPS - SLIPPAGE_BPS)) / BPS;
  return { afterFee, expectedShares, minShares };
}

export function makePick(card: Card, stake: bigint): Pick {
  const { expectedShares, minShares } = quoteStake(card, stake);
  return {
    ticker: card.listing.ticker,
    listing: card.listing,
    pool: card.pool,
    stake,
    expectedShares,
    minShares,
  };
}

export const totalStaked = (picks: Pick[]): bigint =>
  picks.reduce((sum, p) => sum + p.stake, 0n);

export const remainingBudget = (picks: Pick[], budget: bigint): bigint => {
  const left = budget - totalStaked(picks);
  return left > 0n ? left : 0n;
};

/** A stake is offerable only if the budget still covers it. */
export const canAfford = (picks: Pick[], budget: bigint, stake: bigint): boolean =>
  remainingBudget(picks, budget) >= stake;

/**
 * Under this the fee and gas stop making sense against the size of the trade.
 *
 * At ten cents the 50 bps fee is $0.0005 and gas is about $0.004, so costs are already under 5% of
 * the stake. Below that the arithmetic turns against the player.
 */
export const MIN_STAKE = 100_000n;
