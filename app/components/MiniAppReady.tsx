"use client";

import { useEffect } from "react";

/**
 * Tells Base App the page has painted.
 *
 * A mini app host shows its own splash screen until the page calls ready(). Never call it and the
 * host sits on that splash and eventually gives up, which looks to the user like the app is broken
 * rather than like a missing handshake. Called once, after mount, so the host only sees it when
 * there is something to show.
 *
 * Outside a mini app host the import resolves to nothing useful and the call is a no-op, so the
 * same build serves the plain website.
 */
export function MiniAppReady() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { sdk } = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        await sdk.actions.ready();
      } catch {
        // Not running inside a host. Nothing to tell.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
