import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { CollectionEntry, CardCondition } from '../types';

export function useCollection() {
  const entries = useLiveQuery(() => db.collection.toArray()) ?? [];

  async function addCard(cardId: string, quantity: number, condition: CardCondition, isFoil: boolean, purchasePrice?: number) {
    const existing = await db.collection
      .where({ cardId, condition, isFoil: isFoil ? 1 : 0 })
      .first();

    if (existing) {
      await db.collection.update(existing.id!, { quantity: existing.quantity + quantity });
    } else {
      await db.collection.add({
        cardId,
        quantity,
        condition,
        isFoil,
        dateAdded: new Date().toISOString(),
        purchasePrice,
      });
    }
  }

  async function removeCard(entryId: number) {
    await db.collection.delete(entryId);
  }

  async function updateQuantity(entryId: number, quantity: number) {
    if (quantity <= 0) {
      await db.collection.delete(entryId);
    } else {
      await db.collection.update(entryId, { quantity });
    }
  }

  async function updateEntry(entryId: number, changes: Partial<CollectionEntry>) {
    await db.collection.update(entryId, changes);
  }

  return { entries, addCard, removeCard, updateQuantity, updateEntry };
}
