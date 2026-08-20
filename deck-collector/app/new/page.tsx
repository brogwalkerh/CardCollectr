"use client";
// "use client" makes this a Client Component: it ships to the browser and can
// use state and event handlers. Server-only modules (db.ts, runner.ts) must
// NOT be imported here — but buildListUrl/formats are pure functions, so
// importing them is fine and keeps the URL preview identical to what the
// server will really call.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { buildListUrl, type DeckSearchParams } from "@/lib/archidekt";
import { FORMAT_NAMES } from "@/lib/formats";

// React-hooks primer (this file uses the two you'll see everywhere):
//   const [value, setValue] = useState(initial)
// declares a piece of state. Calling setValue(next) re-runs this whole
// function with the new value — that re-run is the "render". Think of the
// component as a pure function of its state, re-invoked on every change,
// rather than an object that mutates fields.

export default function NewJobPage() {
  const router = useRouter(); // programmatic navigation after submit

  // One state slot per form field. Controlled inputs: the <input> shows
  // exactly this state, and onChange writes it back.
  const [formats, setFormats] = useState("3"); // default: Commander/EDH
  const [name, setName] = useState("");
  const [cardName, setCardName] = useState("");
  const [commander, setCommander] = useState("");
  const [orderBy, setOrderBy] = useState("-createdAt");
  const [maxPages, setMaxPages] = useState(5);
  const [refresh, setRefresh] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recomputed on every render — always in sync with the fields above.
  const searchParams: DeckSearchParams = {
    orderBy,
    ...(formats ? { formats } : {}),
    ...(name ? { name } : {}),
    ...(cardName ? { cardName } : {}),
    ...(commander ? { commander } : {}),
  };
  const previewUrl = buildListUrl(searchParams, 1);
  // 60 rows per page is the observed fixed page size (pageSize is ignored).
  const estimatedDecks = maxPages * 60;

  async function startJob() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...searchParams, maxPages, refresh }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
      router.push("/jobs"); // job started — watch it on the Jobs page
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  const labelCls = "block text-sm font-medium text-zinc-300 mb-1";
  const inputCls =
    "w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">New Job</h1>
      <p className="mb-6 text-sm text-zinc-400">
        One job = one narrow query. The list endpoint stops around 1,000 results per query, so keep
        slices small (a single format, a name filter, ...) and run more jobs instead of broader ones.
      </p>

      <div className="space-y-4">
        <div>
          <label className={labelCls}>Format</label>
          <select value={formats} onChange={(e) => setFormats(e.target.value)} className={inputCls}>
            <option value="">Any format</option>
            {Object.entries(FORMAT_NAMES).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Deck name contains</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="e.g. Magda" />
        </div>

        <div>
          <label className={labelCls}>Card name (exact card the deck must contain)</label>
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className={inputCls}
            placeholder="e.g. Sol Ring"
          />
          <p className="mt-1 text-xs text-amber-500">
            Heads-up (observed live): Archidekt&apos;s own database frequently times out on cardName
            searches — the job will fail with their &quot;statement timeout&quot; message rather than
            silently returning nothing.
          </p>
        </div>

        <div>
          <label className={labelCls}>Commander</label>
          <input
            value={commander}
            onChange={(e) => setCommander(e.target.value)}
            className={inputCls}
            placeholder="e.g. Magda, Brazen Outlaw"
          />
          <p className="mt-1 text-xs text-amber-500">
            Heads-up (observed live): the server currently accepts this param but ignores it —
            results come back unfiltered. Verify a sample in Browse before trusting a commander slice.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Sort order</label>
            <select value={orderBy} onChange={(e) => setOrderBy(e.target.value)} className={inputCls}>
              <option value="-createdAt">Newest first</option>
              <option value="createdAt">Oldest first</option>
              <option value="-updatedAt">Recently updated first</option>
              <option value="updatedAt">Least recently updated first</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Max pages (60 decks per page)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxPages}
              onChange={(e) => setMaxPages(Number(e.target.value))}
              className={inputCls}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-300">
          <input type="checkbox" checked={refresh} onChange={(e) => setRefresh(e.target.checked)} />
          Refresh: re-fetch decks even if they are already stored
        </label>

        <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            Exact URL for page 1 (pages 2..{maxPages} only change the page param)
          </div>
          <code className="block break-all font-mono text-xs text-emerald-400">{previewUrl}</code>
          <div className="mt-2 text-xs text-zinc-500">
            Up to {estimatedDecks} decks, fetched at 1 request/second ≈{" "}
            {Math.ceil((estimatedDecks + maxPages) / 60)} min if all are new.
          </div>
        </div>

        {error && <div className="rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">{error}</div>}

        <button
          onClick={startJob}
          disabled={submitting}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
        >
          {submitting ? "Starting..." : "Start job"}
        </button>
      </div>
    </div>
  );
}
