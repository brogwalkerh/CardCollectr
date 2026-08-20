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

## Bulk deck collection (local only)

`deck-collector/` contains a separate Next.js app that bulk-collects public
Archidekt decklists into SQLite — see its [README](deck-collector/README.md).
It cannot run on GitHub Pages: Pages is static hosting, and Archidekt's API
sends `Access-Control-Allow-Origin: http://localhost:3000` to every origin,
so browsers block direct calls from anywhere else. Run the collector locally,
export **Raw JSON** from its Export page, and import that file into this
app's **Archidekt** page to browse the decks from the deployed site.
