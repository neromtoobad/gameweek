/**
 * Regenerates lib/leagueAbi.ts from the Foundry build output, so the front end can never drift
 * from the deployed contract. Run after any change to SundayLeague.sol:
 *
 *   cd contracts && forge build && cd ../app && bun run gen:abi
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const artifact = resolve(import.meta.dir, "../../contracts/out/SundayLeague.sol/SundayLeague.json");
const out = resolve(import.meta.dir, "../lib/leagueAbi.ts");

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
if (!Array.isArray(abi) || abi.length === 0) throw new Error("no ABI in artifact, run forge build");

const banner = `/**
 * GENERATED FILE, DO NOT EDIT.
 * Source: contracts/out/SundayLeague.sol/SundayLeague.json
 * Regenerate: cd contracts && forge build && cd ../app && bun run gen:abi
 */

`;

writeFileSync(out, `${banner}export const sundayLeagueAbi = ${JSON.stringify(abi, null, 2)} as const;\n`);

const fns = abi.filter((e: { type: string }) => e.type === "function").length;
const evs = abi.filter((e: { type: string }) => e.type === "event").length;
console.log(`wrote lib/leagueAbi.ts (${fns} functions, ${evs} events)`);
