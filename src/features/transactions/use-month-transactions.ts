/**
 * The month's transactions, grouped by day.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { groupTransactionsByDay, type DayGroup } from '@/features/transactions/group-by-day';
import { fetchMonthTransactions } from '@/features/transactions/queries';
import { qk } from '@/lib/query-keys';

type MonthTransactions = {
  /** One entry per day, newest first, with totals already computed. */
  days: DayGroup[];
  /** Every transaction in the month, ungrouped. */
  transactions: NonNullable<ReturnType<typeof useQuery>['data']> | never[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  /** Refetches; wired to pull-to-refresh. */
  refresh: () => Promise<void>;
};

/**
 * Loads a month and groups it for display.
 *
 * Paging between months keeps the previous month on screen while the next one
 * loads, because the query client is configured with `keepPreviousData`. That
 * matters here: without it, tapping through the month strip would flash an empty
 * list on every tap.
 *
 * @param year Calendar year.
 * @param month Month, 1-12.
 */
export function useMonthTransactions(year: number, month: number): MonthTransactions {
  const query = useQuery({
    queryKey: qk.month(year, month),
    queryFn: () => fetchMonthTransactions(year, month),
  });

  const transactions = useMemo(() => query.data ?? [], [query.data]);
  const days = useMemo(() => groupTransactionsByDay(transactions), [transactions]);

  return {
    days,
    transactions,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refresh: async () => {
      await query.refetch();
    },
  };
}
