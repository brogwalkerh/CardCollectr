import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Plus, Trash2 } from 'lucide-react';
import { useDecks } from '../hooks/useDecks';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';
import { formatDate } from '../utils/format';
import { FORMATS } from '../utils/constants';

export function DeckListPage() {
  const { decks, createDeck, deleteDeck } = useDecks();
  const { addToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFormat, setNewFormat] = useState('');
  const [newDesc, setNewDesc] = useState('');

  async function handleCreate() {
    if (!newName.trim()) return;
    await createDeck(newName, newFormat || undefined, newDesc || undefined);
    addToast(`Created deck "${newName}"`, 'success');
    setShowCreate(false);
    setNewName('');
    setNewFormat('');
    setNewDesc('');
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete deck "${name}"?`)) return;
    await deleteDeck(id);
    addToast(`Deleted deck "${name}"`, 'info');
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Decks</h1>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> New Deck
        </button>
      </div>

      {decks.length === 0 ? (
        <EmptyState icon={<Layers size={48} />} title="No decks yet" description="Create a deck to start building" action={
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Create Deck</button>
        } />
      ) : (
        <div className="space-y-3">
          {decks.map(deck => (
            <Link key={deck.id} to={`/decks/${deck.id}`} className="block p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">{deck.name}</h3>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {deck.format && <span className="capitalize">{deck.format}</span>}
                    <span>Updated {formatDate(deck.updatedAt)}</span>
                  </div>
                  {deck.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{deck.description}</p>}
                </div>
                <button onClick={e => { e.preventDefault(); handleDelete(deck.id!, deck.name); }} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                  <Trash2 size={16} />
                </button>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Deck" size="sm">
        <div className="space-y-3">
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Deck Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Awesome Deck" className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Format</label>
            <select value={newFormat} onChange={e => setNewFormat(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white capitalize">
              <option value="">None</option>
              {FORMATS.map(f => <option key={f} value={f} className="capitalize">{f}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
          </div>
          <button onClick={handleCreate} disabled={!newName.trim()} className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">Create Deck</button>
        </div>
      </Modal>
    </div>
  );
}
