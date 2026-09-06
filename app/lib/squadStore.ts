"use client";

/**
 * A local record of what a side was bought at.
 *
 * The contract knows what a wallet is worth, not what it paid for each holding, so per-stock points
 * need entry prices from somewhere. They are kept in this browser only.
 *
 * Nothing important depends on them. The side itself is read from the chain, and the team total is
 * the same NAV ratio the contract settles on. These records only add the per-shirt breakdown, so
 * losing them, or opening the league on another device, costs a nicety and never a result.
 */

const KEY = "gameweek.squads.v1";

export type StoredEntry = {
  ticker: string;
  /** USDC per share at the moment of purchase, 6 decimals, as a string so JSON keeps precision. */
  entryPrice: string;
  stake: string;
  isCaptain: boolean;
};

export type StoredSquad = {
  wallet: string;
  entries: StoredEntry[];
  boughtAt: number;
};

type Store = Record<string, StoredSquad>;

const EMPTY: Store = {};
const keyFor = (wallet: string) => wallet.toLowerCase();

/**
 * Cached so that reads have a stable identity between renders.
 *
 * useSyncExternalStore compares snapshots by reference, so parsing localStorage on every call would
 * hand React a new object each time and loop forever. The cache is dropped whenever the store
 * changes, here or in another tab.
 */
let cache: Store | null = null;
const listeners = new Set<() => void>();

function parse(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : EMPTY;
  } catch {
    // Private windows, cleared site data, or storage blocked outright. Not worth surfacing.
    return EMPTY;
  }
}

function invalidate() {
  cache = null;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key === null || event.key === KEY) invalidate();
}

export function subscribeSquads(onChange: () => void) {
  listeners.add(onChange);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

export function getSquadsSnapshot(): Store {
  if (cache === null) cache = parse();
  return cache;
}

/** The server has no localStorage, so it always sees an empty store. */
export const getSquadsServerSnapshot = (): Store => EMPTY;

export function saveSquad(squad: Omit<StoredSquad, "boughtAt">) {
  const store = { ...getSquadsSnapshot(), [keyFor(squad.wallet)]: { ...squad, boughtAt: Date.now() / 1000 } };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // The breakdown is optional; a failed write costs nothing else.
  }
  invalidate();
}

export function clearSquad(wallet: string) {
  const store = { ...getSquadsSnapshot() };
  delete store[keyFor(wallet)];
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // As above.
  }
  invalidate();
}

export const squadFrom = (store: Store, wallet: string | null): StoredSquad | null =>
  wallet ? (store[keyFor(wallet)] ?? null) : null;
