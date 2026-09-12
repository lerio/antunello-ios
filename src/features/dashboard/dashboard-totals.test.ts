/**
 * Tests for the dashboard's totals.
 *
 * These are the same class of rule as the transaction list's day totals —
 * which rows count, and how a row without a usable EUR figure is treated — and
 * the two apps must agree on every one. The web app computes them inline in a
 * component, so this is the first time they are pinned.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import {
  UNCATEGORIZED,
  calculateTotals,
  listCategories,
  percentageChange,
  type DashboardComparison,
} from '@/features/dashboard/dashboard-totals';

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
    date: '2026-09-11T10:00:00.000Z',
    created_at: '2026-09-11T10:00:00.000Z',
    updated_at: '2026-09-11T10:00:00.000Z',
    ...overrides,
  };
}

describe('totals', () => {
  it('sums income and expense separately', () => {
    const totals = calculateTotals([
      tx({ type: 'income', amount: 500, eur_amount: 500 }),
      tx({ type: 'expense', amount: 120, eur_amount: 120 }),
      tx({ type: 'expense', amount: 80, eur_amount: 80 }),
    ]);

    assert.equal(totals.income, 500);
    assert.equal(totals.expense, 200);
  });

  it('returns zeros for nothing', () => {
    const totals = calculateTotals([]);

    assert.equal(totals.income, 0);
    assert.equal(totals.expense, 0);
  });

  it('excludes hidden rows', () => {
    const totals = calculateTotals([
      tx({ amount: 100, eur_amount: 100, hide_from_totals: true }),
      tx({ amount: 50, eur_amount: 50 }),
    ]);

    assert.equal(totals.expense, 50);
  });

  it('excludes money transfers, which would double the same money', () => {
    const totals = calculateTotals([
      tx({ amount: 900, eur_amount: 900, is_money_transfer: true }),
      tx({ amount: 50, eur_amount: 50 }),
    ]);

    assert.equal(totals.expense, 50);
  });

  it('excludes rows with no EUR amount', () => {
    const totals = calculateTotals([
      tx({ amount: 500, currency: 'USD', eur_amount: undefined }),
      tx({ amount: 50, eur_amount: 50 }),
    ]);

    assert.equal(totals.expense, 50, 'five hundred dollars is not five hundred euros');
  });

  it('uses the split display amount when a row has one', () => {
    const totals = calculateTotals([
      tx({ amount: 1200, eur_amount: 1200, split_across_year: true, split_display_eur_amount: 100 }),
    ]);

    assert.equal(totals.expense, 100, 'only the slice shown, not the whole source');
  });
});

describe('category breakdown', () => {
  it('groups by main category, with subcategories beneath', () => {
    const totals = calculateTotals([
      tx({ main_category: 'Groceries', sub_category: 'Supermarket', amount: 40, eur_amount: 40 }),
      tx({ main_category: 'Groceries', sub_category: 'Drugstore', amount: 60, eur_amount: 60 }),
    ]);

    assert.equal(totals.expenseCategories.Groceries.total, 100);
    assert.equal(totals.expenseCategories.Groceries.subcategories.Supermarket, 40);
    assert.equal(totals.expenseCategories.Groceries.subcategories.Drugstore, 60);
  });

  it('files a row with no subcategory under Uncategorized', () => {
    const totals = calculateTotals([tx({ sub_category: undefined, amount: 25, eur_amount: 25 })]);

    assert.equal(totals.expenseCategories.Groceries.subcategories[UNCATEGORIZED], 25);
  });

  it('keeps income and expense categories apart', () => {
    const totals = calculateTotals([
      tx({ type: 'income', main_category: 'Primary Income', amount: 3000, eur_amount: 3000 }),
      tx({ type: 'expense', main_category: 'Groceries', amount: 100, eur_amount: 100 }),
    ]);

    assert.ok(totals.incomeCategories['Primary Income']);
    assert.equal(totals.expenseCategories['Primary Income'], undefined);
    assert.ok(totals.expenseCategories.Groceries);
    assert.equal(totals.incomeCategories.Groceries, undefined);
  });

  it('does not let a hidden row into the breakdown', () => {
    const totals = calculateTotals([
      tx({ main_category: 'Travel', amount: 800, eur_amount: 800, hide_from_totals: true }),
    ]);

    assert.equal(totals.expenseCategories.Travel, undefined);
  });
});

describe('comparing categories across periods', () => {
  const empty = calculateTotals([]);

  const comparison: DashboardComparison = {
    current: calculateTotals([
      tx({ main_category: 'Groceries', amount: 300, eur_amount: 300 }),
    ]),
    previous: calculateTotals([
      tx({ main_category: 'Groceries', amount: 500, eur_amount: 500 }),
      tx({ main_category: 'Travel', amount: 200, eur_amount: 200 }),
    ]),
    lastYear: empty,
  };

  it('lists a category that has fallen to zero', () => {
    // Travel is absent this period. Dropping it would hide the most
    // interesting line in the table — that it stopped entirely.
    const categories = listCategories(comparison, 'expense');

    assert.ok(categories.includes('Travel'));
    assert.ok(categories.includes('Groceries'));
  });

  it('orders by the current period, largest first', () => {
    const withTwo = {
      ...comparison,
      current: calculateTotals([
        tx({ main_category: 'Groceries', amount: 100, eur_amount: 100 }),
        tx({ main_category: 'Travel', amount: 400, eur_amount: 400 }),
      ]),
    };

    assert.deepEqual(listCategories(withTwo, 'expense'), ['Travel', 'Groceries']);
  });

  it('lists income categories separately from expense ones', () => {
    const withIncome = {
      ...comparison,
      current: calculateTotals([
        tx({ type: 'income', main_category: 'Primary Income', amount: 3000, eur_amount: 3000 }),
      ]),
    };

    assert.deepEqual(listCategories(withIncome, 'income'), ['Primary Income']);
    assert.ok(!listCategories(withIncome, 'income').includes('Groceries'));
  });
});

describe('percentage change', () => {
  it('reports an increase', () => {
    assert.equal(percentageChange(150, 100), 50);
  });

  it('reports a decrease as negative', () => {
    assert.equal(percentageChange(50, 100), -50);
  });

  it('returns null when there is nothing to compare against', () => {
    // Dividing by a zero baseline gives infinity, which is not a figure worth
    // putting on screen.
    assert.equal(percentageChange(100, 0), null);
  });

  it('measures against the size of the baseline, not its sign', () => {
    assert.equal(percentageChange(-50, -100), 50);
  });
});
