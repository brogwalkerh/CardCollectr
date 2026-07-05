import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getCardPrice } from '../api/scryfall';
import type { ScryfallCard } from '../types';

export function useCollectionStats() {
  const stats = useLiveQuery(async () => {
    const entries = await db.collection.toArray();
    if (entries.length === 0) return null;

    const cardIds = [...new Set(entries.map(e => e.cardId))];
    const cards = await db.cards.bulkGet(cardIds);
    const cardMap = new Map<string, ScryfallCard>();
    cards.forEach(c => { if (c) cardMap.set(c.id, c); });

    let totalValue = 0;
    let totalCards = 0;
    const colorCounts: Record<string, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    const rarityCounts: Record<string, number> = { common: 0, uncommon: 0, rare: 0, mythic: 0 };
    const setCounts: Record<string, { name: string; count: number; value: number }> = {};

    for (const entry of entries) {
      const card = cardMap.get(entry.cardId);
      if (!card) continue;

      totalCards += entry.quantity;
      const price = getCardPrice(card, entry.isFoil);
      if (price) totalValue += price * entry.quantity;

      rarityCounts[card.rarity] = (rarityCounts[card.rarity] || 0) + entry.quantity;

      const colors = card.colors ?? card.color_identity;
      if (colors.length === 0) {
        colorCounts['C'] += entry.quantity;
      } else {
        for (const c of colors) {
          colorCounts[c] = (colorCounts[c] || 0) + entry.quantity;
        }
      }

      if (!setCounts[card.set]) {
        setCounts[card.set] = { name: card.set_name, count: 0, value: 0 };
      }
      setCounts[card.set].count += entry.quantity;
      if (price) setCounts[card.set].value += price * entry.quantity;
    }

    return { totalValue, totalCards, uniqueCards: cardIds.length, colorCounts, rarityCounts, setCounts };
  });

  return stats ?? null;
}
