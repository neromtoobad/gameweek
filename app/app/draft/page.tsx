import { Wordmark } from "@/components/Wordmark";
import { SquadBuilder } from "@/components/SquadBuilder";

export const metadata = { title: "Draft · Gameweek" };

export default function DraftPage() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-24 pt-6">
      <header className="flex items-center justify-between">
        <Wordmark size={22} />
        <span className="hed text-[13px] tracking-[0.12em] text-chalk-500">Pick your side</span>
      </header>

      <SquadBuilder />
    </main>
  );
}
