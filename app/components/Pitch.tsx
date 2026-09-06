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
 * A blue pitch rather than a green one. It is the same shape any fantasy football game draws, and
 * the colour is what makes a screenshot of this one recognisable as this one.
 *
 * Five shirts in a 1-2-2, laid out the way a fantasy football side is: keeper at the back, forwards
 * at the top. Seeing your picks as a formation rather than a list is most of what makes the game
 * feel like a game.
 */
export function Pitch({
  slots,
  onSlotClick,
  activePosition,
  height = 340,
}: {
  slots: PitchSlot[];
  onSlotClick?: (index: number) => void;
  /** Highlights the rows still waiting for a pick. */
  activePosition?: Position | null;
  /** Shorter on the draft screen, where the deck needs the room. */
  height?: number;
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
    <div className="relative overflow-hidden rounded-3xl border border-line-800 shadow-2xl shadow-base-500/10">
      {/* the pitch: stripes, centre circle, penalty box */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(180deg, var(--color-turf-900) 0px, var(--color-turf-900) 34px, var(--color-turf-800) 34px, var(--color-turf-800) 68px)",
        }}
      />
      <div aria-hidden className="stadium absolute inset-0" />
      <svg aria-hidden className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 140">
        <g stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" fill="none">
          <rect x="3" y="3" width="94" height="134" />
          <line x1="3" y1="70" x2="97" y2="70" />
          <circle cx="50" cy="70" r="13" />
          <rect x="28" y="112" width="44" height="25" />
          <rect x="39" y="127" width="22" height="10" />
          <rect x="28" y="3" width="44" height="25" />
          <rect x="39" y="3" width="22" height="10" />
        </g>
      </svg>

      <div className="relative flex flex-col justify-between gap-3 px-3 py-4" style={{ minHeight: height }}>
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
                  } ${waiting ? "slot-waiting ring-1 ring-cyan-400" : ""}`}
                >
                  {empty ? (
                    <GhostShirt waiting={waiting} />
                  ) : (
                    <span className="relative">
                      <Jersey ticker={slot.ticker!} size={52} />
                      {slot.isCaptain && (
                        <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-chalk-100 text-[9px] font-bold text-deep-950">
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

/** The outline of a shirt, for a slot nobody has filled yet. */
function GhostShirt({ waiting }: { waiting: boolean }) {
  return (
    <svg width={52} height={52} viewBox="0 0 48 48" aria-hidden style={{ display: "block" }}>
      <path
        d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
        fill={waiting ? "rgba(53,208,255,0.12)" : "rgba(255,255,255,0.05)"}
        stroke={waiting ? "var(--color-cyan-400)" : "rgba(255,255,255,0.35)"}
        strokeWidth="1.3"
        strokeDasharray="3 2.4"
        strokeLinejoin="round"
      />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fill={waiting ? "var(--color-cyan-400)" : "rgba(255,255,255,0.5)"}
        fontSize="16"
        fontWeight="700"
      >
        +
      </text>
    </svg>
  );
}
