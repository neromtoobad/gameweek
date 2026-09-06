import { createPublicClient, http, defineChain } from "viem";
import { base } from "viem/chains";
import { RPC_URL } from "./config";

export const baseChain = defineChain({ ...base, rpcUrls: { default: { http: [RPC_URL] } } });

/** Read-only client. Every price and balance on the shell comes through here, no API key needed. */
export const publicClient = createPublicClient({
  chain: baseChain,
  transport: http(RPC_URL, { batch: true }),
});

type MulticallEntry = { address: `0x${string}`; abi: readonly unknown[]; functionName: string; args?: readonly unknown[] };
export type MulticallResult<T> = { status: "success"; result: T } | { status: "failure" };

/**
 * A multicall that survives a rate-limited RPC.
 *
 * Public Base RPCs throttle bursts, and viem reports a throttled batch as a per-call failure that
 * looks exactly like a reverted call. Dropping those silently makes a whole board of prices vanish,
 * so failed entries are retried on their own with a short backoff. Whatever still fails after the
 * last attempt is genuinely unavailable.
 */
/**
 * Whether this chain has the Multicall3 the client is configured to use.
 *
 * The chain config carries Base's address, so pointing the same client at a local node leaves it
 * calling into nothing. Retrying that three times per batch cost five seconds a page. Probed once
 * and remembered.
 */
let multicallAvailable: Promise<boolean> | null = null;

function hasMulticall(): Promise<boolean> {
  if (!multicallAvailable) {
    const address = publicClient.chain?.contracts?.multicall3?.address;
    multicallAvailable = !address
      ? Promise.resolve(false)
      : publicClient
          .getCode({ address })
          .then((code) => Boolean(code && code !== "0x"))
          .catch(() => false);
  }
  return multicallAvailable;
}

export async function multicallResilient<T = unknown>(
  contracts: MulticallEntry[],
  { attempts = 3, delayMs = 400 }: { attempts?: number; delayMs?: number } = {},
): Promise<MulticallResult<T>[]> {
  const out: MulticallResult<T>[] = contracts.map(() => ({ status: "failure" }));
  let pending = contracts.map((_, i) => i);

  const batching = await hasMulticall();
  if (!batching) attempts = 0; // go straight to individual calls

  for (let attempt = 0; attempt < attempts && pending.length > 0; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, delayMs * attempt));

    let results;
    try {
      results = (await publicClient.multicall({
        // viem's contract typing is stricter than this generic helper needs.
        contracts: pending.map((i) => contracts[i]) as never,
        allowFailure: true,
      })) as unknown as ReadonlyArray<{ status: "success"; result: unknown } | { status: "failure" }>;
    } catch {
      continue; // whole batch rejected, try again
    }

    const stillPending: number[] = [];
    pending.forEach((originalIndex, j) => {
      const r = results[j];
      if (r.status === "success") out[originalIndex] = { status: "success", result: r.result as T };
      else stillPending.push(originalIndex);
    });
    pending = stillPending;
  }

  // Multicall3 may not exist on the chain at all. It is deployed on Base, but a local anvil node
  // has nothing at that address, and the failure is indistinguishable from a throttled batch. Fall
  // back to plain calls so local development and mainnet behave the same.
  if (pending.length > 0) {
    const settled = await Promise.allSettled(
      pending.map((i) =>
        publicClient.readContract({
          address: contracts[i].address,
          abi: contracts[i].abi as never,
          functionName: contracts[i].functionName,
          args: contracts[i].args as never,
        }),
      ),
    );
    pending.forEach((originalIndex, j) => {
      const r = settled[j];
      if (r.status === "fulfilled") out[originalIndex] = { status: "success", result: r.value as T };
    });
  }

  return out;
}

export const erc20Abi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

export const aggregatorAbi = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;
