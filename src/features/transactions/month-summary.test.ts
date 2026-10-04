/**
 * Tests for the month summary's arithmetic.
 *
 * Ported from the monthly branch of `transaction-summary.tsx` in the web app.
 * The comparison against the previous month is the subtle part: for the current
 * month both sides are cut off at today's day-of-month so a half-finished month
 * is not compared against a whole one.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import {
  computeMonthSummary,
  formatPreviousMonthLabel,
  getMonthComparisonMode,
  getPreviousMonth,
} from '@/features/transactions/month-summary';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    user_id: 'u1',
    amount: 10,
    currency: 'EUR',
    type: 'expense',
    main_category: 'Groceries',
    sub_category: 'Supermarket',
    title: 'Test',
    date: '2026-05-11T10:00:00',
    created_at: '2026-05-11T10:00:00.000Z',
    updated_at: '2026-05-11T10:00:00.000Z',
    eur_amount: 10,
    ...overrides,
  };
}

describe('previous month', () => {
  it('wraps January back to December of the prior year', () => {
    assert.deepEqual(getPreviousMonth(2026, 1), { year: 2025, month: 12 });
    assert.deepEqual(getPreviousMonth(2026, 5), { year: 2026, month: 4 });
  });

  it('labels the comparison, adding the year only across a year boundary', () => {
    assert.equal(formatPreviousMonthLabel(2026, 2026, 4), 'VS APR');
    assert.equal(formatPreviousMonthLabel(2026, 2025, 12), "VS DEC '25");
  });
});

describe('comparison mode', () => {
  const now = new Date(2026, 4, 15, 12); // 15 May 2026, local

  it('has no comparison for a future month', () => {
    assert.deepEqual(getMonthComparisonMode(2026, 6, now), {
      isFutureMonth: true,
      cutoffDay: null,
      previousMonthCutoffDay: null,
    });
  });

  it('cuts both months at today for the current month', () => {
    assert.deepEqual(getMonthComparisonMode(2026, 5, now), {
      isFutureMonth: false,
      cutoffDay: 15,
      previousMonthCutoffDay: 15,
    });
  });

  it('compares a whole past month against the whole previous month', () => {
    assert.deepEqual(getMonthComparisonMode(2026, 2, now), {
      isFutureMonth: false,
      cutoffDay: 28,
      previousMonthCutoffDay: null,
    });
  });
});

describe('month summary', () => {
  const now = new Date(2026, 4, 31, 12);
  const base = { year: 2026, month: 5, splitSources: [], previousSplitSources: [], now };

  it('sums income and expenses, ignoring transfers', () => {
    const summary = computeMonthSummary({
      ...base,
      transactions: [
        tx({ id: 'a', type: 'income', main_category: 'Primary Income', eur_amount: 100, amount: 100 }),
        tx({ id: 'b', eur_amount: 30, amount: 30 }),
        tx({ id: 'c', is_money_transfer: true, eur_amount: 999, amount: 999 }),
      ],
      previousMonthTransactions: [],
    });

    assert.equal(summary.incomeTotal, 100);
    assert.equal(summary.expenseTotal, 30);
    assert.equal(summary.balance, 70);
  });

  it('orders categories richest first and tracks hidden expenses apart', () => {
    const summary = computeMonthSummary({
      ...base,
      transactions: [
        tx({ id: 'a', main_category: 'Dining', eur_amount: 5, amount: 5 }),
        tx({ id: 'b', main_category: 'Housing', eur_amount: 50, amount: 50 }),
        tx({ id: 'c', hide_from_totals: true, eur_amount: 20, amount: 20 }),
      ],
      previousMonthTransactions: [],
    });

    assert.deepEqual(
      summary.expenseCategories.map((c) => c.category),
      ['Housing', 'Dining'],
    );
    assert.equal(summary.expenseTotal, 55);
    assert.equal(summary.hiddenExpenseTotal, 20);
  });

  it('compares against the previous month, cut at the same day for the current month', () => {
    const summary = computeMonthSummary({
      ...base,
      now: new Date(2026, 4, 10, 12),
      transactions: [
        tx({ id: 'a', date: '2026-05-05T10:00:00', eur_amount: 50, amount: 50 }),
        // After the cutoff: must not count towards the comparison.
        tx({ id: 'b', date: '2026-05-20T10:00:00', eur_amount: 500, amount: 500 }),
      ],
      previousMonthTransactions: [
        tx({ id: 'c', date: '2026-04-05T10:00:00', eur_amount: 100, amount: 100 }),
        tx({ id: 'd', date: '2026-04-25T10:00:00', eur_amount: 900, amount: 900 }),
      ],
    });

    // Balances are negative expenses: -50 now versus -100 then.
    assert.equal(summary.comparison?.label, 'VS APR');
    assert.equal(summary.comparison?.referenceValue, -100);
    assert.equal(summary.comparison?.percentage, 50);
  });

  it('has no comparison for a future month or a zero baseline', () => {
    const future = computeMonthSummary({
      ...base,
      now: new Date(2026, 3, 1),
      transactions: [],
      previousMonthTransactions: [],
    });
    assert.equal(future.comparison, null);

    const zero = computeMonthSummary({
      ...base,
      transactions: [tx({ eur_amount: 10, amount: 10 })],
      previousMonthTransactions: [],
    });
    assert.equal(zero.comparison?.percentage, null);
  });

  it('reports the not-yet-visible share of split transactions', () => {
    const source = tx({
      id: 'split-1',
      split_across_year: true,
      date: '2026-01-10T10:00:00',
      eur_amount: 1200,
      amount: 1200,
    });

    const summary = computeMonthSummary({
      ...base,
      transactions: [],
      previousMonthTransactions: [],
      splitSources: [source],
    });

    // The source is not among the visible rows, so its monthly slice is expected.
    assert.ok(summary.expectedSplitAmountEur > 0);
  });
});
