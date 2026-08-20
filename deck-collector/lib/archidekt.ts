// Archidekt API client.
//
// Everything in here runs ONLY on the server (Node.js) — API routes and CLI
// scripts import it. The browser never calls Archidekt directly (CORS).
//
// Guarantees:
//   * single-threaded: requests are queued and run strictly one at a time
//   * throttled: at least `config.requestDelayMs` between request starts
//   * retries HTTP 429 / 5xx and network errors with exponential backoff

import { config } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
// TypeScript note: these interfaces describe the JSON we get back. They are
// erased at runtime (no reflection, unlike C#) — they only help the compiler
// and your editor. Fields the API sends that we don't declare are simply
// ignored, and we always keep the raw JSON too.

/** One row from the list/search endpoint (deck summary). Verified against a
 * live response 2026-08-20 — the format field is `deckFormat`, not `format`. */
export interface DeckSummary {
  id: number;
  name: string;
  deckFormat: number | null; // numeric format code; see formats.ts
  size: number; // card count (0 = empty shell deck)
  owner: { id: number; username: string } | null;
  createdAt: string; // ISO timestamp string
  updatedAt: string;
}

/** Response shape of GET /api/decks/v3/.
 * Verified live: top-level keys are exactly count/next/results (no
 * `previous`), `count` is capped at 1000, and the server IGNORES the
 * pageSize param — every page contains 60 rows regardless. We still send
 * pageSize for politeness/future-proofing but never rely on it. */
export interface DeckListResponse {
  count: number;
  next: string | null; // URL of the next page, null on the last page
  results: DeckSummary[];
}

/** Rows the list endpoint actually returns per page (observed, fixed). */
export const OBSERVED_PAGE_SIZE = 60;

/** One card entry inside a full deck. Verified against a live response:
 * the entry has quantity/categories plus a nested `card` (one printing),
 * which nests `oracleCard` (the rules-text-level card with the name). */
export interface DeckCard {
  quantity: number;
  categories: string[] | null; // e.g. ["Commander"] or ["Finisher"]
  card: {
    uid: string; // Scryfall printing UUID (this is our scryfall_id)
    collectorNumber: string | number;
    displayName: string | null; // usually null; set for flip/alt names
    edition: { editioncode: string; editionname?: string } | null; // e.g. "pip"
    oracleCard: { name: string } | null;
  } | null;
}

/** Response shape of GET /api/decks/{id}/ (full deck). */
export interface DeckDetail {
  id: number;
  name: string;
  deckFormat: number | null;
  owner: { id: number; username: string } | null;
  createdAt: string;
  updatedAt: string;
  cards: DeckCard[];
}

/** Query parameters for the list endpoint. Only params we know exist. */
export interface DeckSearchParams {
  formats?: string; // numeric format code as a string, e.g. "3" = EDH
  cardName?: string;
  commander?: string;
  name?: string; // deck name contains
  orderBy?: string; // e.g. "-createdAt"
  pageSize?: number; // max 100
}

// ---------------------------------------------------------------------------
// URL building (exported so the UI can show the exact URL before a job runs)
// ---------------------------------------------------------------------------

const BASE = "https://archidekt.com/api";

export function buildListUrl(params: DeckSearchParams, page: number): string {
  // URLSearchParams handles percent-encoding for us (like UriBuilder in C#).
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("pageSize", String(Math.min(params.pageSize ?? config.maxPageSize, config.maxPageSize)));
  // `??` is the null-coalescing operator, same as C#'s.
  if (params.orderBy) qs.set("orderBy", params.orderBy);
  if (params.formats) qs.set("formats", params.formats);
  if (params.cardName) qs.set("cardName", params.cardName);
  if (params.commander) qs.set("commander", params.commander);
  if (params.name) qs.set("name", params.name);
  return `${BASE}/decks/v3/?${qs.toString()}`;
}

export function buildDeckUrl(id: number): string {
  return `${BASE}/decks/${id}/`;
}

// ---------------------------------------------------------------------------
// Throttle queue
// ---------------------------------------------------------------------------
// JS is single-threaded, but `async` code can still interleave: if two API
// routes each call fetch(), both requests would be in flight at once. To
// prevent that we chain every request onto one shared Promise ("the queue").
// Each caller awaits the previous caller's completion plus the delay —
// conceptually like a mutex + Thread.sleep in Java, but non-blocking.
//
// Next.js dev mode reloads modules on file changes, which would reset a
// plain module variable. Stashing state on `globalThis` (the process-wide
// global object) survives those reloads, so the throttle stays honest.

