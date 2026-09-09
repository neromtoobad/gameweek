import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { LeagueView } from "@/components/LeagueView";
import { readLeague } from "@/lib/leagues";
import { APP_URL } from "@/lib/config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const league = await readLeague(Number.parseInt(id, 10)).catch(() => null);
  const title = league ? `${league.name} · Gameweek` : "Gameweek";
  return {
    title,
    description: "Fantasy football, except the players are real stocks.",
    openGraph: { title, images: [`${APP_URL}/api/og/${id}`] },
    twitter: { card: "summary_large_image", title, images: [`${APP_URL}/api/og/${id}`] },
  };
}

export default async function LeaguePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = Number.parseInt(id, 10);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 pb-24 pt-6 lg:max-w-3xl lg:pb-28">
      <header className="flex items-center justify-between">
        <Wordmark size={22} />
        <Link
          href={`/spectate/${id}`}
          className="hed rounded-sm border border-line-800 px-2 py-1 text-[11px] tracking-[0.12em] text-chalk-500 transition hover:text-chalk-300"
        >
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
