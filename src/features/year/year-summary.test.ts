/**
 * Tests for the yearly summary's arithmetic.
 *
 * Its rules differ from the dashboard's in ways that are easy to conflate —
 * notably that hidden *income* is not tracked, only hidden expenses — so they
 * are pinned separately rather than assumed to match.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import {
  computeBalanceTotal,
  computeYearTotals,
  filterToLastCompleteMonth,
  formatMonthRange,
  getDifferenceFromPreviousYear,
  getMonthlyAverage,
  lastCompleteMonth,
  percentageChange,
} from '@/features/year/year-summary';

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
    date: '2026-05-11T10:00:00.000Z',
    created_at: '2026-05-11T10:00:00.000Z',
    updated_at: '2026-05-11T10:00:00.000Z',
    eur_amount: 10,
    ...overrides,
  };
}

describe('year totals', () => {
  it('sums income and expenses', () => {
    const totals = computeYearTotals([
      tx({ type: 'income', amount: 3000, eur_amount: 3000 }),
      tx({ type: 'expense', amount: 800, eur_amount: 800 }),
    ]);

    assert.equal(totals.incomeTotal, 3000);
    assert.equal(totals.expenseTotal, 800);
  });

  it('breaks totals down by category', () => {
    const totals = computeYearTotals([
      tx({ main_category: 'Groceries', amount: 200, eur_amount: 200 }),
      tx({ main_category: 'Travel', amount: 500, eur_amount: 500 }),
    ]);

    assert.equal(totals.expenseCategoryTotals.Groceries, 200);
    assert.equal(totals.expenseCategoryTotals.Travel, 500);
  });

  it('excludes money transfers', () => {
    const totals = computeYearTotals([
      tx({ amount: 900, eur_amount: 900, is_money_transfer: true }),
    ]);

    assert.equal(totals.expenseTotal, 0);
  });

  it('excludes rows with no EUR amount', () => {
    const totals = computeYearTotals([
      tx({ amount: 500, currency: 'USD', eur_amount: undefined }),
    ]);

    assert.equal(totals.expenseTotal, 0);
  });
});

describe('hidden rows', () => {
  it('keeps hidden expenses out of the total but reports them separately', () => {
    const totals = computeYearTotals([
      tx({ amount: 300, eur_amount: 300, hide_from_totals: true }),
      tx({ amount: 100, eur_amount: 100 }),
    ]);

    assert.equal(totals.expenseTotal, 100);
    assert.equal(totals.hiddenExpenseTotal, 300);
  });

  it('does not track hidden income', () => {
    // Deliberate, and matching the web app: the figure exists to explain
    // spending that looks lower than expected, which income never does.
    const totals = computeYearTotals([
      tx({ type: 'income', amount: 500, eur_amount: 500, hide_from_totals: true }),
    ]);

    assert.equal(totals.incomeTotal, 0);
    assert.equal(totals.hiddenExpenseTotal, 0, 'hidden income is not counted anywhere');
  });

  it('keeps hidden rows out of the category breakdown', () => {
    const totals = computeYearTotals([
      tx({ main_category: 'Travel', amount: 300, eur_amount: 300, hide_from_totals: true }),
    ]);

    assert.equal(totals.expenseCategoryTotals.Travel, undefined);
  });
});

describe('balance', () => {
  it('is income less expenses', () => {
    const balance = computeBalanceTotal([
      tx({ type: 'income', amount: 3000, eur_amount: 3000 }),
      tx({ type: 'expense', amount: 1200, eur_amount: 1200 }),
    ]);

    assert.equal(balance, 1800);
  });

  it('is negative when spending exceeds income', () => {
    const balance = computeBalanceTotal([
      tx({ type: 'income', amount: 100, eur_amount: 100 }),
      tx({ type: 'expense', amount: 400, eur_amount: 400 }),
    ]);

    assert.equal(balance, -300);
  });
});

describe('the last complete month', () => {
  it('is the previous month during the current year', () => {
    // Mid-September: August is the last month that has finished.
    assert.equal(lastCompleteMonth(2026, new Date('2026-09-15T00:00:00.000Z')), 7);
  });

  it('is none in January, since no month of the year has finished', () => {
    assert.equal(lastCompleteMonth(2026, new Date('2026-01-10T00:00:00.000Z')), -1);
  });

  it('is the whole year for a past year', () => {
    assert.equal(lastCompleteMonth(2025, new Date('2026-09-15T00:00:00.000Z')), 11);
  });

  it('is none for a future year', () => {
    assert.equal(lastCompleteMonth(2027, new Date('2026-09-15T00:00:00.000Z')), -1);
  });

  it('drops transactions after it', () => {
    const transactions = [
      tx({ id: 'aug', date: '2026-08-20T10:00:00.000Z' }),
      tx({ id: 'sep', date: '2026-09-02T10:00:00.000Z' }),
    ];

    const kept = filterToLastCompleteMonth(transactions, 7);

    assert.deepEqual(kept.map((t) => t.id), ['aug']);
  });

  it('keeps everything for a finished year', () => {
    const transactions = [tx({ date: '2025-12-31T10:00:00.000Z' })];

    assert.equal(filterToLastCompleteMonth(transactions, 11).length, 1);
  });

  it('keeps nothing when no month has finished', () => {
    assert.equal(filterToLastCompleteMonth([tx()], -1).length, 0);
  });
});

describe('averages', () => {
  it('divides by the months covered', () => {
    assert.equal(getMonthlyAverage(1200, 12), 100);
    assert.equal(getMonthlyAverage(800, 8), 100);
  });

  it('returns the total when no months are given', () => {
    assert.equal(getMonthlyAverage(500, 0), 500);
  });

  it('measures the change in monthly rate, not in raw totals', () => {
    // Jan-Aug of this year against Jan-Aug of last year: €800 over 8 months is
    // €100/month, against €150/month. Compared as totals the gap would look
    // like €400; compared as rates it is €50 a month.
    assert.equal(getDifferenceFromPreviousYear(800, 1200, 8), -50);
  });

  it('is nil when the monthly rate is unchanged', () => {
    assert.equal(getDifferenceFromPreviousYear(800, 800, 8), 0);
  });

  it('takes the same span for both years', () => {
    // The caller filters *both* years to the last complete month before
    // comparing — see `filterToLastCompleteMonth`. Without that, a part-finished
    // year would be measured against a whole one and always look worse.
    const midYear = [tx({ id: 'aug', date: '2026-08-20T10:00:00.000Z' })];
    const lastYear = [
      tx({ id: 'aug-25', date: '2025-08-20T10:00:00.000Z' }),
      tx({ id: 'dec-25', date: '2025-12-20T10:00:00.000Z' }),
    ];

    const kept = filterToLastCompleteMonth(lastYear, 7);

    assert.deepEqual(kept.map((t) => t.id), ['aug-25']);
    assert.equal(kept.length, midYear.length, 'both sides cover the same months');
  });
});

describe('the month range heading', () => {
  it('names the last complete month', () => {
    assert.equal(formatMonthRange(7), 'Jan–Aug');
    assert.equal(formatMonthRange(11), 'Jan–Dec');
  });

  it('is empty when no month has finished', () => {
    assert.equal(formatMonthRange(-1), '');
  });
});

describe('percentage change', () => {
  it('reports rises and falls', () => {
    assert.equal(percentageChange(150, 100), 50);
    assert.equal(percentageChange(50, 100), -50);
  });

  it('returns null with no baseline', () => {
    assert.equal(percentageChange(100, 0), null);
  });
});
