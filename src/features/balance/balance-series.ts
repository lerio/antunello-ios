/**
 * The balance chart's series.
 *
 * Ported from the web app's `useAnchoredBalanceHistory`, with the pure half
 * extracted so it can be tested without rendering — the web app keeps all of
 * this inside the hook.
 *
 * ## Why the series is walked backwards
 *
 * The last point is *set* to the Balance card's total, and every earlier point
 * is derived by subtracting what happened since:
 *
 *   balance(B) = anchor − Σ net(tx) where B < tx.date ≤ today
 *
 * Walking forwards from an opening balance would accumulate every rounding and
 * conversion error the database has ever seen, and the chart's final point would
 * drift from the card beside it. Walking backwards makes the two agree by
 * construction — the card and the chart cannot disagree, because the chart is
 * defined in terms of the card.
 *
 * ## The dotted overlay
 *
 * Split-across-year transactions are booked in full on their source date in the
 * real series. The second series subtracts a per-bucket accrual adjustment, so
 * it shows what the balance would look like if each split were accrued month by
 * month instead. The two lines coincide outside a split's window and diverge
 * only while one is being accrued.
 */

import { expandSplitTransactionsForYear } from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';
import type { TimeRange } from '@/lib/query-keys';

export type AnchoredDataPoint = {
  /** `YYYY-MM-DD`, the bucket's start. */
  date: string;
  balance: number;
  income: number;
  expense: number;
  transactionCount: number;
  /** The split-adjusted figure, or null where it does not differ. */
  splitAdjustedBalance: number | null;
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

/** Parses `YYYY-MM-DD` as UTC midnight, so buckets do not shift by timezone. */
function parseUtcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

/** The subset of a transaction the series needs. */
type SeriesRow = {
  date: string;
  type: 'expense' | 'income';
  eur_amount: number | null;
  split_display_eur_amount: number | null;
  is_money_transfer: boolean | null;
};

function toSeriesRow(tx: Transaction): SeriesRow {
  return {
    date: tx.date,
    type: tx.type,
    eur_amount: tx.eur_amount ?? null,
    split_display_eur_amount: tx.split_display_eur_amount ?? null,
    is_money_transfer: tx.is_money_transfer ?? null,
  };
}

/**
 * The start of the bucket containing a date.
 *
 * Daily buckets for the short ranges, week-starting-Monday for 5y, and
 * month-start for "all" — so a long range does not try to draw a point per day.
 */
function getBucketStart(date: Date, timeRange: TimeRange): Date {
  const result = new Date(date);
  result.setUTCHours(0, 0, 0, 0);

  if (timeRange === '5y') {
    const day = result.getUTCDay();
    result.setUTCDate(result.getUTCDate() + (day === 0 ? -6 : 1 - day));
  } else if (timeRange === 'all') {
    result.setUTCDate(1);
  }

  return result;
}

function addBucket(date: Date, timeRange: TimeRange): Date {
  const result = new Date(date);
  if (timeRange === '5y') result.setUTCDate(result.getUTCDate() + 7);
  else if (timeRange === 'all') result.setUTCMonth(result.getUTCMonth() + 1);
  else result.setUTCDate(result.getUTCDate() + 1);
  return result;
}

function getBucketKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * The index of the bucket a date falls in, computed by arithmetic rather than
 * by scanning the grid.
 */
function getBucketIndex(txDate: Date, start: Date, timeRange: TimeRange): number {
  const txBucketStart = getBucketStart(txDate, timeRange);
  const diffMs = txBucketStart.getTime() - start.getTime();

  if (timeRange === '5y') return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  if (timeRange === 'all') {
    return (
      (txDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
      (txDate.getUTCMonth() - start.getUTCMonth())
    );
  }
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

/** A split instance's slice when it has one, otherwise the transaction's EUR amount. */
function getAmount(tx: SeriesRow): number {
  return tx.split_display_eur_amount ?? (tx.eur_amount as number);
}

function signedAmount(tx: SeriesRow): number {
  return (tx.type === 'income' ? 1 : -1) * getAmount(tx);
}

/** Whether a row carries a usable EUR figure at all. */
function hasEurAmount(tx: SeriesRow): boolean {
  return tx.split_display_eur_amount !== null || tx.eur_amount !== null;
}

/**
 * Transactions that belong in the series.
 *
 * Money transfers are excluded — they move money between the user's own funds,
 * so the total is unchanged and including them would count the same money twice.
 * Rows with no EUR amount cannot be summed, so they are dropped.
 *
 * **Hidden rows are kept.** The Balance card has no `hide_from_totals` filter,
 * so excluding them here would make the chart disagree with the card it is
 * anchored to.
 */
function filterSeriesTransactions(transactions: SeriesRow[]): SeriesRow[] {
  return transactions.filter((tx) => !tx.is_money_transfer && hasEurAmount(tx));
}

/**
 * Per-bucket accrual adjustments for split-across-year transactions.
 *
 * For each split source, the difference between booking it in full on its source
 * date and accruing it across its twelve-month window. Once a source is fully
 * accrued the adjustment returns to zero, so the dotted line rejoins the solid
 * one.
 */
function buildSplitAdjustments(
  transactions: Transaction[],
  bucketCount: number,
  start: Date,
  timeRange: TimeRange,
  now: Date,
): number[] {
  const adjust = new Array<number>(bucketCount).fill(0);

  const splitSources = transactions.filter((t) => t.split_across_year && !t.is_money_transfer);
  if (splitSources.length === 0) return adjust;

  const nowYear = now.getUTCFullYear();

  for (const source of splitSources) {
    const sourceRow = toSeriesRow(source);
    // Match the real series, which drops splits with no usable EUR amount.
    if (!hasEurAmount(sourceRow)) continue;

    const signedFull = signedAmount(sourceRow);

    // Expand the source's rolling window over every year it can reach. The
    // original-month instance is included, returned by the expander as the
    // source row carrying a split display amount.
    const sourceYear = new Date(source.date).getUTCFullYear();
    const instances: { idx: number; signed: number }[] = [];

    for (let year = sourceYear; year <= nowYear; year += 1) {
      for (const instance of expandSplitTransactionsForYear([source], year, now)) {
        const row = toSeriesRow(instance);
        if (!hasEurAmount(row)) continue;

        const idx = getBucketIndex(new Date(instance.date), start, timeRange);
        if (idx >= bucketCount) continue;

        instances.push({ idx, signed: signedAmount(row) });
      }
    }

    instances.sort((a, b) => a.idx - b.idx);

    const sourceIdx = getBucketIndex(new Date(source.date), start, timeRange);

    // Instances before the window have already accrued for every bucket in it.
    let accrued = 0;
    let cursor = 0;
    while (cursor < instances.length && instances[cursor].idx < 0) {
      accrued += instances[cursor].signed;
      cursor += 1;
    }

    // From the source's bucket onward, the adjustment is whatever is not yet
    // accrued. Before it, the two series agree.
    for (let i = Math.max(0, sourceIdx); i < bucketCount; i += 1) {
      while (cursor < instances.length && instances[cursor].idx <= i) {
        accrued += instances[cursor].signed;
        cursor += 1;
      }
      adjust[i] += signedFull - accrued;
    }
  }

  return adjust;
}

/**
 * Builds the two series.
 *
 * @param transactions Transactions covering the window, split instances expanded.
 * @param windowStart `YYYY-MM-DD` the chart starts at.
 * @param windowEnd `YYYY-MM-DD` the chart ends at.
 * @param anchor The Balance card's total, which the last point is set to.
 * @param timeRange The selected range, which decides bucket granularity.
 * @param now Reference time for deciding which split instances have happened.
 * @returns One point per bucket.
 */
export function buildAnchoredSeries(
  transactions: Transaction[],
  windowStart: string,
  windowEnd: string,
  anchor: number,
  timeRange: TimeRange,
  now: Date = new Date(),
): AnchoredDataPoint[] {
  const filtered = filterSeriesTransactions(transactions.map(toSeriesRow));

  const start = getBucketStart(parseUtcDate(windowStart), timeRange);
  const end = getBucketStart(parseUtcDate(windowEnd), timeRange);

  const bucketKeys: string[] = [];
  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = addBucket(current, timeRange)
  ) {
    bucketKeys.push(getBucketKey(current));
  }

  const bucketCount = bucketKeys.length;
  if (bucketCount === 0) return [];

  const net = new Array<number>(bucketCount).fill(0);
  const income = new Array<number>(bucketCount).fill(0);
  const expense = new Array<number>(bucketCount).fill(0);
  const count = new Array<number>(bucketCount).fill(0);

  for (const tx of filtered) {
    const idx = getBucketIndex(new Date(tx.date), start, timeRange);
    if (idx < 0 || idx >= bucketCount) continue;

    const amount = getAmount(tx);
    if (tx.type === 'income') {
      net[idx] += amount;
      income[idx] += amount;
    } else {
      net[idx] -= amount;
      expense[idx] += amount;
    }
    count[idx] += 1;
  }

  // The backwards walk. Setting the last point to the anchor is what makes the
  // chart's end agree with the Balance card.
  const balance = new Array<number>(bucketCount);
  balance[bucketCount - 1] = anchor;
  for (let i = bucketCount - 2; i >= 0; i -= 1) {
    balance[i] = balance[i + 1] - net[i + 1];
  }

  const adjustments = buildSplitAdjustments(transactions, bucketCount, start, timeRange, now);

  return bucketKeys.map((date, i) => ({
    date,
    balance: balance[i],
    income: income[i],
    expense: expense[i],
    transactionCount: count[i],
    // Below half a cent the two series are the same number, so the overlay is
    // suppressed rather than drawn on top of the solid line.
    splitAdjustedBalance:
      Math.abs(adjustments[i]) > 0.005 ? balance[i] - adjustments[i] : null,
  }));
}
