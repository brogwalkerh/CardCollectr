"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatName, FORMAT_NAMES } from "@/lib/formats";

interface DeckView {
  id: number;
  name: string;
  format: number | null;
  commander: string | null;
  owner: string | null;
  created_at: string | null;
  fetched_at: string;
  card_count: number;
}

const PAGE_SIZE = 50;

export default function BrowsePage() {
  // Filter inputs (what the user is typing)…
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("");
  const [cardName, setCardName] = useState("");
  // …and the query results.
  const [page, setPage] = useState(1);
  const [decks, setDecks] = useState<DeckView[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Re-query whenever a filter or the page changes. The 250ms timer debounces
  // typing: each keystroke resets it, so we only hit the API when the user
  // pauses — the cleanup function (returned) cancels the previous timer.
  useEffect(() => {
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (q) qs.set("q", q);
      if (format) qs.set("format", format);
      if (cardName) qs.set("cardName", cardName);
      const response = await fetch(`/api/decks?${qs}`);
      const data = await response.json();
      setDecks(data.decks);
      setTotal(data.total);
      setLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [q, format, cardName, page]);

  // Jump back to page 1 when filters change (stale page numbers make no sense).
  useEffect(() => {
    setPage(1);
  }, [q, format, cardName]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const inputCls =
    "rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Browse stored decks</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name / commander / owner"
          className={`${inputCls} w-64`}
        />
        <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
          <option value="">Any format</option>
          {Object.entries(FORMAT_NAMES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          placeholder="Contains card…"
          className={`${inputCls} w-52`}
        />
        <span className="self-center text-sm text-zinc-400">
          {loading ? "…" : `${total.toLocaleString()} deck${total === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-2">Deck</th>
              <th className="px-3 py-2">Format</th>
              <th className="px-3 py-2">Commander</th>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2 text-right">Cards</th>
              <th className="px-3 py-2">Fetched</th>
            </tr>
          </thead>
          <tbody>
            {decks.map((deck) => (
              <tr key={deck.id} className="border-t border-zinc-800 hover:bg-zinc-900">
                <td className="px-3 py-2">
                  <Link href={`/browse/${deck.id}`} className="text-amber-400 hover:underline">
                    {deck.name}
                  </Link>
                  <span className="ml-2 font-mono text-xs text-zinc-600">#{deck.id}</span>
                </td>
                <td className="px-3 py-2 text-zinc-300">{formatName(deck.format)}</td>
                <td className="px-3 py-2 text-zinc-300">{deck.commander ?? "—"}</td>
                <td className="px-3 py-2 text-zinc-400">{deck.owner ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-zinc-300">{deck.card_count}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">
                  {deck.fetched_at.slice(0, 16).replace("T", " ")}
                </td>
              </tr>
            ))}
            {!loading && decks.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No stored decks match. Run a job first, or loosen the filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700 disabled:opacity-40"
        >
          ← Prev
        </button>
        <span className="text-zinc-400">
          page {page} / {pageCount}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          disabled={page >= pageCount}
          className="rounded bg-zinc-800 px-3 py-1 hover:bg-zinc-700 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
