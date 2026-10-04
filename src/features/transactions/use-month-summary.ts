/**
 * The month summary, with the data it compares against.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Transaction } from '@/domain/types';
import { fetchMonthTransactions, fetchSplitSources } from '@/features/transactions/queries';
import {
  computeMonthSummary,
  getPreviousMonth,
  type MonthSummary,
} from '@/features/transactions/month-summary';
import { qk } from '@/lib/query-keys';

/**
 * @param year Calendar year.
 * @param month Month, 1-12.
 * @param transactions The month's rows, already loaded by the list.
 * @returns The summary, or null until the comparison data has loaded.
 */
export function useMonthSummary(
  year: number,
  month: number,
  transactions: readonly Transaction[],
): MonthSummary | null {
  const previous = getPreviousMonth(year, month);

  const previousMonth = useQuery({
    queryKey: qk.month(previous.year, previous.month),
    queryFn: () => fetchMonthTransactions(previous.year, previous.month),
  });
  const splitSources = useQuery({
    queryKey: qk.splitSources(year),
    queryFn: () => fetchSplitSources(year),
  });
  const previousSplitSources = useQuery({
    queryKey: qk.splitSources(previous.year),
    queryFn: () => fetchSplitSources(previous.year),
  });

  return useMemo(() => {
    if (!previousMonth.data || !splitSources.data || !previousSplitSources.data) return null;

    return computeMonthSummary({
      year,
      month,
      transactions,
      previousMonthTransactions: previousMonth.data,
      splitSources: splitSources.data,
      previousSplitSources: previousSplitSources.data,
    });
  }, [year, month, transactions, previousMonth.data, splitSources.data, previousSplitSources.data]);
}
