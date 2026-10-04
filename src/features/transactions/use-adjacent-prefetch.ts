/**
 * Warms the cache for the periods either side of the one on screen.
 *
 * The web app prefetches adjacent months and years so paging through the strip
 * is instant; this does the same. `prefetchQuery` is a no-op for data that is
 * still fresh, so calling it on every change of period costs nothing when the
 * neighbour is already loaded — which, for the previous month, it usually is.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { fetchMonthTransactions, fetchYearTransactions } from '@/features/transactions/queries';
import { qk } from '@/lib/query-keys';

/**
 * @param year Calendar year on screen.
 * @param month Month on screen, 1-12.
 * @param ready Whether the visible month has finished loading. Neighbours wait
 *   for it so they never compete with the data the user is actually looking at.
 */
export function usePrefetchAdjacentMonths(year: number, month: number, ready: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;

    const neighbours = [
      month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
      month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
    ];

    for (const target of neighbours) {
      void queryClient.prefetchQuery({
        queryKey: qk.month(target.year, target.month),
        queryFn: () => fetchMonthTransactions(target.year, target.month),
      });
    }
  }, [queryClient, year, month, ready]);
}

/**
 * Years are heavier than months, so only the ones the year view can actually
 * navigate to are fetched: the next year (never beyond the current one, which
 * would be empty), and the one before the previous year, which paging back
 * will compare against.
 *
 * @param year Year on screen.
 * @param ready Whether the visible year has finished loading.
 */
export function usePrefetchAdjacentYears(year: number, ready: boolean): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!ready) return;

    const currentYear = new Date().getFullYear();
    const neighbours = [year + 1, year - 2].filter((target) => target <= currentYear);

    for (const target of neighbours) {
      void queryClient.prefetchQuery({
        queryKey: qk.year(target),
        queryFn: () => fetchYearTransactions(target),
      });
    }
  }, [queryClient, year, ready]);
}
