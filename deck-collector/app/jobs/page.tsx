"use client";

import { useEffect, useState, useCallback } from "react";
import { formatName } from "@/lib/formats";
import { config } from "@/lib/config";

// Shape of one job as returned by GET /api/jobs (JobRow + live progress).
interface JobView {
  id: number;
  query_params: string;
  status: "pending" | "running" | "paused" | "done" | "failed" | "cancelled";
  pages_done: number;
  decks_found: number;
  api_count: number | null;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  queue: Record<string, number>;
  errors: { deck_id: number; error: string | null }[];
}

const STATUS_COLORS: Record<JobView["status"], string> = {
  pending: "bg-zinc-700 text-zinc-200",
  running: "bg-emerald-700 text-emerald-100",
  paused: "bg-amber-700 text-amber-100",
  done: "bg-blue-800 text-blue-100",
  failed: "bg-red-800 text-red-100",
  cancelled: "bg-zinc-800 text-zinc-400",
};

/** Human summary of a job's stored query JSON. */
function describeQuery(json: string): string {
  try {
    const p = JSON.parse(json);
    const parts: string[] = [];
    if (p.formats) parts.push(formatName(Number(p.formats)));
    if (p.name) parts.push(`name~"${p.name}"`);
    if (p.cardName) parts.push(`card:"${p.cardName}"`);
    if (p.commander) parts.push(`commander:"${p.commander}"`);
    parts.push(`${p.orderBy ?? "-createdAt"}, ${p.maxPages} page${p.maxPages === 1 ? "" : "s"}`);
    if (p.refresh) parts.push("refresh");
    return parts.join(" · ");
  } catch {
    return json;
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobView[] | null>(null); // null = first load pending

  // useCallback memoizes the function so the useEffect below doesn't see a
  // "new" function every render (which would tear down/recreate the timer).
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/jobs");
      const data = await response.json();
      setJobs(data.jobs);
    } catch {
      // Polling: a transient failure just means this tick shows stale data.
    }
  }, []);

  // useEffect(fn, [deps]) runs fn after render when deps change; with [load]
  // (stable) that means: once on mount. The returned function is the cleanup,
  // called on unmount — clearing the interval prevents a leak.
  useEffect(() => {
    load();
    const timer = setInterval(load, 2000); // live progress: poll every 2s
    return () => clearInterval(timer);
  }, [load]);

  async function act(jobId: number, action: "pause" | "resume" | "cancel") {
    await fetch(`/api/jobs/${jobId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    load(); // refresh immediately instead of waiting for the next poll tick
  }

  if (jobs === null) return <p className="text-zinc-400">Loading…</p>;
  if (jobs.length === 0)
    return (
      <div>
        <h1 className="mb-4 text-2xl font-semibold">Jobs</h1>
        <p className="text-zinc-400">No jobs yet — start one on the New Job page.</p>
      </div>
    );

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Jobs</h1>
      <div className="space-y-4">
        {jobs.map((job) => {
          const done = job.queue.done ?? 0;
          const failed = job.queue.failed ?? 0;
          const pending = job.queue.pending ?? 0;
          const total = done + failed + pending;
          const pct = total > 0 ? Math.round(((done + failed) / total) * 100) : 0;
          // Warn when the API-reported total nears/hits the ~1000 cap: the
          // query slice is too broad and results are being silently dropped.
          const capped = job.api_count !== null && job.api_count >= config.resultCapWarningThreshold;

          return (
            <div key={job.id} className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm text-zinc-500">#{job.id}</span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_COLORS[job.status]}`}>
                  {job.status}
                </span>
                <span className="text-sm text-zinc-300">{describeQuery(job.query_params)}</span>
                <span className="ml-auto flex gap-2">
                  {job.status === "running" && (
                    <button onClick={() => act(job.id, "pause")} className="rounded bg-zinc-700 px-3 py-1 text-xs hover:bg-zinc-600">
                      Pause
                    </button>
                  )}
                  {(job.status === "paused" || job.status === "failed") && (
                    <button onClick={() => act(job.id, "resume")} className="rounded bg-emerald-700 px-3 py-1 text-xs hover:bg-emerald-600">
                      Resume
                    </button>
                  )}
                  {(job.status === "running" || job.status === "paused" || job.status === "pending") && (
                    <button onClick={() => act(job.id, "cancel")} className="rounded bg-red-900 px-3 py-1 text-xs hover:bg-red-800">
                      Cancel
                    </button>
                  )}
                </span>
              </div>

              {capped && (
                <div className="mt-2 rounded border border-amber-700 bg-amber-950 px-3 py-2 text-xs text-amber-300">
                  ⚠ Archidekt reported {job.api_count} matches — at or near the ~1,000-result cap. This
                  slice is too broad: decks beyond the cap are unreachable. Narrow the query (single
                  format, name filter, …) and run more, smaller jobs.
                </div>
              )}

              <div className="mt-3">
                <div className="mb-1 flex justify-between font-mono text-xs text-zinc-400">
                  <span>
                    pages {job.pages_done} · found {job.decks_found} · done {done} · failed {failed} · pending {pending}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-zinc-800">
                  <div className="h-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>

              {job.error && (
                <div className="mt-2 rounded border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
                  Job error: {job.error}
                </div>
              )}
              {job.errors.length > 0 && (
                // <details> is a native HTML collapsible — no JS needed.
                <details className="mt-2 text-xs text-zinc-400">
                  <summary className="cursor-pointer">Failed decks ({failed})</summary>
                  <ul className="mt-1 space-y-0.5 font-mono">
                    {job.errors.map((e) => (
                      <li key={e.deck_id}>
                        deck {e.deck_id}: {e.error}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
