import { aggregatorAbi, erc20Abi, multicallResilient } from "./chain";
import { LISTINGS, type Listing } from "./tokens";
import { USDC } from "./config";

export type Quote = {
  listing: Listing;
  /** Chainlink answer with 8 decimals. */
  price: bigint;
  /** Unix seconds of the last feed update. */
  updatedAt: number;
  /** Seconds since that update. */
  age: number;
};

/**
 * Read every Chainlink equity feed in one multicall.
 *
 * These feeds run 24/5. Outside US market hours they hold the last close and stop publishing, so a
 * large age is normal on a weekend rather than a fault. Scoring rejects stale feeds; display does
 * not, it labels them.
 */
export async function readQuotes(listings: Listing[] = LISTINGS): Promise<Quote[]> {
  const results = await multicallResilient<readonly [bigint, bigint, bigint, bigint, bigint]>(
    listings.map((l) => ({ address: l.feed, abi: aggregatorAbi, functionName: "latestRoundData" })),
  );

  const now = Math.floor(Date.now() / 1000);

  return listings.flatMap((listing, i) => {
    const r = results[i];
    if (r.status !== "success") return [];
    const [, answer, , updatedAt] = r.result;
    if (answer <= 0n) return [];
    return [{ listing, price: answer, updatedAt: Number(updatedAt), age: now - Number(updatedAt) }];
  });
}

/**
 * Whether the equity feeds are currently publishing.
 *
 * Derived from the freshest feed rather than a hardcoded NYSE calendar, so holidays and early
 * closes are handled without a schedule to maintain.
 */
export function marketState(quotes: Quote[]): { open: boolean; youngest: number } {
  if (quotes.length === 0) return { open: false, youngest: Number.POSITIVE_INFINITY };
  const youngest = Math.min(...quotes.map((q) => q.age));
  return { open: youngest < 3600, youngest };
}

export type Holding = { listing: Listing; balance: bigint; price: bigint; usd6: bigint };

/**
 * Value a wallet the same way the contract does:
 *   usd6 = balanceOf * price / 10 ** (tokenDecimals + feedDecimals - 6) = balance * price / 1e10
 */
export async function readPortfolio(wallet: `0x${string}`, listings: Listing[] = LISTINGS) {
  const [balances, quotes] = await Promise.all([
    multicallResilient<bigint>([
      { address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet] },
      ...listings.map((l) => ({
        address: l.token,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [wallet],
      })),
    ]),
    readQuotes(listings),
  ]);

  const priceByTicker = new Map(quotes.map((q) => [q.listing.ticker, q.price]));

  const cash = balances[0].status === "success" ? balances[0].result : 0n;

  const holdings: Holding[] = [];
  listings.forEach((listing, i) => {
    const r = balances[i + 1];
    if (r.status !== "success") return;
    const balance = r.result;
    if (balance === 0n) return;
    const price = priceByTicker.get(listing.ticker);
    if (!price) return;
    holdings.push({ listing, balance, price, usd6: (balance * price) / 10n ** 10n });
  });

  const stocks = holdings.reduce((sum, h) => sum + h.usd6, 0n);
  return { cash, holdings, stocks, nav: cash + stocks, quotes };
}
