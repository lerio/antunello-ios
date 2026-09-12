/**
 * The year's transactions, and the summary computed from them.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchYearTransactions } from '@/features/transactions/queries';
import {
  computeYearTotals,
  filterToLastCompleteMonth,
  lastCompleteMonth,
  type YearTotals,
} from '@/features/year/year-summary';
import { qk } from '@/lib/query-keys';

type YearView = {
  /** Totals for the selected year, up to its last complete month. */
  totals: YearTotals;
  /** Totals for the previous year, over the same months. */
  previousTotals: YearTotals;
  /** Index of the last complete month, or -1 when none has finished. */
  lastCompleteMonthIndex: number;
  /** How many months the comparison covers, for the averages. */
  monthsCovered: number;
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
};

const EMPTY_TOTALS: YearTotals = {
  expenseTotal: 0,
  incomeTotal: 0,
  incomeCategoryTotals: {},
  expenseCategoryTotals: {},
  hiddenExpenseTotal: 0,
};

/**
 * Loads a year and the one before it, and totals both over the same months.
 *
 * The previous year is fetched so the summary can compare like for like. It is
 * filtered to the same last-complete-month as the selected year — comparing
 * eight months of this year against twelve of last year would make every year in
 * progress look worse than its predecessor, which is the opposite of
 * informative.
 *
 * @param year The year to summarise.
 */
export function useYearTransactions(year: number): YearView {
  const current = useQuery({
    queryKey: qk.year(year),
    queryFn: () => fetchYearTransactions(year),
  });

  const previous = useQuery({
    queryKey: qk.year(year - 1),
    queryFn: () => fetchYearTransactions(year - 1),
  });

  const lastCompleteMonthIndex = useMemo(() => lastCompleteMonth(year), [year]);

  const totals = useMemo(
    () =>
      current.data
        ? computeYearTotals(filterToLastCompleteMonth(current.data, lastCompleteMonthIndex))
        : EMPTY_TOTALS,
    [current.data, lastCompleteMonthIndex],
  );

  const previousTotals = useMemo(
    () =>
      previous.data
        ? computeYearTotals(filterToLastCompleteMonth(previous.data, lastCompleteMonthIndex))
        : EMPTY_TOTALS,
    [previous.data, lastCompleteMonthIndex],
  );

  return {
    totals,
    previousTotals,
    lastCompleteMonthIndex,
    monthsCovered: Math.max(0, lastCompleteMonthIndex + 1),
    // A year still showing the other year's rows would total the wrong span, so
    // placeholders count as loading.
    isLoading: current.isLoading || previous.isLoading || current.isPlaceholderData,
    isError: current.isError || previous.isError,
    refresh: async () => {
      await Promise.all([current.refetch(), previous.refetch()]);
    },
  };
}
