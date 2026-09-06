import { multicallResilient } from "./chain";
import { LISTINGS, type Listing } from "./tokens";
import { USDC } from "./config";

/**
 * Aerodrome Slipstream, the deployment that actually holds the tokenized stock pools.
 *
 * Note this is not the factory published for the original Slipstream deployment
 * (0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A), whose router and quoter do not know about these
 * pools. Verified onchain 2026-09-06: all ten listings with supply have a pool here at tick
 * spacing 10, and the three with no supply have none at any spacing.
 */
export const SLIPSTREAM_FACTORY = "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef" as const;

/** Tried in order. Every stock pool is at 10 today; the rest are cheap insurance. */
const TICK_SPACINGS = [10, 1, 50, 100, 200, 2000] as const;

const Q192 = 2n ** 192n;

const factoryAbi = [
  {
    type: "function",
    name: "getPool",
    stateMutability: "view",
    inputs: [
      { name: "tokenA", type: "address" },
      { name: "tokenB", type: "address" },
      { name: "tickSpacing", type: "int24" },
    ],
    outputs: [{ type: "address" }],
  },
] as const;

const poolAbi = [
  {
    type: "function",
    name: "slot0",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "sqrtPriceX96", type: "uint160" },
      { name: "tick", type: "int24" },
      { name: "observationIndex", type: "uint16" },
      { name: "observationCardinality", type: "uint16" },
      { name: "observationCardinalityNext", type: "uint16" },
      { name: "unlocked", type: "bool" },
    ],
  },
  { type: "function", name: "liquidity", stateMutability: "view", inputs: [], outputs: [{ type: "uint128" }] },
] as const;

export type PoolInfo = {
  listing: Listing;
  pool: `0x${string}`;
  tickSpacing: number;
  /** True when USDC is token0, which decides how a price is read out of slot0. */
  usdcIsToken0: boolean;
};

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Ask the factory for every listing's pool.
 *
 * Discovered rather than hardcoded, so a new listing or a re-deployed pool needs no code change.
 * Cached for the process because the answer only changes when Aerodrome creates a pool.
 */
let cache: Promise<PoolInfo[]> | null = null;

export function discoverPools(): Promise<PoolInfo[]> {
  if (!cache) {
    // Do not cache an empty or failed sweep, or a transient RPC hiccup would blank the board for
    // the rest of the process.
    cache = discoverPoolsUncached().then((pools) => {
      if (pools.length === 0) cache = null;
      return pools;
    }).catch((e) => {
      cache = null;
      throw e;
    });
  }
  return cache;
}

async function discoverPoolsUncached(): Promise<PoolInfo[]> {
  const chosen = new Map<string, { listing: Listing; pool: `0x${string}`; tickSpacing: number }>();

  // Probe one tick spacing at a time. The public RPC drops oversized multicalls, and every stock
  // pool sits at spacing 10, so the common case is a single round of thirteen calls.
  for (const tickSpacing of TICK_SPACINGS) {
    const pending = LISTINGS.filter((l) => !chosen.has(l.ticker));
    if (pending.length === 0) break;

    const addresses = await multicallResilient<`0x${string}`>(
      pending.map((listing) => ({
        address: SLIPSTREAM_FACTORY,
        abi: factoryAbi,
        functionName: "getPool",
        args: [listing.token, USDC, tickSpacing],
      })),
    );

    pending.forEach((listing, i) => {
      const r = addresses[i];
      if (r.status !== "success") return;
      const pool = r.result;
      if (!pool || pool === ZERO) return;
      chosen.set(listing.ticker, { listing, pool, tickSpacing });
    });
  }

  // Which side of the pair is token0 follows from address order, the same rule the pool used when
  // it was created, so it needs no RPC call. Every B20 address begins 0xb2 and USDC begins 0x83, so
  // USDC is always token0 here, but the comparison is written out rather than assumed.
  return [...chosen.values()].map((f) => ({
    ...f,
    usdcIsToken0: USDC.toLowerCase() < f.listing.token.toLowerCase(),
  }));
}

/**
 * Spot price in USDC with 6 decimals, read from the pool's current sqrt price.
 *
 * slot0 gives sqrt(token1/token0) scaled by 2^96. Squaring it recovers the raw ratio, and the
 * decimal shift between an 8-decimal stock and 6-decimal USDC is the 1e8 factor below.
 */
export function priceFromSqrt(sqrtPriceX96: bigint, usdcIsToken0: boolean): bigint {
  if (sqrtPriceX96 === 0n) return 0n;
  const squared = sqrtPriceX96 * sqrtPriceX96;
  return usdcIsToken0 ? (10n ** 8n * Q192) / squared : (squared * 10n ** 8n) / Q192;
}

export type DexQuote = {
  listing: Listing;
  pool: `0x${string}`;
  tickSpacing: number;
  /** USDC per share, 6 decimals. */
  price: bigint;
  /** In-range liquidity. A rough depth signal, not a dollar figure. */
  liquidity: bigint;
};

/** Live onchain price for every listing that has a pool. No API key, no HTTP dependency. */
export async function readDexQuotes(): Promise<DexQuote[]> {
  const pools = await discoverPools();
  if (pools.length === 0) return [];

  const results = await multicallResilient<unknown>(
    pools.flatMap((p) => [
      { address: p.pool, abi: poolAbi, functionName: "slot0" },
      { address: p.pool, abi: poolAbi, functionName: "liquidity" },
    ]),
  );

  return pools.flatMap((p, i) => {
    const slot0 = results[i * 2];
    const liq = results[i * 2 + 1];
    if (slot0.status !== "success") return [];
    const [sqrtPriceX96] = slot0.result as readonly [bigint, number, number, number, number, boolean];
    const price = priceFromSqrt(sqrtPriceX96, p.usdcIsToken0);
    if (price === 0n) return [];
    // Liquidity is a depth hint only, so a missing one must not cost us the price.
    return [
      {
        listing: p.listing,
        pool: p.pool,
        tickSpacing: p.tickSpacing,
        price,
        liquidity: liq.status === "success" ? (liq.result as bigint) : 0n,
      },
    ];
  });
}
