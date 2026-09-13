/**
 * The query key taxonomy.
 *
 * Every cached read is addressed through this file. Keys are hierarchical so a
 * single `invalidateQueries` call can target a whole family — `['tx','year']`
 * covers every year at once, which replaces the web app's hand-maintained list
 * of cache keys to bust after each mutation.
 *
 * The web app keys its SWR cache with flat strings (`transactions-2026-9`,
 * `year-transactions-2026`, …) and invalidates them by re-listing each one.
 * Hierarchical keys make that fan-out a prefix match instead.
 *
 * @example
 * // Everything derived from transactions, for any period:
 * queryClient.invalidateQueries({ queryKey: qk.transactions })
 */

export type TimeRange = '1m' | '1y' | '5y' | 'all';

/**
 * Root of the transaction cache family.
 *
 * Every transaction-derived key starts with this, so it is the handle for
 * broad invalidation.
 *
 * **Do not invalidate this root after a write.** An optimistic mutation has
 * just written the correct month into the cache; invalidating `['tx']` would
 * throw that away and refetch it, producing a visible flicker and a wasted
 * round trip. Invalidate the *derived* families below instead — `year`, `range`,
 * `anchored`, `split` — and let the month key stay authoritative.
 */
export const TX = 'tx' as const;

export const qk = {
  /** Root of the transaction family — for broad invalidation only. */
  transactions: [TX] as const,

  /** One month of transactions, split instances expanded. */
  month: (year: number, month: number) => [TX, 'month', year, month] as const,

  /** A whole year, split instances expanded. */
  year: (year: number) => [TX, 'year', year] as const,

  /** An arbitrary date range, used by the dashboard comparison windows. */
  range: (start: string, end: string) => [TX, 'range', start, end] as const,

  /** The anchored balance series for a chart time range. */
  anchored: (range: TimeRange) => [TX, 'anchored', range] as const,

  /** A single transaction by id. */
  one: (id: string) => [TX, 'one', id] as const,

  /**
   * The fund account list, for pickers.
   *
   * Only changes when a fund is added, renamed or deactivated — not when a
   * transaction is written.
   */
  funds: () => ['funds'] as const,

  /**
   * Fund accounts with their balances, for the Balance card.
   *
   * Separate from `funds` because the cost differs sharply: this one calls an
   * RPC and converts every non-EUR fund over the network, so it must not be
   * refetched merely to populate a picker. It *is* invalidated by every
   * transaction write, since a write changes a balance.
   */
  fundBalances: () => ['fund-balances'] as const,

  /** Budget targets with spending progress. */
  budgets: () => ['budgets'] as const,

  /** Bank transactions awaiting review. */
  pending: () => ['pending'] as const,

  /**
   * One category's transactions over a range.
   *
   * `subCategory` is null when the whole category is shown, so the two views do
   * not share a key.
   */
  category: (category: string, subCategory: string | null, range: TimeRange) =>
    ['category', category, subCategory ?? '*', range] as const,

  /** Full-text search results for a query string. */
  search: (query: string) => ['search', query] as const,

  /** Filtered results, keyed by a stable hash of the filter criteria. */
  filter: (criteriaHash: string) => ['filter', criteriaHash] as const,

  /** Title autocomplete suggestions. */
  titleSuggestions: (query: string) => ['title-suggestions', query] as const,

  /** Connected bank accounts and their sync state. */
  integrations: () => ['integrations'] as const,

  /** Date of the earliest transaction, used to bound the month selector. */
  firstTransactionDate: () => ['first-transaction-date'] as const,
} as const;

/**
 * Query families that survive an app restart.
 *
 * Persisting everything would bloat storage with results that are cheap to
 * refetch — search results and autocomplete suggestions in particular, which
 * are keyed by arbitrary user input and would accumulate without bound.
 *
 * The set mirrors what the web app persisted to localStorage, which was
 * likewise limited to transaction data.
 */
export const PERSISTED_ROOTS: readonly string[] = [
  TX,
  'funds',
  'fund-balances',
  'budgets',
  'first-transaction-date',
];

/**
 * Whether a query key belongs to a persisted family.
 *
 * @param key The query key to test.
 * @returns True if the key should be written to disk.
 */
export function isPersistedKey(key: readonly unknown[]): boolean {
  return PERSISTED_ROOTS.includes(String(key[0]));
}
