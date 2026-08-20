import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FolderDown, Upload, Trash2, FileArchive, FileSpreadsheet, FileJson, DownloadCloud } from 'lucide-react';
import JSZip from 'jszip';
import { archDb, type ArchDeck } from '../db/archidektViewer';
import {
  ARCH_FORMAT_NAMES,
  archFormatName,
  parseRawDeck,
  renderDecklist,
  safeFilename,
  csvCell,
  downloadBlob,
  type RawDeck,
} from '../utils/archidektViewer';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../context/ToastContext';

const PAGE_SIZE = 50;

// Archidekt snapshot viewer. GitHub Pages is static hosting and Archidekt's
// API only allows the origin http://localhost:3000 (verified 2026-08-20), so
// this page cannot fetch from Archidekt directly. Instead you import the
// "Raw JSON" export produced by the local deck-collector app; everything else
// (search, browse, export) runs entirely in the browser via IndexedDB.
export function ArchidektViewerPage() {
  const { addToast } = useToast();
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('');
  const [cardName, setCardName] = useState('');
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const deckCount = useLiveQuery(() => archDb.archDecks.count(), []);

  // useLiveQuery re-runs automatically when the underlying IndexedDB tables
  // change (e.g. right after an import finishes).
  const filtered = useLiveQuery(async () => {
    let decks = await archDb.archDecks.toArray();
    if (q) {
      const needle = q.toLowerCase();
      decks = decks.filter(
        d =>
          d.name.toLowerCase().includes(needle) ||
          (d.commander ?? '').toLowerCase().includes(needle) ||
          (d.owner ?? '').toLowerCase().includes(needle)
      );
    }
    if (format) {
      decks = decks.filter(d => d.format === Number(format));
    }
    if (cardName) {
      const needle = cardName.toLowerCase();
      const matches = await archDb.archCards
        .filter(c => c.cardName.toLowerCase().includes(needle))
        .toArray();
      const deckIds = new Set(matches.map(c => c.deckId));
      decks = decks.filter(d => deckIds.has(d.id));
    }
    decks.sort((a, b) => b.id - a.id);
    return decks;
  }, [q, format, cardName]);

  const pageCount = Math.max(1, Math.ceil((filtered?.length ?? 0) / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageDecks = useMemo(
    () => (filtered ?? []).slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage]
  );

  async function handleImport(file: File) {
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      const rawDecks: RawDeck[] = Array.isArray(parsed) ? parsed : [parsed];
      const valid = rawDecks.filter(r => r && typeof r.id === 'number');
      if (valid.length === 0) throw new Error('No decks found — expected the Raw JSON export from the local deck-collector app.');

      await archDb.transaction('rw', archDb.archDecks, archDb.archCards, async () => {
        for (const raw of valid) {
          const { deck, cards } = parseRawDeck(raw);
          // Idempotent upsert on deck ID, same as the local app.
          await archDb.archCards.where('deckId').equals(deck.id).delete();
          await archDb.archDecks.put(deck);
          await archDb.archCards.bulkAdd(cards);
        }
      });
      addToast(`Imported ${valid.length} deck${valid.length === 1 ? '' : 's'}`, 'success');
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  async function cardsForDecks(decks: ArchDeck[]) {
    const ids = decks.map(d => d.id);
    return archDb.archCards.where('deckId').anyOf(ids).toArray();
  }

  async function exportZip() {
    if (!filtered?.length) return;
    setExporting(true);
    try {
      const zip = new JSZip();
      for (const deck of filtered) {
        const cards = await archDb.archCards.where('deckId').equals(deck.id).toArray();
        zip.file(safeFilename(deck.name, deck.id), renderDecklist(deck, cards));
      }
      const bytes = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      downloadBlob(bytes, `decklists_${filtered.length}.zip`, 'application/zip');
    } finally {
      setExporting(false);
    }
  }

  async function exportCsv() {
    if (!filtered?.length) return;
    const nameById = new Map(filtered.map(d => [d.id, d.name]));
    const cards = await cardsForDecks(filtered);
    cards.sort((a, b) => a.deckId - b.deckId || (a.category ?? '').localeCompare(b.category ?? ''));
    const lines = ['deck_id,deck_name,card_name,quantity,category,set_code,collector_number,scryfall_id'];
    for (const card of cards) {
      lines.push(
        [
          card.deckId,
          csvCell(nameById.get(card.deckId)),
          csvCell(card.cardName),
          card.quantity,
          csvCell(card.category),
          csvCell(card.setCode),
          csvCell(card.collectorNumber),
          csvCell(card.scryfallId),
        ].join(',')
      );
    }
    downloadBlob(lines.join('\n') + '\n', `cards_${filtered.length}_decks.csv`, 'text/csv');
  }

  function exportJson() {
    if (!filtered?.length) return;
    downloadBlob(
      JSON.stringify(filtered.map(d => d.raw), null, 1),
      `decks_raw_${filtered.length}.json`,
      'application/json'
    );
  }

  async function clearAll() {
    if (!window.confirm('Remove all imported Archidekt decks from this browser?')) return;
    await archDb.transaction('rw', archDb.archDecks, archDb.archCards, async () => {
      await archDb.archCards.clear();
      await archDb.archDecks.clear();
    });
    addToast('Cleared imported decks', 'success');
  }

  const inputCls =
    'px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-20 md:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Archidekt Decks</h2>
        <div className="flex gap-2">
          <Link
            to="/archidekt/collect"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium"
          >
            <DownloadCloud size={16} />
            Collect decks
          </Link>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium cursor-pointer">
            <Upload size={16} />
            {importing ? 'Importing…' : 'Import Raw JSON'}
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.target.value = ''; // allow re-selecting the same file
              }}
            />
          </label>
          {(deckCount ?? 0) > 0 && (
            <button
              onClick={clearAll}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <Trash2 size={16} />
              Clear
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-3xl">
        Decks live in this browser (IndexedDB). Fill it two ways: run collection jobs right here via{' '}
        <Link to="/archidekt/collect" className="text-blue-600 dark:text-blue-400 hover:underline">Collect decks</Link>{' '}
        (works on Vercel and in local dev, where the app has an Archidekt proxy — on the GitHub Pages
        copy, set the proxy URL under Advanced on that page), or import a “Raw JSON” export from the
        local deck-collector app above.
      </p>

      {(deckCount ?? 0) === 0 ? (
        <EmptyState
          icon={<FolderDown size={48} />}
          title="No Archidekt decks imported"
          description="Start a collection job with Collect decks, or import a Raw JSON export from the local deck-collector app."
        />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <input
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1); }}
              placeholder="Search name / commander / owner"
              className={`${inputCls} w-64`}
            />
            <select value={format} onChange={e => { setFormat(e.target.value); setPage(1); }} className={inputCls}>
              <option value="">Any format</option>
              {Object.entries(ARCH_FORMAT_NAMES).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <input
              value={cardName}
              onChange={e => { setCardName(e.target.value); setPage(1); }}
              placeholder="Contains card…"
              className={`${inputCls} w-52`}
            />
            <span className="self-center text-sm text-gray-500 dark:text-gray-400">
              {filtered === undefined ? '…' : `${filtered.length.toLocaleString()} of ${deckCount?.toLocaleString()} decks`}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-4">
            <button onClick={exportZip} disabled={exporting || !filtered?.length} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
              <FileArchive size={15} /> {exporting ? 'Zipping…' : 'Decklists (.zip)'}
            </button>
            <button onClick={exportCsv} disabled={!filtered?.length} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
              <FileSpreadsheet size={15} /> Cards CSV
            </button>
            <button onClick={exportJson} disabled={!filtered?.length} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40">
              <FileJson size={15} /> Raw JSON
            </button>
            <span className="self-center text-xs text-gray-400 dark:text-gray-500">Exports cover the current filter.</span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-3 py-2">Deck</th>
                  <th className="px-3 py-2">Format</th>
                  <th className="px-3 py-2">Commander</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2 text-right">Cards</th>
                </tr>
              </thead>
              <tbody>
                {pageDecks.map(deck => (
                  <tr key={deck.id} className="border-t border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-3 py-2">
                      <Link to={`/archidekt/${deck.id}`} className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                        {deck.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{archFormatName(deck.format)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{deck.commander ?? '—'}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{deck.owner ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-gray-700 dark:text-gray-300">{deck.cardCount}</td>
                  </tr>
                ))}
                {pageDecks.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-gray-500 dark:text-gray-400">
                      No imported decks match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-3 flex items-center gap-3 text-sm">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 text-gray-700 dark:text-gray-300"
              >
                ← Prev
              </button>
              <span className="text-gray-500 dark:text-gray-400">page {currentPage} / {pageCount}</span>
              <button
                onClick={() => setPage(p => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 text-gray-700 dark:text-gray-300"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
