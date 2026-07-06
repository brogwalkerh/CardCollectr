import { useState, useMemo } from 'react';
import { Library, Search, Trash2, Plus, Minus, Grid, List, SlidersHorizontal } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useCollection } from '../hooks/useCollection';
import { db } from '../db';
import { CardImage } from '../components/card/CardImage';
import { ManaCost } from '../components/card/ManaCost';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { getCardPrice } from '../api/scryfall';
import type { ScryfallCard, CollectionEntry } from '../types';
import { CONDITIONS, CONDITION_LABELS, MTG_COLORS } from '../utils/constants';
import { formatPrice } from '../utils/format';

export function CollectionPage() {
  const { entries, updateQuantity, removeCard } = useCollection();
  const [searchFilter, setSearchFilter] = useState('');
  const [colorFilter, setColorFilter] = useState<string[]>([]);
  const [rarityFilter, setRarityFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'value' | 'dateAdded' | 'set'>('dateAdded');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { addToast } = useToast();

  const cardIds = useMemo(() => [...new Set(entries.map(e => e.cardId))], [entries]);
  const cards = useLiveQuery(() => db.cards.bulkGet(cardIds), [cardIds]) ?? [];
  const cardMap = useMemo(() => {
    const map = new Map<string, ScryfallCard>();
    cards.forEach(c => { if (c) map.set(c.id, c); });
    return map;
  }, [cards]);

  const enrichedEntries = useMemo(() => {
    return entries
      .map(entry => ({ entry, card: cardMap.get(entry.cardId) }))
      .filter((item): item is { entry: CollectionEntry; card: ScryfallCard } => !!item.card)
      .filter(({ card, entry }) => {
        if (searchFilter && !card.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
        if (colorFilter.length > 0 && !colorFilter.some(c => card.color_identity.includes(c))) return false;
        if (rarityFilter && card.rarity !== rarityFilter) return false;
        if (conditionFilter && entry.condition !== conditionFilter) return false;
        return true;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'name': return a.card.name.localeCompare(b.card.name);
          case 'value': return (getCardPrice(b.card, b.entry.isFoil) ?? 0) - (getCardPrice(a.card, a.entry.isFoil) ?? 0);
          case 'set': return a.card.set_name.localeCompare(b.card.set_name);
          default: return b.entry.dateAdded.localeCompare(a.entry.dateAdded);
        }
      });
  }, [entries, cardMap, searchFilter, colorFilter, rarityFilter, conditionFilter, sortBy]);

  const totalValue = useMemo(() => {
    return enrichedEntries.reduce((sum, { entry, card }) => {
      const price = getCardPrice(card, entry.isFoil);
      return sum + (price ?? 0) * entry.quantity;
    }, 0);
  }, [enrichedEntries]);

  const totalCards = useMemo(() => enrichedEntries.reduce((sum, { entry }) => sum + entry.quantity, 0), [enrichedEntries]);

  function toggleColor(color: string) {
    setColorFilter(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  }

  async function handleDelete(entryId: number, name: string) {
    await removeCard(entryId);
    addToast(`Removed ${name} from collection`, 'info');
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">My Collection</h1>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">{totalCards} cards</span>
          <span className="text-gray-600 dark:text-gray-400">{enrichedEntries.length} entries</span>
          <span className="text-green-600 dark:text-green-400 font-medium">{formatPrice(totalValue)} total value</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            value={searchFilter}
            onChange={e => setSearchFilter(e.target.value)}
            placeholder="Filter by name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium ${showFilters ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
        >
          <SlidersHorizontal size={16} /> Filters
        </button>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
        >
          <option value="dateAdded">Recently Added</option>
          <option value="name">Name</option>
          <option value="value">Value</option>
          <option value="set">Set</option>
        </select>
        <div className="flex gap-1">
          <button onClick={() => setViewMode('table')} className={`p-2 rounded ${viewMode === 'table' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
            <List size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
            <Grid size={18} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex gap-1">
            {MTG_COLORS.map(c => (
              <button
                key={c.code}
                onClick={() => toggleColor(c.code)}
                className={`w-7 h-7 rounded-full border-2 text-xs font-bold ${colorFilter.includes(c.code) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300 dark:border-gray-600'}`}
                style={{ backgroundColor: c.bg, color: c.hex }}
                title={c.name}
              >
                {c.code}
              </button>
            ))}
          </div>
          <select
            value={rarityFilter}
            onChange={e => setRarityFilter(e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
          >
            <option value="">All Rarities</option>
            <option value="common">Common</option>
            <option value="uncommon">Uncommon</option>
            <option value="rare">Rare</option>
            <option value="mythic">Mythic</option>
          </select>
          <select
            value={conditionFilter}
            onChange={e => setConditionFilter(e.target.value)}
            className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
          >
            <option value="">All Conditions</option>
            {CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
          </select>
        </div>
      )}

      {enrichedEntries.length === 0 ? (
        <EmptyState
          icon={<Library size={48} />}
          title="Your collection is empty"
          description="Search for cards and add them to start building your collection"
        />
      ) : viewMode === 'table' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Card</th>
                <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium hidden sm:table-cell">Set</th>
                <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Cond.</th>
                <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Qty</th>
                <th className="py-2 px-2 text-gray-500 dark:text-gray-400 font-medium">Price</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {enrichedEntries.map(({ entry, card }) => (
                <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="py-2 px-2">
                    <button onClick={() => setSelectedCard(card)} className="flex items-center gap-2 text-left">
                      <img src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small} alt="" className="w-8 h-11 rounded object-cover" />
                      <div>
                        <span className="font-medium text-gray-900 dark:text-white">{card.name}</span>
                        {entry.isFoil && <span className="ml-1.5 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1 rounded">Foil</span>}
                      </div>
                    </button>
                  </td>
                  <td className="py-2 px-2 text-gray-500 dark:text-gray-400 hidden sm:table-cell">{card.set_name}</td>
                  <td className="py-2 px-2"><span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">{entry.condition}</span></td>
                  <td className="py-2 px-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQuantity(entry.id!, entry.quantity - 1)} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
                        <Minus size={12} />
                      </button>
                      <span className="w-6 text-center text-gray-900 dark:text-white">{entry.quantity}</span>
                      <button onClick={() => updateQuantity(entry.id!, entry.quantity + 1)} className="w-6 h-6 flex items-center justify-center rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">
                        <Plus size={12} />
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2 text-green-600 dark:text-green-400">{formatPrice(getCardPrice(card, entry.isFoil))}</td>
                  <td className="py-2 px-2">
                    <button onClick={() => handleDelete(entry.id!, card.name)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {enrichedEntries.map(({ entry, card }) => (
            <button key={entry.id} onClick={() => setSelectedCard(card)} className="text-left group">
              <div className="relative">
                <CardImage card={card} size="normal" className="transition-transform group-hover:scale-105" />
                <span className="absolute top-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">x{entry.quantity}</span>
                {entry.isFoil && <span className="absolute top-1 left-1 bg-yellow-500/90 text-white text-xs px-1.5 py-0.5 rounded">Foil</span>}
              </div>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate">{card.name}</p>
            </button>
          ))}
        </div>
      )}

      <Modal isOpen={!!selectedCard} onClose={() => setSelectedCard(null)} title={selectedCard?.name} size="md">
        {selectedCard && (
          <div className="flex flex-col md:flex-row gap-4">
            <CardImage card={selectedCard} size="large" className="w-full md:w-48" />
            <div className="flex-1 space-y-2">
              <ManaCost cost={selectedCard.mana_cost} />
              <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCard.type_line}</p>
              {selectedCard.oracle_text && <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{selectedCard.oracle_text}</p>}
              <p className="text-sm text-green-600 dark:text-green-400">{formatPrice(getCardPrice(selectedCard))}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
