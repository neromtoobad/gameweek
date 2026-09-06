"use client";

import { Jersey } from "./Jersey";
import { formatPoints } from "@/lib/points";
import type { Position } from "@/lib/squad";
import { POSITION_LABEL } from "@/lib/squad";

export type PitchSlot = {
  position: Position;
  /** Empty until a pick has been made for this slot. */
  ticker: string | null;
  name?: string;
  /** Points this holding has contributed so far, once a round is running. */
  points?: number | null;
  isCaptain?: boolean;
};

/**
 * The team sheet.
 *
 * Five shirts in a 1-2-2, laid out the way a fantasy football side is: keeper at the back, forwards
 * at the top. Seeing your picks as a formation rather than a list is most of what makes the game
 * feel like a game.
 */
export function Pitch({
  slots,
  onSlotClick,
  activePosition,
}: {
  slots: PitchSlot[];
  onSlotClick?: (index: number) => void;
  /** Highlights the rows still waiting for a pick. */
  activePosition?: Position | null;
}) {
  const rows: { position: Position; indices: number[] }[] = [
    { position: "FWD", indices: [] },
    { position: "DEF", indices: [] },
    { position: "GK", indices: [] },
  ];
  slots.forEach((slot, i) => {
    rows.find((r) => r.position === slot.position)?.indices.push(i);
  });

  return (
    <div className="relative overflow-hidden rounded-3xl border border-line-800">
      {/* the pitch: stripes, centre circle, penalty box */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(180deg, #0d2b18 0px, #0d2b18 34px, #0f3320 34px, #0f3320 68px)",
        }}
      />
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 140">
        <g stroke="rgba(255,255,255,0.13)" strokeWidth="0.5" fill="none">
          <rect x="3" y="3" width="94" height="134" />
          <line x1="3" y1="70" x2="97" y2="70" />
          <circle cx="50" cy="70" r="13" />
          <rect x="28" y="112" width="44" height="25" />
          <rect x="39" y="127" width="22" height="10" />
          <rect x="28" y="3" width="44" height="25" />
          <rect x="39" y="3" width="22" height="10" />
        </g>
      </svg>

      <div className="relative flex flex-col justify-between gap-4 px-3 py-5" style={{ minHeight: 340 }}>
        {rows.map((row) => (
          <div key={row.position} className="flex items-start justify-center gap-6">
            {row.indices.map((i) => {
              const slot = slots[i];
              const empty = slot.ticker === null;
              const waiting = activePosition === slot.position && empty;

              return (
                <button
                  key={i}
                  type="button"
                  onClick={onSlotClick ? () => onSlotClick(i) : undefined}
                  disabled={!onSlotClick}
                  className={`flex w-20 flex-col items-center gap-1 rounded-xl p-1 transition ${
                    onSlotClick ? "hover:bg-white/5" : "cursor-default"
                  } ${waiting ? "ring-1 ring-turf-400" : ""}`}
                >
                  {empty ? (
                    <span
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-dashed border-white/25 text-lg text-white/35"
                      aria-hidden
                    >
                      +
                    </span>
                  ) : (
                    <span className="relative">
                      <Jersey ticker={slot.ticker!} />
                      {slot.isCaptain && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-chalk-100 text-[9px] font-bold text-pitch-950">
                          C
                        </span>
                      )}
                    </span>
                  )}

                  <span className="w-full truncate text-center text-[10px] font-semibold text-white/90">
                    {empty ? POSITION_LABEL[slot.position] : slot.name ?? slot.ticker}
                  </span>

                  {slot.points !== undefined && slot.points !== null && (
                    <span
                      className={`tnum rounded px-1.5 text-[10px] font-bold ${
                        slot.points > 0
                          ? "bg-up/20 text-up"
                          : slot.points < 0
                            ? "bg-down/20 text-down"
                            : "bg-white/10 text-white/60"
                      }`}
                    >
                      {formatPoints(slot.points)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
