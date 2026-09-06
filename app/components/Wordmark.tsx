import Link from "next/link";
import { Logo } from "./Logo";

/** The name, set the way it would be printed on a scoreboard. */
export function Wordmark({ size = 22, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2" aria-label="Gameweek home">
      <Logo size={size} />
      <span className="hed text-[24px] tracking-[0.04em]">Gameweek</span>
    </Link>
  );
}
