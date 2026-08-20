# Deck Collector

Local web app that bulk-collects public Magic: The Gathering decklists from
[Archidekt](https://archidekt.com)'s public read API into SQLite. No auth, no
deployment — runs on your machine only.

## Run

```bash
cd deck-collector
npm install
npm run dev          # http://localhost:3000
```

Quick smoke test of the API client without the UI:

```bash
npm run fetch-deck              # grabs the newest public Commander deck
npm run fetch-deck -- 1234567   # fetch a specific deck ID
npm run fetch-deck -- 1234567 --raw   # full raw JSON
```

The database lives in `deck-collector/data/deck-collector.db` (gitignored).
Delete the file to start over.

## Pages

- **New Job** — build one query (format, deck name, card name, commander, sort,
  max pages). Shows the exact URL that will be called before you start.
- **Jobs** — live progress (2s polling), pause / resume / cancel, per-deck
  errors, and a warning when a query hits the ~1,000-result cap.
- **Browse** — searchable, paginated table of stored decks; click through for
  the full list grouped by category.
- **Export** — current filter to: zip of plain-text decklists (one `.txt` per
  deck), one CSV of every card row, or the raw Archidekt JSON.

## Politeness

All Archidekt traffic goes through `lib/archidekt.ts` on the server:

- descriptive User-Agent with contact email (edit it in `lib/config.ts`)
- single-threaded, 1 request/second (`requestDelayMs` in `lib/config.ts`)
- exponential backoff on 429/5xx/network errors: 2s, 4s, 8s, 16s, 32s, then fail

## Resumability

Every discovered deck ID is persisted in the `deck_queue` table with a
pending/done/failed status. Kill the app mid-run, restart, hit Resume on the
Jobs page — it continues from the pending rows. Decks already in the `decks`
table are never re-fetched (no HTTP at all) unless the job was started with
the **Refresh** checkbox. Writes are idempotent upserts keyed on deck ID.

## Live findings about the Archidekt API (verified 2026-08-20)

The API is undocumented; these behaviors were confirmed by inspecting raw
responses (see comments in `lib/archidekt.ts`):

- The list endpoint (`/api/decks/v3/`) returns **exactly 60 rows per page**
  and ignores the `pageSize` param.
- `count` is capped at **1000**; a job whose reported count is ≥ 900 gets a
  "slice too broad" warning in the Jobs page.
- The format field is **`deckFormat`** (numeric code — mapping in
  `lib/formats.ts`), not `format`.
- The **`commander` param is accepted but ignored** — results come back
  unfiltered. The UI warns about this.
- **`cardName` searches usually fail inside Archidekt's own database**
  ("canceling statement due to statement timeout", returned as HTTP 200 with
  a `message` field). The runner surfaces that as a job error instead of
  reporting zero decks.
- `name` (deck name contains) filters correctly.

## Schema

- `decks` — id (Archidekt ID, PK), name, format, commander, owner,
  created_at, updated_at, raw_json, fetched_at
- `cards` — deck_id, card_name, quantity, category, set_code,
  collector_number, scryfall_id (indexes on card_name and deck_id)
- `jobs` — id, query_params (JSON), status, pages_done, decks_found,
  api_count, error, started_at, finished_at
- `deck_queue` — job_id, deck_id, status (pending/done/failed), error

`api_count` and `deck_queue` are additions to the original schema sketch:
`api_count` powers the 1000-cap warning, `deck_queue` is the resumable work
queue.

## Viewing collected decks on GitHub Pages

The deployed CardCollectr site (GitHub Pages) has an **Archidekt** page that
imports this app's **Raw JSON** export and lets you browse, search, and
re-export the decks from any browser (data stays in IndexedDB). Collection
itself must run locally: GitHub Pages cannot host a server, and Archidekt's
CORS policy (`Access-Control-Allow-Origin: http://localhost:3000`, verified
2026-08-20) blocks browser-side API calls from any other origin.

Related: [pyrchidekt](https://github.com/linkian209/pyrchidekt) is a Python
wrapper for the same API — handy if you want to script analysis of the data
outside this app; the CSV/JSON exports here are plain files any Python
script can read.

## Stack

Next.js (App Router) + TypeScript · better-sqlite3 · Tailwind. All Archidekt
calls happen in Next API routes / server code — the browser never talks to
Archidekt (CORS would block it anyway).
