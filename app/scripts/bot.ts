/**
 * Sunday Bot.
 *
 * An agent with its own wallet that fields a side every round: it reads the board, picks a legal
 * 1-2-2, names a captain, and buys the stocks itself. Nobody drives it and it holds its own
 * positions, which is the point. A league is never empty, and there is always something to beat.
 *
 *   bun run bot            # show the side it would field, send nothing
 *   bun run bot --send     # join if needed, then buy the side
 *
 * Environment:
 *   BOT_PRIVATE_KEY            required to send. A hot wallet: fund it with at most $1.
 *   NEXT_PUBLIC_GAMEWEEK       the league contract
 *   NEXT_PUBLIC_GAMEWEEK_ROUTER the router that executes picks
 *   NEXT_PUBLIC_RPC_URL        a Base RPC
 *   BOT_LEAGUE                 league id to play in, default 0
 *   BOT_BUDGET                 USDC to commit, in whole cents, default 50 for fifty cents
 *
 * The key lives in the environment rather than a keystore on purpose: this wallet is meant to sign
 * unattended on a schedule. It is capped at a dollar and holds nothing that matters.
 */
import { createWalletClient, createPublicClient, http, encodeFunctionData, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";

import { readDexQuotes } from "../lib/pools";
import { readQuotes } from "../lib/prices";
import { buildDeck, quoteStake } from "../lib/draft";
import { pickSide, explainPick, STRATEGY_NAME, STRATEGY_LINE } from "../lib/strategy";
import { splitBudget } from "../lib/points";
import { SQUAD_SIZE } from "../lib/squad";
import { gameweekAbi } from "../lib/gameweekAbi";
import { GAMEWEEK, GAMEWEEK_ROUTER, RPC_URL, USDC, txUrl } from "../lib/config";

const send = process.argv.includes("--send");
const leagueId = BigInt(process.env.BOT_LEAGUE ?? "0");
const budget = BigInt(process.env.BOT_BUDGET ?? "50") * 10_000n; // cents -> USDC units

const routerAbi = [
  {
    type: "function",
    name: "swapExactIn",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "p",
        type: "tuple",
        components: [
          { name: "pool", type: "address" },
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "minAmountOut", type: "uint256" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
        ],
      },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

const usd = (v: bigint) => `$${(Number(v) / 1e6).toFixed(2)}`;

// ---------------------------------------------------------------- pick

console.log(`\n${STRATEGY_NAME}`);
console.log(`${STRATEGY_LINE}\n`);

const [dex, oracle] = await Promise.all([readDexQuotes(), readQuotes()]);
const deck = buildDeck(dex, oracle);
const side = pickSide(deck);

if (side.length === 0) {
  console.error("No side to field. Either no pool has liquidity, or no feed answered.");
  process.exit(1);
}
if (side.length < SQUAD_SIZE) {
  console.warn(`Only ${side.length} of ${SQUAD_SIZE} positions could be filled from liquid pools.\n`);
}

const { base: baseStake, captain: captainStake } = splitBudget(budget, side.length);
const picks = side.map((p) => {
  const stake = p.isCaptain ? captainStake : baseStake;
  return { ...p, stake, ...quoteStake(p.card, stake) };
});
const total = picks.reduce((sum, p) => sum + p.stake, 0n);

for (const p of picks) {
  const shares = (Number(p.expectedShares) / 1e8).toFixed(5);
  console.log(`  ${explainPick(p).padEnd(38)} ${usd(p.stake).padStart(7)}  ~${shares} shares`);
}
console.log(`\n  budget ${usd(budget)}   committing ${usd(total)}   league #${leagueId}`);

if (!send) {
  console.log("\nDry run. Pass --send to join and buy.\n");
  process.exit(0);
}

// ---------------------------------------------------------------- send

const key = process.env.BOT_PRIVATE_KEY as `0x${string}` | undefined;
if (!key) throw new Error("BOT_PRIVATE_KEY is required to send");
if (!GAMEWEEK || !GAMEWEEK_ROUTER) throw new Error("Contract addresses are not configured");

const account = privateKeyToAccount(key);
const chain = { ...base, rpcUrls: { default: { http: [RPC_URL] } } };
const publicClient = createPublicClient({ chain, transport: http(RPC_URL) });
const wallet = createWalletClient({ account, chain, transport: http(RPC_URL) });

console.log(`\n  wallet ${account.address}`);

const cash = await publicClient.readContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [account.address],
});
console.log(`  usdc   ${usd(cash)}`);
if (cash < total) throw new Error(`Not enough USDC: needs ${usd(total)}, holds ${usd(cash)}`);

const members = (await publicClient.readContract({
  address: GAMEWEEK,
  abi: gameweekAbi,
  functionName: "getMembers",
  args: [leagueId],
})) as `0x${string}`[];

if (!members.some((m) => m.toLowerCase() === account.address.toLowerCase())) {
  console.log("\n  joining…");
  const hash = await wallet.writeContract({
    address: GAMEWEEK,
    abi: gameweekAbi,
    functionName: "join",
    args: [leagueId],
  });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log(`  joined  ${txUrl(hash)}`);
}

// One approval for the whole side, then a swap per pick. Sequential rather than batched: this is an
// EOA, so there is no wallet_sendCalls to lean on, and a failed pick should not lose the others.
console.log("\n  approving the router…");
const approval = await wallet.writeContract({
  address: USDC,
  abi: erc20Abi,
  functionName: "approve",
  args: [GAMEWEEK_ROUTER, total],
});
await publicClient.waitForTransactionReceipt({ hash: approval });

const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
let bought = 0;

for (const p of picks) {
  const ticker = p.card.listing.ticker;
  try {
    const hash = await wallet.sendTransaction({
      to: GAMEWEEK_ROUTER,
      data: encodeFunctionData({
        abi: routerAbi,
        functionName: "swapExactIn",
        args: [
          {
            pool: p.card.pool,
            tokenIn: USDC,
            tokenOut: p.card.listing.token,
            amountIn: p.stake,
            minAmountOut: p.minShares,
            recipient: account.address,
            deadline,
          },
        ],
      }),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    bought += 1;
    console.log(`  bought ${ticker.padEnd(7)} ${usd(p.stake).padStart(7)}  ${txUrl(hash)}`);
  } catch (e) {
    // One thin pool should not cost the bot its whole side.
    console.error(`  failed ${ticker.padEnd(7)} ${e instanceof Error ? e.message.split("\n")[0] : e}`);
  }
}

console.log(`\n  fielded ${bought} of ${picks.length}\n`);
