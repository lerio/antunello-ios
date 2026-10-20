/**
 * The data behind the balance chart.
 *
 * The buckets come from the `get_net_worth_series` RPC, shared with the web
 * app, and are anchored to the Balance card's total here: the RPC returns each
 * bucket's change, so walking backwards from today's total makes the chart's
 * last point *be* the card's figure rather than merely near it.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  anchorDeltas,
  getStartDateForTimeRange,
  type AnchoredDataPoint,
} from '@/features/balance/balance-series';
import { qk, type TimeRange } from '@/lib/query-keys';
import { supabase } from '@/lib/supabase';

/** Bucket width per range: enough shape to read, no more rows than needed. */
const BUCKET_BY_RANGE: Record<TimeRange, 'day' | 'week' | 'month'> = {
  '1m': 'day',
  '1y': 'week',
  '5y': 'month',
  all: 'month',
};

type NetWorthRow = {
  bucket_start: string;
  delta: number;
};

/** The device's IANA timezone, so month boundaries match what the user sees. */
function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

async function fetchSeries(timeRange: TimeRange): Promise<{ date: string; delta: number }[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const userId = session?.user.id;
  if (!userId) return [];

  const { data, error } = await supabase.rpc('get_net_worth_series', {
    p_user_id: userId,
    // Any date identifies the window; "all" needs a concrete lower bound.
    p_from: getStartDateForTimeRange(timeRange) ?? '1900-01-01',
    p_bucket: BUCKET_BY_RANGE[timeRange],
    p_tz: deviceTimeZone(),
  });

  if (error) throw error;

  return ((data ?? []) as NetWorthRow[]).map((row) => ({
    date: row.bucket_start,
    delta: Number(row.delta) || 0,
  }));
}

/**
 * The anchored balance series for a range.
 *
 * @param timeRange The selected range, which sets both the window and the
 *   bucket granularity.
 * @param anchor The Balance card's total. The series' last point is set to it,
 *   so the two can never disagree.
 * @returns The series points, and whether the first load is still in flight.
 */
export function useBalanceHistory(timeRange: TimeRange, anchor: number) {
  const query = useQuery({
    queryKey: qk.anchored(timeRange),
    queryFn: () => fetchSeries(timeRange),
    // The chart covers years of history; refetching on every mount would be
    // wasteful when a transaction write already invalidates this key.
    staleTime: 5 * 60 * 1000,
  });

  // Switching range changes the key, but the client is configured to keep the
  // previous data while the new query runs. Building a line from that would
  // draw a plausible-looking series for the wrong window.
  const hasOwnData = Boolean(query.data) && !query.isPlaceholderData;

  const points = useMemo<AnchoredDataPoint[]>(
    () => (hasOwnData ? anchorDeltas(query.data!, anchor) : []),
    [hasOwnData, query.data, anchor],
  );

  return {
    points,
    // A failure has no own data either, so `!hasOwnData` alone would report a
    // permanent load and the error branch could never render.
    isLoading: query.isLoading || (!hasOwnData && !query.error),
    error: query.error,
  };
}
