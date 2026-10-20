/**
 * Tests for the balance chart's anchoring.
 *
 * The property that matters is the one the design exists for: the final point
 * equals the fund total exactly, so the chart and the number beside it can
 * never disagree.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { anchorDeltas } from '@/features/balance/balance-series';

describe('anchorDeltas', () => {
  const buckets = [
    { date: '2026-08-01', delta: -10 },
    { date: '2026-09-01', delta: 20 },
  ];

  it('sets the last point to the total exactly', () => {
    assert.equal(anchorDeltas(buckets, 100).at(-1)?.balance, 100);
  });

  it('walks backwards through each bucket', () => {
    // September rose by 20, so August ended at 80.
    assert.deepEqual(anchorDeltas(buckets, 100), [
      { date: '2026-08-01', balance: 80 },
      { date: '2026-09-01', balance: 100 },
    ]);
  });

  it('has no points without buckets, and still anchors a single one', () => {
    assert.deepEqual(anchorDeltas([], 100), []);
    assert.deepEqual(anchorDeltas([{ date: '2026-09-01', delta: 5 }], 100), [
      { date: '2026-09-01', balance: 100 },
    ]);
  });
});
