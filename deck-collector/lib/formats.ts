// Archidekt encodes deck format as a small integer. This mapping comes from
// observing their site/API responses — it is not officially documented.
// Anything unmapped renders as "Format #N" so we never hide data.

export const FORMAT_NAMES: Record<number, string> = {
  1: "Standard",
  2: "Modern",
  3: "Commander / EDH",
  4: "Legacy",
  5: "Vintage",
  6: "Pauper",
  7: "Custom",
  9: "Future Standard",
  10: "Penny Dreadful",
  11: "1v1 Commander",
  12: "Duel Commander",
  13: "Brawl",
  14: "Oathbreaker",
  15: "Pioneer",
  16: "Historic",
  17: "Pauper EDH",
};

export function formatName(code: number | null | undefined): string {
  if (code === null || code === undefined) return "(none)";
  return FORMAT_NAMES[code] ?? `Format #${code}`;
}
