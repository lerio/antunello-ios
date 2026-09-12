/**
 * Full-text search over transactions.
 *
 * Mirrors the web app's `useTransactionSearch`: a case-insensitive substring
 * match against the title, the main category and the subcategory, newest first
 * and capped at 100 rows.
 *
 * ## Split sources are not expanded
 *
 * Unlike the month and year fetchers, this one returns rows exactly as stored.
 * A split-across-year source therefore appears as the single row it is rather
 * than as twelve monthly slices — matching the web app, which hands the raw
 * search results straight to its table.
 */

import type { Transaction } from '@/domain/types';
import { supabase } from '@/lib/supabase';

/**
 * How many matches to return.
 *
 * The web app's cap, kept because it is what bounds the payload on a table with
 * over twelve thousand rows. A search that reaches it is one the user should
 * narrow rather than page through.
 */
const MAX_RESULTS = 100;

/**
 * Searches transactions by title, category and subcategory.
 *
 * @param query The search term, already trimmed.
 * @returns Matching transactions, newest first, at most `MAX_RESULTS`.
 */
export async function fetchSearchResults(query: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    // Composed as one PostgREST `or` filter rather than three queried-then-merged
    // round trips, which is what the web app does. The value is interpolated
    // unescaped, exactly as upstream: a query containing a comma or a closing
    // bracket produces a malformed filter and a 400 from PostgREST, and matching
    // that is preferable to returning rows the web app would not.
    .or(
      `title.ilike.%${query}%,main_category.ilike.%${query}%,sub_category.ilike.%${query}%`,
    )
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_RESULTS);

  if (error) throw error;

  return (data ?? []) as Transaction[];
}
