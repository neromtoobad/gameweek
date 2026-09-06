import type { Listing } from "./tokens";

/**
 * Positions.
 *
 * Fantasy football needs a formation, and a formation needs positions. A stock's position is its
 * temperament: how hard it moves. Keepers are the steadiest names, forwards the ones that swing.
 * That turns "pick five stocks" into a real selection problem, because you cannot field five
 * forwards even when momentum says you should.
 *
 * Assignment is by character rather than a rolling volatility calculation, so the deck is stable
 * from one round to the next and a player can learn it. Revisit if the listed set changes.
 */
export type Position = "GK" | "DEF" | "FWD";

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Keeper",
  DEF: "Defender",
  FWD: "Forward",
};

/** Exactly one keeper, two defenders, two forwards. A 1-2-2, five on the pitch. */
export const FORMATION: Record<Position, number> = { GK: 1, DEF: 2, FWD: 2 };
export const SQUAD_SIZE = FORMATION.GK + FORMATION.DEF + FORMATION.FWD;

type Kit = { position: Position; primary: string; secondary: string; text: string };

/**
 * Kit colours, taken from each company's own brand.
 *
 * Shirts rather than logos: it is what fantasy football actually shows, it needs no external image
 * requests in the middle of a demo, and it sidesteps using company marks as our own artwork.
 */
export const KITS: Record<string, Kit> = {
  MSFTc: { position: "GK", primary: "#0F6CBD", secondary: "#F25022", text: "#FFFFFF" },
  GOOGLc: { position: "GK", primary: "#4285F4", secondary: "#EA4335", text: "#FFFFFF" },
  AAPLc: { position: "GK", primary: "#1D1D1F", secondary: "#A2AAAD", text: "#FFFFFF" },

  METAc: { position: "DEF", primary: "#0866FF", secondary: "#FFFFFF", text: "#FFFFFF" },
  AMZNc: { position: "DEF", primary: "#FF9900", secondary: "#232F3E", text: "#232F3E" },
  NVDAc: { position: "DEF", primary: "#76B900", secondary: "#1A1A1A", text: "#0B1A00" },

  TSLAc: { position: "FWD", primary: "#CC0000", secondary: "#FFFFFF", text: "#FFFFFF" },
  MSTRc: { position: "FWD", primary: "#F7931A", secondary: "#1A1A1A", text: "#1A1A1A" },
  SPCXc: { position: "FWD", primary: "#005288", secondary: "#FFFFFF", text: "#FFFFFF" },
  SNDKc: { position: "FWD", primary: "#E31937", secondary: "#FFFFFF", text: "#FFFFFF" },

  COINc: { position: "FWD", primary: "#0052FF", secondary: "#FFFFFF", text: "#FFFFFF" },
  CRCLc: { position: "DEF", primary: "#00D1B2", secondary: "#1A1A1A", text: "#0B1A17" },
  INTCc: { position: "GK", primary: "#0068B5", secondary: "#FFFFFF", text: "#FFFFFF" },
};

const FALLBACK_KIT: Kit = {
  position: "FWD",
  primary: "#4B5563",
  secondary: "#111827",
  text: "#FFFFFF",
};

export const kitFor = (ticker: string): Kit => KITS[ticker] ?? FALLBACK_KIT;
export const positionOf = (ticker: string): Position => kitFor(ticker).position;

/** Short name for the shirt, e.g. "Alphabet" becomes "GOOGL". */
export const shirtName = (listing: Listing): string => listing.ticker.replace(/c$/, "");

/** How many of each position are still needed. */
export function slotsRemaining(picked: Position[]): Record<Position, number> {
  const used: Record<Position, number> = { GK: 0, DEF: 0, FWD: 0 };
  for (const p of picked) used[p] += 1;
  return {
    GK: Math.max(0, FORMATION.GK - used.GK),
    DEF: Math.max(0, FORMATION.DEF - used.DEF),
    FWD: Math.max(0, FORMATION.FWD - used.FWD),
  };
}

/** Whether another stock in this position would fit the formation. */
export const hasRoomFor = (picked: Position[], position: Position): boolean =>
  slotsRemaining(picked)[position] > 0;

export const isSquadComplete = (picked: Position[]): boolean =>
  picked.length === SQUAD_SIZE &&
  (["GK", "DEF", "FWD"] as Position[]).every((p) => slotsRemaining(picked)[p] === 0);
