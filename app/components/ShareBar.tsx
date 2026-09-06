"use client";

import { useState } from "react";
import { leagueShareUrl, shareText, tweetUrl, whatsappUrl } from "@/lib/share";

/**
 * Sharing a result.
 *
 * The link points at the read-only league view, so whoever opens it sees a real table without
 * needing a wallet, and the card that unfurls is rendered from chain state rather than from
 * anything passed in the link. A screenshot can lie; this cannot.
 */
export function ShareBar({
  leagueId,
  leagueName,
  matchday,
  rank,
  players,
  points,
  tickers,
}: {
  leagueId: number;
  leagueName: string;
  matchday: number;
  rank: number;
  players: number;
  points: number | null;
  tickers: string[];
}) {
  const [copied, setCopied] = useState(false);
  if (points === null) return null;

  const link = leagueShareUrl(leagueId);
  const text = shareText({ leagueName, matchday, rank, players, points, tickers });

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked. The share buttons still work.
    }
  }

  return (
    <div className="flex gap-2">
      <a
        href={tweetUrl(text, link)}
        target="_blank"
        rel="noreferrer"
        className="btn cut-sm flex-1 bg-chalk-100 px-4 py-2.5 text-center hed text-[17px] text-deep-950 hover:bg-white"
      >
        Post on X
      </a>
      <a
        href={whatsappUrl(text, link)}
        target="_blank"
        rel="noreferrer"
        className="btn cut-sm flex-1 border border-line-800 bg-deep-900 px-4 py-2.5 text-center hed text-[17px] text-chalk-300 hover:text-chalk-100"
      >
        WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className="cut-sm border border-line-800 bg-deep-900 px-3 py-2.5 hed text-[15px] text-chalk-500 transition hover:text-chalk-300"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
