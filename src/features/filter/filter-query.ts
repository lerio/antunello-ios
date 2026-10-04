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
  /**
   * Half-open date bounds, or null for all time.
   *
   * Half-open because the bounds are compared against timestamps: an inclusive
   * end of "January 1st" would drop everything recorded later that day.
   */
  dateBounds: { start: string; end: string } | null;
  /**
   * How split-across-year rows should be expanded, or null to leave them alone.
   *
   * A split source is stored once and drawn down over twelve months, so it only
   * has monthly slices to show when a month or year is in scope.
   */
  splitExpansion: { year: number; month: number | null } | null;
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
export function planFilterQuery(criteria: FilterCriteria): FilterPlan {
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
    amountMin: criteria.amountMin,
    amountMax: criteria.amountMax,
    currencies: criteria.currencies.length > 0 ? criteria.currencies : null,
    dateBounds,
    // A month and a year expand month-by-month; a year alone expands the whole
    // year; all time leaves sources as the single rows they are.
    splitExpansion:
      year === null ? null : { year, month: month === null ? null : month },
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

/**
 * The PostgREST `or` expression for one end of the amount range.
 *
 * The range is in euros, as the filter's label says: a ¥10,000 purchase is about
 * €60 and must not match "over 100". It compares `eur_amount`, falling back to
 * `amount` only for a EUR row that somehow has no `eur_amount`. A non-EUR row
 * with no conversion cannot be placed in the range, so it is left out rather
 * than compared in a different currency.
 *
 * @param bound `gte` for the minimum, `lte` for the maximum.
 * @param value The bound, in euros.
 */
export function buildAmountCondition(bound: 'gte' | 'lte', value: number): string {
  return `eur_amount.${bound}.${value},and(eur_amount.is.null,currency.eq.EUR,amount.${bound}.${value})`;
}
