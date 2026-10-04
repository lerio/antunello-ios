/**
 * The month summary's arithmetic.
 *
 * Ported from the monthly branch of `transaction-summary.tsx` in the web app.
 * Kept free of React so the comparison rules can be tested.
 */

import {
  calculateExpectedSplitAmountEur,
  expandSplitTransactionsForMonth,
} from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';
import {
  computeBalanceTotal,
  computeYearTotals,
  percentageChange,
} from '@/features/year/year-summary';

export type CategoryTotal = { category: string; total: number };

export type MonthComparison = {
  /** "VS APR", or "VS DEC '25" across a year boundary. */
  label: string;
  /** Null when the previous month has no balance to compare against. */
  percentage: number | null;
  referenceValue: number;
};

export type MonthSummary = {
  balance: number;
  incomeTotal: number;
  expenseTotal: number;
  hiddenExpenseTotal: number;
  incomeCategories: CategoryTotal[];
  expenseCategories: CategoryTotal[];
  /** Share of split transactions that has not appeared as a row yet. */
  expectedSplitAmountEur: number;
  /** Null for a future month, which has nothing to compare. */
  comparison: MonthComparison | null;
};

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function getPreviousMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

export function formatPreviousMonthLabel(
  selectedYear: number,
  previousYear: number,
  previousMonth: number,
): string {
  const label = MONTH_LABELS[previousMonth - 1];
  if (selectedYear === previousYear) return `VS ${label}`;
  return `VS ${label} '${String(previousYear).slice(-2)}`;
}

/**
 * How far into each month the comparison reaches.
 *
 * For the current month both sides stop at today's day-of-month, so a month
 * that is half over is not compared against a whole one.
 */
export function getMonthComparisonMode(year: number, month: number, now: Date) {
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const selectedMonthStart = new Date(year, month - 1, 1).getTime();

  if (selectedMonthStart > currentMonthStart) {
    return { isFutureMonth: true, cutoffDay: null, previousMonthCutoffDay: null };
  }
  if (selectedMonthStart === currentMonthStart) {
    return {
      isFutureMonth: false,
      cutoffDay: now.getDate(),
      previousMonthCutoffDay: now.getDate(),
    };
  }
  return {
    isFutureMonth: false,
    cutoffDay: new Date(year, month, 0).getDate(),
    previousMonthCutoffDay: null,
  };
}

function filterThroughDay(transactions: readonly Transaction[], cutoffDay: number | null) {
  if (cutoffDay === null) return transactions;
  return transactions.filter((t) => new Date(t.date).getDate() <= cutoffDay);
}

function expectedSplitAmount(
  splitSources: readonly Transaction[],
  visible: readonly Transaction[],
  year: number,
  month: number,
  cutoffDay?: number,
): number {
  if (splitSources.length === 0) return 0;

  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = new Date(year, month - 1, Math.min(cutoffDay ?? lastDay, lastDay), 23, 59, 59, 999);
  const allSplitForMonth = expandSplitTransactionsForMonth([], [...splitSources], year, month, monthEnd);

  return calculateExpectedSplitAmountEur(allSplitForMonth, visible);
}

function sortedCategories(totals: Record<string, number>): CategoryTotal[] {
  return Object.entries(totals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

type MonthSummaryInput = {
  year: number;
  month: number;
  /** The month's rows, split instances expanded. */
  transactions: readonly Transaction[];
  previousMonthTransactions: readonly Transaction[];
  /** Split sources for `year` and the year before it. */
  splitSources: readonly Transaction[];
  /** Split sources for the previous month's year and the year before it. */
  previousSplitSources: readonly Transaction[];
  now?: Date;
};

export function computeMonthSummary({
  year,
  month,
  transactions,
  previousMonthTransactions,
  splitSources,
  previousSplitSources,
  now = new Date(),
}: MonthSummaryInput): MonthSummary {
  const totals = computeYearTotals(transactions);

  // The split share is measured to the end of the month, as on the web's list
  // page: it is a forecast of what is still to come, not a comparison.
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  const expectedSplitAmountEur =
    splitSources.length === 0
      ? 0
      : calculateExpectedSplitAmountEur(
          expandSplitTransactionsForMonth([], [...splitSources], year, month, monthEnd),
          transactions,
        );

  return {
    balance: totals.incomeTotal - totals.expenseTotal,
    incomeTotal: totals.incomeTotal,
    expenseTotal: totals.expenseTotal,
    hiddenExpenseTotal: totals.hiddenExpenseTotal,
    incomeCategories: sortedCategories(totals.incomeCategoryTotals),
    expenseCategories: sortedCategories(totals.expenseCategoryTotals),
    expectedSplitAmountEur,
    comparison: computeComparison({
      year,
      month,
      transactions,
      previousMonthTransactions,
      splitSources,
      previousSplitSources,
      now,
    }),
  };
}

function computeComparison({
  year,
  month,
  transactions,
  previousMonthTransactions,
  splitSources,
  previousSplitSources,
  now,
}: Required<MonthSummaryInput>): MonthComparison | null {
  const previous = getPreviousMonth(year, month);
  const { isFutureMonth, cutoffDay, previousMonthCutoffDay } = getMonthComparisonMode(
    year,
    month,
    now,
  );
  if (isFutureMonth || cutoffDay === null) return null;

  const current = filterThroughDay(transactions, cutoffDay);
  const before = filterThroughDay(previousMonthTransactions, previousMonthCutoffDay);

  const currentBalance =
    computeBalanceTotal(current) - expectedSplitAmount(splitSources, current, year, month, cutoffDay);
  const previousBalance =
    computeBalanceTotal(before) -
    expectedSplitAmount(previousSplitSources, before, previous.year, previous.month, cutoffDay);

  return {
    label: formatPreviousMonthLabel(year, previous.year, previous.month),
    percentage: percentageChange(currentBalance, previousBalance),
    referenceValue: previousBalance,
  };
}
