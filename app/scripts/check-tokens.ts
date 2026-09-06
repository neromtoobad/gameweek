/**
 * Proves app/lib/tokens.ts still matches contracts/config/tokens.json, which the deploy uses.
 * A silent divergence here would price a league against the wrong feed.
 *
 *   bun run check:tokens
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { LISTINGS } from "../lib/tokens";

const config = JSON.parse(
  readFileSync(resolve(import.meta.dir, "../../contracts/config/tokens.json"), "utf8"),
);

const problems: string[] = [];

if (config.count !== config.listings.length) {
  problems.push(`tokens.json count is ${config.count} but it has ${config.listings.length} listings`);
}
if (config.listings.length !== LISTINGS.length) {
  problems.push(`tokens.json has ${config.listings.length} listings, lib/tokens.ts has ${LISTINGS.length}`);
}

for (const [i, expected] of config.listings.entries()) {
  const actual = LISTINGS[i];
  if (!actual) continue;
  for (const key of ["ticker", "token", "feed", "live"] as const) {
    const a = typeof actual[key] === "string" ? (actual[key] as string).toLowerCase() : actual[key];
    const b = typeof expected[key] === "string" ? expected[key].toLowerCase() : expected[key];
    if (a !== b) problems.push(`listing ${i} (${expected.ticker}): ${key} is ${actual[key]}, expected ${expected[key]}`);
  }
}

if (problems.length > 0) {
  console.error("tokens.ts and tokens.json disagree:");
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(`tokens.ts matches tokens.json (${LISTINGS.length} listings, ${LISTINGS.filter((l) => l.live).length} tradeable)`);
