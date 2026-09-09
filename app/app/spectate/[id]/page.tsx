import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { LeagueView } from "@/components/LeagueView";

export const metadata = { title: "Watch a league · Gameweek" };

/**
 * A read-only league, for anyone who cannot or should not play.
 *
 * Coinbase Tokenized Stocks are not available to people in the United States, so a US judge cannot
 * hold one. This page lets them watch a real league settle without a wallet.
 */
export default async function SpectatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = Number.parseInt(id, 10);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-24 pt-6 lg:max-w-3xl lg:pb-28">
      <header className="flex items-center justify-between">
        <Wordmark size={22} />
        <span className="hed text-[13px] tracking-[0.12em] text-chalk-500">Watching</span>
      </header>

      {Number.isNaN(leagueId) ? (
        <p className="text-sm text-chalk-500">That is not a league number.</p>
      ) : (
        <LeagueView id={leagueId} spectator />
      )}

      <p className="text-[11px] leading-relaxed text-chalk-500">
        Read-only. No wallet needed. Everything on this page is read straight from Base.
      </p>
    </main>
  );
}
