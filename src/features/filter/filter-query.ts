/**
 * Turns filter criteria into a description of the query to run.
 *
 * Split out from the fetcher for one reason: this is the part that is easy to
 * get wrong and impossible to test behind a network call. The web app builds the
 * PostgREST query inline in `useFilteredTransactions`, so the conditions — which
 * are fiddly, and where three of the four subtly differ from what they look like
 * — have never been checked against anything but the live database.
 *
 * The fetcher takes a plan and applies it. Nothing here touches the network.
 */

import type { FilterCriteria } from '@/features/filter/filter-criteria';

/** How a transfer's target fund should be matched, alongside the source fund. */
export type FundCondition = {
  /** Fund ids to match against the transaction's own fund. */
  ids: string[];
};

export type FilterPlan = {
  /**
   * The `or` conditions describing the type filter, or null for no constraint.
   *
   * Deliberately not a list of types: a transfer is a transaction whose `type`
   * is still `income` or `expense`, so selecting "expense" must exclude
   * transfers, while selecting "movement" selects them regardless of type.
   */
  typeConditions: string[] | null;
  /** Main categories to match, or null for no constraint. */
  mainCategories: string[] | null;
  /** Subcategory names, stripped of their parent, or null for no constraint. */
  subCategories: string[] | null;
  /** Fund condition, or null for no constraint. */
  funds: FundCondition | null;
  amountMin: number | null;
  amountMax: number | null;
  /** Currencies to match, or null for no constraint. */
  currencies: string[] | null;
  /** Text matched against title and categories, or null for no constraint. */
  search: string | null;
  /**
   * Half-open date bounds, or null for all time.
   *
   * Half-open because the bounds are compared against timestamps: an inclusive
   * end of "January 1st" would drop everything recorded later that day.
   */
  dateBounds: { start: string; end: string } | null;
};

/**
 * Builds the type conditions for the `or` filter.
 *
 * @param types The selected types.
 * @returns One condition per selected type, or null if none.
 */
function buildTypeConditions(types: FilterCriteria['types']): string[] | null {
  const conditions: string[] = [];

  if (types.includes('income')) {
    conditions.push('and(type.eq.income,or(is_money_transfer.is.null,is_money_transfer.eq.false))');
  }
  if (types.includes('expense')) {
    conditions.push('and(type.eq.expense,or(is_money_transfer.is.null,is_money_transfer.eq.false))');
  }
  if (types.includes('movement')) {
    // A transfer's `type` is whatever it was created as, so it is matched on the
    // flag alone.
    conditions.push('is_money_transfer.eq.true');
  }

  return conditions.length > 0 ? conditions : null;
}

/**
 * Describes the query that satisfies a set of criteria.
 *
 * @param criteria The filter criteria.
 * @returns The plan the fetcher applies.
 */
export function planFilterQuery(criteria: FilterCriteria, searchQuery = ''): FilterPlan {
  const { year, month } = criteria;

  let dateBounds: FilterPlan['dateBounds'] = null;
  if (year !== null && month !== null) {
    // Local time, matching the web app's filter — note this differs from the
    // month *fetcher*, which also uses local time, and from the year fetcher,
    // which does not.
    dateBounds = {
      start: new Date(year, month - 1, 1).toISOString(),
      end: new Date(year, month, 1).toISOString(),
    };
  } else if (year !== null) {
    dateBounds = {
      start: new Date(year, 0, 1).toISOString(),
      end: new Date(year + 1, 0, 1).toISOString(),
    };
  }

  // The amount range is only offered for a single currency, and is in that
  // currency's face value. A stale bound must not narrow a multi-currency query.
  const amountCurrency = criteria.currencies.length === 1 ? criteria.currencies[0] : null;

  return {
    typeConditions: buildTypeConditions(criteria.types),
    mainCategories: criteria.mainCategories.length > 0 ? criteria.mainCategories : null,
    // Stored as "Main::Sub" so the chip can name both; PostgREST is matched on
    // the subcategory alone.
    subCategories:
      criteria.subCategories.length > 0
        ? criteria.subCategories.map((sub) => sub.split('::')[1] || sub)
        : null,
    funds:
      criteria.fundSourceIds.length > 0 ? { ids: criteria.fundSourceIds } : null,
    amountMin: amountCurrency === null ? null : criteria.amountMin,
    amountMax: amountCurrency === null ? null : criteria.amountMax,
    currencies: criteria.currencies.length > 0 ? criteria.currencies : null,
    search: searchQuery.trim() || null,
    dateBounds,
  };
}

/**
 * The `or` condition matching a transaction's fund, or a transfer's target fund.
 *
 * A transfer names both ends, so filtering by one fund has to match either side
 * — otherwise "everything from my current account" would omit the transfers out
 * of it.
 *
 * @param funds The fund condition.
 * @returns The PostgREST `or` expression.
 */
export function buildFundCondition(funds: FundCondition): string {
  const ids = funds.ids.join(',');
  return `fund_category_id.in.(${ids}),and(is_money_transfer.eq.true,target_fund_category_id.in.(${ids}))`;
}

