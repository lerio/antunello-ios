/**
 * Totals and category breakdowns for the dashboard comparison.
 *
 * Ported from `calculateTotals` in the web app's `dashboard-summary.tsx`, where
 * it lives inside the component. Extracted here so the rules can be tested —
 * they are the same class of easy-to-get-wrong arithmetic as the day totals in
 * the transaction list, and the two apps must agree on them.
 *
 * The exclusions, all of which the web app applies:
 *
 *  - `hide_from_totals` rows are out, by definition.
 *  - Money transfers are out: they move money between the user's own accounts,
 *    so counting them would double the same money.
 *  - Rows with no EUR amount are out, since only a EUR figure can be summed.
 */

import { getTransactionDisplayEurAmount } from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';

/** A main category's total and the split beneath it. */
export type CategoryAggregate = {
  total: number;
  /** Subcategory name to amount. Rows with no subcategory land in "Uncategorized". */
  subcategories: Record<string, number>;
};

export type PeriodTotals = {
  income: number;
  expense: number;
  incomeCategories: Record<string, CategoryAggregate>;
  expenseCategories: Record<string, CategoryAggregate>;
};

/** Subcategory used for rows that have none, matching the web app's label. */
export const UNCATEGORIZED = 'Uncategorized';

/**
 * Totals for one period.
 *
 * @param transactions The period's transactions, split instances expanded.
 * @returns Income and expense totals, each broken down by category.
 */
export function calculateTotals(transactions: readonly Transaction[]): PeriodTotals {
  let income = 0;
  let expense = 0;
  const incomeCategories: Record<string, CategoryAggregate> = {};
  const expenseCategories: Record<string, CategoryAggregate> = {};

  for (const transaction of transactions) {
    if (transaction.hide_from_totals || transaction.is_money_transfer) continue;

    const amount = getTransactionDisplayEurAmount(transaction);
    if (amount === null || amount === undefined) continue;

    const subCategory = transaction.sub_category || UNCATEGORIZED;

    const categories = transaction.type === 'income' ? incomeCategories : expenseCategories;
    if (transaction.type === 'income') income += amount;
    else expense += amount;

    const aggregate = categories[transaction.main_category];
    if (aggregate) {
      aggregate.total += amount;
      aggregate.subcategories[subCategory] = (aggregate.subcategories[subCategory] ?? 0) + amount;
    } else {
      categories[transaction.main_category] = {
        total: amount,
        subcategories: { [subCategory]: amount },
      };
    }
  }

  return { income, expense, incomeCategories, expenseCategories };
}

/** The three periods the dashboard compares, in label order. */
export type DashboardComparison = {
  current: PeriodTotals;
  previous: PeriodTotals;
  lastYear: PeriodTotals;
};

/**
 * Builds all three periods from their transaction sets.
 *
 * @param sets The transactions for each period.
 * @returns Totals for each, ready to render side by side.
 */
export function buildComparison(sets: {
  current: readonly Transaction[];
  previous: readonly Transaction[];
  lastYear: readonly Transaction[];
}): DashboardComparison {
  return {
    current: calculateTotals(sets.current),
    previous: calculateTotals(sets.previous),
    lastYear: calculateTotals(sets.lastYear),
  };
}

/**
 * Categories present in any period, richest first.
 *
 * Every period is included, not just the current one, so a category that has
 * fallen to zero still appears — its disappearance is the comparison's whole
 * point, and dropping it would hide the most interesting line in the table.
 *
 * @param comparison The three periods.
 * @param kind Whether to list income or expense categories.
 * @returns Category names, ordered by the current period's total descending.
 */
export function listCategories(
  comparison: DashboardComparison,
  kind: 'income' | 'expense',
): string[] {
  const key = kind === 'income' ? 'incomeCategories' : 'expenseCategories';

  const names = new Set<string>([
    ...Object.keys(comparison.current[key]),
    ...Object.keys(comparison.previous[key]),
    ...Object.keys(comparison.lastYear[key]),
  ]);

  return [...names].sort(
    (a, b) =>
      (comparison.current[key][b]?.total ?? 0) - (comparison.current[key][a]?.total ?? 0),
  );
}

/**
 * The percentage change between two figures.
 *
 * @param current The newer figure.
 * @param previous The figure being compared against.
 * @returns The change as a percentage, or null when there is nothing to compare
 *   against — dividing by a zero baseline yields infinity, which is not a
 *   useful thing to show.
 */
export function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
