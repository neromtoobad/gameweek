/**
 * The Gameweek mark: a football shirt with a rising chart printed on the chest.
 *
 * The whole product is about putting a mark on a shirt, so the logo does that to itself. Drawn
 * rather than loaded, so it is sharp in a browser tab and on a share card alike.
 */
export function Logo({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label="Gameweek"
      className={className}
      style={{ display: "block", flexShrink: 0 }}
    >
      <path
        d="M16 7 L10 10 L5 18 L11 22 L13 19 L13 42 Q24 44 35 42 L35 19 L37 22 L43 18 L38 10 L32 7 Q24 12 16 7 Z"
        fill="var(--color-base-500)"
      />
      <rect x="14.5" y="29" width="5.5" height="8" rx="1.6" fill="var(--color-deep-950)" />
      <rect x="22" y="24" width="5.5" height="13" rx="1.6" fill="var(--color-deep-950)" />
      <rect x="29.5" y="17" width="5.5" height="20" rx="1.6" fill="var(--color-deep-950)" />
    </svg>
  );
}
