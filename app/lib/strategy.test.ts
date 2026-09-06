import { describe, expect, test } from "bun:test";
import { pickSide, tradeable, MAX_ABS_GAP_BPS } from "./strategy";
import type { Card } from "./draft";
import type { Position } from "./squad";

const card = (
  ticker: string,
  position: Position,
  gapBps: number | null,
  liquidity = 1_000_000_000_000n,
): Card => ({
  listing: { ticker, name: ticker, token: `0x${"1".repeat(40)}`, feed: `0x${"2".repeat(40)}`, live: true },
  position,
  pool: `0x${"3".repeat(40)}`,
  price: 100_000_000n,
  close: 10_000_000_000n,
  gapBps,
  liquidity,
});

const board = () => [
  card("GK_TIGHT", "GK", 10),
  card("GK_WIDE", "GK", 400),
  card("DEF_A", "DEF", 20),
  card("DEF_B", "DEF", 50),
  card("DEF_C", "DEF", 300),
  card("FWD_A", "FWD", 30),
  card("FWD_B", "FWD", 60),
  card("FWD_C", "FWD", 200),
];

describe("Gap Hunter", () => {
  test("fields a legal 1-2-2", () => {
    const side = pickSide(board());
    expect(side).toHaveLength(5);
    const positions = side.map((p) => p.card.position);
    expect(positions.filter((p) => p === "GK")).toHaveLength(1);
    expect(positions.filter((p) => p === "DEF")).toHaveLength(2);
    expect(positions.filter((p) => p === "FWD")).toHaveLength(2);
  });

  test("takes the smallest gap in each position", () => {
    const tickers = pickSide(board()).map((p) => p.card.listing.ticker);
    expect(tickers).toEqual(["GK_TIGHT", "DEF_A", "DEF_B", "FWD_A", "FWD_B"]);
  });

  test("captains the biggest discount on the board", () => {
    const captain = pickSide(board()).find((p) => p.isCaptain);
    expect(captain?.card.listing.ticker).toBe("GK_TIGHT");
    expect(pickSide(board()).filter((p) => p.isCaptain)).toHaveLength(1);
  });

  test("a negative gap outranks any premium", () => {
    const withDiscount = [...board(), card("FWD_CHEAP", "FWD", -150)];
    const side = pickSide(withDiscount);
    expect(side.find((p) => p.isCaptain)?.card.listing.ticker).toBe("FWD_CHEAP");
  });

  test("throws out a gap too wide to be real", () => {
    const noisy = card("FWD_NOISE", "FWD", MAX_ABS_GAP_BPS + 1);
    expect(tradeable([noisy])).toHaveLength(0);
    expect(pickSide([...board(), noisy]).map((p) => p.card.listing.ticker)).not.toContain("FWD_NOISE");
  });

  test("throws out a dust pool", () => {
    const deep = card("DEF_DEEP", "DEF", 5, 1_000_000_000_000_000n);
    const dust = card("DEF_DUST", "DEF", 1, 1_000n);
    expect(tradeable([deep, dust]).map((c) => c.listing.ticker)).toEqual(["DEF_DEEP"]);
  });

  test("skips a card with no gap to rank on", () => {
    expect(tradeable([card("NO_CLOSE", "GK", null)])).toHaveLength(0);
  });

  test("fields a short side rather than reaching for a pool it should not touch", () => {
    const thin = [card("GK_ONLY", "GK", 10), card("DEF_ONLY", "DEF", 20)];
    const side = pickSide(thin);
    expect(side).toHaveLength(2);
    expect(side.filter((p) => p.isCaptain)).toHaveLength(1);
  });

  test("returns nothing when no pool is tradeable", () => {
    expect(pickSide([card("X", "GK", null)])).toHaveLength(0);
  });
});
