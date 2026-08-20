import Dexie, { type Table } from 'dexie';

// Separate IndexedDB database for the Archidekt collector/viewer, so this
// data never interferes with the main CardCollectrDB schema/versioning.

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

// Collection jobs (browser port of deck-collector's jobs table).
export interface ArchJob {
  id?: number; // auto-increment
  params: {
    formats?: string;
    name?: string;
    cardName?: string;
    commander?: string;
    orderBy?: string;
    maxPages: number;
    refresh: boolean;
  };
  status: 'running' | 'paused' | 'done' | 'failed' | 'cancelled';
  pagesDone: number;
  decksFound: number;
  apiCount: number | null; // total Archidekt reported; 1000 = capped slice
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

// Work queue (browser port of deck_queue) — what makes runs resumable.
export interface ArchQueueItem {
  jobId: number;
  deckId: number;
  status: 'pending' | 'done' | 'failed';
  error: string | null;
}

export class ArchidektViewerDB extends Dexie {
  archDecks!: Table<ArchDeck, number>;
  archCards!: Table<ArchCard, number>;
  archJobs!: Table<ArchJob, number>;
  archQueue!: Table<ArchQueueItem, [number, number]>;

  constructor() {
    super('ArchidektViewerDB');
    this.version(1).stores({
      // First field is the primary key; the rest are indexes.
      archDecks: 'id, name, format, commander, owner',
      archCards: '++id, deckId, cardName',
    });
    // v2 adds the collection jobs + queue tables. Dexie upgrades existing
    // browsers in place; v1 data is untouched.
    this.version(2).stores({
      archDecks: 'id, name, format, commander, owner',
      archCards: '++id, deckId, cardName',
      archJobs: '++id, status',
      // [jobId+deckId] compound primary key = one queue row per deck per job.
      archQueue: '[jobId+deckId], jobId, status',
    });
  }
}

export const archDb = new ArchidektViewerDB();
