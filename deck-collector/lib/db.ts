// SQLite storage layer (better-sqlite3).
//
// better-sqlite3 is deliberately SYNCHRONOUS — calls block like plain JDBC.
// That is fine (and fast) for a local single-user tool, and it means no
// async/await noise in this file. Server-only: never import from a
// "use client" component.

import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config";
import type { DeckDetail } from "./archidekt";
import { extractCardName } from "./archidekt";

// ---------------------------------------------------------------------------
// Connection (singleton, survives Next.js dev-mode module reloads)
// ---------------------------------------------------------------------------

function openDatabase(): Database.Database {
  const file = path.resolve(process.cwd(), config.databaseFile);
  fs.mkdirSync(path.dirname(file), { recursive: true }); // like mkdirs()
  const db = new Database(file);
  // WAL journal lets readers (the UI) run while the job runner writes.
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function getDb(): Database.Database {
  // Same globalThis trick as the throttle: keep one connection per process.
  const g = globalThis as { __deckCollectorDb?: Database.Database };
  if (!g.__deckCollectorDb) {
    g.__deckCollectorDb = openDatabase();
  }
  return g.__deckCollectorDb;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function migrate(db: Database.Database): void {
  // exec() runs multiple statements; IF NOT EXISTS makes it re-runnable.
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id               INTEGER PRIMARY KEY,          -- Archidekt deck ID
      name             TEXT    NOT NULL,
      format           INTEGER,                      -- numeric code, see formats.ts
      commander        TEXT,                         -- names joined with " / ", null if none
      owner            TEXT,
      created_at       TEXT,                         -- ISO strings straight from the API
      updated_at       TEXT,
      raw_json         TEXT    NOT NULL,             -- full API response, for anything we didn't model
      fetched_at       TEXT    NOT NULL              -- when WE stored it (refresh bookkeeping)
    );

    CREATE TABLE IF NOT EXISTS cards (
      deck_id          INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
      card_name        TEXT    NOT NULL,
      quantity         INTEGER NOT NULL,
      category         TEXT,                         -- first category label, e.g. "Ramp"
      set_code         TEXT,
      collector_number TEXT,
      scryfall_id      TEXT
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      query_params     TEXT    NOT NULL,             -- JSON blob of DeckSearchParams + maxPages
      status           TEXT    NOT NULL DEFAULT 'pending',
        -- pending | running | paused | done | failed | cancelled
      pages_done       INTEGER NOT NULL DEFAULT 0,
      decks_found      INTEGER NOT NULL DEFAULT 0,   -- deck IDs discovered by the list phase
      api_count        INTEGER,                      -- total the API reported; 1000 = capped
      error            TEXT,
      started_at       TEXT,
      finished_at      TEXT
    );

    -- Work queue: every deck ID a job discovered, with per-deck status.
    -- This is what makes runs resumable: restart the app, and the runner
    -- just picks up where the 'pending' rows left off.
    CREATE TABLE IF NOT EXISTS deck_queue (
      job_id           INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
      deck_id          INTEGER NOT NULL,
      status           TEXT    NOT NULL DEFAULT 'pending',  -- pending | done | failed
      error            TEXT,
      PRIMARY KEY (job_id, deck_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cards_card_name ON cards(card_name);
    CREATE INDEX IF NOT EXISTS idx_cards_deck_id   ON cards(deck_id);
    CREATE INDEX IF NOT EXISTS idx_decks_format    ON decks(format);
    CREATE INDEX IF NOT EXISTS idx_queue_status    ON deck_queue(job_id, status);
  `);
}

// ---------------------------------------------------------------------------
// Row types (what SELECTs give back)
// ---------------------------------------------------------------------------

export interface DeckRow {
  id: number;
  name: string;
  format: number | null;
  commander: string | null;
  owner: string | null;
  created_at: string | null;
  updated_at: string | null;
  fetched_at: string;
}

export interface CardRow {
  deck_id: number;
  card_name: string;
  quantity: number;
  category: string | null;
  set_code: string | null;
  collector_number: string | null;
  scryfall_id: string | null;
}

export interface JobRow {
  id: number;
  query_params: string; // JSON string; parse with JSON.parse
  status: "pending" | "running" | "paused" | "done" | "failed" | "cancelled";
  pages_done: number;
  decks_found: number;
  api_count: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
}

// ---------------------------------------------------------------------------
// Deck upsert (requirement 4: idempotent writes keyed on deck ID)
// ---------------------------------------------------------------------------

/** Names of the commander(s), pulled from card categories. */
function extractCommander(deck: DeckDetail): string | null {
  const names: string[] = [];
  for (const entry of deck.cards ?? []) {
    if (entry.categories?.includes("Commander")) {
      names.push(extractCardName(entry));
    }
  }
  return names.length > 0 ? names.join(" / ") : null;
}

/**
 * Insert or replace one deck and all of its card rows, atomically.
 * Running this twice for the same deck leaves the DB identical (idempotent):
 * the deck row is updated in place and the card rows are replaced wholesale.
 */
export function upsertDeck(deck: DeckDetail): void {
  const db = getDb();

  const upsertDeckStmt = db.prepare(`
    INSERT INTO decks (id, name, format, commander, owner, created_at, updated_at, raw_json, fetched_at)
    VALUES (@id, @name, @format, @commander, @owner, @created_at, @updated_at, @raw_json, @fetched_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, format = excluded.format, commander = excluded.commander,
      owner = excluded.owner, created_at = excluded.created_at, updated_at = excluded.updated_at,
      raw_json = excluded.raw_json, fetched_at = excluded.fetched_at
  `);
  const deleteCardsStmt = db.prepare(`DELETE FROM cards WHERE deck_id = ?`);
  const insertCardStmt = db.prepare(`
    INSERT INTO cards (deck_id, card_name, quantity, category, set_code, collector_number, scryfall_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // db.transaction() wraps the function in BEGIN/COMMIT with rollback on
  // throw — same idea as TransactionScope in C#.
  const write = db.transaction(() => {
    upsertDeckStmt.run({
      id: deck.id,
      name: deck.name ?? "(unnamed)",
      format: deck.deckFormat ?? null,
      commander: extractCommander(deck),
      owner: deck.owner?.username ?? null,
      created_at: deck.createdAt ?? null,
      updated_at: deck.updatedAt ?? null,
      raw_json: JSON.stringify(deck),
      fetched_at: new Date().toISOString(),
    });
    deleteCardsStmt.run(deck.id);
    for (const entry of deck.cards ?? []) {
      insertCardStmt.run(
        deck.id,
        extractCardName(entry),
        entry.quantity ?? 1,
        entry.categories?.[0] ?? null,
        entry.card?.edition?.editioncode ?? null,
        entry.card?.collectorNumber != null ? String(entry.card.collectorNumber) : null,
        entry.card?.uid ?? null
      );
    }
  });
  write();
}

/** True if we already stored this deck (used to skip re-fetches). */
export function deckExists(id: number): boolean {
  return getDb().prepare(`SELECT 1 FROM decks WHERE id = ?`).get(id) !== undefined;
}

// ---------------------------------------------------------------------------
// Job + queue helpers (used by the runner in step 3 and the UI)
// ---------------------------------------------------------------------------

export function createJob(queryParams: object): number {
  const result = getDb()
    .prepare(`INSERT INTO jobs (query_params, status) VALUES (?, 'pending')`)
    .run(JSON.stringify(queryParams));
  // lastInsertRowid is a number for normal-sized IDs; bigint only past 2^53.
  return Number(result.lastInsertRowid);
}

export function getJob(id: number): JobRow | undefined {
  return getDb().prepare(`SELECT * FROM jobs WHERE id = ?`).get(id) as JobRow | undefined;
}

export function listJobs(): JobRow[] {
  return getDb().prepare(`SELECT * FROM jobs ORDER BY id DESC`).all() as JobRow[];
}

export function updateJob(
  id: number,
  fields: Partial<Pick<JobRow, "status" | "pages_done" | "decks_found" | "api_count" | "error" | "started_at" | "finished_at">>
): void {
  // Build "SET a = @a, b = @b" from whichever fields were passed.
  // Column names come from our own code (the Partial<> type), never from
  // user input, so string-building the SET list is safe here.
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const setClause = keys.map((k) => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE jobs SET ${setClause} WHERE id = @id`).run({ ...fields, id });
}

/** Add discovered deck IDs to a job's queue (ignores duplicates). */
export function enqueueDeckIds(jobId: number, deckIds: number[]): void {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO deck_queue (job_id, deck_id, status) VALUES (?, ?, 'pending')`
  );
  const write = db.transaction(() => {
    for (const id of deckIds) stmt.run(jobId, id);
  });
  write();
}

/** Next batch of unfetched deck IDs for a job. */
export function pendingDeckIds(jobId: number, limit: number): number[] {
  const rows = getDb()
    .prepare(`SELECT deck_id FROM deck_queue WHERE job_id = ? AND status = 'pending' ORDER BY deck_id LIMIT ?`)
    .all(jobId, limit) as { deck_id: number }[];
  return rows.map((r) => r.deck_id);
}

export function markQueueItem(jobId: number, deckId: number, status: "done" | "failed", error?: string): void {
  getDb()
    .prepare(`UPDATE deck_queue SET status = ?, error = ? WHERE job_id = ? AND deck_id = ?`)
    .run(status, error ?? null, jobId, deckId);
}

/** Per-status counts for a job's queue, e.g. { pending: 40, done: 100, failed: 2 }. */
export function queueCounts(jobId: number): Record<string, number> {
  const rows = getDb()
    .prepare(`SELECT status, COUNT(*) AS n FROM deck_queue WHERE job_id = ? GROUP BY status`)
    .all(jobId) as { status: string; n: number }[];
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row.n;
  return counts;
}

/** Errors recorded on a job's failed queue items (for the Jobs UI). */
export function queueErrors(jobId: number, limit = 20): { deck_id: number; error: string | null }[] {
  return getDb()
    .prepare(`SELECT deck_id, error FROM deck_queue WHERE job_id = ? AND status = 'failed' LIMIT ?`)
    .all(jobId, limit) as { deck_id: number; error: string | null }[];
}
