import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gameweek: fantasy football, except the players are real stocks";

/**
 * The card that unfurls when the site itself is shared.
 *
 * League links render a live card from chain state; this is the one for the front door, so it is
 * static and says what the game is.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "linear-gradient(160deg, #0f3320 0%, #06110c 60%)",
          color: "#f2f7f4",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="60" height="60" viewBox="0 0 48 48">
            <path
              d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
              fill="#22c55e"
            />
            <rect x="14.5" y="29" width="5.5" height="8" rx="1.6" fill="#06110c" />
            <rect x="22" y="24" width="5.5" height="13" rx="1.6" fill="#06110c" />
            <rect x="29.5" y="17" width="5.5" height="20" rx="1.6" fill="#06110c" />
          </svg>
          <span style={{ fontSize: 40, letterSpacing: 1, color: "#b8c9bf" }}>GAMEWEEK</span>
        </div>

        <div style={{ display: "flex", fontSize: 76, lineHeight: 1.12, marginTop: 34, maxWidth: 940 }}>
          Fantasy football, except the players are real stocks.
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#7d9187", marginTop: 28, maxWidth: 900 }}>
          Pick five, name a captain, settle in 24 hours. On Base.
        </div>
      </div>
    ),
    size,
  );
}