type ThrottleState = { chain: Promise<void>; lastRequestAt: number };

function throttleState(): ThrottleState {
  const g = globalThis as { __archidektThrottle?: ThrottleState };
  if (!g.__archidektThrottle) {
    g.__archidektThrottle = { chain: Promise.resolve(), lastRequestAt: 0 };
  }
  return g.__archidektThrottle;
}

function sleep(ms: number): Promise<void> {
  // Promisified setTimeout — `await sleep(1000)` pauses this async function
  // without blocking the process (other work keeps running meanwhile).
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Run `task` exclusively: after all previously queued tasks, and at least
 * `config.requestDelayMs` after the previous request started.
 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const state = throttleState();
  const run = state.chain.then(async () => {
    const elapsed = Date.now() - state.lastRequestAt;
    const waitMs = config.requestDelayMs - elapsed;
    if (waitMs > 0) await sleep(waitMs);
    state.lastRequestAt = Date.now();
    return task();
  });
  // Extend the chain. `.catch(() => {})` keeps one failed request from
  // poisoning the queue for everyone after it (errors still propagate to
  // the original caller through `run`).
  state.chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

// ---------------------------------------------------------------------------
// Fetch with retry
// ---------------------------------------------------------------------------

export class ArchidektHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    body: string
  ) {
    super(`Archidekt HTTP ${status} for ${url}: ${body.slice(0, 300)}`);
    this.name = "ArchidektHttpError";
  }
}

/**
 * GET `url`, parse JSON. Retries on 429/5xx/network failure with exponential
 * backoff (2s, 4s, 8s, ... up to config.maxRetries attempts after the first).
 * 4xx other than 429 fails immediately — retrying a 404 will never help.
 */
async function fetchJson(url: string): Promise<unknown> {
  let lastError: Error = new Error("unreachable");

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    if (attempt > 0) {
      // 2 ** (attempt - 1) doubles the wait each round: 2s, 4s, 8s, 16s, 32s.
      const backoffMs = config.initialBackoffMs * 2 ** (attempt - 1);
      console.warn(`[archidekt] retry ${attempt}/${config.maxRetries} in ${backoffMs}ms — ${lastError.message}`);
      await sleep(backoffMs);
    }

    try {
      // Each attempt goes through the throttle queue, so retries also
      // respect the 1-request-per-second rule.
      const response = await enqueue(() =>
        fetch(url, { headers: { "User-Agent": config.userAgent, Accept: "application/json" } })
      );

      if (response.ok) {
        return await response.json();
      }

      const body = await response.text();
      const error = new ArchidektHttpError(response.status, url, body);
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable) throw error; // e.g. 404 deck deleted — don't retry
      lastError = error;
    } catch (err) {
      if (err instanceof ArchidektHttpError && err.status !== 429 && err.status < 500) {
        throw err; // the non-retryable rethrow from just above
      }
      // Network-level failure (DNS, reset, timeout) — retryable.
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch one page of deck search results. */
export function listDecks(params: DeckSearchParams, page: number): Promise<DeckListResponse> {
  // The cast tells the compiler "trust me, this JSON matches DeckListResponse".
  // If Archidekt changes shape, downstream code defends with `?? null` checks.
  return fetchJson(buildListUrl(params, page)) as Promise<DeckListResponse>;
}

/** Fetch one full deck by numeric ID. */
export function getDeck(id: number): Promise<DeckDetail> {
  return fetchJson(buildDeckUrl(id)) as Promise<DeckDetail>;
}

/**
 * Pull a card's name out of the nested response, tolerating shape drift.
 * Kept here so the CLI script and the DB layer normalize identically.
 */
export function extractCardName(entry: DeckCard): string {
  const card = entry.card as Record<string, unknown> | null;
  if (!card) return "(unknown card)";
  const oracle = card["oracleCard"] as Record<string, unknown> | null;
  if (oracle && typeof oracle["name"] === "string") return oracle["name"];
  if (typeof card["displayName"] === "string") return card["displayName"] as string;
  if (typeof card["name"] === "string") return card["name"] as string;
  return "(unknown card)";
}
