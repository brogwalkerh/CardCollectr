// Plain-text decklist rendering, shared by the zip export.

import type { CardRow } from "./db";
import type { DeckRow } from "./db";
import { groupByCategory } from "./queries";
import { formatName } from "./formats";

/** Render one deck as a classic plain-text list:
 *
 *   // Commander
 *   1 Magda, Brazen Outlaw
 *   // Land
 *   14 Mountain
 */
export function renderDecklist(deck: DeckRow, cards: CardRow[]): string {
  const lines: string[] = [
    `// ${deck.name}`,
    `// Format: ${formatName(deck.format)}`,
    ...(deck.commander ? [`// Commander: ${deck.commander}`] : []),
    ...(deck.owner ? [`// Owner: ${deck.owner}`] : []),
    `// https://archidekt.com/decks/${deck.id}`,
    "",
  ];
  for (const group of groupByCategory(cards)) {
    lines.push(`// ${group.category}`);
    for (const card of group.cards) {
      lines.push(`${card.quantity} ${card.card_name}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Turn a deck name into a safe filename: "Krenko's Mob!" -> "Krenko_s_Mob_". */
export function safeFilename(name: string, id: number): string {
  const cleaned = name.replace(/[^A-Za-z0-9 _-]/g, "_").trim().slice(0, 60) || "deck";
  return `${cleaned}_${id}.txt`; // ID suffix guarantees uniqueness in the zip
}

/** Minimal CSV escaping: quote when needed, double any inner quotes. */
export function csvCell(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
