import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Gameweek: fantasy football, except the players are real stocks";

const INK = "#08080b";
const VOLT = "#d7ff3f";

/**
 * The card that unfurls when the site itself is shared.
 *
 * League links render a live card from chain state; this is the one for the front door, so it is
 * static and says what the game is, set like a matchday poster.
 */
export default async function OpengraphImage() {
  const display = await readFile(path.join(process.cwd(), "app", "fonts", "BigShoulders-800.ttf"));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: `linear-gradient(180deg, #17171d 0%, ${INK} 70%)`,
          color: "#f6f6f8",
          fontFamily: "display",
          textTransform: "uppercase",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 0,
            height: 0,
            borderTop: `64px solid ${VOLT}`,
            borderLeft: "64px solid transparent",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, letterSpacing: 3 }}>
          <svg width="54" height="54" viewBox="0 0 48 48">
            <path
              d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
              fill="#0052ff"
            />
            <rect x="14.5" y="29" width="5.5" height="8" rx="1.6" fill={INK} />
            <rect x="22" y="24" width="5.5" height="13" rx="1.6" fill={INK} />
            <rect x="29.5" y="17" width="5.5" height="20" rx="1.6" fill={INK} />
          </svg>
          <span>Gameweek</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 118, lineHeight: 0.9, marginTop: 30 }}>
          <span>Fantasy football,</span>
          <span>except the players</span>
          <span style={{ color: VOLT }}>are real stocks.</span>
        </div>

        <div style={{ display: "flex", fontSize: 32, letterSpacing: 2, color: "#7b7b8e", marginTop: 34 }}>
          Pick five · name a captain · settle in 24 hours · on Base
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "display", data: display, weight: 800, style: "normal" }],
    },
  );
}
