import { useMemo } from 'react';
import { Heart, Trash2, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWishlist } from '../hooks/useWishlist';
import { useCollection } from '../hooks/useCollection';
import { db } from '../db';
import { getCardPrice } from '../api/scryfall';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import type { ScryfallCard } from '../types';
import { formatPrice } from '../utils/format';

export function WishlistPage() {
  const { entries, removeFromWishlist } = useWishlist();
  const { addCard } = useCollection();
  const { addToast } = useToast();

  const cardIds = useMemo(() => entries.map(e => e.cardId), [entries]);
  const cards = useLiveQuery(() => db.cards.bulkGet(cardIds), [cardIds]) ?? [];
  const cardMap = useMemo(() => {
    const map = new Map<string, ScryfallCard>();
    cards.forEach(c => { if (c) map.set(c.id, c); });
    return map;
  }, [cards]);

  const enriched = useMemo(() =>
    entries.map(e => ({ entry: e, card: cardMap.get(e.cardId) })).filter((i): i is { entry: typeof entries[0]; card: ScryfallCard } => !!i.card),
    [entries, cardMap]
  );

  async function moveToCollection(cardId: string, entryId: number, name: string) {
    await addCard(cardId, 1, 'NM', false);
    await removeFromWishlist(entryId);
    addToast(`Moved ${name} to collection`, 'success');
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Wishlist</h1>

      {enriched.length === 0 ? (
        <EmptyState icon={<Heart size={48} />} title="Wishlist is empty" description="Add cards to your wishlist from the search page" />
      ) : (
        <div className="space-y-2">
          {enriched.map(({ entry, card }) => (
            <div key={entry.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <img src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small} alt="" className="w-10 h-14 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{card.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.set_name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-sm text-green-600 dark:text-green-400">{formatPrice(getCardPrice(card))}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${entry.priority === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : entry.priority === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                    {entry.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => moveToCollection(card.id, entry.id!, card.name)} className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg" title="Move to collection">
                <ArrowRight size={16} />
              </button>
              <button onClick={() => { removeFromWishlist(entry.id!); addToast(`Removed ${card.name}`, 'info'); }} className="p-2 text-gray-400 hover:text-red-500 rounded-lg">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
