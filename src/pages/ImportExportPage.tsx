import { useState, useRef } from 'react';
import { Upload, Download } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { getCardByName } from '../api/scryfall';
import { Spinner } from '../components/ui/Spinner';
import { useToast } from '../context/ToastContext';
import { useCollection } from '../hooks/useCollection';
import { exportCollectionToCSV, parseCSV } from '../utils/csv';
import type { ScryfallCard } from '../types';

export function ImportExportPage() {
  const { entries, addCard } = useCollection();
  const { addToast } = useToast();
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const cards = useLiveQuery(async () => {
    const ids = [...new Set(entries.map(e => e.cardId))];
    return await db.cards.bulkGet(ids);
  }, [entries]) ?? [];

  async function handleExport() {
    const cardMap = new Map<string, ScryfallCard>();
    cards.forEach(c => { if (c) cardMap.set(c.id, c); });

    const exportData = entries.map(e => {
      const card = cardMap.get(e.cardId);
      return { ...e, name: card?.name ?? 'Unknown', set: card?.set ?? '', collectorNumber: card?.collector_number ?? '' };
    });

    const csv = exportCollectionToCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cardcollectr-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('Collection exported successfully', 'success');
  }

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const content = await file.text();
      const parsed = parseCSV(content);
      if (parsed.length === 0) {
        addToast('No valid entries found in CSV', 'error');
        setImporting(false);
        return;
      }

      let imported = 0;
      let failed = 0;
      for (let i = 0; i < parsed.length; i++) {
        const row = parsed[i];
        setImportProgress(`Importing ${i + 1}/${parsed.length}: ${row.name}`);
        try {
          const card = await getCardByName(row.name);
          if (card) {
            const condition = (['NM', 'LP', 'MP', 'HP', 'DMG'].includes(row.condition || '') ? row.condition : 'NM') as any;
            await addCard(card.id, row.count, condition, row.foil, row.purchasePrice);
            imported++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      addToast(`Imported ${imported} cards${failed > 0 ? `, ${failed} failed` : ''}`, imported > 0 ? 'success' : 'error');
    } catch (e) {
      addToast('Failed to parse CSV file', 'error');
    }
    setImporting(false);
    setImportProgress('');
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Import / Export</h1>

      <div className="space-y-6">
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Download size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Export Collection</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Download your collection as a CSV file compatible with most MTG trackers.</p>
          <button onClick={handleExport} disabled={entries.length === 0} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm disabled:opacity-50">
            Export {entries.length} entries as CSV
          </button>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Upload size={20} className="text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Import Collection</h2>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Import cards from a CSV file. Expected format:</p>
          <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 p-2 rounded block mb-4">Count,Name,Set,Collector Number,Condition,Foil,Purchase Price</code>
          <input ref={fileInputRef} type="file" accept=".csv,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) handleImport(f); }} className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={importing} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm disabled:opacity-50">
            {importing ? 'Importing...' : 'Choose CSV File'}
          </button>
          {importProgress && (
            <div className="mt-3 flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-sm text-gray-600 dark:text-gray-400">{importProgress}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
