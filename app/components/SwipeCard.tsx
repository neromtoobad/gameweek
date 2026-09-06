"use client";

import { useRef, useState } from "react";
import type { Card } from "@/lib/draft";
import { sharePrice, usd } from "@/lib/format";
import { kitFor, POSITION_LABEL } from "@/lib/squad";
import { Jersey } from "./Jersey";

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
 * One draftable stock, as a player card.
 *
 * The shirt is the hero, lit from above in the kit's own colour, with the numbers underneath the
 * way a sticker album prints them. Dragging is done with pointer events rather than a gesture
 * library: the deck is the centrepiece of the demo, and a dependency that misbehaves on one phone
 * is not worth the convenience. Buttons do the same job for anyone on a desktop or a keyboard.
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
  const kit = kitFor(card.listing.ticker);

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
  // The stamp fades in with the drag, so it reads as a consequence of the gesture and not a label.
  const stampOpacity = Math.min(1, Math.max(0, (Math.abs(dx) - 30) / 60));

  return (
    <div
      className="absolute inset-x-0 top-0 touch-none select-none"
      style={{
        transform: `translateX(${offset}px) rotate(${rotation}deg) scale(${1 - depth * 0.04}) translateY(${depth * 12}px)`,
        transition: dragging ? "none" : "transform 220ms var(--ease-out-soft), opacity 180ms ease-out",
        opacity: leaving ? 0 : 1,
        zIndex: 10 - depth,
        pointerEvents: isTop ? "auto" : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="kit-card relative overflow-hidden rounded-3xl border shadow-2xl"
        style={{ ["--kit" as string]: kit.primary }}
      >
        {intent && (
          <span
            className={`absolute top-5 z-10 rounded-lg border-[3px] px-2.5 py-1 text-xl font-black uppercase tracking-widest ${
              intent === "draft"
                ? "left-5 -rotate-12 border-cyan-400 text-cyan-400"
                : "right-5 rotate-12 border-chalk-300 text-chalk-300"
            }`}
            style={{ opacity: stampOpacity }}
          >
            {intent === "draft" ? "Pick" : "Next"}
          </span>
        )}

        <div className="relative flex flex-col items-center px-5 pb-3.5 pt-4">
          <div className="flex w-full items-center justify-between">
            <span className="rounded-md bg-deep-950/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-chalk-300">
              {POSITION_LABEL[card.position]}
            </span>
            {gapBps !== null && (
              <span
                className={`tnum rounded-md px-2 py-0.5 text-[11px] font-bold ${
                  discount ? "bg-up/15 text-up" : gapBps > 0 ? "bg-down/15 text-down" : "bg-deep-800 text-chalk-300"
                }`}
              >
                {discount ? "" : "+"}
                {(gapBps / 100).toFixed(2)}% vs close
              </span>
            )}
          </div>

          <div className="my-2" style={{ filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.5))" }}>
            <Jersey ticker={card.listing.ticker} size={116} />
          </div>

          <h3 className="text-center text-[26px] font-extrabold leading-none tracking-tight">
            {card.listing.name}
          </h3>
          <p className="mt-1.5 font-mono text-xs text-chalk-500">{card.listing.ticker}</p>
        </div>

        <div className="flex items-end justify-between border-t border-line-900 bg-deep-950/40 px-5 py-3.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-chalk-500">Price</p>
            <p className="tnum text-[28px] font-extrabold leading-none tracking-tight">
              {sharePrice(card.price * 100n)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-chalk-500">Stake</p>
            <p className="tnum text-xl font-bold leading-none">{usd(stake)}</p>
            <p className="tnum mt-1 text-[11px] text-chalk-500">
              {(Number(expectedShares) / 1e8).toFixed(5)} shares
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
