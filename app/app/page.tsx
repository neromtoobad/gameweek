import { AccountBar } from "@/components/AccountBar";
import { MarketBoard } from "@/components/MarketBoard";
import { NextDraft } from "@/components/NextDraft";
import { GAMEWEEK } from "@/lib/config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col gap-5 px-4 pb-16 pt-6">
      <header className="flex items-center gap-2">
        <span aria-hidden className="text-xl">
          🏆
        </span>
        <span className="font-semibold tracking-tight">Gameweek</span>
      </header>

      <NextDraft />
      <AccountBar />

      {!GAMEWEEK && (
        <p className="rounded-xl border border-dashed border-line-800 px-4 py-3 text-xs leading-relaxed text-chalk-500">
          Leagues appear here once the contract is deployed. The board below is live either way.
        </p>
      )}

      <MarketBoard />

      <footer className="mt-auto pt-6 text-[11px] leading-relaxed text-chalk-500">
        Coinbase Tokenized Stocks are available only to eligible persons outside the United States.
        Nothing here is investment advice.
      </footer>
    </main>
  );
}
