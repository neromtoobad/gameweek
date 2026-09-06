/**
 * Reads every tokenized stock pool onchain and prints the weekend gap: what the stock trades for on
 * Base right now against what Chainlink says it closed at.
 *
 *   bun run check:pools
 */
import { readDexQuotes, discoverPools } from "../lib/pools";
import { readQuotes } from "../lib/prices";
import { sharePrice } from "../lib/format";

const pools = await discoverPools();
const [dex, oracle] = await Promise.all([readDexQuotes(), readQuotes()]);
const oracleByTicker = new Map(oracle.map((q) => [q.listing.ticker, q]));

console.log(`pools discovered: ${pools.length} of 13 listings\n`);
console.log(
  `${"TICKER".padEnd(8)}${"DEX".padStart(10)}${"CLOSE".padStart(10)}${"GAP".padStart(9)}   POOL`,
);

let gaps = 0;
for (const q of dex.sort((a, b) => a.listing.ticker.localeCompare(b.listing.ticker))) {
  const o = oracleByTicker.get(q.listing.ticker);
  if (!o) continue;
  const dexUsd = Number(q.price) / 1e6;
  const closeUsd = Number(o.price) / 1e8;
  const gap = (dexUsd / closeUsd - 1) * 100;
  gaps++;
  console.log(
    `${q.listing.ticker.padEnd(8)}${sharePrice(BigInt(Math.round(dexUsd * 1e8))).padStart(10)}` +
      `${sharePrice(o.price).padStart(10)}${`${gap >= 0 ? "+" : ""}${gap.toFixed(2)}%`.padStart(9)}   ${q.pool}`,
  );
}
console.log(`\n${gaps} tradeable listings priced onchain`);
