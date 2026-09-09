"use client";
import type { EIP1193Provider } from "viem";
import { CHAIN_ID } from "./config";

/**
 * Wallet choice, for players who do not want a passkey.
 *
 * The Base Account is still the default and still the best experience: it provisions a Sub Account
 * as the league wallet and can batch a whole draft into one signature. But a player who already
 * keeps funds in MetaMask, Rainbow or Coinbase Wallet should not have to move them to play, and a
 * judge should be able to look around with whatever they already have installed.
 *
 * Injected wallets are discovered through EIP-6963 rather than by reading `window.ethereum`, which
 * is whichever extension happened to win the race to define it. Nothing here bundles a connector
 * library: every one of these wallets speaks EIP-1193, which is the only interface the app uses.
 */

export type WalletId = "base-account" | `injected:${string}`;

export type WalletChoice = {
  id: WalletId;
  name: string;
  icon: string | null;
  /** The Base Account provisions a Sub Account; an injected wallet just uses the account itself. */
  hasSubAccount: boolean;
};

type Eip6963Detail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EIP1193Provider;
};

const injected = new Map<string, Eip6963Detail>();
const listeners = new Set<() => void>();
let discovered = false;

function announce() {
  snapshotStale = true;
  listeners.forEach((fn) => fn());
}

/**
 * Ask every installed wallet to announce itself.
 *
 * Extensions answer synchronously in practice, but they are allowed to answer late, so the result
 * is a live map that re-renders whatever is subscribed rather than a one-shot read.
 */
export function discoverWallets() {
  if (typeof window === "undefined" || discovered) return;
  discovered = true;
  window.addEventListener("eip6963:announceProvider", (event) => {
    const detail = (event as CustomEvent<Eip6963Detail>).detail;
    if (!detail?.info?.uuid || injected.has(detail.info.rdns)) return;
    injected.set(detail.info.rdns, detail);
    announce();
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function subscribeWallets(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * A stable snapshot, rebuilt only when something actually changes.
 *
 * `useSyncExternalStore` compares snapshots by identity, so handing it a freshly built array on
 * every render would spin forever.
 */
let snapshot: WalletChoice[] = [];
let snapshotStale = true;

export function walletsSnapshot(): WalletChoice[] {
  if (snapshotStale) {
    snapshot = buildWalletList();
    snapshotStale = false;
  }
  return snapshot;
}

/** Every wallet the player could pick, the Base Account first because it is the good path. */
export function listWallets(): WalletChoice[] {
  return buildWalletList();
}

function buildWalletList(): WalletChoice[] {
  const base: WalletChoice = {
    id: "base-account",
    name: "Base Account",
    icon: null,
    hasSubAccount: true,
  };
  const rest = Array.from(injected.values()).map<WalletChoice>((d) => ({
    id: `injected:${d.info.rdns}`,
    name: d.info.name,
    icon: d.info.icon,
    hasSubAccount: false,
  }));
  return [base, ...rest];
}

// ---------------------------------------------------------------- the active choice

const STORAGE_KEY = "gameweek.wallet";
let active: WalletId = "base-account";

if (typeof window !== "undefined") {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "base-account" || saved?.startsWith("injected:")) active = saved as WalletId;
  } catch {
    // Private browsing can throw on read. The default is fine.
  }
}

export function getActiveWalletId(): WalletId {
  return active;
}

export function setActiveWalletId(id: WalletId) {
  active = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Not being able to remember the choice is survivable; the session still works.
  }
  announce();
}

/** The injected provider behind the current choice, or null when the Base Account is selected. */
export function getInjectedProvider(): EIP1193Provider | null {
  if (!active.startsWith("injected:")) return null;
  return injected.get(active.slice("injected:".length))?.provider ?? null;
}

export function activeWalletName(): string {
  return listWallets().find((w) => w.id === active)?.name ?? "Wallet";
}

// ---------------------------------------------------------------- network

const CHAIN_HEX = `0x${CHAIN_ID.toString(16)}`;

/**
 * Put an injected wallet on Base, adding the network if it has never seen it.
 *
 * The Base Account is always on Base and needs none of this.
 */
export async function ensureBaseNetwork(provider: EIP1193Provider): Promise<void> {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current?.toLowerCase() === CHAIN_HEX) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CHAIN_HEX }],
    } as never);
  } catch (e) {
    // 4902 is "unrecognised chain". Anything else is the player saying no.
    const code = (e as { code?: number })?.code;
    if (code !== 4902) throw e;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: CHAIN_HEX,
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      ],
    } as never);
  }
}

// ---------------------------------------------------------------- sending

export type Call = { to: `0x${string}`; data: `0x${string}`; value: `0x${string}` };

/**
 * Send a batch, however this wallet is able to.
 *
 * A whole draft is meant to be one atomic signature through EIP-5792 `wallet_sendCalls`, which is
 * what makes swiping feel like a game and what stops a player ending up holding two picks out of
 * five. Most injected wallets do not implement it yet, so they fall back to signing each call in
 * turn. That is a worse experience and it is not atomic, which is worth saying plainly in the UI
 * rather than hiding: `atomic` in the result says which path ran.
 */
export async function sendBatch(
  provider: EIP1193Provider,
  { from, calls, capabilities }: { from: `0x${string}`; calls: Call[]; capabilities?: unknown },
): Promise<{ id: string; atomic: boolean }> {
  try {
    const id = (await provider.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0",
          chainId: CHAIN_HEX,
          from,
          atomicRequired: true,
          calls,
          ...(capabilities ? { capabilities } : {}),
        },
      ],
    } as never)) as string | { id: string };
    return { id: typeof id === "string" ? id : id.id, atomic: true };
  } catch (e) {
    if (!isUnsupported(e)) throw e;
    // One at a time, in order. The approve has to land before the swaps that spend it.
    let last = "";
    for (const call of calls) {
      last = (await provider.request({
        method: "eth_sendTransaction",
        params: [{ from, to: call.to, data: call.data, value: call.value }],
      } as never)) as string;
      await waitForReceipt(provider, last);
    }
    return { id: last, atomic: false };
  }
}

/** Whether a wallet is telling us it has never heard of the method, rather than refusing it. */
function isUnsupported(e: unknown): boolean {
  const code = (e as { code?: number })?.code;
  if (code === 4200 || code === -32601 || code === -32602) return true;
  const message = e instanceof Error ? e.message : String(e);
  return /unsupported|not support|unrecognized|unknown method|does not exist/i.test(message);
}

/** Poll for a receipt through the wallet's own transport, so it stays on the wallet's node. */
async function waitForReceipt(provider: EIP1193Provider, hash: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const receipt = (await provider.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    } as never)) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("A transaction in the draft reverted");
      return;
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error("Timed out waiting for a transaction to confirm");
}
