"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAccounts } from "@/lib/useAccounts";
import {
  discoverWallets,
  getActiveWalletId,
  setActiveWalletId,
  subscribeWallets,
  walletsSnapshot,
} from "@/lib/wallets";
import { readPortfolio } from "@/lib/prices";
import { addressUrl } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";

/**
 * The league wallet, as a strip.
 *
 * Disconnected it is one line and one button. Connected it is the wallet's value set like a score,
 * because that number is the one a player checks first.
 */
const EMPTY: ReturnType<typeof walletsSnapshot> = [];

export function AccountBar() {
  const { accounts, status, error, connect, disconnect } = useAccounts();
  // Browser extensions announce themselves on request, so ask once the page is interactive.
  useEffect(discoverWallets, []);
  const wallets = useSyncExternalStore(subscribeWallets, walletsSnapshot, () => EMPTY);
  const activeId = useSyncExternalStore(subscribeWallets, getActiveWalletId, () => "base-account");
  const league = accounts?.league ?? null;

  const portfolio = useQuery({
    queryKey: ["portfolio", league],
    queryFn: () => readPortfolio(league!),
    enabled: Boolean(league),
    refetchInterval: 60_000,
  });

  if (status === "loading") {
    return <div className="h-[76px] animate-pulse rounded-2xl border border-line-800 bg-deep-900" />;
  }

  if (status !== "connected" || !accounts) {
    const others = wallets.filter((w) => w.id !== "base-account");
    return (
      <div className="cut-sm border border-line-800 bg-deep-900 p-3.5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="hed text-[19px]">League wallet</p>
            <p className="mt-0.5 text-xs leading-snug text-chalk-500">
              {activeId === "base-account"
                ? "Yours, held by a passkey. The stocks you draft land in it."
                : "The stocks you draft land in the wallet you connect."}
            </p>
          </div>
          <button
            type="button"
            onClick={connect}
            disabled={status === "connecting"}
            className="btn cut-sm shrink-0 bg-base-500 px-4 py-2.5 hed text-[17px] text-white hover:bg-base-400 disabled:opacity-60"
          >
            {status === "connecting" ? "Opening…" : "Connect"}
          </button>
        </div>

        {/* Only worth showing once a browser wallet has actually announced itself. */}
        {others.length > 0 && (
          <div className="mt-3 border-t border-line-900 pt-3">
            <p className="kicker">Connect with</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {wallets.map((w) => {
                const on = w.id === activeId;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setActiveWalletId(w.id)}
                    aria-pressed={on}
                    className={`cut-sm flex items-center gap-2 border px-3 py-2 text-xs transition ${
                      on
                        ? "border-volt bg-volt/10 text-volt"
                        : "border-line-800 text-chalk-300 hover:border-line-700 hover:text-chalk-100"
                    }`}
                  >
                    {w.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={w.icon} alt="" width={16} height={16} className="rounded-sm" />
                    ) : (
                      <span className="h-4 w-4 rounded-sm bg-base-500" />
                    )}
                    {w.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-chalk-500">
              {activeId === "base-account"
                ? "A passkey wallet gets a Sub Account and signs a whole draft once."
                : "A browser wallet signs each pick separately, and pays its own gas."}
            </p>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-down">{error}</p>}
      </div>
    );
  }

  const nav = portfolio.data?.nav;
  const cash = portfolio.data?.cash;
  const stocks = portfolio.data?.stocks;

  return (
    <div className="leather cut-sm border border-line-800 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="kicker">League wallet</p>
          {league ? (
            <a
              href={addressUrl(league)}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block font-mono text-[13px] text-chalk-300 underline-offset-2 hover:underline"
            >
              {shortAddress(league)}
            </a>
          ) : (
            <p className="mt-1 text-sm text-chalk-500">Created on your first pick</p>
          )}
        </div>
        <button
          type="button"
          onClick={disconnect}
          className="hed rounded-sm border border-line-800 px-2 py-1 text-[11px] tracking-[0.1em] text-chalk-500 transition hover:text-chalk-300"
        >
          Sign out
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="num text-[40px]">
          {portfolio.isPending ? "—" : nav !== undefined ? usd(nav) : "—"}
        </p>
        {cash !== undefined && stocks !== undefined && (
          <p className="tnum text-right text-[11px] leading-snug text-chalk-500">
            {usd(cash)} cash
            <br />
            {usd(stocks)} stocks
          </p>
        )}
      </div>

      <p className="mt-2 text-[11px] text-chalk-500">Spot only. Your wallet, your stocks. You set the cap.</p>
    </div>
  );
}
