"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

const TABS = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/draft", label: "Pick", icon: PitchIcon },
  { href: "/#leagues", label: "Leagues", icon: TableIcon, anchor: true },
] as const;

/**
 * A bottom tab bar, because this is a game you hold in one hand.
 *
 * Sticky, blurred, and always showing where you are. Targets are a full 56px tall with no dead
 * space between them, per the touch-target rule: pad the hit area, do not shrink it.
 */
export function TabBar() {
  const path = usePathname();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line-800 bg-deep-950/90 backdrop-blur-md lg:inset-x-auto lg:bottom-6 lg:left-1/2 lg:w-auto lg:-translate-x-1/2 lg:rounded-full lg:border lg:px-2 lg:shadow-[0_10px_40px_rgba(0,0,0,0.55)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-md lg:max-w-none lg:gap-1">
        {TABS.map(({ href, label, icon: Icon, ...tab }) => {
          const base = href.replace(/#.*$/, "");
          const isAnchor = "anchor" in tab && tab.anchor;
          // An anchor tab never claims the page; the plain home tab does.
          const active = isAnchor ? false : base === "/" ? path === "/" : path.startsWith(base);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-1 hed text-[12px] tracking-[0.1em] lg:h-12 lg:w-28 lg:flex-none lg:rounded-full ${
                active ? "text-volt" : "text-chalk-500 hover:text-chalk-300"
              }`}
            >
              {active && <span className="absolute inset-x-6 top-0 h-[3px] bg-volt lg:inset-x-8 lg:top-1 lg:rounded-full" />}
              <Icon active={active} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return active ? (
    <Logo size={22} />
  ) : (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" strokeLinejoin="round" />
    </svg>
  );
}

function PitchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <circle cx="12" cy="12" r="3" fill={active ? "currentColor" : "none"} />
    </svg>
  );
}

function TableIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
      {active && <circle cx="4" cy="6" r="1.6" fill="currentColor" stroke="none" />}
    </svg>
  );
}
