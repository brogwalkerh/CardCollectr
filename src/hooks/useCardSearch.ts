import { useState, useCallback, useRef } from 'react';
import { searchCards, autocompleteCards } from '../api/scryfall';
import type { ScryfallCard } from '../types';

export function useCardSearch() {
  const [results, setResults] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const currentQuery = useRef('');
  const currentPage = useRef(1);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setHasMore(false);
      setTotalCards(0);
      return;
    }
    currentQuery.current = query;
    currentPage.current = 1;
    setLoading(true);
    setError(null);
    try {
      const res = await searchCards(query, 1);
      setResults(res.data);
      setHasMore(res.has_more);
      setTotalCards(res.total_cards);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;
    currentPage.current++;
    setLoading(true);
    try {
      const res = await searchCards(currentQuery.current, currentPage.current);
      setResults(prev => [...prev, ...res.data]);
      setHasMore(res.has_more);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading]);

  return { results, loading, hasMore, totalCards, error, search, loadMore };
}

export function useAutocomplete() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const getSuggestions = useCallback((query: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      const results = await autocompleteCards(query);
      setSuggestions(results);
      setLoading(false);
    }, 300);
  }, []);

  const clearSuggestions = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, getSuggestions, clearSuggestions };
}
