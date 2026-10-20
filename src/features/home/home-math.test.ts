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
  // Ordered as the RPC returns them: largest delta first.
  const movers = [
    { name: 'Groceries', delta: 50 },
    { name: 'Travel', delta: 20 },
    { name: 'Rent', delta: -5 },
    { name: 'Dining', delta: -300 },
  ];

  it('takes the biggest over-spends when running hot', () => {
    assert.deepEqual(
      culpritsOf(movers, 'over').map((mover) => mover.name),
      ['Groceries', 'Travel'],
    );
  });

  it('takes the biggest under-spends, most negative first, when running cold', () => {
    assert.deepEqual(
      culpritsOf(movers, 'under').map((mover) => mover.name),
      ['Dining', 'Rent'],
    );
  });

  it('caps the list and stays empty when in line', () => {
    assert.equal(culpritsOf(movers, 'over', 1).length, 1);
    assert.deepEqual(culpritsOf(movers, 'inline'), []);
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
