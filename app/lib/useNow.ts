"use client";

import { useSyncExternalStore } from "react";

/**
 * A shared one-second clock.
 *
 * The wall clock is external mutable state, so it belongs in useSyncExternalStore rather than in a
 * state-plus-effect pair. The snapshot is cached between ticks because React compares snapshots by
 * identity and a fresh Date.now() on every render would loop forever.
 *
 * getServerSnapshot returns null, so the server and the first client paint agree on "no clock yet"
 * and there is no hydration mismatch.
 */
let snapshot = Math.floor(Date.now() / 1000);
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (!timer) {
    timer = setInterval(() => {
      snapshot = Math.floor(Date.now() / 1000);
      for (const listener of listeners) listener();
    }, 1000);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = (): number | null => null;

/** Unix seconds on the client, null on the server and during hydration. */
export function useNowSeconds(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
