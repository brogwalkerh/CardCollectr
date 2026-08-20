// Job runner: list pages -> queue deck IDs -> fetch each deck -> store.
//
// Runs INSIDE the Next.js dev server process, started by the API routes.
// There is exactly one runner loop for the whole process (single-threaded
// politeness), coordinated through globalThis just like the throttle.
//
// Control flow is database-driven: the loop re-reads the job's status row
// before every network call, so a pause/cancel written by an API route takes
// effect within one request. If the process dies mid-run, nothing is lost —
// jobs and deck_queue rows are in SQLite, and Resume picks up the pending
// rows (requirement 3: resumable).

import { listDecks, getDeck, type DeckSearchParams } from "./archidekt";
import {
  getDb,
  getJob,
  updateJob,
  enqueueDeckIds,
  pendingDeckIds,
  markQueueItem,
  upsertDeck,
  deckExists,
  type JobRow,
} from "./db";

/** What we store in jobs.query_params (search params + runner options). */
export interface JobParams extends DeckSearchParams {
  maxPages: number; // stop the list phase after this many pages
  refresh: boolean; // true = re-fetch decks even if already stored
}

export function parseJobParams(job: JobRow): JobParams {
  return JSON.parse(job.query_params) as JobParams;
}

// ---------------------------------------------------------------------------
// Runner singleton
// ---------------------------------------------------------------------------

type RunnerState = { active: boolean };

function runnerState(): RunnerState {
  const g = globalThis as { __deckRunner?: RunnerState };
  if (!g.__deckRunner) g.__deckRunner = { active: false };
  return g.__deckRunner;
}

/**
 * Make sure the background loop is running. Fire-and-forget: API routes call
 * this and return immediately; the loop keeps going after the HTTP response.
 * (In C# terms: kicking off a Task without awaiting it, guarded by a flag so
 * only one ever exists.)
 */
export function kickRunner(): void {
  const state = runnerState();
  if (state.active) return;
  state.active = true;
  runLoop()
    .catch((err) => console.error("[runner] loop crashed:", err))
    .finally(() => {
      state.active = false;
    });
}

/** Oldest job the user wants running. */
function nextRunnableJobId(): number | undefined {
  const row = getDb()
    .prepare(`SELECT id FROM jobs WHERE status = 'running' ORDER BY id ASC LIMIT 1`)
    .get() as { id: number } | undefined;
  return row?.id;
}

async function runLoop(): Promise<void> {
  // Process jobs one at a time until there is nothing left in 'running'.
  while (true) {
    const jobId = nextRunnableJobId();
    if (jobId === undefined) return; // queue drained — loop exits, kickRunner revives it later
    await runJob(jobId);
  }
}

// ---------------------------------------------------------------------------
// Running one job
// ---------------------------------------------------------------------------

/** Re-read status from the DB; false means stop touching this job. */
function stillRunning(jobId: number): boolean {
  return getJob(jobId)?.status === "running";
}

async function runJob(jobId: number): Promise<void> {
  const job = getJob(jobId);
  if (!job) return;
  const params = parseJobParams(job);

  if (!job.started_at) {
    updateJob(jobId, { started_at: new Date().toISOString() });
  }

  try {
    await discoverDeckIds(jobId, params);
    if (!stillRunning(jobId)) return; // paused/cancelled during discovery
    await fetchQueuedDecks(jobId, params);
    if (!stillRunning(jobId)) return;
    updateJob(jobId, { status: "done", finished_at: new Date().toISOString() });
  } catch (err) {
    // A job-level failure (list page failed after all retries). Individual
    // deck failures do NOT land here — they're recorded per queue row.
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] job ${jobId} failed:`, message);
    updateJob(jobId, { status: "failed", error: message, finished_at: new Date().toISOString() });
  }
}

/**
 * Phase A: walk the list endpoint page by page and queue every deck ID.
 * pages_done persists after each page, so a restart resumes at the right
 * page instead of re-listing from 1 (re-listing would be harmless — the
 * queue ignores duplicates — just wasteful).
 */
async function discoverDeckIds(jobId: number, params: JobParams): Promise<void> {
  let job = getJob(jobId)!;
  // `!` is a non-null assertion — we just checked this job exists.

  for (let page = job.pages_done + 1; page <= params.maxPages; page++) {
    if (!stillRunning(jobId)) return;

    const response = await listDecks(params, page);

    // Archidekt reports some failures as HTTP 200 + a `message` field with
    // zero results (e.g. cardName lookups timing out server-side). Treat
    // that as a real error so the job shows it instead of "found 0 decks".
    if (response.message && response.results.length === 0) {
      throw new Error(`Archidekt API message: ${response.message.trim()}`);
    }

    enqueueDeckIds(jobId, response.results.map((d) => d.id));

    const total = getDb()
      .prepare(`SELECT COUNT(*) AS n FROM deck_queue WHERE job_id = ?`)
      .get(jobId) as { n: number };
    updateJob(jobId, {
      pages_done: page,
      decks_found: total.n,
      // The API's reported total for this query. 1000 exactly = the cap —
      // the UI uses this to warn that the slice is too broad.
      api_count: response.count,
    });

    if (!response.next) return; // real last page for this query
  }
}

/**
 * Phase B: fetch each queued deck and store it. One request per second
 * (enforced inside the client), checking for pause/cancel between decks.
 */
async function fetchQueuedDecks(jobId: number, params: JobParams): Promise<void> {
  while (true) {
    if (!stillRunning(jobId)) return;

    // Small batches so a pause never waits behind a long pre-fetched list.
    const ids = pendingDeckIds(jobId, 25);
    if (ids.length === 0) return; // queue drained

    for (const deckId of ids) {
      if (!stillRunning(jobId)) return;

      // Requirement 3: never re-fetch a stored deck unless refresh is on.
      // No HTTP request happens for skips, so resuming a half-done job
      // flies through the already-stored part.
      if (!params.refresh && deckExists(deckId)) {
        markQueueItem(jobId, deckId, "done");
        continue;
      }

      try {
        const deck = await getDeck(deckId);
        upsertDeck(deck);
        markQueueItem(jobId, deckId, "done");
      } catch (err) {
        // One bad deck (deleted → 404, malformed, etc.) must not sink the
        // job: record the error on its queue row and move on.
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[runner] deck ${deckId} failed: ${message}`);
        markQueueItem(jobId, deckId, "failed", message);
      }
    }
  }
}
