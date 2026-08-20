import { Link, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { archDb } from '../db/archidektViewer';
import { archFormatName, groupCardsByCategory } from '../utils/archidektViewer';
import { Spinner } from '../components/ui/Spinner';

export function ArchidektDeckPage() {
  const { deckId } = useParams();
  const id = Number(deckId);

  const deck = useLiveQuery(() => archDb.archDecks.get(id), [id]);
  const cards = useLiveQuery(() => archDb.archCards.where('deckId').equals(id).toArray(), [id]);

  if (deck === undefined || cards === undefined) {
    return (
      <div className="p-6 flex justify-center">
        <Spinner />
      </div>
    );
  }
  if (!deck) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">
          Deck not found in this browser’s imported data.{' '}
          <Link to="/archidekt" className="text-blue-600 dark:text-blue-400 hover:underline">Back to Archidekt decks</Link>
        </p>
      </div>
    );
  }

  const groups = groupCardsByCategory(cards);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-20 md:pb-6">
      <Link to="/archidekt" className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
        <ArrowLeft size={16} /> Archidekt decks
      </Link>

      <div className="mt-2 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{deck.name}</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {archFormatName(deck.format)}
          {deck.commander && <> · Commander: <span className="text-gray-900 dark:text-gray-200">{deck.commander}</span></>}
          {deck.owner && <> · by {deck.owner}</>} · {deck.cardCount} cards ·{' '}
          <a
            href={`https://archidekt.com/decks/${deck.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
          >
            view on Archidekt <ExternalLink size={12} />
          </a>
        </p>
      </div>

      <div className="columns-1 md:columns-2 lg:columns-3 gap-6">
        {groups.map(group => (
          <div
            key={group.category}
            className="mb-6 break-inside-avoid rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
              {group.category}{' '}
              <span className="font-normal text-gray-400 dark:text-gray-500">
                ({group.cards.reduce((sum, c) => sum + c.quantity, 0)})
              </span>
            </h3>
            <ul className="space-y-1 text-sm">
              {group.cards.map((card, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-gray-900 dark:text-gray-200">
                    <span className="font-mono text-gray-400 dark:text-gray-500">{card.quantity}×</span> {card.cardName}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs text-gray-400 dark:text-gray-600">
                    {card.setCode} #{card.collectorNumber}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {groups.length === 0 && <p className="text-gray-500 dark:text-gray-400">This deck has no cards stored.</p>}
    </div>
  );
}
