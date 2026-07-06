import Dexie, { type Table } from 'dexie';
import type { ScryfallCard, CollectionEntry, Deck, DeckCard, WishlistEntry, ValueSnapshot } from '../types';

export class CardCollectrDB extends Dexie {
  cards!: Table<ScryfallCard, string>;
  collection!: Table<CollectionEntry, number>;
  decks!: Table<Deck, number>;
  deckCards!: Table<DeckCard, number>;
  wishlist!: Table<WishlistEntry, number>;
  valueSnapshots!: Table<ValueSnapshot, number>;

  constructor() {
    super('CardCollectrDB');
    this.version(1).stores({
      cards: 'id, oracle_id, name, set, rarity, cmc',
      collection: '++id, cardId, condition, isFoil, dateAdded',
      decks: '++id, name, format, createdAt',
      deckCards: '++id, deckId, cardId, [deckId+cardId], zone',
      wishlist: '++id, cardId, dateAdded, priority',
      valueSnapshots: '++id, date',
    });
  }
}

export const db = new CardCollectrDB();
