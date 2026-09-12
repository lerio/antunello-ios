/**
 * The three 30-day windows the dashboard compares.
 *
 * Fetches each window separately rather than one large range: the windows are
 * not contiguous (last year's is a year back), and three keys let each be
 * cached and refetched on its own.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { Transaction } from '@/domain/types';
import { getComparisonWindows30 } from '@/features/balance/comparison-windows';
import { buildComparison, type DashboardComparison } from '@/features/dashboard/dashboard-totals';
import { fetchRangeTransactions } from '@/features/transactions/queries';
import { qk } from '@/lib/query-keys';

export type DashboardPeriod = {
  transactions: Transaction[];
  label: string;
  start: string;
  end: string;
};

type DashboardComparisonResult = {
  comparison: DashboardComparison;
  /** Raw transactions per period, for the tables' drill-downs. */
  periods: {
    current: DashboardPeriod;
    previous: DashboardPeriod;
    lastYear: DashboardPeriod;
  };
  isLoading: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
};

/** The labels the table headers use. */
const LABELS = {
  current: 'Last 30',
  previous: 'Prev 30d',
  lastYear: 'vs Last Year',
} as const;


/**
 * Loads all three windows and totals them.
 *
 * The windows are computed once on mount. They depend on today's date, which
 * does not change meaningfully during a session, and recomputing would change
 * the query keys and refetch everything.
 */
export function useDashboardComparison(): DashboardComparisonResult {
  const windows = useMemo(() => getComparisonWindows30(), []);

  const current = useQuery({
    queryKey: qk.range(windows.current.start, windows.current.end),
    queryFn: () => fetchRangeTransactions(windows.current.start, windows.current.end),
  });

  const previous = useQuery({
    queryKey: qk.range(windows.prev.start, windows.prev.end),
    queryFn: () => fetchRangeTransactions(windows.prev.start, windows.prev.end),
  });

  const lastYear = useQuery({
    queryKey: qk.range(windows.lastYear.start, windows.lastYear.end),
    queryFn: () => fetchRangeTransactions(windows.lastYear.start, windows.lastYear.end),
  });

  const comparison = useMemo(
    () =>
      buildComparison({
        current: current.data ?? [],
        previous: previous.data ?? [],
        lastYear: lastYear.data ?? [],
      }),
    [current.data, previous.data, lastYear.data],
  );

  return {
    comparison,
    periods: {
      current: {
        transactions: asRows(current.data),
        label: LABELS.current,
        start: windows.current.start,
        end: windows.current.end,
      },
      previous: {
        transactions: asRows(previous.data),
        label: LABELS.previous,
        start: windows.prev.start,
        end: windows.prev.end,
      },
      lastYear: {
        transactions: asRows(lastYear.data),
        label: LABELS.lastYear,
        start: windows.lastYear.start,
        end: windows.lastYear.end,
      },
    },
    // A period still showing its predecessor's rows would total the wrong
    // window — the range decides how the rows are read, not just which they
    // are — so placeholders count as loading.
    isLoading:
      current.isLoading ||
      previous.isLoading ||
      lastYear.isLoading ||
      current.isPlaceholderData ||
      previous.isPlaceholderData ||
      lastYear.isPlaceholderData,
    isError: current.isError || previous.isError || lastYear.isError,
    refresh: async () => {
      await Promise.all([current.refetch(), previous.refetch(), lastYear.refetch()]);
    },
  };
}

/** Narrows a possibly-undefined query result to an array. */
function asRows(data: Transaction[] | undefined): Transaction[] {
  return data ?? [];
}
