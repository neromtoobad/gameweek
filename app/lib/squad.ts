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
  // primary/secondary drive the drawn fallback shirt. `text` is the colour the company's mark is
  // printed in, chosen to read against that kit's own pattern.
  MSFTc: { position: "GK", primary: "#0F6CBD", secondary: "#F25022", text: "#FFFFFF" },
  GOOGLc: { position: "GK", primary: "#C8CDD2", secondary: "#4285F4", text: "#1A1A1A" },
  AAPLc: { position: "GK", primary: "#1D1D1F", secondary: "#F5F5F7", text: "#FFFFFF" },

  METAc: { position: "DEF", primary: "#1877F2", secondary: "#FFFFFF", text: "#FFFFFF" },
  AMZNc: { position: "DEF", primary: "#232F3E", secondary: "#FF9900", text: "#FFFFFF" },
  NVDAc: { position: "DEF", primary: "#76B900", secondary: "#1A1A1A", text: "#FFFFFF" },

  TSLAc: { position: "FWD", primary: "#CC0000", secondary: "#1A1A1A", text: "#FFFFFF" },
  MSTRc: { position: "FWD", primary: "#F7931A", secondary: "#1A1A1A", text: "#FFFFFF" },
  SPCXc: { position: "FWD", primary: "#0B1E3B", secondary: "#FFFFFF", text: "#FFFFFF" },
  SNDKc: { position: "FWD", primary: "#3A3A3C", secondary: "#E31937", text: "#FFFFFF" },

  COINc: { position: "FWD", primary: "#0052FF", secondary: "#FFFFFF", text: "#FFFFFF" },
  CRCLc: { position: "DEF", primary: "#00D1B2", secondary: "#1A1A1A", text: "#0B1A17" },
  INTCc: { position: "GK", primary: "#0068B5", secondary: "#FFFFFF", text: "#FFFFFF" },
};

/**
 * The kit each stock plays in.
 *
 * Every side needs to be recognisable at a glance on a crowded pitch, so no two share a pattern:
 * a sash, hoops, pinstripes, quarters, halves, a chevron. Colour alone is not enough at 52px, and
 * this is how real clubs solve the same problem.
 */
export const KIT_PATTERN: Record<string, string> = {
  AAPLc: "Black with white raglan sleeves",
  AMZNc: "Navy with an orange sash",
  GOOGLc: "Silver with four coloured stripes",
  METAc: "Blue and white pinstripes",
  MSFTc: "Quartered in four colours",
  MSTRc: "Orange with black hoops",
  NVDAc: "Green with a black chevron",
  SNDKc: "Graphite and scarlet halves",
  SPCXc: "Navy starfield",
  TSLAc: "Crimson with black shoulders",
};

const FALLBACK_KIT: Kit = {
  position: "FWD",
  primary: "#4B5563",
  secondary: "#111827",
  text: "#FFFFFF",
};

export const kitFor = (ticker: string): Kit => KITS[ticker] ?? FALLBACK_KIT;

/**
 * Tickers with a photographed kit in public/kits.
 *
 * Only the tradeable listings were shot. Anything else falls back to the drawn shirt, which is why
 * that drawing is still in the codebase rather than deleted.
 */
const PHOTOGRAPHED = new Set([
  "AAPLc",
  "AMZNc",
  "GOOGLc",
  "METAc",
  "MSFTc",
  "MSTRc",
  "NVDAc",
  "SNDKc",
  "SPCXc",
  "TSLAc",
]);

export const kitImageFor = (ticker: string): string | null =>
  PHOTOGRAPHED.has(ticker) ? `/kits/${ticker}.png` : null;
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
