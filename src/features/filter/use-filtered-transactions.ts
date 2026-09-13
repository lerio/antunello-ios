/**
 * The filtered transaction query, debounced.
 *
 * The debounce matters more here than in search: every control on the filter
 * sheet is a discrete tap, and a user working through five of them in a row
 * should produce one request, not five.
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import {
  criteriaHash,
  type FilterCriteria,
} from '@/features/filter/filter-criteria';
import { fetchFilteredTransactions } from '@/features/filter/queries';
import type { Transaction } from '@/domain/types';
import { qk } from '@/lib/query-keys';

/** How long the criteria must hold still before a query goes out. */
const DEBOUNCE_MS = 300;

type FilteredTransactions = {
  results: Transaction[];
  /** True when the row cap was hit, so the results are partial. */
  truncated: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refresh: () => Promise<void>;
};

/**
 * Loads the transactions matching a set of criteria.
 *
 * @param criteria The current filter criteria.
 * @param enabled False until the user has touched a control — an untouched
 *        filter screen should prompt rather than list every transaction ever
 *        recorded.
 * @returns The matching transactions and the state of the request.
 */
export function useFilteredTransactions(
  criteria: FilterCriteria,
  enabled: boolean,
): FilteredTransactions {
  const hash = criteriaHash(criteria);
  const [debouncedHash, setDebouncedHash] = useState(hash);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedHash(hash), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [hash]);

  const settled = debouncedHash === hash;
  const active = enabled && settled;

  const result = useQuery({
    queryKey: qk.filter(debouncedHash),
    enabled: active,
    queryFn: () => fetchFilteredTransactions(criteria),
  });

  // As with search: a disabled query keeps the previous key's data as its
  // placeholder, so the guard is what stops a stale result set from showing
  // through while the criteria are still settling.
  const results = useMemo(
    () => (active ? (result.data?.transactions ?? []) : []),
    [active, result.data],
  );

  return {
    results,
    truncated: active && result.data?.truncated === true,
    // `isPending` rather than `isFetching`: a debounce that has not fired yet is
    // not a load, and neither is a refetch that still has rows on screen.
    isLoading: active && result.isPending,
    isError: active && result.isError,
    error: result.error,
    refresh: async () => {
      // `refetch` bypasses `enabled`, so without this an untouched filter
      // screen would pull the unfiltered 500-row query and then throw the
      // result away — the exact thing the `active` guard exists to prevent.
      if (active) await result.refetch();
    },
  };
}
