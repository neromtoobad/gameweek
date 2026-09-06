import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { hasContract, readLeague, readRegisteredListings, readStandings } from "@/lib/leagues";
import { readPortfolio } from "@/lib/prices";
import { LISTINGS } from "@/lib/tokens";
import { pointsFromScore } from "@/lib/points";
import { kitFor } from "@/lib/squad";
import { logoFor } from "@/lib/logos";

export const runtime = "nodejs";

const INK = "#08080b";
const CHALK = "#f6f6f8";
const MUTED = "#7b7b8e";
const VOLT = "#d7ff3f";

/** The condensed display face, as a static TrueType instance the renderer can read. Read from disk
 *  rather than fetched by URL, which the dev bundler does not support for local files. */
const displayFont = () => readFile(path.join(process.cwd(), "app", "fonts", "BigShoulders-800.ttf"));

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
  const fonts = [{ name: "display", data: await displayFont(), weight: 800 as const, style: "normal" as const }];

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
            background: INK,
            color: CHALK,
            fontSize: 96,
            fontFamily: "display",
            textTransform: "uppercase",
          }}
        >
          {message}
        </div>
      ),
      { width: 1200, height: 630, fonts },
    );

  if (Number.isNaN(leagueId)) return fallback("Gameweek");

  const league = await readLeague(leagueId).catch(() => null);
  if (!league) return fallback("Gameweek");

  // Read holdings directly rather than through readSide. The card does not need pool prices, and
  // pool discovery is six sequential multicalls that a social crawler will not wait for.
  const listings = hasContract()
    ? await readRegisteredListings().catch(() => LISTINGS)
    : LISTINGS;
  const standings = await readStandings(leagueId, listings).catch(() => []);
  const me = player
    ? standings.find((s) => s.member.toLowerCase() === player.toLowerCase())
    : undefined;

  const points = me?.scoreBps == null ? null : pointsFromScore(me.scoreBps);
  const portfolio = player
    ? await readPortfolio(player as `0x${string}`, listings).catch(() => null)
    : null;
  const shirts = (portfolio?.holdings ?? []).slice(0, 5);

  const tone = points === null ? MUTED : points > 0 ? "#35e3a0" : points < 0 ? "#ff5c7a" : MUTED;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          background: `linear-gradient(180deg, #17171d 0%, ${INK} 70%)`,
          color: CHALK,
          fontFamily: "display",
          textTransform: "uppercase",
        }}
      >
        {/* volt corner cut, the mark of the card */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: `56px solid ${VOLT}`,
            borderLeft: "56px solid transparent",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 34, letterSpacing: 2, color: CHALK }}>
          <svg width="36" height="36" viewBox="0 0 48 48">
            <path
              d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
              fill="#0052ff"
            />
            <rect x="14.5" y="29" width="5.5" height="8" rx="1.6" fill={INK} />
            <rect x="22" y="24" width="5.5" height="13" rx="1.6" fill={INK} />
            <rect x="29.5" y="17" width="5.5" height="20" rx="1.6" fill={INK} />
          </svg>
          <span>Gameweek</span>
          <span style={{ color: MUTED, fontSize: 26, marginLeft: 8 }}>
            {league.settled ? "Full time" : league.locked ? "Live" : "Team sheets open"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, color: VOLT }}>
              {`— ${me ? `${me.rank} of ${standings.length}` : `${standings.length} players`}`}
            </div>
            <div style={{ fontSize: 112, lineHeight: 0.92, marginTop: 8, maxWidth: 760 }}>{league.name}</div>
          </div>
          {points !== null && (
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, color: tone }}>
              <span style={{ fontSize: 160, lineHeight: 0.9 }}>{points > 0 ? `+${points}` : points}</span>
              <span style={{ fontSize: 34, color: MUTED }}>pts</span>
            </div>
          )}
        </div>

        {shirts.length > 0 && (
          <div style={{ display: "flex", gap: 20, marginTop: 40 }}>
            {shirts.map((h) => {
              const ticker = h.listing.ticker;
              const kit = kitFor(ticker);
              const logo = logoFor(ticker);
              return (
                <div key={ticker} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 124,
                      height: 124,
                      borderRadius: 18,
                      background: kit.primary,
                      border: `4px solid ${kit.secondary}`,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      color: kit.text,
                      fontSize: 26,
                      letterSpacing: 1,
                    }}
                  >
                    {logo && (
                      <svg width="40" height="40" viewBox="0 0 24 24">
                        <path d={logo.path} fill={kit.text} />
                      </svg>
                    )}
                    {ticker.replace(/c$/, "")}
                  </div>
                  <div style={{ fontSize: 24, color: MUTED }}>{`$${(Number(h.usd6) / 1e6).toFixed(2)}`}</div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", fontSize: 28, letterSpacing: 2, color: MUTED }}>
          <span>Fantasy football, except the players are real stocks.</span>
          <span style={{ color: VOLT }}>On Base</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts,
      headers: {
        // A card is worth re-rendering about once a minute; a crawler hitting it ten times in a
        // burst should not pay for ten rounds of chain reads.
        "cache-control": "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
