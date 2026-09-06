import { readPortfolio } from "./prices";
import { hasContract, readRegisteredListings } from "./leagues";
import { LISTINGS } from "./tokens";
import { readDexQuotes } from "./pools";
import { positionOf, type Position } from "./squad";
import { pointsFromHolding } from "./points";
import type { StoredSquad } from "./squadStore";

export type SideHolding = {
  ticker: string;
  name: string;
  position: Position;
  /** Shares held, 8 decimals. */
  balance: bigint;
  /** Current value in USDC units. */
  value: bigint;
  /** Percentage move since purchase. Null when there is no local entry price. */
  pctMove: number | null;
  /** Points this shirt has contributed. Null without an entry price. */
  points: number | null;
  isCaptain: boolean;
};

export type Side = {
  holdings: SideHolding[];
  /** USDC still sitting in the wallet, unspent. */
  cash: bigint;
  /** Everything the wallet is worth right now. */
  nav: bigint;
};

/**
 * What a player is actually fielding.
 *
 * Read from the wallet rather than from any record of what was picked, so it is true even if
 * someone traded outside the app. The pool price is used rather than the Chainlink close, because
 * that is what the holding could be sold for right now, and on a weekend it is the only price that
 * is still moving.
 */
export async function readSide(
  wallet: `0x${string}`,
  stored: StoredSquad | null,
): Promise<Side> {
  // Ask the contract which tokens it scores. It is the authority, and it is the only way this works
  // on a local chain whose token addresses differ from mainnet's.
  const listings = hasContract()
    ? await readRegisteredListings().catch(() => LISTINGS)
    : LISTINGS;

  const [portfolio, dex] = await Promise.all([
    readPortfolio(wallet, listings),
    readDexQuotes(),
  ]);

  const poolPrice = new Map(dex.map((q) => [q.listing.ticker, q.price]));
  const entries = new Map(
    (stored?.wallet.toLowerCase() === wallet.toLowerCase() ? stored.entries : []).map((e) => [
      e.ticker,
      e,
    ]),
  );

  // What each holding cost, so a shirt's points can be weighted the way the team's score is: by its
  // share of the side at kick-off, not by what it happens to be worth now.
  const priced = portfolio.holdings.map((h) => {
    const ticker = h.listing.ticker;
    // Prefer the live pool price; fall back to the oracle if the pool could not be read.
    const now = poolPrice.get(ticker) ?? h.price / 100n;
    const entry = entries.get(ticker);
    const entryPrice = entry ? BigInt(entry.entryPrice) : null;
    const entryValue = entryPrice === null ? null : (h.balance * entryPrice) / 10n ** 8n;
    const pctMove =
      entryPrice && entryPrice > 0n ? (Number(now - entryPrice) / Number(entryPrice)) * 100 : null;
    return { h, ticker, entry, entryValue, pctMove };
  });

  // Points per shirt only make sense when every shirt has a cost. With one missing, the weights are
  // wrong and the parts would not add up to the whole, so the breakdown is dropped rather than
  // shown as something that quietly disagrees with the team score.
  const complete = priced.length > 0 && priced.every((p) => p.entryValue !== null);
  const staked = complete
    ? priced.reduce((sum, p) => sum + (p.entryValue ?? 0n), 0n)
    : 0n;

  const holdings: SideHolding[] = priced.map(({ h, ticker, entry, entryValue, pctMove }) => {
    const weight =
      complete && staked > 0n && entryValue !== null ? Number(entryValue) / Number(staked) : 0;

    return {
      ticker,
      name: h.listing.name,
      position: positionOf(ticker),
      balance: h.balance,
      value: h.usd6,
      pctMove,
      points: complete && pctMove !== null ? pointsFromHolding(pctMove, weight) : null,
      isCaptain: entry?.isCaptain ?? false,
    };
  });

  return { holdings, cash: portfolio.cash, nav: portfolio.nav };
}
