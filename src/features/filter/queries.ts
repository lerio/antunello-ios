/**
 * The filtered transaction query.
 *
 * Applies the plan from `filter-query.ts` and then expands split-across-year
 * rows the same way the month and year views do, so a filter's totals are built
 * from the same numbers those screens show.
 *
 * ## Two upstream limits, kept on purpose
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
 *
 * The second limit is on split sources, which upstream also caps at 500 per
 * year. That one is not reproduced — `fetchSplitSources` allows 10,000, matching
 * the month and year views. It cannot change a result today, since it is far
 * above the number of splits any account has, and where the two would diverge
 * the month views would already be the ones that were wrong.
 */

import type { Transaction } from '@/domain/types';
import {
  buildAmountCondition,
  buildFundCondition,
  planFilterQuery,
} from '@/features/filter/filter-query';
import type { FilterCriteria } from '@/features/filter/filter-criteria';
import { fetchSplitSources } from '@/features/transactions/queries';
import { expandSplitTransactionsForMonth, expandSplitTransactionsForYear } from '@/domain/split-transactions';
import { sortTransactionsByDateInPlace } from '@/domain/transaction-utils';
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
): Promise<FilteredTransactions> {
  const plan = planFilterQuery(criteria);

  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(MAX_RESULTS);

  if (plan.typeConditions) query = query.or(plan.typeConditions.join(','));
  if (plan.mainCategories) query = query.in('main_category', plan.mainCategories);
  if (plan.subCategories) query = query.in('sub_category', plan.subCategories);
  // A second `or`, which PostgREST ANDs with the first: within each call the
  // conditions are alternatives, between calls they must both hold. That is what
  // makes "expense, from this fund" mean both things at once.
  if (plan.funds) query = query.or(buildFundCondition(plan.funds));
  if (plan.amountMin !== null) query = query.or(buildAmountCondition('gte', plan.amountMin));
  if (plan.amountMax !== null) query = query.or(buildAmountCondition('lte', plan.amountMax));
  if (plan.currencies) query = query.in('currency', plan.currencies);
  if (plan.dateBounds) {
    query = query.gte('date', plan.dateBounds.start).lt('date', plan.dateBounds.end);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as Transaction[];
  const truncated = rows.length >= MAX_RESULTS;
  const expansion = plan.splitExpansion;

  if (!expansion) return { transactions: rows, truncated };

  const splitSources = await fetchSplitSources(expansion.year);

  if (expansion.month !== null) {
    // The month expander discards non-source rows from its first argument
    // itself, so passing the results as-is is what upstream does too.
    return {
      transactions: sortTransactionsByDateInPlace(
        expandSplitTransactionsForMonth(rows, splitSources, expansion.year, expansion.month),
      ),
      truncated,
    };
  }

  // The year expander does *not* discard non-source rows: it expands every row
  // flagged as a source. A source that survived the filter is therefore already
  // in `rows`, and concatenating the two lists would expand it twice — the
  // upstream behaviour, and a doubled row with a doubled total in the results.
  // Deduplicating by id is the one place this port corrects the web app rather
  // than reproducing it. Recorded in PARITY.md.
  const byId = new Map<string, Transaction>();
  for (const row of rows) byId.set(row.id, row);
  for (const source of splitSources) byId.set(source.id, source);

  return {
    transactions: sortTransactionsByDateInPlace(
      expandSplitTransactionsForYear([...byId.values()], expansion.year),
    ),
    truncated,
  };
}
