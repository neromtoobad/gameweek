import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AccountBar } from "@/components/AccountBar";
import { MarketBoard } from "@/components/MarketBoard";
import { NextDraft } from "@/components/NextDraft";
import { LeagueList } from "@/components/LeagueList";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <header className="flex items-center gap-2">
        <Logo size={22} />
        <span className="font-semibold tracking-tight">Gameweek</span>
      </header>

      <NextDraft />

      <Link
        href="/draft"
        className="rounded-xl bg-turf-500 px-4 py-3 text-center font-semibold text-pitch-950 transition hover:bg-turf-400"
      >
        Pick your side
      </Link>

      <AccountBar />

      <LeagueList />

      <MarketBoard />

      <footer className="mt-auto pt-6 text-[11px] leading-relaxed text-chalk-500">
        Coinbase Tokenized Stocks are available only to eligible persons outside the United States.
        Nothing here is investment advice.
      </footer>
    </main>
  );
}
