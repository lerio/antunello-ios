/**
 * One category's transactions and its chart history.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  calculateCategoryHistory,
  type CategoryStats,
} from '@/features/category/category-history';
import { fetchCategoryTransactions } from '@/features/transactions/queries';
import { qk, type TimeRange } from '@/lib/query-keys';

type CategoryView = {
  /** The category's transactions, newest first. */
  transactions: NonNullable<Awaited<ReturnType<typeof fetchCategoryTransactions>>>;
  /** Buckets for the bar chart, gaps included as zeros. */
  stats: CategoryStats;
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
};

/**
 * Loads a category over a range.
 *
 * The range is part of the query key and part of how the data is read — it sets
 * both which rows come back and how they are bucketed — so a placeholder from
 * another range would chart the wrong span. Placeholders therefore count as
 * loading.
 *
 * @param category The main category, or null while it is still resolving.
 * @param subCategory Optional subcategory to narrow to.
 * @param timeRange The selected range.
 */
export function useCategoryTransactions(
  category: string | null,
  subCategory: string | null,
  timeRange: TimeRange,
): CategoryView {
  const query = useQuery({
    queryKey: qk.category(category ?? '', subCategory, timeRange),
    enabled: Boolean(category),
    queryFn: () => fetchCategoryTransactions(category!, subCategory, timeRange),
  });

  const transactions = useMemo(() => query.data ?? [], [query.data]);
  const stats = useMemo(
    () => calculateCategoryHistory(transactions, timeRange),
    [transactions, timeRange],
  );

  const hasOwnData = Boolean(query.data) && !query.isPlaceholderData;

  return {
    transactions,
    stats,
    // `!query.error` as well, so a failure is not reported as a permanent load
    // — see the note in `use-balance-history.ts`. The view currently tests
    // `isError` first, which hid the difference; that ordering is load-bearing
    // and should not have to be.
    isLoading: query.isLoading || (!hasOwnData && !query.error),
    isError: query.isError,
    refresh: async () => {
      await query.refetch();
    },
  };
}
