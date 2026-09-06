"use client";

import { useRef, useState } from "react";
import type { Card } from "@/lib/draft";
import { sharePrice, usd } from "@/lib/format";

const SWIPE_THRESHOLD = 90;

type Props = {
  card: Card;
  stake: bigint;
  expectedShares: bigint;
  affordable: boolean;
  onDraft: () => void;
  onSkip: () => void;
  /** Cards behind the top one are inert and slightly scaled back. */
  depth: number;
};

/**
 * One draftable stock.
 *
 * Dragging is done with pointer events rather than a gesture library: the deck is the centrepiece
 * of the demo, and a dependency that misbehaves on one phone is not worth the convenience. Buttons
 * do the same job for anyone on a desktop or using a keyboard.
 */
export function SwipeCard({ card, stake, expectedShares, affordable, onDraft, onSkip, depth }: Props) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<"draft" | "skip" | null>(null);
  // Dragging drives the transition style, so it has to be state. A ref read during render is both
  // a lint error and a genuine correctness trap, since React would not re-render on the change.
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);

  const isTop = depth === 0;
  const gapBps = card.gapBps;
  const discount = gapBps !== null && gapBps < 0;

  function onPointerDown(e: React.PointerEvent) {
    if (!isTop || leaving) return;
    setDragging(true);
    startX.current = e.clientX;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    setDx(e.clientX - startX.current);
  }

  function onPointerUp() {
    if (!dragging) return;
    setDragging(false);

    if (dx > SWIPE_THRESHOLD && affordable) {
      setLeaving("draft");
      setTimeout(onDraft, 180);
    } else if (dx < -SWIPE_THRESHOLD) {
      setLeaving("skip");
      setTimeout(onSkip, 180);
    } else {
      setDx(0);
    }
  }

  const offset = leaving === "draft" ? 500 : leaving === "skip" ? -500 : dx;
  const rotation = offset / 22;
  const intent = dx > 40 ? "draft" : dx < -40 ? "skip" : null;

  return (
    <div
      className="absolute inset-x-0 top-0 touch-none select-none"
      style={{
        transform: `translateX(${offset}px) rotate(${rotation}deg) scale(${1 - depth * 0.04}) translateY(${depth * 10}px)`,
        transition: dragging ? "none" : "transform 180ms ease-out, opacity 180ms ease-out",
        opacity: leaving ? 0 : 1,
        zIndex: 10 - depth,
        pointerEvents: isTop ? "auto" : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="relative overflow-hidden rounded-3xl border border-line-800 bg-gradient-to-b from-pitch-800 to-pitch-900 p-5 shadow-2xl">
        {intent && (
          <span
            className={`absolute right-4 top-4 rounded-lg border px-2 py-1 text-xs font-bold uppercase tracking-wide ${
              intent === "draft"
                ? "border-turf-400 text-turf-400"
                : "border-chalk-500 text-chalk-500"
            }`}
          >
            {intent === "draft" ? "Draft" : "Skip"}
          </span>
        )}

        <p className="font-mono text-xs text-chalk-500">{card.listing.ticker}</p>
        <h3 className="mt-0.5 text-2xl font-semibold">{card.listing.name}</h3>

        <p className="tnum mt-4 text-4xl font-semibold">{sharePrice(card.price * 100n)}</p>

        {gapBps !== null && (
          <p className="mt-1.5 text-sm">
            <span className={discount ? "text-up" : "text-down"}>
              {discount ? "" : "+"}
              {(gapBps / 100).toFixed(2)}%
            </span>
            <span className="text-chalk-500"> against Friday&rsquo;s close</span>
          </p>
        )}

        <div className="mt-5 rounded-xl border border-line-900 bg-pitch-950/50 px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-chalk-500">Stake</span>
            <span className="tnum font-semibold">{usd(stake)}</span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-chalk-500">You get</span>
            <span className="tnum text-sm text-chalk-300">
              {(Number(expectedShares) / 1e8).toFixed(5)} shares
            </span>
          </div>
        </div>

        {!affordable && (
          <p className="mt-3 text-xs text-down">Not enough budget left for this stake.</p>
        )}
      </div>
    </div>
  );
}
