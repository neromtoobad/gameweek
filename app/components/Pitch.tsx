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
 * Real grass under floodlights, photographed from above and tilted into perspective the way a
 * broadcast graphic shows a line-up. Only the ground is tilted: the shirts sit flat on top, so they
 * stay readable at 52px.
 *
 * Five shirts in a 1-2-2, keeper at the back, forwards at the top. Seeing your picks as a formation
 * rather than a list is most of what makes the game feel like a game.
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
    <div
      className="relative overflow-hidden rounded-[22px] border border-line-800 bg-turf-900"
      style={{ minHeight: height, boxShadow: "0 24px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)" }}
    >
      {/* the ground, in perspective */}
      <div aria-hidden className="absolute inset-0 overflow-hidden">
        <div className="grass pitch-3d absolute inset-0">
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 140">
            <g stroke="rgba(255,255,255,0.55)" strokeWidth="0.55" fill="none">
              <rect x="4" y="3" width="92" height="134" />
              <line x1="4" y1="70" x2="96" y2="70" />
              <circle cx="50" cy="70" r="12" />
              <rect x="28" y="112" width="44" height="25" />
              <rect x="39" y="128" width="22" height="9" />
              <rect x="28" y="3" width="44" height="25" />
              <rect x="39" y="3" width="22" height="9" />
            </g>
          </svg>
        </div>
        {/* floodlight glow at the top, dark at the touchlines */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(80% 45% at 50% 0%, rgba(255,255,255,0.14) 0%, transparent 60%), linear-gradient(180deg, rgba(8,8,11,0.25) 0%, transparent 30%, transparent 70%, rgba(8,8,11,0.45) 100%), radial-gradient(120% 90% at 50% 50%, transparent 55%, rgba(8,8,11,0.65) 100%)",
          }}
        />
      </div>

      <div className="relative flex flex-col justify-between gap-3 px-3 py-4" style={{ minHeight: height }}>
        {rows.map((row) => (
          <div key={row.position} className="flex items-start justify-center gap-7">
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
                  className={`flex w-[84px] flex-col items-center gap-1 rounded-xl p-1 transition ${
                    onSlotClick ? "hover:bg-white/5" : "cursor-default"
                  } ${waiting ? "slot-waiting ring-1 ring-volt" : ""}`}
                >
                  {empty ? (
                    <GhostShirt waiting={waiting} />
                  ) : (
                    <span className="relative" style={{ filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.55))" }}>
                      <Jersey ticker={slot.ticker!} size={54} />
                      {slot.isCaptain && (
                        <span className="hed absolute -right-2 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-volt text-[11px] text-deep-950">
                          C
                        </span>
                      )}
                    </span>
                  )}

                  <span
                    className={`hed w-full truncate rounded-sm px-1.5 py-[3px] text-center text-[11px] tracking-[0.06em] ${
                      empty ? "text-white/70" : "bg-deep-950/75 text-chalk-100"
                    }`}
                  >
                    {empty ? POSITION_LABEL[slot.position] : slot.name ?? slot.ticker}
                  </span>

                  {slot.points !== undefined && slot.points !== null && (
                    <span
                      className={`num rounded-sm px-1.5 py-[2px] text-[12px] ${
                        slot.points > 0
                          ? "bg-up text-deep-950"
                          : slot.points < 0
                            ? "bg-down text-deep-950"
                            : "bg-white/15 text-white/80"
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
    <svg width={54} height={54} viewBox="0 0 48 48" aria-hidden style={{ display: "block" }}>
      <path
        d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
        fill={waiting ? "rgba(215,255,63,0.14)" : "rgba(255,255,255,0.07)"}
        stroke={waiting ? "var(--color-volt)" : "rgba(255,255,255,0.45)"}
        strokeWidth="1.3"
        strokeDasharray="3 2.4"
        strokeLinejoin="round"
      />
      <text
        x="24"
        y="31"
        textAnchor="middle"
        fill={waiting ? "var(--color-volt)" : "rgba(255,255,255,0.6)"}
        fontSize="16"
        fontWeight="700"
      >
        +
      </text>
    </svg>
  );
}
