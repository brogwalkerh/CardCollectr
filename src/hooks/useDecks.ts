import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import type { DeckCard } from '../types';

export function useDecks() {
  const decks = useLiveQuery(() => db.decks.toArray()) ?? [];

  async function createDeck(name: string, format?: string, description?: string) {
    const now = new Date().toISOString();
    return await db.decks.add({ name, format, description, createdAt: now, updatedAt: now });
  }

  async function deleteDeck(deckId: number) {
    await db.deckCards.where('deckId').equals(deckId).delete();
    await db.decks.delete(deckId);
  }

  async function updateDeck(deckId: number, changes: { name?: string; format?: string; description?: string }) {
    await db.decks.update(deckId, { ...changes, updatedAt: new Date().toISOString() });
  }

  return { decks, createDeck, deleteDeck, updateDeck };
}

export function useDeckCards(deckId: number) {
  const cards = useLiveQuery(
    () => db.deckCards.where('deckId').equals(deckId).toArray(),
    [deckId]
  ) ?? [];

  async function addCardToDeck(cardId: string, quantity: number, zone: DeckCard['zone'] = 'main') {
    const existing = await db.deckCards.where({ deckId, cardId }).first();
    if (existing && existing.zone === zone) {
      await db.deckCards.update(existing.id!, { quantity: existing.quantity + quantity });
    } else {
      await db.deckCards.add({ deckId, cardId, quantity, zone });
    }
    await db.decks.update(deckId, { updatedAt: new Date().toISOString() });
  }

  async function removeCardFromDeck(entryId: number) {
    await db.deckCards.delete(entryId);
    await db.decks.update(deckId, { updatedAt: new Date().toISOString() });
  }

  async function updateCardInDeck(entryId: number, changes: Partial<DeckCard>) {
    await db.deckCards.update(entryId, changes);
    await db.decks.update(deckId, { updatedAt: new Date().toISOString() });
  }

  return { cards, addCardToDeck, removeCardFromDeck, updateCardInDeck };
}
