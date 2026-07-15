# CardCollectr

Free Magic: The Gathering collection manager — a Helvault-style app where **every feature is free**. No account, no paywall; your data lives on your device.

## Features

- **Card search** — powered by the [Scryfall API](https://scryfall.com/docs/api), with autocomplete and full Scryfall query syntax
- **Collection** — quantities, conditions (NM/LP/MP/HP/DMG), foils, filters, sorting, live value totals
- **Deck builder** — main / sideboard / maybe zones, any format
- **Wishlist** — priorities and one-click move to collection
- **Statistics** — color, rarity, and set breakdowns with charts
- **Import / Export** — CSV compatible with Helvault and other trackers
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
