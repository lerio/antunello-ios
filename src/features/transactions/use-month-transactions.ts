/**
 * The month's transactions, grouped by day.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { groupTransactionsByDay, type DayGroup } from '@/features/transactions/group-by-day';
import { fetchMonthTransactions } from '@/features/transactions/queries';
import type { Transaction } from '@/domain/types';
import { qk } from '@/lib/query-keys';

type MonthTransactions = {
  /** One entry per day, newest first, with totals already computed. */
  days: DayGroup[];
  /** Every transaction in the month, ungrouped, with split instances expanded. */
  transactions: Transaction[];
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

  /**
   * The previous month's rows, still on screen while this month loads.
   *
   * Kept deliberately: paging the month strip would otherwise flash an empty
   * list on every tap. But when the fetch *fails* the placeholder never clears,
   * because a placeholder is data — so the list would show the previous month's
   * transactions under the new month's header, with no error and no spinner.
   * Dropping them only in that case lets the empty state's error branch, which
   * is the only place `isError` is read, actually reach the screen.
   */
  const foreignPlaceholder = query.isPlaceholderData && query.isError;

  const transactions = useMemo(
    () => (foreignPlaceholder ? [] : (query.data ?? [])),
    [foreignPlaceholder, query.data],
  );
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
