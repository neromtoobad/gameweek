/**
 * The season clock.
 *
 * A gameweek runs from one Friday US close to the next, 21:00 UTC. That boundary is chosen because
 * the Chainlink equity feeds are still publishing at the close, so a league can be locked and
 * settled against fresh prices. Between Friday's close and Monday's open the feeds hold their last
 * price while Base keeps trading, and that gap is the reason draft night is Sunday.
 *
 * Season one starts at the first Friday close after Coinbase Tokenized Stocks went live on Base.
 */
export const SEASON_START = Date.UTC(2026, 7, 28, 21, 0, 0) / 1000; // Friday 2026-08-28 21:00 UTC
export const WEEK_SECONDS = 7 * 86_400;

/** The Friday 21:00 UTC close at or after the given moment. */
export function nextCloseSeconds(nowSeconds: number): number {
  const d = new Date(nowSeconds * 1000);
  d.setUTCHours(21, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + ((5 - d.getUTCDay() + 7) % 7));
  const close = Math.floor(d.getTime() / 1000);
  return close <= nowSeconds ? close + WEEK_SECONDS : close;
}

/** Which gameweek we are in, counting from one. */
export function gameweekNumber(nowSeconds: number): number {
  if (nowSeconds < SEASON_START) return 1;
  return Math.floor((nowSeconds - SEASON_START) / WEEK_SECONDS) + 1;
}

/**
 * Sunday and Saturday are draft nights: US markets are shut, Base is not, and the leaderboard is
 * frozen against Friday's close.
 */
export function isDraftWindow(nowSeconds: number): boolean {
  const day = new Date(nowSeconds * 1000).getUTCDay();
  return day === 0 || day === 6;
}
