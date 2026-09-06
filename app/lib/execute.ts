"use client";

import { encodeFunctionData, erc20Abi as viemErc20Abi } from "viem";
import { getProvider } from "./baseAccount";
import { CHAIN_ID, GAMEWEEK_ROUTER, PAYMASTER_URL, USDC } from "./config";
import type { Pick } from "./draft";

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

export type Call = { to: `0x${string}`; data: `0x${string}`; value: `0x${string}` };

const DEADLINE_SECONDS = 600;

/**
 * Turn a set of picks into one batch of calls.
 *
 * A whole draft is a single transaction: approve the router once for the total, then one swap per
 * pick. Batched through wallet_sendCalls it is one signature for the player, and it is atomic, so
 * nobody ends a draft holding two of three picks.
 */
export function buildDraftCalls(picks: Pick[], leagueWallet: `0x${string}`): Call[] {
  if (picks.length === 0) return [];
  if (!GAMEWEEK_ROUTER) throw new Error("Router address is not configured");

  const total = picks.reduce((sum, p) => sum + p.stake, 0n);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);

  const approve: Call = {
    to: USDC,
    data: encodeFunctionData({
      abi: viemErc20Abi,
      functionName: "approve",
      args: [GAMEWEEK_ROUTER, total],
    }),
    value: "0x0",
  };

  const swaps: Call[] = picks.map((p) => ({
    to: GAMEWEEK_ROUTER as `0x${string}`,
    data: encodeFunctionData({
      abi: routerAbi,
      functionName: "swapExactIn",
      args: [
        {
          pool: p.pool,
          tokenIn: USDC,
          tokenOut: p.listing.token,
          amountIn: p.stake,
          minAmountOut: p.minShares,
          recipient: leagueWallet,
          deadline,
        },
      ],
    }),
    value: "0x0",
  }));

  return [approve, ...swaps];
}

/**
 * Submit the draft from the player's league wallet.
 *
 * The Sub Account is the `from`, so the stocks land in the wallet the league is scored on. The
 * paymaster capability is what makes a pick cost the player nothing but the stake itself.
 */
export async function submitDraft(picks: Pick[], leagueWallet: `0x${string}`): Promise<string> {
  const calls = buildDraftCalls(picks, leagueWallet);
  const provider = getProvider();

  const result = await provider.request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0",
        chainId: `0x${CHAIN_ID.toString(16)}`,
        from: leagueWallet,
        atomicRequired: true,
        calls,
        ...(PAYMASTER_URL ? { capabilities: { paymasterService: { url: PAYMASTER_URL } } } : {}),
      },
    ],
  });

  // Depending on wallet version this is either a bare id or an object carrying one.
  if (typeof result === "string") return result;
  const asObject = result as { id?: string } | null;
  return asObject?.id ?? "";
}

export type DraftReadiness = { ready: true } | { ready: false; reason: string };

/** What is still missing before a draft can actually be submitted. */
export function draftReadiness(leagueWallet: `0x${string}` | null): DraftReadiness {
  if (!GAMEWEEK_ROUTER) return { ready: false, reason: "Router not deployed yet" };
  if (!leagueWallet) return { ready: false, reason: "Connect to get a league wallet" };
  return { ready: true };
}
