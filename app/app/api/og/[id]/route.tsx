import { ImageResponse } from "next/og";
import { hasContract, readLeague, readRegisteredListings, readStandings } from "@/lib/leagues";
import { readPortfolio } from "@/lib/prices";
import { LISTINGS } from "@/lib/tokens";
import { pointsFromScore } from "@/lib/points";
import { kitFor } from "@/lib/squad";
import { logoFor } from "@/lib/logos";

export const runtime = "nodejs";

/**
 * The card that unfurls when a league link is shared.
 *
 * Rendered from chain state at request time rather than from anything the sharer passes in, so a
 * card cannot claim a score its wallet does not have. Shirts are drawn as coloured blocks rather
 * than loaded as images, because an OG renderer that waits on ten PNGs is an OG renderer that times
 * out.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leagueId = Number.parseInt(id, 10);
  const player = new URL(request.url).searchParams.get("player");

  const fallback = (message: string) =>
    new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#06110c",
            color: "#f2f7f4",
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          {message}
        </div>
      ),
      { width: 1200, height: 630 },
    );

  if (Number.isNaN(leagueId)) return fallback("Gameweek");

  const league = await readLeague(leagueId).catch(() => null);
  if (!league) return fallback("Gameweek");

  const standings = await readStandings(leagueId).catch(() => []);
  const me = player
    ? standings.find((s) => s.member.toLowerCase() === player.toLowerCase())
    : undefined;

  const points = me?.scoreBps == null ? null : pointsFromScore(me.scoreBps);
  // Read holdings directly rather than through readSide. The card does not need pool prices, and
  // pool discovery is six sequential multicalls that a social crawler will not wait for.
  const listings = hasContract()
    ? await readRegisteredListings().catch(() => LISTINGS)
    : LISTINGS;
  const portfolio = player
    ? await readPortfolio(player as `0x${string}`, listings).catch(() => null)
    : null;
  const shirts = (portfolio?.holdings ?? []).slice(0, 5);

  const tone = points === null ? "#94a3b8" : points > 0 ? "#34d399" : points < 0 ? "#f87171" : "#94a3b8";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 64,
          background: "linear-gradient(160deg, #0f3320 0%, #06110c 60%)",
          color: "#f2f7f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#7d9187" }}>
          <span>🏆</span>
          <span style={{ letterSpacing: 1 }}>GAMEWEEK</span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 18 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05 }}>{league.name}</div>
            <div style={{ fontSize: 30, color: "#b8c9bf", marginTop: 10 }}>
              {me ? `${me.rank} of ${standings.length}` : `${standings.length} players`}
            </div>
          </div>
          {points !== null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, color: tone }}>
              <span style={{ fontSize: 104, fontWeight: 800 }}>
                {points > 0 ? `+${points}` : points}
              </span>
              <span style={{ fontSize: 30, color: "#7d9187" }}>pts</span>
            </div>
          )}
        </div>

        {shirts.length > 0 && (
          <div style={{ display: "flex", gap: 22, marginTop: 46 }}>
            {shirts.map((h) => {
              const ticker = h.listing.ticker;
              const kit = kitFor(ticker);
              const logo = logoFor(ticker);
              return (
                <div key={ticker} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 128,
                      height: 128,
                      borderRadius: 22,
                      background: kit.primary,
                      border: `4px solid ${kit.secondary}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      color: kit.text,
                      fontSize: 22,
                      fontWeight: 800,
                    }}
                  >
                    {logo && (
                      <svg width="40" height="40" viewBox="0 0 24 24">
                        <path d={logo.path} fill={kit.text} />
                      </svg>
                    )}
                    {ticker.replace(/c$/, "")}
                  </div>
                  <div style={{ fontSize: 22, color: "#7d9187" }}>
                    {`$${(Number(h.usd6) / 1e6).toFixed(2)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 26, color: "#7d9187" }}>
          Fantasy football, except the players are real stocks.
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        // A card is worth re-rendering about once a minute; a crawler hitting it ten times in a
        // burst should not pay for ten rounds of chain reads.
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
