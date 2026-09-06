import Link from "next/link";
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
    <main className="flex flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-chalk-500 transition hover:text-chalk-300">
          ← Gameweek
        </Link>
        <span className="text-xs text-chalk-500">Watching</span>
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
