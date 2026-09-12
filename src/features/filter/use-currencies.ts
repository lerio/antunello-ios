/**
 * The currencies that appear in the user's transactions.
 *
 * The web app reads 1,000 arbitrary rows and collects the currency codes it
 * finds. That is not reproducible: a query with no `order by` has no defined
 * row order, so the web app itself gets a different sample on different loads,
 * and this app would get a third one. A currency whose only transactions fall
 * outside the sampled rows simply would not be offered.
 *
 * This reads the column in full instead. It is a superset of any sample, so the
 * filter can never offer fewer currencies than the web app — and with the
 * currency codes being a handful of distinct values across every row, the
 * payload is small.
 */

import { useQuery } from '@tanstack/react-query';

import { fetchAllBatches } from '@/domain/fetch-all';
import { supabase } from '@/lib/supabase';

/** Query key; not shared with any other family. */
const CURRENCIES_KEY = ['filter-currencies'] as const;

type CurrencyRow = { currency: string };

/**
 * The distinct currencies present in the user's transactions, sorted.
 *
 * @returns A query resolving to currency codes, e.g. `['EUR', 'JPY', 'USD']`.
 */
export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    // Which currencies exist changes only when a transaction is created in a new
    // one, which the user would have just done by hand.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const rows = await fetchAllBatches<CurrencyRow>((from, to) =>
        supabase.from('transactions').select('currency').range(from, to),
      );

      return [...new Set(rows.map((row) => row.currency))].sort();
    },
  });
}
