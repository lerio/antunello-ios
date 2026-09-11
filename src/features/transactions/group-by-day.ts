/**
 * Groups transactions by day and computes each day's totals.
 *
 * Ported from the `groupedData` memo in the web app's
 * `transactions-table-optimized.tsx`, where it was inline in the component.
 * Extracted here so it can be tested without rendering anything.
 *
 * Both apps must agree on these numbers, and the rules are easy to get subtly
 * wrong, so they are reproduced exactly:
 *
 *  - Transactions with `hide_from_totals` or `is_money_transfer` are listed but
 *    contribute **nothing** to either total.
 *  - A transaction with no EUR amount contributes 0 rather than its face value —
 *    only a EUR amount can be summed, since the totals are all in EUR.
 *  - Split-across-year instances accumulate into a **separate** total, so a day
 *    header can show the ordinary total and the split portion apart.
 */

import { formatDate } from '@/domain/date';
import {
  getTransactionDisplayAmount,
  getTransactionDisplayEurAmount,
} from '@/domain/split-transactions';
import type { Transaction } from '@/domain/types';

export type DayGroup = {
  /** Locale-formatted day, used as the grouping key. */
  date: string;
  /** A representative ISO timestamp for the day, used to render the header. */
  isoDate: string;
  transactions: Transaction[];
  /** Net of everything except hidden rows, money transfers and split instances. */
  dailyTotal: number;
  /** Net of the split-across-year instances shown on this day. */
  dailySplitTotal: number;
  /** How many rows on this day are excluded from the totals. */
  hiddenCount: number;
};

/**
 * Groups transactions into days, preserving the order they arrive in.
 *
 * The fetchers return newest first, and insertion order is preserved, so the
 * result is newest day first.
 *
 * @param transactions Transactions for the period, already sorted.
 * @returns One entry per day, in the order the days first appear.
 */
export function groupTransactionsByDay(
  transactions: readonly Transaction[],
): DayGroup[] {
  if (transactions.length === 0) return [];

  const groups = new Map<string, DayGroup>();

  for (const transaction of transactions) {
    const date = formatDate(transaction.date);

    let group = groups.get(date);
    if (!group) {
      group = {
        date,
        isoDate: transaction.date,
        transactions: [],
        dailyTotal: 0,
        dailySplitTotal: 0,
        hiddenCount: 0,
      };
      groups.set(date, group);
    }

    group.transactions.push(transaction);
    if (transaction.hide_from_totals) group.hiddenCount += 1;

    // Hidden rows and money transfers never affect a total — a transfer moves
    // money between the user's own accounts, so counting it would double it.
    if (transaction.hide_from_totals || transaction.is_money_transfer) continue;

    // Only a EUR amount can be summed. A non-EUR row without one contributes
    // nothing rather than its face value, matching the web app.
    const eurAmount = getTransactionDisplayEurAmount(transaction);
    const amount =
      eurAmount ?? (transaction.currency === 'EUR' ? getTransactionDisplayAmount(transaction) : 0);

    const signed = transaction.type === 'expense' ? -amount : amount;

    if (transaction.split_across_year) {
      group.dailySplitTotal += signed;
    } else {
      group.dailyTotal += signed;
    }
  }

  return [...groups.values()];
}
