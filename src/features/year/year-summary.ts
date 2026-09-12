/**
 * The yearly summary's arithmetic.
 *
 * Ported from `transaction-summary.tsx` in the web app, where it lives inside a
 * 1,300-line component. Extracted here so the rules can be tested, since they
 * differ from the dashboard's in ways that are easy to conflate.
 */

import { getTransactionDisplayEurAmount } from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';

export type YearTotals = {
  expenseTotal: number;
  incomeTotal: number;
  incomeCategoryTotals: Record<string, number>;
  expenseCategoryTotals: Record<string, number>;
  /**
   * Expenses excluded from the totals by `hide_from_totals`.
   *
   * **Expenses only.** Hidden income is not tracked — the web app counts only
   * the expense side, because the figure exists to explain why spending looks
   * lower than expected, which income never does.
   */
  hiddenExpenseTotal: number;
};

function increment(map: Record<string, number>, key: string, amount: number): void {
  map[key] = (map[key] ?? 0) + amount;
}

/**
 * Totals for a year's transactions.
 *
 * @param transactions The year's transactions, split instances expanded.
 * @returns Totals and category breakdowns.
 */
export function computeYearTotals(transactions: readonly Transaction[]): YearTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let hiddenExpenseTotal = 0;
  const incomeCategoryTotals: Record<string, number> = {};
  const expenseCategoryTotals: Record<string, number> = {};

  for (const transaction of transactions) {
    const eur = getTransactionDisplayEurAmount(transaction);
    // A row with no EUR amount cannot be summed, so it is left out entirely —
    // before the transfer check, matching the web app's ordering.
    if (eur === null || eur === undefined) continue;

    if (transaction.is_money_transfer) continue;

    if (transaction.hide_from_totals) {
      if (transaction.type === 'expense') hiddenExpenseTotal += eur;
      continue;
    }

    if (transaction.type === 'expense') {
      expenseTotal += eur;
      increment(expenseCategoryTotals, transaction.main_category, eur);
    } else {
      incomeTotal += eur;
      increment(incomeCategoryTotals, transaction.main_category, eur);
    }
  }

  return {
    expenseTotal,
    incomeTotal,
    incomeCategoryTotals,
    expenseCategoryTotals,
    hiddenExpenseTotal,
  };
}

/** Balance for a set of transactions: income less expenses. */
export function computeBalanceTotal(transactions: readonly Transaction[]): number {
  const { incomeTotal, expenseTotal } = computeYearTotals(transactions);
  return incomeTotal - expenseTotal;
}

/**
 * The last month of the year that has finished.
 *
 * Comparing a part-finished month against a whole one would make the current
 * year look worse than it is, so the summary stops at the last complete month.
 *
 * @param year The year being summarised.
 * @param today The reference date.
 * @returns A zero-based month index, or -1 when no month has completed yet, or
 *   11 for a year that is entirely in the past.
 */
export function lastCompleteMonth(year: number, today: Date = new Date()): number {
  if (year < today.getFullYear()) return 11;
  if (year > today.getFullYear()) return -1;
  // Zero-based, so the previous month is one less than the current index. In
  // January this is -1, meaning the year has no complete month yet.
  return today.getMonth() - 1;
}

/**
 * Drops the months that have not finished.
 *
 * @param transactions The year's transactions.
 * @param lastCompleteMonthIndex The index returned by `lastCompleteMonth`.
 * @returns Transactions up to and including that month.
 */
export function filterToLastCompleteMonth(
  transactions: readonly Transaction[],
  lastCompleteMonthIndex: number,
): readonly Transaction[] {
  if (lastCompleteMonthIndex >= 11) return transactions;
  if (lastCompleteMonthIndex < 0) return [];

  return transactions.filter(
    (transaction) => new Date(transaction.date).getMonth() <= lastCompleteMonthIndex,
  );
}

/**
 * An average per month.
 *
 * @param total The year's total.
 * @param numberOfMonths How many months it covers. Defaults to a full year.
 * @returns The monthly average, or the total when there are no months.
 */
export function getMonthlyAverage(total: number, numberOfMonths = 12): number {
  return numberOfMonths > 0 ? total / numberOfMonths : total;
}

/**
 * The change in monthly average between two years.
 *
 * Compared as averages rather than totals, so a part-finished year is measured
 * against the same span of the previous one.
 */
export function getDifferenceFromPreviousYear(
  currentTotal: number,
  previousTotal: number,
  numberOfMonths = 12,
): number {
  return (
    getMonthlyAverage(currentTotal, numberOfMonths) - getMonthlyAverage(previousTotal, numberOfMonths)
  );
}

const MONTH_ABBREVIATIONS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * The heading describing which months the summary covers, e.g. "Jan–Aug".
 *
 * @param lastCompleteMonthIndex The index returned by `lastCompleteMonth`.
 * @returns The range, or an empty string when no month has completed.
 */
export function formatMonthRange(lastCompleteMonthIndex: number): string {
  if (lastCompleteMonthIndex < 0) return '';
  return `Jan–${MONTH_ABBREVIATIONS[Math.min(lastCompleteMonthIndex, 11)]}`;
}

/**
 * The percentage change between two figures.
 *
 * @returns The change, or null when there is no baseline to compare against.
 */
export function percentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
