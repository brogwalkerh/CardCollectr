import { db } from '../db';
import type { ScryfallCard } from '../types';

const BASE_URL = 'https://api.scryfall.com';
const MIN_REQUEST_INTERVAL = 100;

let lastRequestTime = 0;

async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, options);
}

export async function searchCards(query: string, page = 1): Promise<{
  data: ScryfallCard[];
  has_more: boolean;
  total_cards: number;
}> {
  const res = await rateLimitedFetch(
    `${BASE_URL}/cards/search?q=${encodeURIComponent(query)}&page=${page}`
  );
  if (!res.ok) {
    if (res.status === 404) return { data: [], has_more: false, total_cards: 0 };
    throw new Error(`Scryfall search failed: ${res.status}`);
  }
  const json = await res.json();
  for (const card of json.data) {
    await db.cards.put(card);
  }
  return { data: json.data, has_more: json.has_more, total_cards: json.total_cards };
}

export async function autocompleteCards(query: string): Promise<string[]> {
  if (query.length < 2) return [];
  const res = await rateLimitedFetch(
    `${BASE_URL}/cards/autocomplete?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return [];
  const json = await res.json();
  return json.data;
}

export async function getCardById(id: string): Promise<ScryfallCard | null> {
  const cached = await db.cards.get(id);
  if (cached) return cached;
  const res = await rateLimitedFetch(`${BASE_URL}/cards/${id}`);
  if (!res.ok) return null;
  const card = await res.json();
  await db.cards.put(card);
  return card;
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const res = await rateLimitedFetch(
    `${BASE_URL}/cards/named?fuzzy=${encodeURIComponent(name)}`
  );
  if (!res.ok) return null;
  const card = await res.json();
  await db.cards.put(card);
  return card;
}

export async function getCardsByIds(ids: string[]): Promise<ScryfallCard[]> {
  const results: ScryfallCard[] = [];
  const toFetch: { id: string }[] = [];

  for (const id of ids) {
    const cached = await db.cards.get(id);
    if (cached) {
      results.push(cached);
    } else {
      toFetch.push({ id });
    }
  }

  if (toFetch.length > 0) {
    for (let i = 0; i < toFetch.length; i += 75) {
      const batch = toFetch.slice(i, i + 75);
      const res = await rateLimitedFetch(`${BASE_URL}/cards/collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifiers: batch }),
      });
      if (res.ok) {
        const json = await res.json();
        for (const card of json.data) {
          await db.cards.put(card);
          results.push(card);
        }
      }
    }
  }

  return results;
}

export function getCardImage(card: ScryfallCard, size: 'small' | 'normal' | 'large' = 'normal'): string {
  if (card.image_uris) return card.image_uris[size];
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size];
  return '';
}

export function getCardPrice(card: ScryfallCard, foil = false): number | null {
  const priceStr = foil ? card.prices.usd_foil : card.prices.usd;
  if (!priceStr) return null;
  return parseFloat(priceStr);
}
