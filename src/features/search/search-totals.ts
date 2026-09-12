/**
 * Totals for a set of search results.
 *
 * Ported from `computeSearchTotals` in the web app's `search-summary.tsx`.
 *
 * Unlike the other summaries, this one reports **hidden** rows separately rather
 * than ignoring them, because on a search screen the hidden figures are part of
 * what the user came to find.
 *
 * The fallback for a missing EUR amount reproduces the web app exactly, which
 * uses `||` rather than a null check: a EUR amount of exactly zero therefore
 * falls through to the currency test and is treated as unsummable. That reads
 * like a bug and is deliberate — a zero is indistinguishable from "no rate
 * available" here, and treating it as valid would silently drop the row from
 * both the total and the skip count.
 */

import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';

export type SearchTotals = {
  expenseTotal: number;
  incomeTotal: number;
  hiddenExpenseTotal: number;
  hiddenIncomeTotal: number;
  hiddenTransactionCount: number;
};

/**
 * Totals a set of search results.
 *
 * @param transactions The matched transactions.
 * @returns Visible and hidden totals, all in EUR.
 */
export function computeSearchTotals(transactions: readonly Transaction[]): SearchTotals {
  let expenseTotal = 0;
  let incomeTotal = 0;
  let hiddenExpenseTotal = 0;
  let hiddenIncomeTotal = 0;
  let hiddenTransactionCount = 0;

  for (const transaction of transactions) {
    // Money transfers move money between the user's own accounts, so they are
    // neither income nor expense.
    if (transaction.is_money_transfer) continue;

    const eurAmount =
      getTransactionDisplayEurAmount(transaction) ||
      (transaction.currency === 'EUR' ? getTransactionDisplayAmount(transaction) : 0);

    // A non-EUR row with no usable amount cannot be summed and is skipped
    // entirely — not even counted among the hidden.
    if (eurAmount === 0 && transaction.currency !== 'EUR') continue;

    if (transaction.hide_from_totals) {
      hiddenTransactionCount += 1;
      if (transaction.type === 'expense') hiddenExpenseTotal += eurAmount;
      else hiddenIncomeTotal += eurAmount;
      continue;
    }

    if (transaction.type === 'expense') expenseTotal += eurAmount;
    else incomeTotal += eurAmount;
  }

  return {
    expenseTotal,
    incomeTotal,
    hiddenExpenseTotal,
    hiddenIncomeTotal,
    hiddenTransactionCount,
  };
}

/** Whether any hidden rows were found, which decides if the badge shows. */
export function hasHiddenTotals(totals: SearchTotals): boolean {
  return totals.hiddenTransactionCount > 0;
}
