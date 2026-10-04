/**
 * Tests for budget progress.
 *
 * The thresholds are strict inequalities and the percentage is rounded, so
 * exactly-90 and exactly-100 are the cases worth asserting on — they are where a
 * reasonable-looking implementation would disagree with the web app.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Budget, Transaction } from '@/domain/types';
import {
  budgetProgress,
  computeSpendingByCategory,
  selectableBudgetCategories,
} from '@/features/budgets/budget-progress';

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    user_id: 'u1',
    amount: 10,
    currency: 'EUR',
    type: 'expense',
    main_category: 'Dining',
    sub_category: 'Restaurants',
    title: 'Test',
    date: '2026-09-11T10:00:00.000Z',
    created_at: '2026-09-11T10:00:00.000Z',
    updated_at: '2026-09-11T10:00:00.000Z',
    eur_amount: 10,
    ...overrides,
  };
}

function budget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: 'b1',
    user_id: 'u1',
    category: 'Dining',
    amount: 500,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('spending by category', () => {
  it('sums expenses under their main category', () => {
    const spending = computeSpendingByCategory([
      tx({ amount: 30, eur_amount: 30 }),
      tx({ id: 't2', amount: 20, eur_amount: 20 }),
      tx({ id: 't3', main_category: 'Groceries', amount: 15, eur_amount: 15 }),
    ]);

    assert.equal(spending.Dining, 50);
    assert.equal(spending.Groceries, 15);
  });

  it('ignores income', () => {
    const spending = computeSpendingByCategory([
      tx({ type: 'income', amount: 2000, eur_amount: 2000 }),
    ]);

    assert.deepEqual(spending, {});
  });

  it('ignores money transfers', () => {
    const spending = computeSpendingByCategory([
      tx({ amount: 900, eur_amount: 900, is_money_transfer: true }),
    ]);

    assert.deepEqual(spending, {});
  });

  it('ignores rows hidden from totals', () => {
    const spending = computeSpendingByCategory([
      tx({ amount: 300, eur_amount: 300, hide_from_totals: true }),
    ]);

    assert.deepEqual(spending, {});
  });

  it('prefers the EUR amount for a non-EUR row', () => {
    const spending = computeSpendingByCategory([
      tx({ currency: 'USD', amount: 100, eur_amount: 92 }),
    ]);

    assert.equal(spending.Dining, 92);
  });

  it('falls back to the face amount when the EUR amount is zero', () => {
    // The web app's fallback is `||`, not a null check: a zero EUR amount — a
    // missing conversion as much as a genuine zero — is counted at face value.
    const spending = computeSpendingByCategory([
      tx({ currency: 'USD', amount: 100, eur_amount: 0 }),
    ]);

    assert.equal(spending.Dining, 100);
  });

  it('returns an empty record for a month with nothing in it', () => {
    assert.deepEqual(computeSpendingByCategory([]), {});
  });

  it('reports a category with no spending as absent, not as zero', () => {
    const spending = computeSpendingByCategory([tx()]);

    assert.equal(spending.Groceries, undefined);
  });
});

describe('progress against a limit', () => {
  it('reports the spent fraction as a rounded percentage', () => {
    assert.equal(budgetProgress(budget({ amount: 500 }), 250).percentage, 50);
    assert.equal(budgetProgress(budget({ amount: 300 }), 100).percentage, 33);
  });

  it('rounds rather than truncates', () => {
    // 5/8 is 62.5%, which must not become 62.
    assert.equal(budgetProgress(budget({ amount: 800 }), 500).percentage, 63);
  });

  it('reports what is left', () => {
    const progress = budgetProgress(budget({ amount: 500 }), 120);

    assert.equal(progress.remaining, 380);
    assert.equal(progress.isOverBudget, false);
  });

  it('reports how far over when the limit is passed', () => {
    const progress = budgetProgress(budget({ amount: 500 }), 620);

    assert.equal(progress.remaining, -120);
    assert.equal(progress.isOverBudget, true);
    assert.equal(progress.percentage, 124);
  });

  it('treats spending exactly at the limit as not over, but warns', () => {
    const progress = budgetProgress(budget({ amount: 500 }), 500);

    assert.equal(progress.isOverBudget, false, 'over is about the money, not the bar');
    assert.equal(progress.remaining, 0);
    assert.equal(progress.level, 'warning');
  });

  it('treats exactly 90% as normal', () => {
    // A strict `>`: 90% is the end of the normal band, not the start of the
    // warning one.
    assert.equal(budgetProgress(budget({ amount: 1000 }), 900).level, 'normal');
  });

  it('compares the rounded percentage, not the raw ratio', () => {
    // 90.1% rounds to 90, which is not past the threshold. The web app rounds
    // before it compares, so the band edges land on whole percentages rather
    // than on the underlying fractions — worth pinning down, because comparing
    // the raw ratio would look equally reasonable and disagree at the margins.
    assert.equal(budgetProgress(budget({ amount: 1000 }), 901).level, 'normal');
    assert.equal(budgetProgress(budget({ amount: 1000 }), 910).level, 'warning');
  });

  it('only goes over once the rounded percentage passes 100', () => {
    // Spending past the limit is not enough on its own: 100.5% of the limit
    // still reads as 100%, and 100 is not over. The level turns at the point the
    // rounded figure reaches 101.
    assert.equal(budgetProgress(budget({ amount: 1000 }), 1005).percentage, 100);
    assert.equal(budgetProgress(budget({ amount: 1000 }), 1005).level, 'warning');
    assert.equal(budgetProgress(budget({ amount: 1000 }), 1006).level, 'over');

    // Yet it *is* over budget the whole time, because that is about the money.
    assert.equal(budgetProgress(budget({ amount: 1000 }), 1005).isOverBudget, true);
    assert.equal(budgetProgress(budget({ amount: 1000 }), 1005).remaining, -5);
  });

  it('clamps the bar but not the percentage', () => {
    const progress = budgetProgress(budget({ amount: 100 }), 400);

    assert.equal(progress.percentage, 400);
    assert.equal(progress.barWidth, 100);
  });

  it('clamps the bar at zero for a negative spend', () => {
    // Reachable when a month's only rows are refunds against that category.
    const progress = budgetProgress(budget({ amount: 500 }), -50);

    assert.equal(progress.percentage, -10);
    assert.equal(progress.barWidth, 0);
    assert.equal(progress.isOverBudget, false);
  });
});

describe('which categories a budget may be set for', () => {
  it('offers every expense category when none are taken', () => {
    assert.equal(selectableBudgetCategories([]).length, 15);
  });

  it('never offers income categories or Money Transfer', () => {
    const categories = selectableBudgetCategories([]);

    assert.ok(!categories.includes('Primary Income'));
    assert.ok(!categories.includes('Other Income'));
    assert.ok(!categories.includes('Money Transfer'));
  });

  it('keeps the edited category even when it is an income category', () => {
    assert.ok(selectableBudgetCategories([], 'Primary Income').includes('Primary Income'));
  });

  it('omits categories that already have a budget', () => {
    const categories = selectableBudgetCategories(['Dining']);

    assert.equal(categories.length, 14);
    assert.ok(!categories.includes('Dining'));
  });

  it('keeps the category being edited', () => {
    const categories = selectableBudgetCategories(['Dining', 'Groceries'], 'Dining');

    assert.ok(categories.includes('Dining'));
    assert.ok(!categories.includes('Groceries'));
  });

  it('returns the categories sorted', () => {
    const categories = selectableBudgetCategories([]);

    assert.deepEqual(categories, [...categories].sort());
  });
});
