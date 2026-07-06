export type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'mythic' | 'special' | 'bonus';

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  colors?: string[];
  color_identity: string[];
  set: string;
  set_name: string;
  collector_number: string;
  rarity: Rarity;
  prices: {
    usd: string | null;
    usd_foil: string | null;
    eur: string | null;
    eur_foil: string | null;
  };
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    png: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    mana_cost?: string;
    type_line: string;
    oracle_text?: string;
    image_uris?: {
      small: string;
      normal: string;
      large: string;
    };
  }>;
  legalities: Record<string, string>;
  layout: string;
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
}

export interface CollectionEntry {
  id?: number;
  cardId: string;
  quantity: number;
  condition: CardCondition;
  isFoil: boolean;
  dateAdded: string;
  notes?: string;
  purchasePrice?: number;
}

export interface Deck {
  id?: number;
  name: string;
  format?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeckCard {
  id?: number;
  deckId: number;
  cardId: string;
  quantity: number;
  zone: 'main' | 'sideboard' | 'maybe';
}

export interface WishlistEntry {
  id?: number;
  cardId: string;
  dateAdded: string;
  maxPrice?: number;
  priority: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ValueSnapshot {
  id?: number;
  date: string;
  totalValue: number;
  cardCount: number;
}
