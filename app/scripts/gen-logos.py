"""
Regenerates lib/logos.ts from Simple Icons, which publishes each company's own logo as a single
24x24 path. Inlined rather than fetched at runtime, so a shirt never waits on an image host.

  bun run gen:logos
"""
import re
import urllib.request

SLUGS = {
    "AAPLc": ("apple", "Apple"),
    "AMZNc": ("amazon", "Amazon"),
    "GOOGLc": ("google", "Alphabet"),
    "METAc": ("meta", "Meta"),
    "MSFTc": ("microsoft", "Microsoft"),
    "MSTRc": ("microstrategy", "Strategy"),
    "NVDAc": ("nvidia", "Nvidia"),
    "SNDKc": ("sandisk", "SanDisk"),
    "SPCXc": ("spacex", "SpaceX"),
    "TSLAc": ("tesla", "Tesla"),
}


def fetch(slug: str) -> str:
    url = f"https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/{slug}.svg"
    svg = urllib.request.urlopen(url, timeout=30).read().decode()
    paths = re.findall(r'\sd="([^"]+)"', svg)
    if not paths:
        raise SystemExit(f"no path found in {slug}.svg")
    return max(paths, key=len)


rows = [(t, s, n, fetch(s)) for t, (s, n) in SLUGS.items()]
for t, s, _, d in rows:
    print(f"  {t:8} {s:14} {len(d):>6} chars")

body = "\n".join(f'  {t}: {{ slug: "{s}", title: "{n}", path: "{d}" }},' for t, s, n, d in rows)

with open("lib/logos.ts", "w") as f:
    f.write(f'''/**
 * GENERATED FILE, DO NOT EDIT BY HAND.
 *
 * Official brand marks, taken from Simple Icons, which publishes each company's own logo as a
 * single 24x24 path. Inlined rather than fetched, so a shirt never waits on an image host, and kept
 * as vectors so the same mark is crisp on a 52px pitch shirt and on a 1200px share card.
 *
 * These are trademarks of their owners, used here to identify the stock a shirt represents.
 *
 * Regenerate: bun run gen:logos
 */

export type BrandLogo = {{ slug: string; title: string; path: string }};

export const LOGOS: Record<string, BrandLogo> = {{
{body}
}};

export const logoFor = (ticker: string): BrandLogo | null => LOGOS[ticker] ?? null;
''')
print(f"\nwrote lib/logos.ts ({len(rows)} marks)")
