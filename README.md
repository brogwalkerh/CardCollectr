# CardCollectr

Free Magic: The Gathering collection manager — a Helvault-style app where **every feature is free**. No account, no paywall; your data lives on your device.

**Live app: https://brogwalkerh.github.io/CardCollectr/** — on iPhone, open it in Safari and tap Share → Add to Home Screen to install it.

## Features

- **Card search** — powered by the [Scryfall API](https://scryfall.com/docs/api), with autocomplete and full Scryfall query syntax
- **Collection** — quantities, conditions (NM/LP/MP/HP/DMG), foils, filters, sorting, live value totals
- **Deck builder** — main / sideboard / maybe zones, any format
- **Wishlist** — priorities and one-click move to collection
- **Statistics** — color, rarity, and set breakdowns with charts
- **Import / Export** — CSV compatible with Helvault and other trackers
- **Archidekt viewer** — browse, search, and re-export deck snapshots collected with the bundled [deck-collector](deck-collector/) app
- **Scanner** — camera capture + name identification
- Dark/light theme, responsive mobile layout, installable as a PWA (Add to Home Screen)

## Running locally

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`).

## Building

```bash
npm run build     # static output in dist/
npm run preview   # serve the build locally
```

The app is a fully static SPA (hash-based routing), so `dist/` deploys to any static host with zero configuration. Pushes to `main` deploy automatically to GitHub Pages via `.github/workflows/deploy.yml`.

## Tech

Vite + React + TypeScript - TailwindCSS - Dexie.js (IndexedDB) - React Router - Recharts

Card data and prices courtesy of Scryfall. Not affiliated with Wizards of the Coast.

## Archidekt deck collection

The **Archidekt** page collects public Archidekt decklists into this
browser's IndexedDB and lets you browse, search, and export them (zip of
.txt decklists / CSV / raw JSON). Jobs are throttled to 1 request/second,
retried with backoff, and resumable — close the tab mid-run and the job
picks up where it left off, skipping decks already stored.

Archidekt's API hardcodes `Access-Control-Allow-Origin: http://localhost:3000`,
so the browser can't call it directly. Collection therefore works wherever
the app has its `/api/archidekt` proxy:

- **Vercel** (recommended) — deploy this repo there; the serverless function
  in `api/archidekt/[...path].ts` is the proxy. See below.
- **Local dev** — `npm run dev`; the vite dev server proxies it (see
  `vite.config.ts`).
- **GitHub Pages** — static hosting has no proxy, so either paste your
  Vercel deployment's proxy URL into Archidekt → Collect → Advanced, or
  import a **Raw JSON** export from the local
  [deck-collector](deck-collector/) app (a full-featured Next.js + SQLite
  collector for bigger jobs).

### Deploying to Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and import this GitHub
   repository. `vercel.json` already sets the build command and output
   directory; the `api/` function deploys automatically. No other settings
   are required.
2. Optional: set the `ARCHIDEKT_CONTACT_EMAIL` environment variable to
   change the contact address in the proxy's User-Agent header.
3. Open `https://<your-app>.vercel.app`, go to **Archidekt → Collect decks**,
   and run jobs straight from the browser.

The proxy only forwards GET requests to the two Archidekt read endpoints the
collector uses — it is not an open proxy.
