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
 * One draftable stock, as a trading card.
 *
 * Two corners cut, the shirt lit from above in the kit's own colour, the name set tall, and a foil
 * sheen that slides across the card as it is dragged. Dragging is done with pointer events rather
 * than a gesture library: the deck is the centrepiece of the demo, and a dependency that
 * misbehaves on one phone is not worth the convenience. Buttons do the same job for anyone on a
 * desktop or a keyboard.
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
        filter: "drop-shadow(0 26px 34px rgba(0,0,0,0.6))",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="kit-card cut relative overflow-hidden border"
        style={{ ["--kit" as string]: kit.primary }}
      >
        <span className="foil" style={{ backgroundPositionX: `${50 - dx / 3}%` }} />

        {intent && (
          <span
            className={`hed absolute top-5 z-10 border-[3px] px-2.5 py-1 text-[26px] tracking-[0.12em] ${
              intent === "draft"
                ? "left-5 -rotate-12 border-volt text-volt"
                : "right-5 rotate-12 border-chalk-300 text-chalk-300"
            }`}
            style={{ opacity: stampOpacity }}
          >
            {intent === "draft" ? "Pick" : "Next"}
          </span>
        )}

        <div className="relative flex flex-col items-center px-5 pb-3 pt-4">
          <div className="flex w-full items-center justify-between">
            <span className="sticker">{POSITION_LABEL[card.position]}</span>
            <span className="font-mono text-[11px] text-chalk-500">{card.listing.ticker}</span>
          </div>

          <div className="my-2" style={{ filter: "drop-shadow(0 18px 24px rgba(0,0,0,0.55))" }}>
            <Jersey ticker={card.listing.ticker} size={118} priority={isTop} />
          </div>

          <h3 className="hed text-center text-[38px]">{card.listing.name}</h3>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line-800 border-t border-line-800 bg-deep-950/50">
          <Stat label="Price" value={sharePrice(card.price * 100n)} />
          <Stat
            label="vs close"
            value={gapBps === null ? "—" : `${discount ? "" : "+"}${(gapBps / 100).toFixed(2)}%`}
            tone={gapBps === null ? undefined : discount ? "up" : gapBps > 0 ? "down" : undefined}
          />
          <Stat label="Stake" value={usd(stake)} sub={`${(Number(expectedShares) / 1e8).toFixed(4)} sh`} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="px-3 py-3 text-center">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-chalk-500">{label}</p>
      <p className={`num mt-1 text-[22px] ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-chalk-500">{sub}</p>}
    </div>
  );
}
