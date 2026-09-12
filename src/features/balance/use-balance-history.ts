/**
 * The data behind the balance chart.
 *
 * Fetches the transactions the series needs and builds the anchored series
 * against the Balance card's total. Ported from the web app's
 * `useAnchoredBalanceHistory`, minus its SWR wiring.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { fetchAllBatches } from '@/domain/fetch-all';
import type { Transaction } from '@/domain/types';
import {
  buildAnchoredSeries,
  getStartDateForTimeRange,
  type AnchoredDataPoint,
} from '@/features/balance/balance-series';
import { getComparisonWindows30 } from '@/features/balance/comparison-windows';
import { qk, type TimeRange } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/**
 * Only the columns the series reads.
 *
 * The chart is the widest query in the app — a five-year range is thousands of
 * rows — so pulling full rows would transfer a great deal the series discards.
 */
const SERIES_COLUMNS =
  'id, amount, currency, type, date, eur_amount, hide_from_totals, is_money_transfer, split_across_year';

/**
 * The shape a slim query actually returns.
 *
 * Only the series columns are selected, so rows are narrower than a full
 * `Transaction`. The web app casts back to `Transaction` for the same reason:
 * the split expanders are typed against the full row even though they read only
 * these fields.
 */
type SeriesTransactionRow = Pick<
  Transaction,
  | 'id'
  | 'amount'
  | 'currency'
  | 'type'
  | 'date'
  | 'eur_amount'
  | 'hide_from_totals'
  | 'is_money_transfer'
  | 'split_across_year'
>;

/**
 * Where a range begins, or null for "everything".
 *
 * `1m` deliberately uses the comparison window rather than the range helper:
 * those differ by a day (29 days back versus 30), and the chart is meant to line
 * up with the 30-day tables beneath it.
 */
function startForRange(timeRange: TimeRange): string | null {
  return timeRange === '1m'
    ? getComparisonWindows30().current.start
    : getStartDateForTimeRange(timeRange);
}

async function fetchSeriesTransactions(timeRange: TimeRange): Promise<Transaction[]> {
  const now = new Date().toISOString();
  const startDate = startForRange(timeRange);

  // The lower bound is always applied — an epoch date when the range is
  // unbounded. Branching instead would make the builder a union type, which the
  // paginating helper cannot accept.
  const lowerBound = startDate ?? '1900-01-01T00:00:00.000Z';

  const inWindow = (await fetchAllBatches<SeriesTransactionRow>((from, to) =>
    supabase
      .from('transactions')
      .select(SERIES_COLUMNS)
      .gte('date', lowerBound)
      .lte('date', now)
      .order('date', { ascending: true })
      .range(from, to),
  )) as unknown as Transaction[];

  // Splits that began before the window still accrue inside it, so their
  // sources are needed to draw the dotted line's early buckets.
  const olderSplits = startDate
    ? ((await fetchAllBatches<SeriesTransactionRow>((from, to) =>
        supabase
          .from('transactions')
          .select(SERIES_COLUMNS)
          .eq('split_across_year', true)
          .lt('date', startDate)
          .lte('date', now)
          .order('date', { ascending: true })
          .range(from, to),
      )) as unknown as Transaction[])
    : [];

  return [...olderSplits, ...inWindow];
}

/**
 * The anchored balance series for a range.
 *
 * @param timeRange The selected range, which sets both the window and the
 *   bucket granularity.
 * @param anchor The Balance card's total. The series' last point is set to it,
 *   so the two can never disagree. Passed in rather than fetched, because the
 *   card already has it.
 * @returns The series points, and whether the first load is still in flight.
 */
export function useBalanceHistory(timeRange: TimeRange, anchor: number) {
  const query = useQuery({
    queryKey: qk.anchored(timeRange),
    queryFn: () => fetchSeriesTransactions(timeRange),
    // The chart covers years of history; refetching on every mount would be
    // wasteful when a transaction write already invalidates this key.
    staleTime: 5 * 60 * 1000,
  });

  const points = useMemo<AnchoredDataPoint[]>(() => {
    if (!query.data) return [];

    const windows = getComparisonWindows30();
    const windowStart =
      timeRange === '1m' ? windows.current.start : (startForRange(timeRange) ?? earliest(query.data));
    if (!windowStart) return [];

    return buildAnchoredSeries(
      query.data,
      windowStart,
      new Date().toISOString().split('T')[0],
      anchor,
      timeRange,
    );
  }, [query.data, timeRange, anchor]);

  return { points, isLoading: query.isLoading, error: query.error };
}

/** The earliest transaction date, for the "all" range which has no start. */
function earliest(transactions: Transaction[]): string | null {
  let earliest: string | null = null;

  for (const transaction of transactions) {
    const day = transaction.date.split('T')[0];
    if (!earliest || day < earliest) earliest = day;
  }

  return earliest;
}
