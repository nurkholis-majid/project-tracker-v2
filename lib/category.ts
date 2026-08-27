// Auto color for a free-text category name — stable per name, no manual setup.
export function catColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return {
    dot: `hsl(${h} 60% 52%)`,
    strong: `hsl(${h} 62% 46%)`,
    bg: `hsl(${h} 70% 95%)`,
    text: `hsl(${h} 45% 32%)`,
    border: `hsl(${h} 55% 86%)`,
  };
}

// Distinct, sorted, non-empty categories used across the given epics.
export function catList(epics: { category?: string | null }[]): string[] {
  return Array.from(
    new Set(epics.map((e) => (e.category ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}
