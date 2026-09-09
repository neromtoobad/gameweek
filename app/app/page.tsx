import { AccountBar } from "@/components/AccountBar";
import { MarketBoard } from "@/components/MarketBoard";
import { Hero } from "@/components/Hero";
import { LeagueList } from "@/components/LeagueList";
import { Marquee } from "@/components/Marquee";
import { Wordmark } from "@/components/Wordmark";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-6 px-4 pb-24 pt-4 lg:px-8 lg:pb-28 lg:pt-6">
      <header className="flex items-center justify-between">
        <Wordmark size={26} />
        <span className="hed rounded-sm border border-line-800 px-2 py-1 text-[11px] tracking-[0.12em] text-chalk-500">
          on Base
        </span>
      </header>

      <div className="-mx-4 -mt-2 lg:-mx-8">
        <Marquee />
      </div>

      {/* One column on a phone. On a laptop the pitch keeps the left and the board takes its
          own side, so neither has to be scrolled past to reach the other. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <div className="flex flex-col gap-6">
          <Hero />

          <div className="rise" style={{ ["--i" as string]: 1 }}>
            <AccountBar />
          </div>

          <div id="leagues" className="rise" style={{ ["--i" as string]: 2 }}>
            <LeagueList />
          </div>
        </div>

        <div className="lg:sticky lg:top-4">
          <MarketBoard />
        </div>
      </div>

      <footer className="mt-auto pt-6 text-[11px] leading-relaxed text-chalk-500 lg:max-w-[70ch]">
        Coinbase Tokenized Stocks are available only to eligible persons outside the United States.
        Nothing here is investment advice.
      </footer>
    </main>
  );
}
