import Link from "next/link";
import { SquadBuilder } from "@/components/SquadBuilder";

export const metadata = { title: "Draft · Gameweek" };

export default function DraftPage() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="text-sm text-chalk-500 transition hover:text-chalk-300">
          ← Gameweek
        </Link>
        <span className="text-sm font-semibold">Pick your side</span>
      </header>

      <SquadBuilder />
    </main>
  );
}
