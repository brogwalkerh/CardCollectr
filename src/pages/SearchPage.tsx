import { useState, useRef } from 'react';
import { Search, Grid, List, Plus, Heart } from 'lucide-react';
import { useCardSearch, useAutocomplete } from '../hooks/useCardSearch';
import { useCollection } from '../hooks/useCollection';
import { useWishlist } from '../hooks/useWishlist';
import { CardImage } from '../components/card/CardImage';
import { ManaCost } from '../components/card/ManaCost';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { getCardPrice } from '../api/scryfall';
import type { ScryfallCard, CardCondition } from '../types';
import { CONDITIONS, CONDITION_LABELS } from '../utils/constants';
import { formatPrice } from '../utils/format';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedCard, setSelectedCard] = useState<ScryfallCard | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addCondition, setAddCondition] = useState<CardCondition>('NM');
  const [addFoil, setAddFoil] = useState(false);
  const [addQuantity, setAddQuantity] = useState(1);
  const { results, loading, hasMore, totalCards, error, search, loadMore } = useCardSearch();
  const { suggestions, getSuggestions, clearSuggestions } = useAutocomplete();
  const { addCard } = useCollection();
  const { addToWishlist } = useWishlist();
  const { addToast } = useToast();
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      search(query);
      setShowSuggestions(false);
      clearSuggestions();
    }
  }

  function handleInputChange(value: string) {
    setQuery(value);
    getSuggestions(value);
    setShowSuggestions(true);
  }

  function selectSuggestion(name: string) {
    setQuery(name);
    setShowSuggestions(false);
    clearSuggestions();
    search(name);
  }

  async function handleAddToCollection() {
    if (!selectedCard) return;
    await addCard(selectedCard.id, addQuantity, addCondition, addFoil);
    addToast(`Added ${selectedCard.name} to collection`, 'success');
    setShowAddForm(false);
    setAddQuantity(1);
    setAddCondition('NM');
    setAddFoil(false);
  }

  async function handleAddToWishlist() {
    if (!selectedCard) return;
    await addToWishlist(selectedCard.id);
    addToast(`Added ${selectedCard.name} to wishlist`, 'success');
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Search Cards</h1>
        <form onSubmit={handleSearch} className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => handleInputChange(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search cards... (e.g. 'lightning bolt', 'c:red cmc:1')"
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {suggestions.map(name => (
                    <button
                      key={name}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      onMouseDown={() => selectSuggestion(name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Search
            </button>
          </div>
        </form>
      </div>

      {totalCards > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{totalCards.toLocaleString()} results</p>
          <div className="flex gap-1">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
              <Grid size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
              <List size={18} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {!loading && results.length === 0 && query && !error && (
        <EmptyState title="No cards found" description="Try a different search term or use Scryfall syntax" icon={<Search size={48} />} />
      )}

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {results.map(card => (
            <button key={card.id} onClick={() => setSelectedCard(card)} className="text-left group">
              <CardImage card={card} size="normal" className="transition-transform group-hover:scale-105" />
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate">{card.name}</p>
              <p className="text-xs text-green-600 dark:text-green-400">{formatPrice(getCardPrice(card))}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(card => (
            <button
              key={card.id}
              onClick={() => setSelectedCard(card)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-left"
            >
              <img src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small} alt="" className="w-10 h-14 rounded object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{card.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{card.type_line}</p>
              </div>
              <ManaCost cost={card.mana_cost} />
              <span className="text-sm text-green-600 dark:text-green-400 whitespace-nowrap">{formatPrice(getCardPrice(card))}</span>
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-8"><Spinner /></div>}

      {hasMore && !loading && (
        <div className="flex justify-center mt-6">
          <button onClick={loadMore} className="px-6 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 font-medium">
            Load More
          </button>
        </div>
      )}

      <Modal isOpen={!!selectedCard} onClose={() => { setSelectedCard(null); setShowAddForm(false); }} title={selectedCard?.name} size="lg">
        {selectedCard && (
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-64 shrink-0">
              <CardImage card={selectedCard} size="large" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ManaCost cost={selectedCard.mana_cost} />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedCard.type_line}</p>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 capitalize">{selectedCard.rarity} - {selectedCard.set_name}</p>
              </div>
              {selectedCard.oracle_text && (
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{selectedCard.oracle_text}</p>
              )}
              {(selectedCard.power || selectedCard.toughness) && (
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedCard.power}/{selectedCard.toughness}</p>
              )}
              <div className="flex gap-4 text-sm">
                <span className="text-green-600 dark:text-green-400">USD: {formatPrice(getCardPrice(selectedCard))}</span>
                <span className="text-yellow-600 dark:text-yellow-400">Foil: {formatPrice(getCardPrice(selectedCard, true))}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  <Plus size={16} /> Add to Collection
                </button>
                <button
                  onClick={handleAddToWishlist}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium"
                >
                  <Heart size={16} /> Wishlist
                </button>
              </div>

              {showAddForm && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
                  <div className="flex gap-3">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Quantity</label>
                      <input
                        type="number"
                        min={1}
                        value={addQuantity}
                        onChange={e => setAddQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 mt-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Condition</label>
                      <select
                        value={addCondition}
                        onChange={e => setAddCondition(e.target.value as CardCondition)}
                        className="mt-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                      >
                        {CONDITIONS.map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input type="checkbox" checked={addFoil} onChange={e => setAddFoil(e.target.checked)} className="rounded" />
                        Foil
                      </label>
                    </div>
                  </div>
                  <button onClick={handleAddToCollection} className="px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
                    Confirm Add
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
