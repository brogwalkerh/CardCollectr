// Browser-side Archidekt client. Talks to the /api/archidekt proxy
// (Vercel function in production, vite dev proxy in `npm run dev`), never
// to archidekt.com directly — their CORS policy blocks that.
//
// Politeness guarantees (mirrors deck-collector/lib/archidekt.ts):
//   * single "thread": requests are chained one after another
//   * throttled: at least REQUEST_DELAY_MS between request starts
//   * retries HTTP 429/5xx and network errors with exponential backoff

export const REQUEST_DELAY_MS = 1000;
export const MAX_RETRIES = 5;
export const INITIAL_BACKOFF_MS = 2000;
export const OBSERVED_PAGE_SIZE = 60; // the list endpoint ignores pageSize
export const RESULT_CAP_WARNING = 900; // warn near the ~1000-result cap

export interface ArchSearchParams {
  formats?: string;
  name?: string;
  cardName?: string;
  commander?: string;
  orderBy?: string;
}

export interface ArchListResponse {
  count: number; // -1 when the server couldn't count (usually with message)
  next: string | null;
  results: { id: number }[];
  message?: string; // Archidekt soft errors arrive as HTTP 200 + this field
}

const PROXY_STORAGE_KEY = 'archidektProxyUrl';

/** Base URL of the proxy. Same-origin /api/archidekt by default (Vercel or
 * vite dev); overridable so the GitHub Pages copy can point at a deployed
 * Vercel proxy (e.g. https://cardcollectr.vercel.app/api/archidekt). */
export function proxyBase(): string {
  return (localStorage.getItem(PROXY_STORAGE_KEY) ?? '').replace(/\/+$/, '') || '/api/archidekt';
}
export function setProxyBase(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned) localStorage.setItem(PROXY_STORAGE_KEY, cleaned);
  else localStorage.removeItem(PROXY_STORAGE_KEY);
}
export function storedProxyBase(): string {
  return localStorage.getItem(PROXY_STORAGE_KEY) ?? '';
}

function listQuery(params: ArchSearchParams, page: number): string {
  const qs = new URLSearchParams();
  qs.set('page', String(page));
  if (params.orderBy) qs.set('orderBy', params.orderBy);
  if (params.formats) qs.set('formats', params.formats);
  if (params.cardName) qs.set('cardName', params.cardName);
  if (params.commander) qs.set('commander', params.commander);
  if (params.name) qs.set('name', params.name);
  return qs.toString();
}

/** The real Archidekt URL (shown in the UI before starting a job). */
export function archidektListUrl(params: ArchSearchParams, page: number): string {
  return `https://archidekt.com/api/decks/v3/?${listQuery(params, page)}`;
}

// ---- throttle queue (one module instance per tab) --------------------------

let chain: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const waitMs = REQUEST_DELAY_MS - (Date.now() - lastRequestAt);
    if (waitMs > 0) await sleep(waitMs);
    lastRequestAt = Date.now();
    return task();
  });
  chain = run.then(
    () => undefined,
    () => undefined // a failed request must not poison the queue
  );
  return run;
}

export class ArchHttpError extends Error {
  readonly status: number;
  constructor(status: number, url: string, body: string) {
    super(`HTTP ${status} for ${url}: ${body.slice(0, 200)}`);
    this.name = 'ArchHttpError';
    this.status = status;
  }
}

async function fetchJson(path: string): Promise<unknown> {
  const url = `${proxyBase()}/${path}`;
  let lastError: Error = new Error('unreachable');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoffMs = INITIAL_BACKOFF_MS * 2 ** (attempt - 1); // 2s..32s
      console.warn(`[archidekt] retry ${attempt}/${MAX_RETRIES} in ${backoffMs}ms — ${lastError.message}`);
      await sleep(backoffMs);
    }
    try {
      const response = await enqueue(() => fetch(url, { headers: { Accept: 'application/json' } }));
      if (response.ok) return await response.json();
      const error = new ArchHttpError(response.status, url, await response.text());
      if (response.status !== 429 && response.status < 500) throw error; // e.g. 404: don't retry
      lastError = error;
    } catch (err) {
      if (err instanceof ArchHttpError && err.status !== 429 && err.status < 500) throw err;
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastError;
}

export function listDecks(params: ArchSearchParams, page: number): Promise<ArchListResponse> {
  return fetchJson(`decks/v3/?${listQuery(params, page)}`) as Promise<ArchListResponse>;
}

export function getDeck(id: number): Promise<unknown> {
  return fetchJson(`decks/${id}/`);
}
