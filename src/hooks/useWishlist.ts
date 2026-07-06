import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { WishlistEntry } from '../types';

export function useWishlist() {
  const entries = useLiveQuery(() => db.wishlist.toArray()) ?? [];

  async function addToWishlist(cardId: string, priority: WishlistEntry['priority'] = 'medium', maxPrice?: number, notes?: string) {
    const existing = await db.wishlist.where('cardId').equals(cardId).first();
    if (existing) return;
    await db.wishlist.add({
      cardId,
      dateAdded: new Date().toISOString(),
      priority,
      maxPrice,
      notes,
    });
  }

  async function removeFromWishlist(entryId: number) {
    await db.wishlist.delete(entryId);
  }

  async function updateWishlistEntry(entryId: number, changes: Partial<WishlistEntry>) {
    await db.wishlist.update(entryId, changes);
  }

  return { entries, addToWishlist, removeFromWishlist, updateWishlistEntry };
}
