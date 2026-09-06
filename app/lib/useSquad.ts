"use client";

import { useSyncExternalStore } from "react";
import {
  getSquadsServerSnapshot,
  getSquadsSnapshot,
  squadFrom,
  subscribeSquads,
  type StoredSquad,
} from "./squadStore";

/** The locally recorded squad for a wallet, or null if this browser has no record of one. */
export function useSquad(wallet: string | null): StoredSquad | null {
  const store = useSyncExternalStore(subscribeSquads, getSquadsSnapshot, getSquadsServerSnapshot);
  return squadFrom(store, wallet);
}
