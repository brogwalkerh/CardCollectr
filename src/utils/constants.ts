export const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

export const CONDITION_LABELS: Record<string, string> = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

export const RARITIES = ['common', 'uncommon', 'rare', 'mythic'] as const;

export const RARITY_COLORS: Record<string, string> = {
  common: '#1a1a1a',
  uncommon: '#6b7280',
  rare: '#b8860b',
  mythic: '#dc2626',
};

export const MTG_COLORS = [
  { code: 'W', name: 'White', hex: '#F9FAF4', bg: '#F9F5E8' },
  { code: 'U', name: 'Blue', hex: '#0E68AB', bg: '#C1D7E9' },
  { code: 'B', name: 'Black', hex: '#150B00', bg: '#BAB1AB' },
  { code: 'R', name: 'Red', hex: '#D3202A', bg: '#F4C5B8' },
  { code: 'G', name: 'Green', hex: '#00733E', bg: '#C4D3CA' },
] as const;

export const FORMATS = [
  'standard', 'modern', 'legacy', 'vintage', 'commander',
  'pioneer', 'pauper', 'brawl', 'historic', 'alchemy',
] as const;
