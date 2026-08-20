"use client";

import { useEffect, useState } from "react";
import { FORMAT_NAMES } from "@/lib/formats";

// Export page: pick the same filter Browse uses, then download the result.
// The downloads are plain <a href> links to API routes — the browser handles
// the file save; no JS download logic needed.

export default function ExportPage() {
  const [q, setQ] = useState("");
  const [format, setFormat] = useState("");
  const [cardName, setCardName] = useState("");
  const [matching, setMatching] = useState<number | null>(null);

  // Build the shared filter query string once per render.
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (format) qs.set("format", format);
  if (cardName) qs.set("cardName", cardName);
  const filterQs = qs.toString();

  // Live count of decks the current filter matches (debounced like Browse).
  useEffect(() => {
    const timer = setTimeout(async () => {
      const response = await fetch(`/api/decks?pageSize=1&${filterQs}`);
      const data = await response.json();
      setMatching(data.total);
    }, 250);
    return () => clearTimeout(timer);
  }, [filterQs]);

  const inputCls =
    "rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500 focus:outline-none";

  const exports = [
    {
      href: `/api/export/decklists?${filterQs}`,
      title: "Plain-text decklists (.zip)",
      description: "One .txt per deck, grouped by category — the standard '1 Card Name' list format.",
    },
    {
      href: `/api/export/csv?${filterQs}`,
      title: "Cards CSV",
      description: "Every card row of every matching deck: deck_id, deck_name, card_name, quantity, category, set_code, collector_number, scryfall_id.",
    },
    {
      href: `/api/export/json?${filterQs}`,
      title: "Raw JSON",
      description: "The unmodified Archidekt API responses (raw_json column) for every matching deck, as one JSON array.",
    },
  ];

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 text-2xl font-semibold">Export</h1>

      <div className="mb-2 text-sm text-zinc-400">Filter (same semantics as Browse):</div>
      <div className="mb-6 flex flex-wrap gap-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name / commander / owner" className={`${inputCls} w-64`} />
        <select value={format} onChange={(e) => setFormat(e.target.value)} className={inputCls}>
          <option value="">Any format</option>
          {Object.entries(FORMAT_NAMES).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Contains card…" className={`${inputCls} w-52`} />
        <span className="self-center text-sm text-zinc-400">
          {matching === null ? "…" : `${matching.toLocaleString()} deck${matching === 1 ? "" : "s"} match`}
        </span>
      </div>

      <div className="space-y-3">
        {exports.map((exp) => (
          <a
            key={exp.title}
            href={exp.href}
            className="block rounded border border-zinc-800 bg-zinc-900 p-4 hover:border-amber-600"
          >
            <div className="font-semibold text-amber-400">{exp.title}</div>
            <div className="mt-1 text-sm text-zinc-400">{exp.description}</div>
          </a>
        ))}
      </div>

      {matching === 0 && (
        <p className="mt-4 text-sm text-amber-500">Nothing matches this filter — the exports would be empty.</p>
      )}
    </div>
  );
}
