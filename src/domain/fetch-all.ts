/**
 * @vendored-from antunello-app:utils/supabase/fetch-all.ts
 * @upstream-sha256 8db97fdf0c850c43d35b1b34a2f91b4dd2fcbe9a70282e871646a53649685329
 * @vendored-on 2026-10-19
 * @parity exact
 * @divergences none
 *
 * DO NOT EDIT THIS COPY IN ISOLATION.
 *
 * This file is vendored verbatim from the web app. The hash above is of the
 * upstream file after alias rewriting; it must equal the hash of everything
 * below this header. If you change the web implementation, re-run
 * `npm run vendor` and follow PARITY.md.
 */
/**
 * A generic batch-fetching utility that paginates through a Supabase query
 * until all rows are collected.
 *
 * Callers provide a factory function (`queryPage`) that returns the
 * `{ data, error }` shape for a given `from`/`to` range. The utility
 * automatically advances the range by `batchSize` and concatenates results
 * until the query returns fewer rows than the batch size (indicating the
 * end of the dataset).
 */

/**
 * Result shape returned by the `queryPage` callback.
 */
type QueryResult<T> = {
  data: T[] | null
  error: { message?: string } | null
}

/**
 * Fetches all rows matching a paginated Supabase query by walking through
 * batches until no more rows are returned.
 *
 * @typeParam T - The row type returned by the query.
 * @param queryPage - A function that issues a `.range(from, to)` query and
 *   returns the corresponding `{ data, error }` result. Called repeatedly
 *   with increasing `from`/`to` values until the dataset is exhausted.
 * @param batchSize - Number of rows to request per batch (default `1000`).
 *   Must be <= the Supabase maximum range limit (1000).
 * @returns A flat array of all rows across all batches.
 * @throws {Error} Propagates any error thrown or returned by `queryPage`.
 */
export async function fetchAllBatches<T>(
  queryPage: (from: number, to: number) => QueryResult<T> | PromiseLike<QueryResult<T>>,
  batchSize = 1000
): Promise<T[]> {
  let from = 0
  const allRows: T[] = []

  while (true) {
    const { data, error } = await queryPage(from, from + batchSize - 1)

    if (error) {
      throw error
    }

    if (!data || data.length === 0) {
      break
    }

    allRows.push(...data)

    if (data.length < batchSize) {
      break
    }

    from += batchSize
  }

  return allRows
}
