// Central configuration. Everything tunable lives here so you never have to
// hunt through the codebase for a magic number.

export const config = {
  // Contact info sent to Archidekt on every request (politeness requirement).
  contactEmail: "brogwalkerh@gmail.com",

  // Built once from the pieces above; sent as the User-Agent header.
  get userAgent(): string {
    // `get` makes this a computed property, like a C# expression-bodied getter.
    return `CardCollectr-DeckCollector/0.1 (local research tool; contact: ${this.contactEmail})`;
  },

  // Minimum gap between any two outbound requests, in milliseconds.
  // 1000 = 1 request per second, single-threaded.
  requestDelayMs: 1000,

  // Retry policy for HTTP 429 / 5xx responses and network errors.
  maxRetries: 5,
  // First retry waits this long; each further retry doubles it
  // (2s, 4s, 8s, 16s, 32s).
  initialBackoffMs: 2000,

  // Where the SQLite database file lives, relative to the app root
  // (deck-collector/). Created on first use.
  databaseFile: "data/deck-collector.db",

  // Archidekt caps list results at ~1000 per query. When a job's total hits
  // this threshold we flag it in the UI as "slice too broad".
  resultCapWarningThreshold: 900,

  // Archidekt's documented-by-observation page size ceiling.
  maxPageSize: 100,
} as const;
// `as const` freezes the literal types (readonly) — roughly like declaring
// every field `static final` / `const` instead of a mutable object.
