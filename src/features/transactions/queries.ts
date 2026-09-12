/**
 * Transaction fetchers.
 *
 * These mirror the web app's `transaction-fetcher`, `year-fetcher` and
 * `split-sources-fetcher`, minus their caching machinery — the web app layers an
 * LRU cache, in-flight deduplication and SWR on top; here TanStack Query owns
 * all of that, so these are plain async functions.
 *
 * ## Period boundaries are not consistent, and that is deliberate
 *
 * The web app uses **three different conventions**, and this port preserves
 * each exactly:
 *
 * | Fetcher | Boundary |
 * |---|---|
 * | month | local time — `new Date(year, month - 1, 1)` |
 * | year | CET — `Date.UTC(year, 0, 1, -1, 0, 0, 0)` is Dec 31 23:00 UTC |
 * | split sources | UTC — `${year}-01-01T00:00:00.000Z` |
 *
 * This is an inconsistency rather than a design, but "fixing" it would move
 * transactions between periods and make the two apps disagree about the same
 * month. A phone that changes timezone may therefore place an edge-of-month
 * transaction differently from the web app — an accepted divergence, recorded
 * in PARITY.md.
 */

import { fetchAllBatches } from '@/domain/fetch-all';
import {
  expandSplitTransactionsForMonth,
  expandSplitTransactionsForYear,
} from '@/domain/split-transactions';
import { sortTransactionsByDateInPlace } from '@/domain/transaction-utils';
import type { Transaction } from '@/domain/types';
import { supabase } from '@/lib/supabase';

/** Postgres error code for an undefined column — see `fetchSplitSources`. */
const UNDEFINED_COLUMN = '42703';

/**
 * Fetches split-across-year transactions for a year **and the year before it**.
 *
 * Split windows roll forward from each source's own month, so a November 2025
 * source can still be contributing as late as October 2026. Both years are
 * fetched so a window is never truncated at a year boundary.
 *
 * Degrades to an empty array if the `split_across_year` column does not exist,
 * matching the web app — split support was once an optional migration, and a
 * missing column should mean "no splits" rather than a broken month view.
 *
 * @param year The year to fetch sources for.
 * @returns Split-source transactions from `year` and `year - 1`.
 */
