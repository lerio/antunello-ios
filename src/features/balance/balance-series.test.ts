/**
 * Tests for the balance chart's series.
 *
 * The property that matters most is the one the whole design exists for: the
 * final point equals the Balance card total exactly, so the chart and the card
 * beside it can never disagree. Everything else here guards the rules that
 * decide which transactions move the line.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import { buildAnchoredSeries } from '@/features/balance/balance-series';

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
    eur_amount: 10,
    ...overrides,
  };
}

const WINDOW_START = '2026-09-01';
const WINDOW_END = '2026-09-10';
/** After every transaction above, so nothing is filtered as future. */
const NOW = new Date('2026-09-30T00:00:00.000Z');

function build(transactions: Transaction[], anchor = 1000) {
  return buildAnchoredSeries(transactions, WINDOW_START, WINDOW_END, anchor, '1m', NOW);
}

describe('the anchor', () => {
  it('sets the last point to the card total exactly', () => {
    const points = build([tx({ amount: 250, eur_amount: 250 })], 1234.56);

    assert.equal(points.at(-1)!.balance, 1234.56);
  });

  it('holds even with no transactions at all', () => {
    const points = build([], 987.65);

    assert.equal(points.at(-1)!.balance, 987.65);
    assert.ok(points.every((p) => p.balance === 987.65), 'a flat line');
  });

  it('holds for a negative balance', () => {
    const points = build([tx({ type: 'expense', amount: 500, eur_amount: 500 })], -250.25);

    assert.equal(points.at(-1)!.balance, -250.25);
  });
});

describe('the backwards walk', () => {
  it('subtracts an expense from every earlier point', () => {
    // A €100 expense on the 5th: before it, the balance was €100 higher.
    const points = build(
      [tx({ date: '2026-09-05T10:00:00.000Z', amount: 100, eur_amount: 100 })],
      1000,
    );

    const before = points.find((p) => p.date === '2026-09-04')!;
    const after = points.find((p) => p.date === '2026-09-05')!;

    assert.equal(after.balance, 1000);
    assert.equal(before.balance, 1100, 'the expense had not happened yet');
  });

  it('adds an income to every earlier point', () => {
    const points = build(
      [tx({ type: 'income', date: '2026-09-05T10:00:00.000Z', amount: 400, eur_amount: 400 })],
      1000,
    );

    assert.equal(points.find((p) => p.date === '2026-09-04')!.balance, 600);
  });

  it('nets a day containing both an income and an expense', () => {
    const points = build(
      [
        tx({ type: 'income', date: '2026-09-05T09:00:00.000Z', amount: 300, eur_amount: 300 }),
        tx({ type: 'expense', date: '2026-09-05T18:00:00.000Z', amount: 100, eur_amount: 100 }),
      ],
      1000,
    );

    const before = points.find((p) => p.date === '2026-09-04')!;
    assert.equal(before.balance, 800, 'net +200 happened that day');
  });
});

describe('which transactions move the line', () => {
  it('ignores money transfers, which do not change the total', () => {
    const points = build(
      [tx({ is_money_transfer: true, amount: 5000, eur_amount: 5000 })],
      1000,
    );

    assert.ok(points.every((p) => p.balance === 1000), 'a transfer nets to nothing');
  });

  it('includes hidden rows, because the card does', () => {
    // The Balance card has no hide_from_totals filter. Excluding these would
    // make the chart disagree with the card it is anchored to.
    const points = build(
      [tx({ hide_from_totals: true, date: '2026-09-05T10:00:00.000Z', amount: 100, eur_amount: 100 })],
      1000,
    );

    assert.equal(points.find((p) => p.date === '2026-09-04')!.balance, 1100);
  });

  it('ignores rows with no EUR amount, which cannot be summed', () => {
    const points = build(
      [tx({ currency: 'USD', amount: 500, eur_amount: undefined })],
      1000,
    );

    assert.ok(points.every((p) => p.balance === 1000));
  });

  it('counts transactions and totals income and expense per bucket', () => {
    const points = build([
      tx({ type: 'income', date: '2026-09-05T09:00:00.000Z', amount: 300, eur_amount: 300 }),
      tx({ type: 'expense', date: '2026-09-05T18:00:00.000Z', amount: 100, eur_amount: 100 }),
    ]);

    const day = points.find((p) => p.date === '2026-09-05')!;
    assert.equal(day.income, 300);
    assert.equal(day.expense, 100);
    assert.equal(day.transactionCount, 2);
  });
});

describe('bucket granularity', () => {
  it('is daily for the short ranges', () => {
    const points = build([]);

    // 1st to the 10th inclusive.
    assert.equal(points.length, 10);
    assert.equal(points[0].date, '2026-09-01');
    assert.equal(points.at(-1)!.date, '2026-09-10');
  });

  it('is monthly for the all-time range', () => {
    const points = buildAnchoredSeries([], '2026-01-01', '2026-04-15', 500, 'all', NOW);

    assert.deepEqual(
      points.map((p) => p.date),
      ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01'],
    );
  });

  it('is weekly, starting Monday, for the five-year range', () => {
    // 2026-09-01 is a Tuesday, so its week starts Monday the 31st of August.
    const points = buildAnchoredSeries([], '2026-09-01', '2026-09-20', 500, '5y', NOW);

    assert.equal(points[0].date, '2026-08-31');
    assert.equal(points[1].date, '2026-09-07', 'seven days later');
  });
});

describe('the split-adjusted overlay', () => {
  const splitSource = tx({
    id: 'split-1',
    date: '2026-09-05T10:00:00.000Z',
    amount: 1200,
    eur_amount: 1200,
    split_across_year: true,
  });

  it('is absent when nothing is split', () => {
    const points = build([tx({ amount: 50, eur_amount: 50 })]);

    assert.ok(points.every((p) => p.splitAdjustedBalance === null));
  });

  it('appears where a split is accruing', () => {
    const points = build([splitSource]);

    const onSourceDay = points.find((p) => p.date === '2026-09-05')!;
    assert.notEqual(
      onSourceDay.splitAdjustedBalance,
      null,
      'the source month has only accrued one slice of twelve',
    );

    // The real series books the whole €1200 on this day; the adjusted one has
    // accrued a single €100 slice, so it sits **higher** — the eleven slices
    // not yet spent are still in the account. It is easy to assume the
    // opposite, hence the explicit figure.
    assert.equal(
      onSourceDay.splitAdjustedBalance! - onSourceDay.balance,
      1100,
      'eleven unaccrued slices of €100',
    );
  });

  it('is absent before the split happens', () => {
    const points = build([splitSource]);

    const before = points.find((p) => p.date === '2026-09-04')!;
    assert.equal(before.splitAdjustedBalance, null, 'nothing has accrued yet');
  });

  it('leaves the real series showing the full amount on the source day', () => {
    const points = build([splitSource], 5000);

    // Booked in full, so the walk-back subtracts the whole €1200.
    assert.equal(points.find((p) => p.date === '2026-09-04')!.balance, 6200);
  });
});
