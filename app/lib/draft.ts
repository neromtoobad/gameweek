import type { DexQuote } from "./pools";
import type { Quote } from "./prices";
import type { Listing } from "./tokens";
import { SQUAD_SIZE, positionOf, type Position } from "./squad";
import { splitBudget } from "./points";

/**
 * Default budget for a round. One dollar fields a full squad.
 *
 * Deliberately small. Base gas is a fraction of a cent and the router fee is 50 basis points, so a
 * sixteen cent pick is not a toy, it is the point: the Request for Builders opens on markets shut
 * out of US equities by fees and minimums, and a game you can play for a dollar is an answer to
 * that.
 */
export const DEFAULT_BUDGET = 1_000_000n;

/** Router fee, in basis points. Mirrors GameweekRouter.feeBps and funds league pots. */
export const FEE_BPS = 50n;

/** How far a fill may drift before the swap reverts. */
export const SLIPPAGE_BPS = 100n;

const BPS = 10_000n;

export type Card = {
  listing: Listing;
  position: Position;
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
        position: positionOf(q.listing.ticker),
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
  position: Position;
  isCaptain: boolean;
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

export function makePick(card: Card, stake: bigint, isCaptain: boolean): Pick {
  const { expectedShares, minShares } = quoteStake(card, stake);
  return {
    ticker: card.listing.ticker,
    listing: card.listing,
    position: card.position,
    isCaptain,
    pool: card.pool,
    stake,
    expectedShares,
    minShares,
  };
}

/** What each pick is worth, given the captain takes a double share. */
export const squadStakes = (budget: bigint = DEFAULT_BUDGET) => splitBudget(budget, SQUAD_SIZE);

export const totalStaked = (picks: Pick[]): bigint =>
  picks.reduce((sum, p) => sum + p.stake, 0n);
