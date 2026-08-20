import Dexie, { type Table } from 'dexie';

// Separate IndexedDB database for the Archidekt viewer, so imported deck
// snapshots never interfere with the main CardCollectrDB schema/versioning.

export interface ArchDeck {
  id: number; // Archidekt deck ID (primary key — imports upsert on it)
  name: string;
  format: number | null; // Archidekt numeric format code
  commander: string | null;
  owner: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  cardCount: number;
  raw: unknown; // the full original API response, kept for JSON re-export
}

export interface ArchCard {
  id?: number; // auto-increment
  deckId: number;
  cardName: string;
  quantity: number;
  category: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  scryfallId: string | null;
}

export class ArchidektViewerDB extends Dexie {
  archDecks!: Table<ArchDeck, number>;
  archCards!: Table<ArchCard, number>;

  constructor() {
    super('ArchidektViewerDB');
    this.version(1).stores({
      // First field is the primary key; the rest are indexes.
      archDecks: 'id, name, format, commander, owner',
      archCards: '++id, deckId, cardName',
    });
  }
}

export const archDb = new ArchidektViewerDB();
