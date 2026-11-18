import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  culpritsOf,
  moodOf,
  percentageOverTypical,
  previousMonthWindow,
} from '@/features/home/home-math';

describe('percentageOverTypical', () => {
  it('has no answer without a baseline', () => {
    assert.equal(percentageOverTypical(100, null), null);
    assert.equal(percentageOverTypical(100, 0), null);
  });

  it('reports above and below the usual figure', () => {
    assert.equal(percentageOverTypical(110, 100), 10);
    assert.equal(percentageOverTypical(90, 100), -10);
  });
});

describe('moodOf', () => {
  it('treats half a percent as in line, because the card rounds', () => {
    assert.equal(moodOf(0.5), 'inline');
    assert.equal(moodOf(-0.5), 'inline');
    assert.equal(moodOf(0.6), 'over');
    assert.equal(moodOf(-0.6), 'under');
  });

  it('is unknown without a baseline', () => {
    assert.equal(moodOf(null), 'unknown');
  });
});

describe('culpritsOf', () => {
  // Each mover has a mainCategory; the function groups by it and sums deltas.
  const movers = [
    { mainCategory: 'Groceries', delta: 50, spentToDate: 100, typicalToDate: 50 },
    { mainCategory: 'Travel', delta: 20, spentToDate: 50, typicalToDate: 30 },
    { mainCategory: 'Rent', delta: -5, spentToDate: 1000, typicalToDate: 1005 },
    { mainCategory: 'Dining', delta: -300, spentToDate: 200, typicalToDate: 500 },
  ];

  it('takes the biggest movers regardless of direction', () => {
    assert.deepEqual(
      culpritsOf(movers).map((mover) => mover.mainCategory),
      ['Dining', 'Groceries', 'Travel', 'Rent'],
    );
  });

  it('caps the list without needing the month to be over or under', () => {
    assert.deepEqual(
      culpritsOf(movers, 1).map((mover) => mover.mainCategory),
      ['Dining'],
    );
    assert.deepEqual(culpritsOf([]), []);
  });

  it('groups by main category and sums deltas', () => {
    const withSubcategories = [
      { mainCategory: 'Groceries', delta: 30, spentToDate: 60, typicalToDate: 30 },
      { mainCategory: 'Groceries', delta: 20, spentToDate: 40, typicalToDate: 20 },
      { mainCategory: 'Travel', delta: -100, spentToDate: 50, typicalToDate: 150 },
    ];
    const result = culpritsOf(withSubcategories);
    assert.equal(result.length, 2);
    const groceries = result.find((r) => r.mainCategory === 'Groceries');
    const travel = result.find((r) => r.mainCategory === 'Travel');
    assert.deepEqual(groceries?.delta, 50);
    assert.deepEqual(travel?.delta, -100);
    assert.deepEqual(groceries?.spentToDate, 100);
    assert.deepEqual(groceries?.typicalToDate, 50);
  });
});

describe('previousMonthWindow', () => {
  it('names the previous month and the same day', () => {
    assert.equal(previousMonthWindow('2026-10-01', '2026-10-19'), 'Sep 1–19');
  });

  it('clamps to the previous month’s length', () => {
    assert.equal(previousMonthWindow('2026-10-01', '2026-10-31'), 'Sep 1–30');
    assert.equal(previousMonthWindow('2026-03-01', '2026-03-31'), 'Feb 1–28');
  });
});
