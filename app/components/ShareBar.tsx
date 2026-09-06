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
        className="flex-1 rounded-xl bg-chalk-100 px-4 py-2.5 text-center text-sm font-semibold text-deep-950 transition hover:bg-white"
      >
        Post on X
      </a>
      <a
        href={whatsappUrl(text, link)}
        target="_blank"
        rel="noreferrer"
        className="flex-1 rounded-xl border border-line-800 px-4 py-2.5 text-center text-sm font-semibold text-chalk-300 transition hover:text-chalk-100"
      >
        WhatsApp
      </a>
      <button
        type="button"
        onClick={copy}
        className="rounded-xl border border-line-800 px-3 py-2.5 text-sm text-chalk-500 transition hover:text-chalk-300"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