export async function fetchSplitSources(year: number): Promise<Transaction[]> {
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year}-12-31T23:59:59.999Z`;
  const prevStart = `${year - 1}-01-01T00:00:00.000Z`;
  const prevEnd = `${year - 1}-12-31T23:59:59.999Z`;

  const [current, previous] = await Promise.all([
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .range(0, 9999),
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', prevStart)
      .lte('date', prevEnd)
      .range(0, 9999),
  ]);

  const error = current.error ?? previous.error;
  if (error) {
    const message = (error.message ?? '').toLowerCase();
    if (error.code === UNDEFINED_COLUMN || message.includes('split_across_year')) {
      return [];
    }
    throw error;
  }

  return [...(current.data ?? []), ...(previous.data ?? [])] as Transaction[];
}

/**
 * Only the columns the dashboard summaries and split expansion read.
 *
 * A 30-day window is fetched three times over for the comparison tables, so
 * pulling full rows would triple a payload that is almost entirely discarded.
 */
const RANGE_COLUMNS =
  'id, amount, currency, type, main_category, sub_category, date, eur_amount, hide_from_totals, is_money_transfer, split_across_year';

type RangeRow = Pick<
  Transaction,
  | 'id'
  | 'amount'
  | 'currency'
  | 'type'
  | 'main_category'
  | 'sub_category'
  | 'date'
  | 'eur_amount'
  | 'hide_from_totals'
  | 'is_money_transfer'
  | 'split_across_year'
>;

/**
 * Fetches transactions within an arbitrary date range, with split instances
 * expanded into it.
 *
 * The range is inclusive of `start` and of `end`, expressed as a half-open
 * interval internally so a transaction late on the final day is not lost to a
 * boundary comparison.
 *
 * Split sources are fetched from a **year either side** of the range. A split's
 * rolling window runs twelve months from its own month, so a source from the
 * year before can still be contributing to the range's first days, and the extra
 * year forward costs nothing while guaranteeing nothing is missed.
 *
 * @param start `YYYY-MM-DD`, inclusive.
 * @param end `YYYY-MM-DD`, inclusive.
 * @returns Transactions in the range, newest first.
 */
export async function fetchRangeTransactions(
  start: string,
  end: string,
): Promise<Transaction[]> {
  const rangeStart = new Date(`${start}T00:00:00.000Z`);
  const rangeEndExclusive = new Date(`${end}T00:00:00.000Z`);
  rangeEndExclusive.setUTCDate(rangeEndExclusive.getUTCDate() + 1);

  const rangeStartIso = rangeStart.toISOString();
  const rangeEndExclusiveIso = rangeEndExclusive.toISOString();

  const rows = (await fetchAllBatches<RangeRow>((from, to) =>
    supabase
      .from('transactions')
      .select(RANGE_COLUMNS)
      .gte('date', rangeStartIso)
      .lt('date', rangeEndExclusiveIso)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  )) as unknown as Transaction[];

  // Split sources appear in the range as instances rather than as themselves,
  // so they are held back and re-added below.
  const regular = rows.filter((row) => !row.split_across_year);

  const startYear = rangeStart.getUTCFullYear();
  const endYear = rangeEndExclusive.getUTCFullYear();

  const splitSources = (await fetchAllBatches<RangeRow>((from, to) =>
    supabase
      .from('transactions')
      .select(RANGE_COLUMNS)
      .eq('split_across_year', true)
      .gte('date', `${startYear - 1}-01-01T00:00:00.000Z`)
      .lt('date', `${endYear + 1}-01-01T00:00:00.000Z`)
      .order('date', { ascending: false })
      .range(from, to),
  )) as unknown as Transaction[];

  // Expanded a year at a time: an instance is generated for whatever year is
  // asked for, and each source belongs to exactly one.
  const sourcesByYear = new Map<number, Transaction[]>();
  for (const source of splitSources) {
    const year = new Date(source.date).getUTCFullYear();
    const bucket = sourcesByYear.get(year);
    if (bucket) bucket.push(source);
    else sourcesByYear.set(year, [source]);
  }

  const now = new Date();
  const expanded: Transaction[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    const yearSplits = sourcesByYear.get(year);
    if (!yearSplits?.length) continue;
    expanded.push(...expandSplitTransactionsForYear(yearSplits, year, now));
  }

  // Only the instances that actually land inside the range.
  const startMs = rangeStart.getTime();
  const endMs = rangeEndExclusive.getTime();
  const inRange = expanded.filter((instance) => {
    const at = new Date(instance.date).getTime();
    return at >= startMs && at < endMs;
  });

  return sortTransactionsByDateInPlace([...regular, ...inRange]);
}

/**
 * Fetches a single transaction by id.
 *
 * Used by the edit screen, which may be opened directly — from a notification,
 * a deep link, or a cold start — so it cannot assume the row is in a cache.
 *
 * @param id The transaction id.
 * @returns The transaction, or null if it does not exist or is not visible.
 */
export async function fetchTransaction(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return (data as Transaction) ?? null;
}

/**
 * Fetches one month of transactions with split instances expanded into it.
 *
 * @param year The calendar year.
 * @param month The month, 1-12.
 * @returns Transactions for the month, newest first.
 */
export async function fetchMonthTransactions(
  year: number,
  month: number,
): Promise<Transaction[]> {
  // Local-time boundaries, matching the web app. `new Date(y, m, 0)` is the
  // last day of the *previous* month argument, so `month` here means "the day
  // before the 1st of the next month" — the last day of `month`.
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59);

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', start.toISOString())
    .lte('date', end.toISOString())
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    // Supabase caps a single response at 1000 rows; 10,000 is a deliberate
    // ceiling well above any real month, and cheaper than paginating.
    .range(0, 9999);

  if (error) throw error;

  const splitSources = await fetchSplitSources(year);

  return sortTransactionsByDateInPlace(
    expandSplitTransactionsForMonth(data ?? [], splitSources, year, month),
  );
}

/**
 * Fetches a full year of transactions with split instances expanded.
 *
 * Paginates past PostgREST's 1000-row cap, which a year of real data exceeds.
 *
 * @param year The calendar year.
 * @returns Transactions for the year, newest first.
 */
export async function fetchYearTransactions(year: number): Promise<Transaction[]> {
  if (Number.isNaN(year) || year < 1000 || year > 9999) {
    throw new Error(`Invalid year: ${year}`);
  }

  // CET year boundaries: Jan 1st 00:00 CET is 23:00 UTC on Dec 31st.
  const yearStart = new Date(Date.UTC(year, 0, 1, -1, 0, 0, 0)).toISOString();
  const nextYearStart = new Date(Date.UTC(year + 1, 0, 1, -1, 0, 0, 0)).toISOString();

  const yearTransactions = await fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .gte('date', yearStart)
      .lt('date', nextYearStart)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  );

  // Previous-year split sources, because their rolling windows reach into this
  // year — a March 2025 source still has instances in January and February 2026.
  const prevYearStart = new Date(Date.UTC(year - 1, 0, 1, -1, 0, 0, 0)).toISOString();
  const prevNextYearStart = new Date(Date.UTC(year, 0, 1, -1, 0, 0, 0)).toISOString();

  const previousYearSplitSources = await fetchAllBatches<Transaction>((from, to) =>
    supabase
      .from('transactions')
      .select('*')
      .eq('split_across_year', true)
      .gte('date', prevYearStart)
      .lt('date', prevNextYearStart)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to),
  );

  const all = [...yearTransactions, ...previousYearSplitSources];

  return sortTransactionsByDateInPlace(expandSplitTransactionsForYear(all, year));
}
