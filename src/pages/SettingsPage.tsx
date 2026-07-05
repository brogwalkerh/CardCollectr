import { useState } from 'react';
import { Moon, Sun, Database, AlertTriangle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { db } from '../db';

export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { addToast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  async function clearAllData() {
    await db.collection.clear();
    await db.decks.clear();
    await db.deckCards.clear();
    await db.wishlist.clear();
    await db.valueSnapshots.clear();
    await db.cards.clear();
    addToast('All data cleared', 'info');
    setShowClearConfirm(false);
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>

      <div className="space-y-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {theme === 'dark' ? <Moon size={20} className="text-blue-400" /> : <Sun size={20} className="text-yellow-500" />}
              <div>
                <p className="font-medium text-gray-900 dark:text-white">Theme</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Currently using {theme} mode</p>
              </div>
            </div>
            <button onClick={toggleTheme} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
              Switch to {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            <Database size={20} className="text-gray-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Data Storage</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">All data is stored locally in your browser using IndexedDB</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3 mb-3">
            <AlertTriangle size={20} className="text-red-500" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Danger Zone</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">These actions cannot be undone</p>
            </div>
          </div>
          {!showClearConfirm ? (
            <button onClick={() => setShowClearConfirm(true)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">
              Clear All Data
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-red-600 dark:text-red-400">Are you sure? This will delete everything.</p>
              <button onClick={clearAllData} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm">Yes, Delete</button>
              <button onClick={() => setShowClearConfirm(false)} className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">CardCollectr</strong> - Free MTG Collection Manager
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Card data provided by Scryfall. Not affiliated with Wizards of the Coast.</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">All features free. No account required. Your data stays on your device.</p>
        </div>
      </div>
    </div>
  );
}
