// Deck detail page. This is a SERVER component (no "use client"): it runs on
// the server per request, reads SQLite directly — no API hop, no useEffect —
// and ships plain HTML to the browser. Reach for this pattern whenever a page
// only displays data and has no interactivity.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeckRow, cardsForDeck, groupByCategory } from "@/lib/queries";
import { formatName } from "@/lib/formats";

// Always render per-request (live DB), never cache at build time.
export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // Next 16: params is a Promise
  const deck = getDeckRow(Number(id));
  if (!deck) notFound(); // renders the 404 page

  const groups = groupByCategory(cardsForDeck(deck.id));
  const totalCards = groups.reduce((sum, g) => sum + g.cards.reduce((s, c) => s + c.quantity, 0), 0);
  // reduce = fold/aggregate, like LINQ's Aggregate() or a summing for-loop.

  return (
    <div>
      <Link href="/browse" className="text-sm text-zinc-400 hover:text-zinc-200">
        ← Back to Browse
      </Link>

      <div className="mt-2 mb-6">
        <h1 className="text-2xl font-semibold">{deck.name}</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {formatName(deck.format)}
          {deck.commander && <> · Commander: <span className="text-zinc-200">{deck.commander}</span></>}
          {deck.owner && <> · by {deck.owner}</>} · {totalCards} cards ·{" "}
          <a
            href={`https://archidekt.com/decks/${deck.id}`}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:underline"
          >
            view on Archidekt ↗
          </a>
        </p>
      </div>

      <div className="columns-1 gap-6 md:columns-2 lg:columns-3">
        {groups.map((group) => (
          <div key={group.category} className="mb-6 break-inside-avoid rounded border border-zinc-800 bg-zinc-900 p-4">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-amber-400">
              {group.category}{" "}
              <span className="font-normal text-zinc-500">
                ({group.cards.reduce((s, c) => s + c.quantity, 0)})
              </span>
            </h2>
            <ul className="space-y-1 text-sm">
              {group.cards.map((card, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    <span className="font-mono text-zinc-500">{card.quantity}×</span>{" "}
                    <span className="text-zinc-200">{card.card_name}</span>
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-zinc-600">
                    {card.set_code} #{card.collector_number}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {groups.length === 0 && <p className="text-zinc-500">This deck has no cards stored.</p>}
    </div>
  );
}
