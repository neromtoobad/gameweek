import { Logo } from "@/components/Logo";
import { AccountBar } from "@/components/AccountBar";
import { MarketBoard } from "@/components/MarketBoard";
import { Hero } from "@/components/Hero";
import { LeagueList } from "@/components/LeagueList";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-24 pt-5">
      <header className="flex items-center gap-2.5">
        <Logo size={26} />
        <span className="text-lg font-bold tracking-tight">Gameweek</span>
      </header>

      <Hero />


      <div className="rise" style={{ ["--i" as string]: 1 }}>
        <AccountBar />
      </div>

      <div id="leagues" className="rise" style={{ ["--i" as string]: 2 }}>
        <LeagueList />
      </div>

      <MarketBoard />

      <footer className="mt-auto pt-6 text-[11px] leading-relaxed text-chalk-500">
        Coinbase Tokenized Stocks are available only to eligible persons outside the United States.
        Nothing here is investment advice.
      </footer>
    </main>
  );
}
