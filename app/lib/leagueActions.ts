"use client";

import { encodeFunctionData } from "viem";
import { getProvider } from "./baseAccount";
import { gameweekAbi } from "./gameweekAbi";
import { CHAIN_ID, GAMEWEEK, PAYMASTER_URL } from "./config";

type Action = "join" | "lock" | "settle";

/**
 * Send one league action from the player's league wallet.
 *
 * `join` has to come from the Sub Account, because whichever address calls it is the one the league
 * scores. `lock` and `settle` are open to anyone, so the same wallet is fine for those too.
 */
export async function sendLeagueAction(
  action: Action,
  leagueId: number,
  from: `0x${string}`,
): Promise<string> {
  if (!GAMEWEEK) throw new Error("Gameweek contract address is not configured");

  const data = encodeFunctionData({
    abi: gameweekAbi,
    functionName: action,
    args: [BigInt(leagueId)],
  });

  const result = await getProvider().request({
    method: "wallet_sendCalls",
    params: [
      {
        version: "2.0",
        chainId: `0x${CHAIN_ID.toString(16)}`,
        from,
        atomicRequired: true,
        calls: [{ to: GAMEWEEK, data, value: "0x0" }],
        ...(PAYMASTER_URL ? { capabilities: { paymasterService: { url: PAYMASTER_URL } } } : {}),
      },
    ],
  });

  if (typeof result === "string") return result;
  return (result as { id?: string } | null)?.id ?? "";
}
