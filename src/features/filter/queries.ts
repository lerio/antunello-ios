/**
 * The filtered transaction query.
 *
 * Applies the plan from `filter-query.ts` to the raw `transactions` rows. Split
 * sources are returned as the single rows they are; the synthetic monthly
 * instances belong to the month and year views, not to search/filter results,
 * which must show real transactions only.
 *
 * ## The upstream row cap
 *
 * The web app caps the filter query at 500 rows and computes its summary from
 * whatever came back. This port keeps that cap, because the point of the port is
 * that the same filter on either platform returns the same transactions *and*
 * the same totals — an iOS app that quietly returned more rows would disagree
 * with the web app on every wide filter, and the discrepancy would look like a
 * bug in whichever one the user trusted less.
 *
 * The cap is reported rather than hidden: `truncated` is true when the query
 * filled it, and the results screen says so. Silently showing a balance computed
 * from the most recent 500 matches, with nothing to indicate the list was cut
 * off, is the part of the upstream behaviour worth not reproducing.
 */

import type { Transaction } from '@/domain/types';
import {
  buildFundCondition,
  planFilterQuery,
} from '@/features/filter/filter-query';
import type { FilterCriteria } from '@/features/filter/filter-criteria';
import { supabase } from '@/lib/supabase';

/** The upstream row cap. See the note above before changing it. */
const MAX_RESULTS = 500;

export type FilteredTransactions = {
  transactions: Transaction[];
  /** True when the query hit the cap, so the list is not everything that matched. */
  truncated: boolean;
};

/**
 * Fetches the transactions matching a set of filter criteria.
 *
 * @param criteria The filter criteria.
 * @returns The matching transactions, newest first, and whether the list is partial.
 */
export async function fetchFilteredTransactions(
  criteria: FilterCriteria,
  searchQuery = '',
): Promise<FilteredTransactions> {
  const plan = planFilterQuery(criteria, searchQuery);

  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_RESULTS);

  if (plan.search) {
    query = query.or(
      `title.ilike.%${plan.search}%,main_category.ilike.%${plan.search}%,sub_category.ilike.%${plan.search}%`,
    );
  }
  if (plan.typeConditions) query = query.or(plan.typeConditions.join(','));
  if (plan.mainCategories) query = query.in('main_category', plan.mainCategories);
  if (plan.subCategories) query = query.in('sub_category', plan.subCategories);
  // A second `or`, which PostgREST ANDs with the first: within each call the
  // conditions are alternatives, between calls they must both hold. That is what
  // makes "expense, from this fund" mean both things at once.
  if (plan.funds) query = query.or(buildFundCondition(plan.funds));
  // The plan only carries amount bounds when exactly one currency is selected,
  // so this compares the face amount in that currency.
  if (plan.amountMin !== null) query = query.gte('amount', plan.amountMin);
  if (plan.amountMax !== null) query = query.lte('amount', plan.amountMax);
  if (plan.currencies) query = query.in('currency', plan.currencies);
  if (plan.dateBounds) {
    query = query.gte('date', plan.dateBounds.start).lt('date', plan.dateBounds.end);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Transaction[];
  return { transactions: rows, truncated: rows.length >= MAX_RESULTS };
}
