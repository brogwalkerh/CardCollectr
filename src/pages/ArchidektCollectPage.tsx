import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Play, Pause, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
import { archDb, type ArchJob } from '../db/archidektViewer';
import { ARCH_FORMAT_NAMES, archFormatName } from '../utils/archidektViewer';
import {
  archidektListUrl,
  OBSERVED_PAGE_SIZE,
  storedProxyBase,
  setProxyBase,
  type ArchSearchParams,
} from '../utils/archidektClient';
import {
  kickRunner,
  createAndStartJob,
  pauseJob,
  resumeJob,
  cancelJob,
  RESULT_CAP_WARNING,
} from '../utils/archidektRunner';

const STATUS_STYLES: Record<ArchJob['status'], string> = {
  running: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  done: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

function describeParams(params: ArchJob['params']): string {
  const parts: string[] = [];
  if (params.formats) parts.push(archFormatName(Number(params.formats)));
  if (params.name) parts.push(`name~"${params.name}"`);
  if (params.cardName) parts.push(`card:"${params.cardName}"`);
  if (params.commander) parts.push(`commander:"${params.commander}"`);
  parts.push(`${params.orderBy ?? '-createdAt'}, ${params.maxPages} page${params.maxPages === 1 ? '' : 's'}`);
  if (params.refresh) parts.push('refresh');
  return parts.join(' · ');
}

function JobCard({ job }: { job: ArchJob }) {
  // Live per-status counts for this job's queue; re-runs on every queue write.
  const counts = useLiveQuery(async () => {
    const items = await archDb.archQueue.where('jobId').equals(job.id!).toArray();
    const c: Record<string, number> = {};
    for (const item of items) c[item.status] = (c[item.status] ?? 0) + 1;
    return c;
  }, [job.id]);

  const errors = useLiveQuery(
    () =>
      archDb.archQueue
        .where('jobId')
        .equals(job.id!)
        .filter(i => i.status === 'failed')
        .limit(10)
        .toArray(),
    [job.id]
  );

  const done = counts?.done ?? 0;
  const failed = counts?.failed ?? 0;
  const pending = counts?.pending ?? 0;
  const total = done + failed + pending;
  const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
  const capped = job.apiCount !== null && job.apiCount >= RESULT_CAP_WARNING;

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-sm text-gray-400 dark:text-gray-500">#{job.id}</span>
        <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLES[job.status]}`}>
          {job.status}
        </span>
        <span className="text-sm text-gray-700 dark:text-gray-300">{describeParams(job.params)}</span>
        <span className="ml-auto flex gap-2">
          {job.status === 'running' && (
            <button onClick={() => pauseJob(job.id!)} className="flex items-center gap-1 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-1 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">
              <Pause size={13} /> Pause
            </button>
          )}
          {(job.status === 'paused' || job.status === 'failed') && (
            <button onClick={() => resumeJob(job.id!)} className="flex items-center gap-1 rounded-lg bg-green-600 hover:bg-green-700 px-3 py-1 text-xs text-white">
              <RotateCcw size={13} /> Resume
            </button>
          )}
          {(job.status === 'running' || job.status === 'paused') && (
            <button onClick={() => cancelJob(job.id!)} className="flex items-center gap-1 rounded-lg border border-red-300 dark:border-red-900 px-3 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
              <XCircle size={13} /> Cancel
            </button>
          )}
        </span>
      </div>

      {capped && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Archidekt reported {job.apiCount} matches — at or near the ~1,000-result cap. This slice is
            too broad; decks beyond the cap are unreachable. Narrow the query and run more, smaller jobs.
          </span>
        </div>
      )}

      <div className="mt-3">
        <div className="mb-1 flex justify-between font-mono text-xs text-gray-500 dark:text-gray-400">
          <span>
            pages {job.pagesDone} · found {job.decksFound} · done {done} · failed {failed} · pending {pending}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded bg-gray-200 dark:bg-gray-800">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {job.error && (
        <div className="mt-2 rounded-lg border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/50 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          Job error: {job.error}
        </div>
      )}
      {(errors?.length ?? 0) > 0 && (
        <details className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          <summary className="cursor-pointer">Failed decks ({failed})</summary>
          <ul className="mt-1 space-y-0.5 font-mono">
            {errors!.map(e => (
              <li key={e.deckId}>deck {e.deckId}: {e.error}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ArchidektCollectPage() {
  const [formats, setFormats] = useState('3'); // default Commander/EDH
  const [name, setName] = useState('');
  const [cardName, setCardName] = useState('');
  const [commander, setCommander] = useState('');
  const [orderBy, setOrderBy] = useState('-createdAt');
  const [maxPages, setMaxPages] = useState(2);
  const [refresh, setRefresh] = useState(false);
  const [proxyUrl, setProxyUrl] = useState(storedProxyBase());

  const jobs = useLiveQuery(() => archDb.archJobs.reverse().toArray(), []);

  // Auto-resume: if a job was left 'running' (tab closed mid-run), restart
  // the loop as soon as this page opens. kickRunner is a no-op otherwise.
  useEffect(() => {
    kickRunner();
  }, []);

  const searchParams: ArchSearchParams = {
    orderBy,
    ...(formats ? { formats } : {}),
    ...(name ? { name } : {}),
    ...(cardName ? { cardName } : {}),
    ...(commander ? { commander } : {}),
  };
  const previewUrl = archidektListUrl(searchParams, 1);
  const estimatedDecks = maxPages * OBSERVED_PAGE_SIZE;

  async function start() {
    const pages = Math.min(50, Math.max(1, Math.floor(maxPages) || 1));
    await createAndStartJob({ ...searchParams, maxPages: pages, refresh });
  }

  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';
  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20 md:pb-6">
      <Link to="/archidekt" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft size={16} /> Archidekt decks
      </Link>
      <h2 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">Collect from Archidekt</h2>
      <p className="mt-1 mb-6 text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
        One job = one narrow query — the API stops around 1,000 results per query. Requests go through
        the app’s proxy at 1 request/second and everything lands in this browser (IndexedDB), resumable
        if you close the tab. Collection runs while a CardCollectr tab is open.
      </p>

      <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-4 mb-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Format</label>
            <select value={formats} onChange={e => setFormats(e.target.value)} className={inputCls}>
              <option value="">Any format</option>
              {Object.entries(ARCH_FORMAT_NAMES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Deck name contains</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Magda" />
          </div>
          <div>
            <label className={labelCls}>Card name (exact)</label>
            <input value={cardName} onChange={e => setCardName(e.target.value)} className={inputCls} placeholder="e.g. Sol Ring" />
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              Observed live: Archidekt’s own DB frequently times out on this — the job will fail with
              their message rather than silently returning nothing.
            </p>
          </div>
          <div>
            <label className={labelCls}>Commander</label>
            <input value={commander} onChange={e => setCommander(e.target.value)} className={inputCls} placeholder="e.g. Magda, Brazen Outlaw" />
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
              Observed live: the server accepts this param but ignores it — verify a sample before
              trusting a commander slice.
            </p>
          </div>
          <div>
            <label className={labelCls}>Sort order</label>
            <select value={orderBy} onChange={e => setOrderBy(e.target.value)} className={inputCls}>
              <option value="-createdAt">Newest first</option>
              <option value="createdAt">Oldest first</option>
              <option value="-updatedAt">Recently updated first</option>
              <option value="updatedAt">Least recently updated first</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Max pages ({OBSERVED_PAGE_SIZE} decks per page)</label>
            <input type="number" min={1} max={50} value={maxPages} onChange={e => setMaxPages(Number(e.target.value))} className={inputCls} />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={refresh} onChange={e => setRefresh(e.target.checked)} />
          Refresh: re-fetch decks even if they are already stored
        </label>

        <div className="rounded-lg bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Exact URL for page 1 (via the proxy; pages 2..{maxPages || '?'} only change the page param)
          </div>
          <code className="block break-all font-mono text-xs text-green-700 dark:text-green-400">{previewUrl}</code>
          <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Up to {estimatedDecks} decks at 1 request/second ≈ {Math.ceil((estimatedDecks + maxPages) / 60)} min if all are new.
          </div>
        </div>

        <button onClick={start} className="flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
          <Play size={16} /> Start job
        </button>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Jobs</h3>
      {jobs === undefined ? null : jobs.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No jobs yet.</p>
      ) : (
        <div className="space-y-4">
          {jobs.map(job => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <details className="mt-8 text-sm text-gray-500 dark:text-gray-400">
        <summary className="cursor-pointer">Advanced: proxy URL (for the GitHub Pages copy)</summary>
        <div className="mt-2 max-w-xl">
          <p className="mb-2 text-xs">
            Same-origin <code>/api/archidekt</code> is used by default — correct on Vercel and in{' '}
            <code>npm run dev</code>. On the GitHub Pages deployment there is no proxy, so paste your
            Vercel deployment’s proxy here (e.g.{' '}
            <code>https://your-app.vercel.app/api/archidekt</code>). Stored in this browser only.
          </p>
          <input
            value={proxyUrl}
            onChange={e => {
              setProxyUrl(e.target.value);
              setProxyBase(e.target.value);
            }}
            placeholder="/api/archidekt"
            className={inputCls}
          />
        </div>
      </details>
    </div>
  );
}
