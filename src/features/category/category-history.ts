/**
 * Category spending over time, bucketed for the bar chart.
 *
 * Ported from the web app's `useCategoryHistory`. The bucket granularity changes
 * with the range — daily for a month, monthly for a year, yearly beyond that —
 * so a long range does not try to draw hundreds of bars.
 *
 * Two quirks are reproduced deliberately rather than tidied:
 *
 *  - **Every bucket in the grid is pre-seeded at zero.** A month with no
 *    spending renders as an empty bar rather than being skipped, so the chart
 *    shows a gap in spending instead of silently compressing time.
 *  - **Keys are built from UTC for `1m` but from local time for the rest.** That
 *    inconsistency is the web app's, and "fixing" it would move transactions
 *    between buckets. See PARITY.md.
 */

import type { Transaction } from '@/domain/types';
import type { TimeRange } from '@/lib/query-keys';

export type CategoryDataPoint = {
  /** `YYYY-MM-DD` marking the bucket's start. */
  date: string;
  amount: number;
  transactionCount: number;
};

export type CategoryStats = {
  totalAmount: number;
  totalTransactions: number;
  dataPoints: CategoryDataPoint[];
};

/** The bucket a date belongs to, as a key. */
function getPeriodKey(date: Date, timeRange: TimeRange): string {
  switch (timeRange) {
    case '1m':
      // UTC, matching the web app — unlike the other cases below.
      return date.toISOString().split('T')[0];
    case '1y':
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    default:
      // 5y and all bucket by year.
      return `${date.getFullYear()}-01-01`;
  }
}

/**
 * Builds the bucket grid for a range.
 *
 * @param timeRange The selected range.
 * @param earliestDate The earliest transaction, used to bound the "all" range.
 * @param now Reference date.
 * @returns Keys in chronological order, each seeded at zero.
 */
function buildBuckets(
  timeRange: TimeRange,
  earliestDate: string | null,
  now: Date,
): Map<string, CategoryDataPoint> {
  const periods = new Map<string, CategoryDataPoint>();
  const seed = (key: string) => periods.set(key, { date: key, amount: 0, transactionCount: 0 });

  if (timeRange === '1m') {
    const start = new Date(now);
    start.setDate(now.getDate() - 30);
    for (const day = new Date(start); day <= now; day.setDate(day.getDate() + 1)) {
      seed(day.toISOString().split('T')[0]);
    }
    return periods;
  }

  if (timeRange === '1y') {
    // Twelve months ending with the current one. The web app reaches this by
    // stepping a year back and then a month forward, which lands on the first of
    // the month eleven months ago.
    const start = new Date(now);
    start.setFullYear(now.getFullYear() - 1);
    start.setMonth(now.getMonth() + 1);
    start.setDate(1);

    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    for (const month = new Date(start); month <= end; month.setMonth(month.getMonth() + 1)) {
      seed(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`);
    }
    return periods;
  }

  if (timeRange === '5y') {
    for (let year = now.getFullYear() - 4; year <= now.getFullYear(); year += 1) {
      seed(`${year}-01-01`);
    }
    return periods;
  }

  // "all": from the earliest transaction's year, so a chart of everything starts
  // where the data does rather than stretching back to the beginning of time.
  if (earliestDate) {
    const firstYear = new Date(earliestDate).getFullYear();
    for (let year = firstYear; year <= now.getFullYear(); year += 1) {
      seed(`${year}-01-01`);
    }
  }

  return periods;
}

/**
 * Buckets a category's transactions for the bar chart.
 *
 * @param transactions The category's transactions for the range.
 * @param timeRange The selected range.
 * @param now Reference date.
 * @returns Totals and one entry per bucket, gaps included as zeros.
 */
export function calculateCategoryHistory(
  transactions: readonly Transaction[],
  timeRange: TimeRange,
  now: Date = new Date(),
): CategoryStats {
  // Hidden rows are excluded, and so is anything without a EUR amount — neither
  // can be charted as spending.
  const filtered = transactions.filter(
    (transaction) =>
      !transaction.hide_from_totals &&
      transaction.eur_amount !== null &&
      transaction.eur_amount !== undefined,
  );

  let earliest: string | null = null;
  for (const transaction of filtered) {
    if (!earliest || transaction.date < earliest) earliest = transaction.date;
  }

  const periods = buildBuckets(timeRange, earliest, now);

  let totalAmount = 0;
  let totalTransactions = 0;

  for (const transaction of filtered) {
    const key = getPeriodKey(new Date(transaction.date), timeRange);
    const bucket = periods.get(key);

    // A transaction outside the grid — before the earliest bucket, or from a
    // future-dated row — is counted in the totals but has no bar to sit in.
    const amount = transaction.eur_amount ?? 0;
    totalAmount += amount;
    totalTransactions += 1;

    if (!bucket) continue;
    bucket.amount += amount;
    bucket.transactionCount += 1;
  }

  return {
    totalAmount,
    totalTransactions,
    dataPoints: [...periods.values()],
  };
}
