import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { SearchPage } from './pages/SearchPage';
import { CollectionPage } from './pages/CollectionPage';
import { DeckListPage } from './pages/DeckListPage';
import { DeckDetailPage } from './pages/DeckDetailPage';
import { WishlistPage } from './pages/WishlistPage';
import { StatsPage } from './pages/StatsPage';
import { ImportExportPage } from './pages/ImportExportPage';
import { ScannerPage } from './pages/ScannerPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Navigate to="/search" replace />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/collection" element={<CollectionPage />} />
              <Route path="/decks" element={<DeckListPage />} />
              <Route path="/decks/:deckId" element={<DeckDetailPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
              <Route path="/stats" element={<StatsPage />} />
              <Route path="/import-export" element={<ImportExportPage />} />
              <Route path="/scanner" element={<ScannerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
