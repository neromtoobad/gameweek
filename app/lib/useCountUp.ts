"use client";

import { useEffect, useState } from "react";

/**
 * Counts a number up from zero on mount.
 *
 * A score that lands with a run-up reads as an event; one that appears fully formed reads as a
 * label. 600ms is long enough to notice and short enough not to wait for. Honours reduced-motion
 * by skipping straight to the value.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    // Every state update happens inside a frame callback, never synchronously in the effect body.
    // That is what the React lint asks for, and it also means the server and the first client paint
    // agree on zero, so there is no hydration mismatch.
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    if (reduced) {
      frame = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}
