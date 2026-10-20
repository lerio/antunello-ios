/**
 * The balance chart's series.
 *
 * The database returns each bucket's change; anchoring walks backwards from
 * today's total so the chart's last point *is* the total printed above it,
 * rather than a figure that happens to be near it. Walking forwards from an
 * opening balance would accumulate every rounding and conversion error, and the
 * two figures would drift apart.
 */

import type { TimeRange } from '@/lib/query-keys';

export type AnchoredDataPoint = {
  /** `YYYY-MM-DD`, the bucket's start. */
  date: string;
  balance: number;
};

/**
 * How far back each range reaches, or null for "everything".
 *
 * @param timeRange The selected range.
 * @returns A `YYYY-MM-DD` start date, or null.
 */
export function getStartDateForTimeRange(timeRange: TimeRange): string | null {
  const daysAgo =
    timeRange === '1m' ? 30
    : timeRange === '1y' ? 365
    : timeRange === '5y' ? 5 * 365
    : null;

  if (daysAgo === null) return null;

  const start = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  return start.toISOString().split('T')[0];
}

/**
 * Anchors per-bucket deltas to the current total.
 *
 * @param buckets Buckets ordered oldest first, each with its change.
 * @param anchor The current total.
 * @returns One point per bucket, oldest first.
 */
export function anchorDeltas(
  buckets: readonly { date: string; delta: number }[],
  anchor: number,
): AnchoredDataPoint[] {
  const points: AnchoredDataPoint[] = [];
  let running = anchor;

  for (let index = buckets.length - 1; index >= 0; index -= 1) {
    points[index] = { date: buckets[index].date, balance: running };
    running -= buckets[index].delta;
  }

  return points;
}
