/**
 * Regenerates lib/gameweekAbi.ts from the Foundry build output, so the front end can never drift
 * from the deployed contract. Run after any change to Gameweek.sol:
 *
 *   cd contracts && forge build && cd ../app && bun run gen:abi
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const artifact = resolve(import.meta.dir, "../../contracts/out/Gameweek.sol/Gameweek.json");
const out = resolve(import.meta.dir, "../lib/gameweekAbi.ts");

const { abi } = JSON.parse(readFileSync(artifact, "utf8"));
if (!Array.isArray(abi) || abi.length === 0) throw new Error("no ABI in artifact, run forge build");

const banner = `/**
 * GENERATED FILE, DO NOT EDIT.
 * Source: contracts/out/Gameweek.sol/Gameweek.json
 * Regenerate: cd contracts && forge build && cd ../app && bun run gen:abi
 */

`;

writeFileSync(out, `${banner}export const gameweekAbi = ${JSON.stringify(abi, null, 2)} as const;\n`);

const fns = abi.filter((e: { type: string }) => e.type === "function").length;
const evs = abi.filter((e: { type: string }) => e.type === "event").length;
console.log(`wrote lib/gameweekAbi.ts (${fns} functions, ${evs} events)`);
