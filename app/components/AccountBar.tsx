"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccounts } from "@/lib/useAccounts";
import { readPortfolio } from "@/lib/prices";
import { addressUrl } from "@/lib/config";
import { shortAddress, usd } from "@/lib/format";

export function AccountBar() {
  const { accounts, status, error, connect, disconnect } = useAccounts();
  const league = accounts?.league ?? null;

  const portfolio = useQuery({
    queryKey: ["portfolio", league],
    queryFn: () => readPortfolio(league!),
    enabled: Boolean(league),
    refetchInterval: 60_000,
  });

  if (status === "loading") {
    return <div className="h-[92px] animate-pulse rounded-2xl border border-line-800 bg-deep-900/60" />;
  }

  if (status !== "connected" || !accounts) {
    return (
      <div className="rounded-2xl border border-line-800 bg-deep-900/60 p-4">
        <p className="text-sm text-chalk-300">
          Connect to get a league wallet. It is yours, held by a passkey, and the stocks you draft
          land in it.
        </p>
        <button
          type="button"
          onClick={connect}
          disabled={status === "connecting"}
          className="mt-3 w-full rounded-xl bg-base-500 px-4 py-3 font-bold text-white shadow-lg shadow-base-500/25 transition hover:bg-base-400 disabled:opacity-60"
        >
          {status === "connecting" ? "Opening Base Account…" : "Connect"}
        </button>
        {error && <p className="mt-2 text-xs text-down">{error}</p>}
      </div>
    );
  }

  const nav = portfolio.data?.nav;
  const cash = portfolio.data?.cash;
  const stocks = portfolio.data?.stocks;

  return (
    <div className="rounded-2xl border border-line-800 bg-deep-900/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-chalk-500">League wallet</p>
          {league ? (
            <a
              href={addressUrl(league)}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-sm text-chalk-300 underline-offset-2 hover:underline"
            >
              {shortAddress(league)}
            </a>
          ) : (
            <p className="text-sm text-chalk-500">Created on your first pick</p>
          )}
        </div>
        <button
          type="button"
          onClick={disconnect}
          className="rounded-lg border border-line-800 px-2.5 py-1 text-xs text-chalk-500 transition hover:text-chalk-300"
        >
          Sign out
        </button>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-chalk-500">Value</p>
          <p className="tnum text-3xl font-semibold">
            {portfolio.isPending ? "—" : nav !== undefined ? usd(nav) : "—"}
          </p>
        </div>
        {cash !== undefined && stocks !== undefined && (
          <p className="tnum text-right text-xs text-chalk-500">
            {usd(cash)} cash
            <br />
            {usd(stocks)} stocks
          </p>
        )}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-chalk-500">
        Spot only. Your wallet, your stocks. You set the weekly cap.
      </p>
    </div>
  );
}
