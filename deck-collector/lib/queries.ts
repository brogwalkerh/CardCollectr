// Read-side queries for the Browse and Export pages.
// One filter model shared by both, so "export the current filter" is
// literally the same WHERE clause the browse table used.

import { getDb, type DeckRow, type CardRow } from "./db";

export interface DeckFilter {
  q?: string; // substring match on deck name, commander, or owner
  format?: number; // numeric format code
  cardName?: string; // only decks containing this card (substring)
}

/** WHERE clause + bind values for a filter. Always parameterized —
 * user input goes in `values`, never into the SQL string (injection-safe). */
function buildWhere(filter: DeckFilter): { where: string; values: unknown[] } {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filter.q) {
    clauses.push(`(decks.name LIKE ? OR decks.commander LIKE ? OR decks.owner LIKE ?)`);
    const like = `%${filter.q}%`;
    values.push(like, like, like);
  }
  if (filter.format !== undefined) {
    clauses.push(`decks.format = ?`);
    values.push(filter.format);
  }
  if (filter.cardName) {
    // EXISTS subquery: decks that have at least one matching card row.
    clauses.push(`EXISTS (SELECT 1 FROM cards WHERE cards.deck_id = decks.id AND cards.card_name LIKE ?)`);
    values.push(`%${filter.cardName}%`);
  }
  return { where: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", values };
}

/** Parse browse/export filter params from a query string. Both the Browse
 * API and the Export routes accept the same shape:
 *   ?q=goblin&format=3&cardName=Sol+Ring */
export function filterFromSearchParams(sp: URLSearchParams): DeckFilter {
  const filter: DeckFilter = {};
  const q = sp.get("q");
  if (q) filter.q = q;
  const format = sp.get("format");
  if (format) filter.format = Number(format);
  const cardName = sp.get("cardName");
  if (cardName) filter.cardName = cardName;
  return filter;
}

export interface DeckPage {
  decks: (DeckRow & { card_count: number })[];
  total: number;
}

/** One page of stored decks matching the filter, newest-fetched first. */
export function searchDecks(filter: DeckFilter, page: number, pageSize: number): DeckPage {
  const db = getDb();
  const { where, values } = buildWhere(filter);

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM decks ${where}`).get(...values) as { n: number }
  ).n;

  const decks = db
    .prepare(
      `SELECT decks.id, decks.name, decks.format, decks.commander, decks.owner,
              decks.created_at, decks.updated_at, decks.fetched_at,
              (SELECT COALESCE(SUM(quantity), 0) FROM cards WHERE cards.deck_id = decks.id) AS card_count
       FROM decks ${where}
       ORDER BY decks.fetched_at DESC, decks.id DESC
       LIMIT ? OFFSET ?`
    )
    .all(...values, pageSize, (page - 1) * pageSize) as (DeckRow & { card_count: number })[];

  return { decks, total };
}

/** ALL decks matching the filter (no paging) — used by the export routes. */
export function allDecksForFilter(filter: DeckFilter): DeckRow[] {
  const { where, values } = buildWhere(filter);
  return getDb()
    .prepare(
      `SELECT id, name, format, commander, owner, created_at, updated_at, fetched_at
       FROM decks ${where} ORDER BY decks.id`
    )
    .all(...values) as DeckRow[];
}

export function getDeckRow(id: number): DeckRow | undefined {
  return getDb()
    .prepare(`SELECT id, name, format, commander, owner, created_at, updated_at, fetched_at FROM decks WHERE id = ?`)
    .get(id) as DeckRow | undefined;
}

export function cardsForDeck(deckId: number): CardRow[] {
  return getDb()
    .prepare(`SELECT * FROM cards WHERE deck_id = ? ORDER BY category, card_name`)
    .all(deckId) as CardRow[];
}

/** Card rows for many decks at once (export CSV). */
export function cardsForDecks(deckIds: number[]): CardRow[] {
  if (deckIds.length === 0) return [];
  // Build "(?, ?, ?)" with one placeholder per ID — still fully parameterized.
  const placeholders = deckIds.map(() => "?").join(", ");
  return getDb()
    .prepare(`SELECT * FROM cards WHERE deck_id IN (${placeholders}) ORDER BY deck_id, category, card_name`)
    .all(...deckIds) as CardRow[];
}

/** Group a deck's cards by category label, "Commander" group first. */
export function groupByCategory(cards: CardRow[]): { category: string; cards: CardRow[] }[] {
  const groups = new Map<string, CardRow[]>();
  for (const card of cards) {
    const key = card.category ?? "(no category)";
    // Map.get-or-create; Map preserves insertion order (unlike plain objects).
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(card);
  }
  const list = [...groups.entries()].map(([category, cards]) => ({ category, cards }));
  list.sort((a, b) =>
    a.category === "Commander" ? -1 : b.category === "Commander" ? 1 : a.category.localeCompare(b.category)
  );
  return list;
}

/** raw_json for one deck (export + inspection). */
export function rawJsonForDeck(id: number): string | undefined {
  const row = getDb().prepare(`SELECT raw_json FROM decks WHERE id = ?`).get(id) as
    | { raw_json: string }
    | undefined;
  return row?.raw_json;
}
