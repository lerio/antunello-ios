/**
 * Tests for the category chart's bucketing.
 *
 * The behaviour worth defending is the pre-seeded grid: every bucket in the
 * range exists, at zero if nothing happened. Skipping empty buckets would
 * silently compress time and make a quiet month look like it never occurred.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from '@/domain/types';
import { calculateCategoryHistory } from '@/features/category/category-history';

/** A fixed reference date, so bucket counts are stable. */
const NOW = new Date('2026-09-12T12:00:00.000Z');

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

/** The bucket a date falls in, for a given range. */
function keyFor(isoDate: string, range: '1m' | '1y' | '5y' | 'all'): string {
  const date = new Date(isoDate);
  if (range === '1m') return date.toISOString().split('T')[0];
  if (range === '1y') {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
  }
  return `${date.getFullYear()}-01-01`;
}

describe('bucket grids', () => {
  it('produces roughly a month of daily buckets for 1m', () => {
    const { dataPoints } = calculateCategoryHistory([], '1m', NOW);

    // Thirty days back plus today.
    assert.equal(dataPoints.length, 31);
  });

  it('produces twelve monthly buckets for 1y', () => {
    const { dataPoints } = calculateCategoryHistory([], '1y', NOW);

    assert.equal(dataPoints.length, 12);
    // Runs from October last year through September this year.
    assert.equal(dataPoints[0].date, '2025-10-01');
    assert.equal(dataPoints.at(-1)!.date, '2026-09-01');
  });

  it('produces five yearly buckets for 5y', () => {
    const { dataPoints } = calculateCategoryHistory([], '5y', NOW);

    assert.equal(dataPoints.length, 5);
    assert.equal(dataPoints[0].date, '2022-01-01');
    assert.equal(dataPoints.at(-1)!.date, '2026-01-01');
  });

  it('starts "all" at the earliest transaction rather than at the epoch', () => {
    const { dataPoints } = calculateCategoryHistory(
      [tx({ date: '2024-03-01T10:00:00.000Z' })],
      'all',
      NOW,
    );

    assert.equal(dataPoints.length, 3, '2024 to 2026 inclusive');
    assert.equal(dataPoints[0].date, '2024-01-01');
  });

  it('produces nothing for "all" with no transactions', () => {
    const { dataPoints } = calculateCategoryHistory([], 'all', NOW);

    assert.equal(dataPoints.length, 0);
  });
});

describe('a quiet period still occupies its bucket', () => {
  it('keeps every bucket, at zero where nothing happened', () => {
    const { dataPoints } = calculateCategoryHistory(
      [tx({ date: '2026-09-11T10:00:00.000Z', eur_amount: 50 })],
      '1m',
      NOW,
    );

    assert.equal(dataPoints.length, 31, 'the empty days are still there');
    assert.equal(dataPoints.filter((point) => point.amount === 0).length, 30);
  });

  it('places spending in the right bucket', () => {
    const { dataPoints } = calculateCategoryHistory(
      [tx({ date: '2026-09-11T10:00:00.000Z', eur_amount: 50 })],
      '1m',
      NOW,
    );

    const bucket = dataPoints.find((point) => point.date === keyFor('2026-09-11T10:00:00.000Z', '1m'));

    assert.equal(bucket?.amount, 50);
    assert.equal(bucket?.transactionCount, 1);
  });

  it('groups a whole month into one yearly bucket', () => {
    const { dataPoints } = calculateCategoryHistory(
      [
        tx({ id: 'a', date: '2026-03-05T10:00:00.000Z', eur_amount: 30 }),
        tx({ id: 'b', date: '2026-08-20T10:00:00.000Z', eur_amount: 70 }),
      ],
      'all',
      NOW,
    );

    const thisYear = dataPoints.find((point) => point.date === '2026-01-01');

    assert.equal(thisYear?.amount, 100);
    assert.equal(thisYear?.transactionCount, 2);
  });
});

describe('which rows are charted', () => {
  it('excludes hidden rows', () => {
    const stats = calculateCategoryHistory(
      [tx({ eur_amount: 100, hide_from_totals: true })],
      '1m',
      NOW,
    );

    assert.equal(stats.totalAmount, 0);
    assert.ok(stats.dataPoints.every((point) => point.amount === 0));
  });

  it('excludes rows with no EUR amount', () => {
    const stats = calculateCategoryHistory(
      [tx({ currency: 'USD', eur_amount: undefined })],
      '1m',
      NOW,
    );

    assert.equal(stats.totalTransactions, 0);
  });

  it('counts totals and transactions', () => {
    const stats = calculateCategoryHistory(
      [
        tx({ id: 'a', eur_amount: 30 }),
        tx({ id: 'b', eur_amount: 70 }),
      ],
      '1m',
      NOW,
    );

    assert.equal(stats.totalAmount, 100);
    assert.equal(stats.totalTransactions, 2);
  });

  it('still totals a transaction that falls outside the bucket grid', () => {
    // A future-dated row has no bucket to sit in, but it is still spending and
    // should not vanish from the headline figure.
    const stats = calculateCategoryHistory(
      [tx({ date: '2030-01-01T10:00:00.000Z', eur_amount: 25 })],
      '1m',
      NOW,
    );

    assert.equal(stats.totalAmount, 25);
    assert.ok(stats.dataPoints.every((point) => point.amount === 0));
  });
});
