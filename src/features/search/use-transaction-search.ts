/**
 * Debounced transaction search.
 *
 * Every keystroke changes the query key, so without the debounce a burst of
 * typing would issue one request per character. The 300 ms pause is the web
 * app's figure.
 *
 * The debounce is local state rather than a TanStack Query option because the
 * query cache should be keyed by what was actually searched for — caching a key
 * per intermediate keystroke would fill the cache with prefixes nobody asked to
 * see, all of them entries a later keystroke can never reuse.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { fetchSearchResults } from '@/features/search/queries';
import type { Transaction } from '@/domain/types';
import { qk } from '@/lib/query-keys';

/** How long typing must pause before a search goes out. */
const DEBOUNCE_MS = 300;

type TransactionSearch = {
  /** Matches for the debounced query, empty while it is blank or in flight. */
  results: Transaction[];
  /** The query the results correspond to, which lags what is being typed. */
  searchedQuery: string;
  /** True while a search for the current query has not yet returned. */
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Refetches the current results; wired to pull-to-refresh. */
  refresh: () => Promise<void>;
};

/**
 * Searches transactions as the user types.
 *
 * @param query The raw text in the search field.
 * @returns Results, loading and error state for the debounced query.
 */
export function useTransactionSearch(query: string): TransactionSearch {
  const [debounced, setDebounced] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const searchedQuery = debounced.trim();
  const enabled = searchedQuery.length > 0;

  const result = useQuery({
    queryKey: qk.search(searchedQuery),
    enabled,
    queryFn: () => fetchSearchResults(searchedQuery),
  });

  // An empty query is disabled, and the query client is configured to keep the
  // previous key's data as a placeholder — so without this guard, clearing the
  // field would leave the last search's results on screen.
  const results = useMemo(
    () => (enabled ? (result.data ?? []) : []),
    [enabled, result.data],
  );

  return {
    results,
    searchedQuery,
    // A blank or still-debouncing field is not "loading" — it is waiting for the
    // user, and showing a spinner then would be a lie about what is happening.
    isLoading: enabled && result.isPending,
    isError: enabled && result.isError,
    error: result.error,
    refresh: async () => {
      await result.refetch();
    },
  };
}
