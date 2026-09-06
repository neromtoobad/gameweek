import { USDC_DECIMALS } from "./config";

/** Format a 6-decimal USD amount. Compact by default so leaderboards stay narrow. */
export function usd(value: bigint, opts: { cents?: boolean } = {}): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 10n ** BigInt(USDC_DECIMALS);
  const frac = abs % 10n ** BigInt(USDC_DECIMALS);
  const cents = Number(frac) / 10 ** USDC_DECIMALS;
  const n = Number(whole) + cents;

  const formatted = n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts.cents === false ? 0 : 2,
    maximumFractionDigits: opts.cents === false ? 0 : 2,
  });
  return negative ? `-${formatted}` : formatted;
}

/** Format an 8-decimal Chainlink answer as a share price. */
export function sharePrice(answer: bigint): string {
  const n = Number(answer) / 1e8;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format a share quantity held in 8 decimals. */
export function shares(balance: bigint): string {
  const n = Number(balance) / 1e8;
  if (n === 0) return "0";
  if (n < 0.0001) return "<0.0001";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** A ratio in basis points where 10_000 is flat, rendered as a signed percentage. */
export function scoreToPercent(scoreBps: bigint): string {
  const delta = (Number(scoreBps) - 10_000) / 100;
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)}%`;
}

export function shortAddress(address?: string): string {
  if (!address) return "";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** Human duration for a feed age, e.g. "34h ago". */
export function ago(seconds: number): string {
  if (seconds < 90) return `${Math.round(seconds)}s ago`;
  const minutes = seconds / 60;
  if (minutes < 90) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function countdown(target: number, now: number = Date.now() / 1000): string {
  const left = Math.max(0, target - now);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = Math.floor(left % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}
