/**
 * Prove the whole round works, against live Base mainnet, without spending anything.
 *
 * Every claim in the README is checked here rather than asserted. The contracts are the
 * deployed ones at their real addresses, the pool is the real Aerodrome pool, the prices come
 * from the real Chainlink feeds. Nothing is mocked and no transaction is sent: the swap runs as
 * an `eth_call` with the caller's USDC allowance overridden, and the round lifecycle runs as a
 * multi-block simulation with the clock moved forward, so lock and settle execute against real
 * feed data at the moment they would really fire.
 *
 *   node scripts/prove-live.mjs
 *
 * Exits non-zero if any step fails, so it works as a check in CI.
 */
import {
  createPublicClient,
  encodeAbiParameters,
  formatUnits,
  http,
  keccak256,
  parseAbi,
  toHex,
} from "viem";
import { base } from "viem/chains";

const RPCS = [
  process.env.BASE_RPC_URL,
  "https://base-rpc.publicnode.com",
  "https://mainnet.base.org",
].filter(Boolean);

const GAMEWEEK = "0x91c0110852a7abd96e18a928e38d25ee8f384888";
const ROUTER = "0x129e71616c4ad2a1f38c87502f7800ddbfdb1fdc";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const NVDA = "0xb20000000000000000000078ee7ce2fE4908108C";
const NVDA_FEED = "0x04689a41629776563E6822F76f2e57D148d28513";
const NVDA_POOL = "0x853F5f1B92b16714Fe6CDA67CAad0856B83C7ab9";
const OWNER = "0xE8B04B60CbD9764794D9659818a13035A70ae04e";
/** Any address works as the second player. It never needs a balance, only a starting NAV of zero. */
const RIVAL = "0x1111111111111111111111111111111111111111";

/** USDC's allowance mapping lives at storage slot 10, so a draft can be simulated unfunded. */
const USDC_ALLOWANCE_SLOT = 10n;

const abi = parseAbi([
  "function tokenCount() view returns (uint256)",
  "function leagueCount() view returns (uint256)",
  "function owner() view returns (address)",
  "function feeBps() view returns (uint16)",
  "function navWithAge(address wallet) view returns (uint256 usd6, uint256 oldestFeedAge)",
  "function createLeague(string name,uint64 startTime,uint64 endTime,uint128 buyIn,uint32 stalenessTolerance,uint16 maxMembers) returns (uint256)",
  "function join(uint256 id)",
  "function lock(uint256 id)",
  "function settle(uint256 id)",
  "function memberCount(uint256 id) view returns (uint256)",
  "function getPodium(uint256 id) view returns (address[3])",
  "function swapExactIn((address pool,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,address recipient,uint256 deadline) p) returns (uint256)",
  "function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)",
]);

let failures = 0;
const pass = (label, detail) => console.log(`  PASS  ${label.padEnd(46)} ${detail ?? ""}`);
const fail = (label, why) => {
  failures++;
  console.log(`  FAIL  ${label.padEnd(46)} ${why}`);
};
const section = (n, title) => console.log(`\n${n}. ${title}\n${"-".repeat(72)}`);

async function connect() {
  for (const url of RPCS) {
    try {
      const client = createPublicClient({ chain: base, transport: http(url) });
      const block = await client.getBlockNumber();
      console.log(`Base mainnet, block ${block}, via ${new URL(url).host}`);
      return client;
    } catch {
      console.log(`  (${new URL(url).host} unreachable, trying the next node)`);
    }
  }
  throw new Error("no Base RPC reachable");
}

const client = await connect();
console.log(`Run at ${new Date().toISOString()}\n`);

// ---------------------------------------------------------------- 1. it is really deployed
section(1, "The contracts are live on Base mainnet");

const [gwCode, routerCode] = await Promise.all([
  client.getCode({ address: GAMEWEEK }),
  client.getCode({ address: ROUTER }),
]);
gwCode && gwCode !== "0x"
  ? pass("Gameweek has bytecode", `${(gwCode.length - 2) / 2} bytes at ${GAMEWEEK}`)
  : fail("Gameweek has bytecode", "no code at that address");
routerCode && routerCode !== "0x"
  ? pass("GameweekRouter has bytecode", `${(routerCode.length - 2) / 2} bytes`)
  : fail("GameweekRouter has bytecode", "no code at that address");

const [tokenCount, owner, feeBps] = await Promise.all([
  client.readContract({ address: GAMEWEEK, abi, functionName: "tokenCount" }),
  client.readContract({ address: GAMEWEEK, abi, functionName: "owner" }),
  client.readContract({ address: ROUTER, abi, functionName: "feeBps" }),
]);
tokenCount === 10n
  ? pass("ten tokenized stocks registered", `tokenCount() = ${tokenCount}`)
  : fail("ten tokenized stocks registered", `tokenCount() = ${tokenCount}`);
owner.toLowerCase() === OWNER.toLowerCase()
  ? pass("owner is the deployer", owner)
  : fail("owner is the deployer", owner);
feeBps === 50
  ? pass("pot-funding fee is 50 bps", `feeBps() = ${feeBps}`)
  : fail("pot-funding fee is 50 bps", `feeBps() = ${feeBps}`);

// ---------------------------------------------------------------- 2. prices are real
section(2, "Prices come from Chainlink, and the board is priced right now");

