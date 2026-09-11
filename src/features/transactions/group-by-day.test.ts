/**
 * Tests for the day grouping and its totals.
 *
 * The web app computes these numbers inline in a component, so this is the
 * first time they are pinned by tests. Every rule below is one the two apps
 * must agree on, and each is easy to get subtly wrong in a way that only shows
 * up as a total being slightly off.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import { groupTransactionsByDay } from '@/features/transactions/group-by-day';

/** Builds a transaction with sensible defaults. */
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

/** Total of a day group, both kinds added together. */
function combinedTotal(group: { dailyTotal: number; dailySplitTotal: number }): number {
  return group.dailyTotal + group.dailySplitTotal;
}

describe('grouping', () => {
  it('returns nothing for no transactions', () => {
    assert.deepEqual(groupTransactionsByDay([]), []);
  });

  it('puts transactions on the same day in one group', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'a', date: '2026-09-11T09:00:00.000Z' }),
      tx({ id: 'b', date: '2026-09-11T18:00:00.000Z' }),
    ]);

    assert.equal(groups.length, 1);
    assert.equal(groups[0].transactions.length, 2);
  });

  it('separates different days', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'a', date: '2026-09-11T09:00:00.000Z' }),
      tx({ id: 'b', date: '2026-09-10T09:00:00.000Z' }),
    ]);

    assert.equal(groups.length, 2);
  });

  it('preserves the incoming order, so the newest day comes first', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'newer', date: '2026-09-11T09:00:00.000Z' }),
      tx({ id: 'older', date: '2026-09-10T09:00:00.000Z' }),
    ]);

    assert.equal(groups[0].transactions[0].id, 'newer');
    assert.equal(groups[1].transactions[0].id, 'older');
  });
});

describe('daily totals', () => {
  it('counts an expense as negative and an income as positive', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'out', amount: 30, type: 'expense' }),
      tx({ id: 'in', amount: 100, type: 'income' }),
    ]);

    assert.equal(groups[0].dailyTotal, 70);
  });

  it('excludes hidden rows from the total but still counts them', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'visible', amount: 30 }),
      tx({ id: 'hidden', amount: 500, hide_from_totals: true }),
    ]);

    assert.equal(groups[0].dailyTotal, -30, 'the hidden amount must not count');
    assert.equal(groups[0].transactions.length, 2, 'but the row is still listed');
    assert.equal(groups[0].hiddenCount, 1);
  });

  it('excludes money transfers, which only move money between own accounts', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'visible', amount: 30 }),
      tx({ id: 'transfer', amount: 900, is_money_transfer: true }),
    ]);

    assert.equal(groups[0].dailyTotal, -30);
  });

  it('contributes nothing for a non-EUR row with no EUR amount', () => {
    // Only a EUR amount can be summed into a EUR total. Falling back to the
    // face value here would add yen or dollars as though they were euros.
    const groups = groupTransactionsByDay([
      tx({ id: 'usd', amount: 500, currency: 'USD', eur_amount: undefined }),
    ]);

    assert.equal(groups[0].dailyTotal, 0);
  });

  it('uses the EUR amount when a non-EUR row has one', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'usd', amount: 500, currency: 'USD', eur_amount: 460 }),
    ]);

    assert.equal(groups[0].dailyTotal, -460);
  });

  it('prefers the split display amount over the stored EUR amount', () => {
    // A split instance shows one slice of its source, so the display amount is
    // what counts — using `eur_amount` would count the whole original.
    const groups = groupTransactionsByDay([
      tx({
        id: 'slice',
        amount: 1200,
        eur_amount: 1200,
        split_across_year: true,
        split_display_eur_amount: 100,
      }),
    ]);

    assert.equal(groups[0].dailySplitTotal, -100);
    assert.equal(combinedTotal(groups[0]), -100);
  });
});

describe('split totals are kept separate', () => {
  it('routes split instances to dailySplitTotal, not dailyTotal', () => {
    const groups = groupTransactionsByDay([
      tx({ id: 'normal', amount: 30 }),
      tx({ id: 'split', amount: 100, split_across_year: true }),
    ]);

    assert.equal(groups[0].dailyTotal, -30);
    assert.equal(groups[0].dailySplitTotal, -100);
    assert.equal(combinedTotal(groups[0]), -130);
  });

  it('leaves dailySplitTotal at zero when nothing is split', () => {
    const groups = groupTransactionsByDay([tx({ amount: 30 })]);

    assert.equal(groups[0].dailySplitTotal, 0);
  });

  it('keeps hidden splits out of the split total too', () => {
    const groups = groupTransactionsByDay([
      tx({ amount: 100, split_across_year: true, hide_from_totals: true }),
    ]);

    assert.equal(groups[0].dailySplitTotal, 0);
    assert.equal(groups[0].hiddenCount, 1);
  });
});
