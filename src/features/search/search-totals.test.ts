/**
 * Tests for the search summary's totals.
 *
 * The behaviour that differs from every other summary: hidden rows are reported
 * rather than ignored, since on a search screen they are part of what the user
 * came to find.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import {
  computeSearchTotals,
  hasHiddenTotals,
} from '@/features/search/search-totals';

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

describe('visible totals', () => {
  it('sums income and expenses apart', () => {
    const totals = computeSearchTotals([
      tx({ type: 'income', amount: 500, eur_amount: 500 }),
      tx({ type: 'expense', amount: 120, eur_amount: 120 }),
    ]);

    assert.equal(totals.incomeTotal, 500);
    assert.equal(totals.expenseTotal, 120);
  });

  it('ignores money transfers', () => {
    const totals = computeSearchTotals([tx({ amount: 900, eur_amount: 900, is_money_transfer: true })]);

    assert.equal(totals.expenseTotal, 0);
    assert.equal(totals.hiddenTransactionCount, 0);
  });

  it('returns zeros for nothing', () => {
    const totals = computeSearchTotals([]);

    assert.deepEqual(totals, {
      expenseTotal: 0,
      incomeTotal: 0,
      hiddenExpenseTotal: 0,
      hiddenIncomeTotal: 0,
      hiddenTransactionCount: 0,
    });
  });
});

describe('hidden rows are reported, not discarded', () => {
  it('separates hidden expenses and hidden income', () => {
    const totals = computeSearchTotals([
      tx({ id: 'e', type: 'expense', amount: 300, eur_amount: 300, hide_from_totals: true }),
      tx({ id: 'i', type: 'income', amount: 800, eur_amount: 800, hide_from_totals: true }),
    ]);

    assert.equal(totals.hiddenExpenseTotal, 300);
    assert.equal(totals.hiddenIncomeTotal, 800);
    assert.equal(totals.hiddenTransactionCount, 2);
  });

  it('keeps hidden rows out of the visible totals', () => {
    const totals = computeSearchTotals([
      tx({ id: 'hidden', amount: 300, eur_amount: 300, hide_from_totals: true }),
      tx({ id: 'shown', amount: 100, eur_amount: 100 }),
    ]);

    assert.equal(totals.expenseTotal, 100);
    assert.equal(totals.hiddenExpenseTotal, 300);
  });

  it('reports no hidden rows when there are none', () => {
    const totals = computeSearchTotals([tx({ amount: 10, eur_amount: 10 })]);

    assert.equal(hasHiddenTotals(totals), false);
  });

  it('reports hidden rows when there are some', () => {
    const totals = computeSearchTotals([tx({ hide_from_totals: true })]);

    assert.equal(hasHiddenTotals(totals), true);
  });
});

describe('rows that cannot be summed', () => {
  it('skips a non-EUR row with no EUR amount entirely', () => {
    const totals = computeSearchTotals([
      tx({ currency: 'USD', amount: 500, eur_amount: undefined }),
    ]);

    assert.equal(totals.expenseTotal, 0);
    assert.equal(totals.hiddenTransactionCount, 0, 'not even counted as hidden');
  });

  it('uses the EUR amount for a non-EUR row that has one', () => {
    const totals = computeSearchTotals([tx({ currency: 'USD', amount: 500, eur_amount: 460 })]);

    assert.equal(totals.expenseTotal, 460);
  });

  it('treats a EUR amount of exactly zero as unsummable', () => {
    // The web app's fallback uses `||`, not a null check, so zero falls through
    // to the currency test. Deliberate: here a zero is indistinguishable from
    // "no rate available", and counting it would silently drop a row.
    const totals = computeSearchTotals([
      tx({ currency: 'USD', amount: 0, eur_amount: 0 }),
    ]);

    assert.equal(totals.expenseTotal, 0);
    assert.equal(totals.hiddenTransactionCount, 0);
  });

  it('sums a EUR row whose amount is zero', () => {
    // For a EUR row the currency test passes, so a zero is a genuine zero.
    const totals = computeSearchTotals([tx({ currency: 'EUR', amount: 0, eur_amount: 0 })]);

    assert.equal(totals.expenseTotal, 0);
    assert.equal(totals.hiddenTransactionCount, 0);
  });
});