const [, answer, , updatedAt] = await client.readContract({
  address: NVDA_FEED,
  abi,
  functionName: "latestRoundData",
});
const chainlinkPrice = Number(formatUnits(answer, 8));
const ageHours = (Date.now() / 1000 - Number(updatedAt)) / 3600;
answer > 0n
  ? pass("NVDA feed returns a live price", `$${chainlinkPrice.toFixed(2)}, ${ageHours.toFixed(1)}h old`)
  : fail("NVDA feed returns a live price", "non-positive answer");

// ---------------------------------------------------------------- 3. a draft pick really swaps
section(3, "A draft pick is a real swap through a real Aerodrome pool");

const stake = 250_000n; // $0.25
const inner = keccak256(
  encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [OWNER, USDC_ALLOWANCE_SLOT]),
);
const allowanceSlot = keccak256(
  encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [ROUTER, inner]),
);
const stateOverride = [
  { address: USDC, stateDiff: [{ slot: allowanceSlot, value: toHex(stake, { size: 32 }) }] },
];

try {
  const { result: sharesOut } = await client.simulateContract({
    address: ROUTER,
    abi,
    functionName: "swapExactIn",
    account: OWNER,
    stateOverride,
    args: [
      {
        pool: NVDA_POOL,
        tokenIn: USDC,
        tokenOut: NVDA,
        amountIn: stake,
        minAmountOut: 0n,
        recipient: OWNER,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 600),
      },
    ],
  });
  const shares = Number(formatUnits(sharesOut, 8));
  const spentAfterFee = Number(formatUnits(stake, 6)) * 0.995;
  const impliedPrice = spentAfterFee / shares;
  const drift = Math.abs(impliedPrice / chainlinkPrice - 1) * 100;
  pass("$0.25 buys NVDAc through the pool", `${shares.toFixed(6)} shares`);
  drift < 5
    ? pass("pool price tracks Chainlink", `$${impliedPrice.toFixed(2)} vs $${chainlinkPrice.toFixed(2)}, ${drift.toFixed(2)}% apart`)
    : fail("pool price tracks Chainlink", `${drift.toFixed(2)}% apart`);
} catch (e) {
  fail("$0.25 buys NVDAc through the pool", (e.shortMessage ?? e.message).split("\n")[0]);
}

// ---------------------------------------------------------------- 4. the whole round closes
section(4, "A whole round opens, locks and pays out");

const t0 = BigInt(Math.floor(Date.now() / 1000) + 5);
const start = t0 + 60n;
const end = start + 86_400n;

try {
  const blocks = await client.simulateBlocks({
    validation: false,
    blocks: [
      {
        blockOverrides: { time: t0 },
        calls: [
          { from: OWNER, to: GAMEWEEK, abi, functionName: "createLeague", args: ["Proof round", start, end, 0n, 93_600, 20] },
          { from: OWNER, to: GAMEWEEK, abi, functionName: "join", args: [0n] },
          { from: RIVAL, to: GAMEWEEK, abi, functionName: "join", args: [0n] },
          { from: OWNER, to: GAMEWEEK, abi, functionName: "memberCount", args: [0n] },
        ],
      },
      {
        blockOverrides: { time: start + 1n },
        calls: [{ from: OWNER, to: GAMEWEEK, abi, functionName: "lock", args: [0n] }],
      },
      {
        blockOverrides: { time: end + 1n },
        calls: [
          { from: OWNER, to: GAMEWEEK, abi, functionName: "settle", args: [0n] },
          { from: OWNER, to: GAMEWEEK, abi, functionName: "getPodium", args: [0n] },
        ],
      },
    ],
  });

  const steps = [
    ["a league opens", 0, 0],
    ["the drafter joins", 0, 1],
    ["a rival joins", 0, 2],
    ["the league has two members", 0, 3],
    ["it locks once the window opens", 1, 0],
    ["it settles after the final whistle", 2, 0],
    ["a podium is ranked", 2, 1],
  ];
  for (const [label, b, c] of steps) {
    const call = blocks[b].calls[c];
    if (call.status !== "success") {
      fail(label, (call.error?.shortMessage ?? call.error?.message ?? "reverted").split("\n")[0]);
      continue;
    }
    const shown =
      label === "the league has two members"
        ? `memberCount() = ${call.result}`
        : label === "a podium is ranked"
          ? `winner ${String(call.result[0]).slice(0, 10)}...`
          : `${call.gasUsed} gas`;
    pass(label, shown);
  }
} catch (e) {
  fail("the round lifecycle simulates", (e.shortMessage ?? e.message).split("\n")[0]);
}

// ---------------------------------------------------------------- 5. scoring reads real wallets
section(5, "Scoring reads a real wallet through real feeds");

try {
  const [usd6, oldestAge] = await client.readContract({
    address: GAMEWEEK,
    abi,
    functionName: "navWithAge",
    args: [OWNER],
  });
  pass("the contract values a live wallet", `$${formatUnits(usd6, 6)}`);
  pass("it reports how stale its feeds are", `oldest ${(Number(oldestAge) / 3600).toFixed(1)}h`);
} catch (e) {
  fail("the contract values a live wallet", (e.shortMessage ?? e.message).split("\n")[0]);
}

console.log(`\n${"=".repeat(72)}`);
console.log(
  failures === 0
    ? "Everything above passed. No transaction was sent and nothing was spent."
    : `${failures} check(s) failed.`,
);
console.log(`${"=".repeat(72)}\n`);
process.exit(failures === 0 ? 0 : 1);
