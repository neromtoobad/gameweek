import Link from "next/link";
import { LeagueView } from "@/components/LeagueView";

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = Number.parseInt(id, 10);

  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-chalk-500 transition hover:text-chalk-300">
          ← Gameweek
        </Link>
        <Link href={`/spectate/${id}`} className="text-xs text-chalk-500 transition hover:text-chalk-300">
          Share view
        </Link>
      </header>

      {Number.isNaN(leagueId) ? (
        <p className="text-sm text-chalk-500">That is not a league number.</p>
      ) : (
        <LeagueView id={leagueId} />
      )}
    </main>
  );
}
