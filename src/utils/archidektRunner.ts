// Browser job runner: list pages -> queue deck IDs -> fetch each deck ->
// store in IndexedDB. Port of deck-collector/lib/runner.ts.
//
// Control flow is database-driven, exactly like the local app: pause/cancel
// write a status to Dexie, and the loop re-reads it before every network
// request. Closing the tab mid-run loses nothing — jobs and queue rows are
// in IndexedDB, and reopening the page auto-resumes 'running' jobs, skipping
// decks that are already stored.
//
// One caveat vs. the local app: collection only progresses while a
// CardCollectr tab is open (browsers pause background JS eventually).

import { archDb, type ArchJob } from '../db/archidektViewer';
import { listDecks, getDeck, RESULT_CAP_WARNING } from './archidektClient';
import { parseRawDeck, type RawDeck } from './archidektViewer';

export { RESULT_CAP_WARNING };

let active = false; // one runner loop per tab

/** Start the background loop if it isn't running. Fire-and-forget. */
export function kickRunner(): void {
  if (active) return;
  active = true;
  runLoop()
    .catch(err => console.error('[runner] loop crashed:', err))
    .finally(() => {
      active = false;
    });
}

async function runLoop(): Promise<void> {
  while (true) {
    const job = await archDb.archJobs.where('status').equals('running').first();
    if (!job) return; // nothing to do — loop exits, kickRunner revives it later
    await runJob(job.id!);
  }
}

async function stillRunning(jobId: number): Promise<boolean> {
  return (await archDb.archJobs.get(jobId))?.status === 'running';
}

async function patchJob(jobId: number, fields: Partial<ArchJob>): Promise<void> {
  await archDb.archJobs.update(jobId, fields);
}

async function runJob(jobId: number): Promise<void> {
  const job = await archDb.archJobs.get(jobId);
  if (!job) return;
  if (!job.startedAt) await patchJob(jobId, { startedAt: new Date().toISOString() });

  try {
    await discoverDeckIds(jobId);
    if (!(await stillRunning(jobId))) return; // paused/cancelled meanwhile
    await fetchQueuedDecks(jobId);
    if (!(await stillRunning(jobId))) return;
    await patchJob(jobId, { status: 'done', finishedAt: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[runner] job ${jobId} failed:`, message);
    await patchJob(jobId, { status: 'failed', error: message, finishedAt: new Date().toISOString() });
  }
}

/** Phase A: walk list pages, queue every deck ID. pagesDone persists after
 * each page so a reopened tab resumes at the right page. */
async function discoverDeckIds(jobId: number): Promise<void> {
  const job = (await archDb.archJobs.get(jobId))!;

  for (let page = job.pagesDone + 1; page <= job.params.maxPages; page++) {
    if (!(await stillRunning(jobId))) return;

    const response = await listDecks(job.params, page);

    // Archidekt reports some failures as HTTP 200 + a message field with
    // zero results (e.g. cardName timing out server-side). Surface it.
    if (response.message && response.results.length === 0) {
      throw new Error(`Archidekt API message: ${response.message.trim()}`);
    }

    // Queue the IDs; the compound [jobId+deckId] key makes duplicates
    // ConstraintErrors, which we swallow (re-listing a page is harmless).
    for (const result of response.results) {
      await archDb.archQueue
        .add({ jobId, deckId: result.id, status: 'pending', error: null })
        .catch(() => {});
    }

    const found = await archDb.archQueue.where('jobId').equals(jobId).count();
    await patchJob(jobId, { pagesDone: page, decksFound: found, apiCount: response.count });

    if (!response.next) return; // genuine last page for this query
  }
}

/** Phase B: fetch each queued deck (1 req/s enforced by the client),
 * checking for pause/cancel between decks. */
async function fetchQueuedDecks(jobId: number): Promise<void> {
  while (true) {
    if (!(await stillRunning(jobId))) return;
    const job = (await archDb.archJobs.get(jobId))!;

    const pending = await archDb.archQueue
      .where('jobId')
      .equals(jobId)
      .filter(item => item.status === 'pending')
      .limit(25)
      .toArray();
    if (pending.length === 0) return; // queue drained

    for (const item of pending) {
      if (!(await stillRunning(jobId))) return;

      // Never re-fetch a stored deck unless refresh is on — skips cost no
      // HTTP request, so resuming flies through the already-done part.
      if (!job.params.refresh && (await archDb.archDecks.get(item.deckId))) {
        await archDb.archQueue.update([jobId, item.deckId], { status: 'done' });
        continue;
      }

      try {
        const raw = (await getDeck(item.deckId)) as RawDeck;
        const { deck, cards } = parseRawDeck(raw);
        await archDb.transaction('rw', archDb.archDecks, archDb.archCards, async () => {
          await archDb.archCards.where('deckId').equals(deck.id).delete();
          await archDb.archDecks.put(deck);
          await archDb.archCards.bulkAdd(cards);
        });
        await archDb.archQueue.update([jobId, item.deckId], { status: 'done' });
      } catch (err) {
        // One bad deck (deleted -> 404, etc.) must not sink the job.
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[runner] deck ${item.deckId} failed: ${message}`);
        await archDb.archQueue.update([jobId, item.deckId], { status: 'failed', error: message });
      }
    }
  }
}

// ---- job control (used by the Collect page) --------------------------------

export async function createAndStartJob(params: ArchJob['params']): Promise<number> {
  const jobId = await archDb.archJobs.add({
    params,
    status: 'running',
    pagesDone: 0,
    decksFound: 0,
    apiCount: null,
    error: null,
    startedAt: null,
    finishedAt: null,
  });
  kickRunner();
  return jobId as number;
}

export async function pauseJob(jobId: number): Promise<void> {
  await patchJob(jobId, { status: 'paused' });
}

export async function resumeJob(jobId: number): Promise<void> {
  await patchJob(jobId, { status: 'running', error: null });
  kickRunner();
}

export async function cancelJob(jobId: number): Promise<void> {
  await patchJob(jobId, { status: 'cancelled', finishedAt: new Date().toISOString() });
}

/** Per-status queue counts for one job, e.g. { pending: 40, done: 100 }. */
export async function queueCounts(jobId: number): Promise<Record<string, number>> {
  const items = await archDb.archQueue.where('jobId').equals(jobId).toArray();
  const counts: Record<string, number> = {};
  for (const item of items) counts[item.status] = (counts[item.status] ?? 0) + 1;
  return counts;
}
