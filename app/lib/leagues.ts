import { publicClient, multicallResilient } from "./chain";
import { gameweekAbi } from "./gameweekAbi";
import { GAMEWEEK } from "./config";

/** Mirrors Gameweek.MAX_SCORE_BPS. A score is capped at five times the starting value. */
export const MAX_SCORE_BPS = 50_000;

export type League = {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  stalenessTolerance: number;
  maxMembers: number;
  buyIn: bigint;
  pot: bigint;
  stakes: bigint;
  locked: boolean;
  settled: boolean;
  refundMode: boolean;
};

export type Standing = {
  member: `0x${string}`;
  /** Recorded at lock. Zero means the member never funded a wallet and will be skipped at settle. */
  navStart: bigint;
  /** Live value now. */
  navNow: bigint;
  /** navNow / navStart in basis points, where 10_000 is flat. Null before the league locks. */
  scoreBps: number | null;
  rank: number;
};

/** Where a league is in its week. Drives what the screen offers to do next. */
export type Phase = "drafting" | "running" | "settling" | "settled";

export function phaseOf(league: League, now: number): Phase {
  if (league.settled) return "settled";
  if (!league.locked) return now < league.startTime ? "drafting" : "settling";
  return now < league.endTime ? "running" : "settling";
}

function requireAddress(): `0x${string}` {
  if (!GAMEWEEK) throw new Error("Gameweek contract address is not configured");
  return GAMEWEEK;
}

/** Whether the app has a contract to talk to at all. */
export const hasContract = (): boolean => Boolean(GAMEWEEK);

type RawLeague = {
  name: string;
  startTime: bigint;
  endTime: bigint;
  stalenessTolerance: number;
  maxMembers: number;
  buyIn: bigint;
  pot: bigint;
  stakes: bigint;
  locked: boolean;
  settled: boolean;
  refundMode: boolean;
};

function toLeague(id: number, raw: RawLeague): League {
  return {
    id,
    name: raw.name,
    startTime: Number(raw.startTime),
    endTime: Number(raw.endTime),
    stalenessTolerance: Number(raw.stalenessTolerance),
    maxMembers: Number(raw.maxMembers),
    buyIn: raw.buyIn,
    pot: raw.pot,
    stakes: raw.stakes,
    locked: raw.locked,
    settled: raw.settled,
    refundMode: raw.refundMode,
  };
}

/** Every league on the contract, newest first. */
export async function readLeagues(): Promise<League[]> {
  const address = requireAddress();

  const count = Number(
    await publicClient.readContract({ address, abi: gameweekAbi, functionName: "leagueCount" }),
  );
  if (count === 0) return [];

  const ids = Array.from({ length: count }, (_, i) => i);
  const results = await multicallResilient<RawLeague>(
    ids.map((id) => ({ address, abi: gameweekAbi, functionName: "getLeague", args: [BigInt(id)] })),
  );

  return ids
    .flatMap((id, i) => (results[i].status === "success" ? [toLeague(id, results[i].result)] : []))
    .reverse();
}

export async function readLeague(id: number): Promise<League | null> {
  const address = requireAddress();
  try {
    const raw = (await publicClient.readContract({
      address,
      abi: gameweekAbi,
      functionName: "getLeague",
      args: [BigInt(id)],
    })) as RawLeague;
    return toLeague(id, raw);
  } catch {
    return null;
  }
}

/**
 * The leaderboard.
 *
 * Scores are the same ratio the contract will use at settlement, `navNow * 10_000 / navStart`, so
 * what a player watches all week is exactly what decides the pot. Before a league locks there is no
 * starting NAV to divide by, so members are shown with their current value and no score.
 */
export async function readStandings(id: number): Promise<Standing[]> {
  const address = requireAddress();

  const members = (await publicClient.readContract({
    address,
    abi: gameweekAbi,
    functionName: "getMembers",
    args: [BigInt(id)],
  })) as `0x${string}`[];

  if (members.length === 0) return [];

  const [starts, nows] = await Promise.all([
    multicallResilient<bigint>(
      members.map((m) => ({
        address,
        abi: gameweekAbi,
        functionName: "navStart",
        args: [BigInt(id), m],
      })),
    ),
    multicallResilient<bigint>(
      members.map((m) => ({ address, abi: gameweekAbi, functionName: "navOf", args: [m] })),
    ),
  ]);

  const rows = members.map((member, i) => {
    const navStart = starts[i].status === "success" ? starts[i].result : 0n;
    const navNow = nows[i].status === "success" ? nows[i].result : 0n;
    const raw = navStart > 0n ? Number((navNow * 10_000n) / navStart) : null;
    // Apply the contract's own ceiling. Showing an uncapped score would promise a standing that
    // settlement will not honour.
    const scoreBps = raw === null ? null : Math.min(raw, MAX_SCORE_BPS);
    return { member, navStart, navNow, scoreBps, rank: 0 };
  });

  // Highest score first. Members with no starting NAV sit at the bottom, in join order, which is
  // the same tie-break the contract applies.
  rows.sort((a, b) => {
    if (a.scoreBps === null && b.scoreBps === null) return 0;
    if (a.scoreBps === null) return 1;
    if (b.scoreBps === null) return -1;
    return b.scoreBps - a.scoreBps;
  });

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** First, second and third after settlement. A zero address means the place went unfilled. */
export async function readPodium(id: number): Promise<readonly [`0x${string}`, `0x${string}`, `0x${string}`]> {
  const address = requireAddress();
  return (await publicClient.readContract({
    address,
    abi: gameweekAbi,
    functionName: "getPodium",
    args: [BigInt(id)],
  })) as readonly [`0x${string}`, `0x${string}`, `0x${string}`];
}
