/**
 * The clock.
 *
 * A round is 24 hours, locking and settling at 21:00 UTC, which is when the US market closes and
 * the Chainlink equity feeds are still publishing. That is the only moment of the day a league can
 * be scored against fresh prices, so it is where the day starts and ends.
 *
 * Rounds only run into a trading day. Outside market hours the feeds hold their last price, so a
 * round opened on a Saturday would score everyone zero. Friday's close therefore runs to Monday's,
 * which turns the weekend into the long window where sides are picked for the week ahead.
 */
export const SEASON_START = Date.UTC(2026, 7, 28, 21, 0, 0) / 1000; // Friday 2026-08-28 21:00 UTC
export const DAY_SECONDS = 86_400;
const CLOSE_HOUR_UTC = 21;

const isWeekend = (day: number) => day === 0 || day === 6;

/** The next 21:00 UTC that lands on a trading day. */
export function nextCloseSeconds(nowSeconds: number): number {
  const d = new Date(nowSeconds * 1000);
  d.setUTCHours(CLOSE_HOUR_UTC, 0, 0, 0);
  if (Math.floor(d.getTime() / 1000) <= nowSeconds) d.setUTCDate(d.getUTCDate() + 1);
  while (isWeekend(d.getUTCDay())) d.setUTCDate(d.getUTCDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

/** Which matchday we are on, counting trading days from the season's first close. */
export function matchdayNumber(nowSeconds: number): number {
  if (nowSeconds <= SEASON_START) return 1;
  let count = 1;
  const cursor = new Date(SEASON_START * 1000);
  while (Math.floor(cursor.getTime() / 1000) < nowSeconds) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (!isWeekend(cursor.getUTCDay())) count += 1;
  }
  return count;
}

/**
 * Whether the market is shut and sides are being picked for the next round.
 *
 * True all weekend, and every evening between the close and the next open.
 */
export function isDraftWindow(nowSeconds: number): boolean {
  const d = new Date(nowSeconds * 1000);
  if (isWeekend(d.getUTCDay())) return true;
  const hour = d.getUTCHours();
  return hour >= CLOSE_HOUR_UTC || hour < 13; // US pre-market opens around 13:00 UTC
}

/** Kept for callers that still speak in weeks. A gameweek is five matchdays. */
export const gameweekNumber = (nowSeconds: number): number =>
  Math.ceil(matchdayNumber(nowSeconds) / 5);
