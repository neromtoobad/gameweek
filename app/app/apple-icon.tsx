import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon: the mark on a pitch-dark tile. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d2b18",
        }}
      >
        <svg width="132" height="132" viewBox="0 0 48 48">
          <path
            d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
            fill="#22c55e"
          />
          <rect x="14.5" y="29" width="5.5" height="8" rx="1.6" fill="#06110c" />
          <rect x="22" y="24" width="5.5" height="13" rx="1.6" fill="#06110c" />
          <rect x="29.5" y="17" width="5.5" height="20" rx="1.6" fill="#06110c" />
        </svg>
      </div>
    ),
    size,
  );
}
