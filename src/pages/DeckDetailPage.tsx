import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDeckCards } from '../hooks/useDecks';
import { db } from '../db';
import { searchCards, getCardPrice } from '../api/scryfall';
import { ManaCost } from '../components/card/ManaCost';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import type { ScryfallCard } from '../types';
import { formatPrice } from '../utils/format';

export function DeckDetailPage() {
  const { deckId } = useParams<{ deckId: string }>();
  const navigate = useNavigate();
  const id = parseInt(deckId || '0');
  const deck = useLiveQuery(() => db.decks.get(id), [id]);
  const { cards, addCardToDeck, removeCardFromDeck, updateCardInDeck } = useDeckCards(id);
  const { addToast } = useToast();
  const [showAddCard, setShowAddCard] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ScryfallCard[]>([]);
  const [searching, setSearching] = useState(false);

  const cardIds = useMemo(() => [...new Set(cards.map(c => c.cardId))], [cards]);
  const cardData = useLiveQuery(() => db.cards.bulkGet(cardIds), [cardIds]) ?? [];
  const cardMap = useMemo(() => {
    const map = new Map<string, ScryfallCard>();
    cardData.forEach(c => { if (c) map.set(c.id, c); });
    return map;
  }, [cardData]);

  const zones = useMemo(() => {
    const main = cards.filter(c => c.zone === 'main');
    const sideboard = cards.filter(c => c.zone === 'sideboard');
    const maybe = cards.filter(c => c.zone === 'maybe');
    return { main, sideboard, maybe };
  }, [cards]);

  const mainCount = zones.main.reduce((s, c) => s + c.quantity, 0);
  const sideCount = zones.sideboard.reduce((s, c) => s + c.quantity, 0);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await searchCards(searchQuery);
      setSearchResults(res.data);
    } catch { setSearchResults([]); }
    setSearching(false);
  }

  async function handleAddCard(card: ScryfallCard) {
    await addCardToDeck(card.id, 1, 'main');
    addToast(`Added ${card.name}`, 'success');
  }

  if (!deck) return <div className="p-6"><Spinner /></div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/decks')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{deck.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {deck.format && <span className="capitalize">{deck.format} - </span>}
            {mainCount} main / {sideCount} sideboard
          </p>
        </div>
        <button onClick={() => setShowAddCard(true)} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> Add Card
        </button>
      </div>

      {(['main', 'sideboard', 'maybe'] as const).map(zone => {
        const zoneCards = zones[zone];
        if (zoneCards.length === 0 && zone !== 'main') return null;
        return (
          <div key={zone} className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
              {zone} ({zoneCards.reduce((s, c) => s + c.quantity, 0)})
            </h2>
            <div className="space-y-1">
              {zoneCards.map(dc => {
                const card = cardMap.get(dc.cardId);
                if (!card) return null;
                return (
                  <div key={dc.id} className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50 group">
                    <span className="w-6 text-center text-sm text-gray-600 dark:text-gray-400">{dc.quantity}x</span>
                    <span className="flex-1 text-sm text-gray-900 dark:text-white">{card.name}</span>
                    <ManaCost cost={card.mana_cost} className="hidden sm:inline-flex" />
                    <span className="text-xs text-green-600 dark:text-green-400">{formatPrice(getCardPrice(card))}</span>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={() => updateCardInDeck(dc.id!, { quantity: dc.quantity + 1 })} className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">+</button>
                      <button onClick={() => dc.quantity > 1 ? updateCardInDeck(dc.id!, { quantity: dc.quantity - 1 }) : removeCardFromDeck(dc.id!)} className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300">-</button>
                      <button onClick={() => removeCardFromDeck(dc.id!)} className="w-5 h-5 flex items-center justify-center rounded text-red-400 hover:text-red-500"><Trash2 size={12} /></button>
                    </div>
                  </div>
                );
              })}
              {zone === 'main' && zoneCards.length === 0 && (
                <p className="text-sm text-gray-400 dark:text-gray-500 py-4 text-center">No cards in maindeck. Click "Add Card" to get started.</p>
              )}
            </div>
          </div>
        );
      })}

      <Modal isOpen={showAddCard} onClose={() => { setShowAddCard(false); setSearchResults([]); setSearchQuery(''); }} title="Add Card to Deck" size="md">
        <div className="space-y-4">
          <form onSubmit={e => { e.preventDefault(); handleSearch(); }} className="flex gap-2">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search for a card..." className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Search</button>
          </form>
          {searching && <div className="flex justify-center"><Spinner size="sm" /></div>}
          <div className="max-h-80 overflow-y-auto space-y-1">
            {searchResults.map(card => (
              <div key={card.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <img src={card.image_uris?.small || card.card_faces?.[0]?.image_uris?.small} alt="" className="w-8 h-11 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{card.name}</p>
                  <p className="text-xs text-gray-500">{card.type_line}</p>
                </div>
                <ManaCost cost={card.mana_cost} />
                <button onClick={() => handleAddCard(card)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Add</button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
