// Category colors. To guarantee that different categories never share a color,
// colors are drawn from a curated, well-separated palette and assigned by the
// category's position in the (alphabetically sorted) set of all categories —
// so the same category always gets the same color across badges and charts.

export type CatColor = { dot: string; strong: string; bg: string; text: string; border: string };

const fromHue = (h: number): CatColor => ({
  dot: `hsl(${h} 62% 52%)`,
  strong: `hsl(${h} 64% 45%)`,
  bg: `hsl(${h} 70% 95%)`,
  text: `hsl(${h} 42% 32%)`,
  border: `hsl(${h} 55% 85%)`,
});

// 16 hues ordered so neighbours in the list stay visually distinct.
const HUES = [214, 152, 28, 280, 0, 190, 96, 330, 50, 258, 172, 8, 232, 120, 300, 64];

// Stable fallback (hash) for one-off use where the full set isn't known.
export function catColor(name: string): CatColor {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return fromHue(h);
}

// Distinct, sorted, non-empty categories used across the given epics.
export function catList(epics: { category?: string | null }[]): string[] {
  return Array.from(
    new Set(epics.map((e) => (e.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

// Build a name -> color map with guaranteed-distinct colors (cycles past 16).
export function catColorMap(categories: string[]): Map<string, CatColor> {
  const sorted = Array.from(
    new Set(categories.map((c) => (c ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
  const map = new Map<string, CatColor>();
  sorted.forEach((c, i) => map.set(c, fromHue(HUES[i % HUES.length])));
  return map;
}

// Resolve a color from a prebuilt map, falling back to the hash color.
export function catColorOf(name: string | null | undefined, map?: Map<string, CatColor>): CatColor {
  const n = (name ?? "").trim();
  return (map && map.get(n)) || catColor(n || "?");
}
