import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { niceTicks, xTickIndices } from '@/features/balance/chart-ticks';

describe('niceTicks', () => {
  it('rounds a typical range to 5k steps', () => {
    assert.deepEqual(niceTicks(95000, 109000), [95000, 100000, 105000, 110000]);
  });

  it('covers the data and handles a flat series', () => {
    assert.ok(niceTicks(1012, 1987)[0] <= 1012);
    assert.ok(niceTicks(1012, 1987).at(-1)! >= 1987);
    assert.deepEqual(niceTicks(100, 100), [100]);
  });

  it('caps the axis at four lines when rounding adds extra ticks', () => {
    const ticks = niceTicks(94000, 106000);
    assert.ok(ticks.length <= 4);
    assert.ok(ticks[0] <= 94000);
    assert.ok(ticks.at(-1)! >= 106000);
  });
});

describe('xTickIndices', () => {
  it('labels every seventh day for a month', () => {
    const dates = Array.from({ length: 10 }, (_, index) =>
      `2026-10-${String(index + 1).padStart(2, '0')}`,
    );
    assert.deepEqual(xTickIndices(dates, '1m'), [0, 7]);
  });

  it('labels each month once for a year, thinned to every second month', () => {
    const dates: string[] = [];
    for (let month = 0; month < 12; month += 1) {
      dates.push(`2025-${String(month + 1).padStart(2, '0')}-01`);
      dates.push(`2025-${String(month + 1).padStart(2, '0')}-15`);
    }
    assert.deepEqual(xTickIndices(dates, '1y'), [0, 4, 8, 12, 16, 20]);
  });

  it('labels each year once for a long range', () => {
    const dates = ['2020-01-01', '2020-02-01', '2021-01-01', '2022-01-01'];
    assert.deepEqual(xTickIndices(dates, '5y'), [0, 2, 3]);
  });
});
