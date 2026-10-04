/**
 * Budget progress for the current month.
 *
 * Ported from `useBudgetProgress` and `BudgetCard` in the web app, with the
 * arithmetic split out of the components so it can be checked without rendering
 * anything. The thresholds and the rounding are the parts worth pinning down:
 * they decide what the user is told about their spending, and "90%" is not a
 * number anyone re-derives by hand.
 */

import { MAIN_CATEGORIES, getCategoryType } from '@/domain/types';
import type { Budget, Transaction } from '@/domain/types';

/** How a budget's progress reads at a glance. */
export type BudgetLevel = 'normal' | 'warning' | 'over';

export type BudgetProgress = {
  /** Spend as a whole percentage of the limit; may exceed 100, or be negative. */
  percentage: number;
  /** Limit minus spend; negative when over. */
  remaining: number;
  isOverBudget: boolean;
  /** Which colour the bar and the over-budget figures take. */
  level: BudgetLevel;
  /** Bar width as a percentage, clamped to 0-100. */
  barWidth: number;
};

/**
 * Month-to-date spending per main category.
 *
 * Three exclusions, all of them the web app's: money transfers are not spending,
 * rows hidden from totals are hidden here too, and only expenses count — a
 * refund or a salary does not reduce a budget.
 *
 * The EUR amount falls back to the face amount with `||`, so a row whose
 * `eur_amount` is exactly zero is counted at its face value. That reaches a
 * non-EUR row with no rate as much as it does a genuine zero, so a budget can be
 * overspent by a transaction whose conversion is missing. Kept because the web
 * app counts it that way, and a budget that disagreed between the two platforms
 * would be worse than one that is consistently pessimistic.
 *
 * @param transactions The month's transactions, split instances expanded.
 * @returns Totals in EUR, keyed by main category.
 */
export function computeSpendingByCategory(
  transactions: readonly Transaction[],
): Record<string, number> {
  const spending: Record<string, number> = {};

  for (const transaction of transactions) {
    if (transaction.type !== 'expense') continue;
    if (transaction.hide_from_totals) continue;
    if (transaction.is_money_transfer) continue;

    const amount = transaction.eur_amount || transaction.amount;
    spending[transaction.main_category] = (spending[transaction.main_category] ?? 0) + amount;
  }

  return spending;
}

/**
 * How a budget is doing against its limit.
 *
 * The thresholds compare the **rounded** percentage, which is the web app's
 * order and matters at the edges. 90.1% rounds to 90, so it is still normal; and
 * the level only turns to "over" once the rounded figure reaches 101, so a
 * budget can be past its limit and still read as a warning. Comparing the raw
 * ratio instead would be equally defensible and would disagree here.
 *
 * `isOverBudget` does not follow the percentage — it is simply whether the limit
 * has been passed, and it is what the card's figures key off. The level only
 * decides the colour.
 *
 * The thresholds are strict inequalities throughout: exactly 90% is not a
 * warning, and exactly 100% is not over — though it *is* a warning, being past
 * 90.
 *
 * @param budget The budget definition.
 * @param spent Month-to-date spending in the budget's currency.
 * @returns The figures the card displays.
 */
export function budgetProgress(budget: Budget, spent: number): BudgetProgress {
  const percentage = Math.round((spent / budget.amount) * 100);
  const remaining = budget.amount - spent;
  const isOverBudget = remaining < 0;

  let level: BudgetLevel = 'normal';
  if (percentage > 100) level = 'over';
  else if (percentage > 90) level = 'warning';

  return {
    percentage,
    remaining,
    isOverBudget,
    level,
    // The bar is clamped, so a budget at 400% does not overflow its track. The
    // percentage beside it is not, since that is the number that matters.
    barWidth: Math.min(100, Math.max(0, percentage)),
  };
}

/**
 * The categories a new budget may be set for.
 *
 * Only expense categories: spending is summed from expenses and excludes
 * transfers, so a budget on an income category or on "Money Transfer" could never
 * show anything but €0.
 *
 * One budget per category — a second would silently shadow the first, since the
 * page looks spending up by category. The category being edited stays in the
 * list so an existing budget can be re-saved, and so its own name is not the one
 * thing missing from its own picker — even if it predates this rule and is an
 * income category.
 *
 * @param existingCategories Categories that already have a budget.
 * @param currentCategory The category being edited, if any.
 * @returns Sorted category names.
 */
export function selectableBudgetCategories(
  existingCategories: readonly string[],
  currentCategory?: string,
): string[] {
  return MAIN_CATEGORIES.filter(
    (category) =>
      category === currentCategory ||
      (getCategoryType(category) === 'expense' &&
        category !== 'Money Transfer' &&
        !existingCategories.includes(category)),
  ).sort();
}
