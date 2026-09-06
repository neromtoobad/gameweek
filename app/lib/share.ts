import { APP_URL } from "./config";

/** The link a player shares. Opens the league read-only, so anyone can look without a wallet. */
export const leagueShareUrl = (leagueId: number): string => `${APP_URL}/spectate/${leagueId}`;

/** The card that unfurls on that link. */
export const cardUrl = (leagueId: number, player: string): string =>
  `${APP_URL}/api/og/${leagueId}?player=${player}`;

/**
 * What a player posts.
 *
 * Written to be worth reading on its own: a score, a formation, and the one thing about this game
 * nobody else can claim, which is that the market it plays on never shuts.
 */
export function shareText({
  leagueName,
  matchday,
  rank,
  players,
  points,
  tickers,
}: {
  leagueName: string;
  matchday: number;
  rank: number;
  players: number;
  points: number;
  tickers: string[];
}): string {
  const sign = points > 0 ? "+" : "";
  const side = tickers.map((t) => t.replace(/c$/, "")).join(" ");
  return [
    `Matchday ${matchday}, ${leagueName}: ${rank} of ${players} on ${sign}${points} pts.`,
    side && `My side: ${side}.`,
    `Real stocks, onchain, on Base.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const tweetUrl = (text: string, link: string): string =>
  `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`;

export const whatsappUrl = (text: string, link: string): string =>
  `https://wa.me/?text=${encodeURIComponent(`${text}\n${link}`)}`;
