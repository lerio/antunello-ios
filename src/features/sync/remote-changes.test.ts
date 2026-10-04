/**
 * Tests for remote-change detection.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeRemoteChange,
  detectRemoteChange,
  getLocalWriteCount,
  markLocalWrite,
} from '@/features/sync/remote-changes';

const v = (count: number, lastUpdate: string) => ({ count, lastUpdate });

describe('detectRemoteChange', () => {
  it('only takes a baseline on the first poll', () => {
    const result = detectRemoteChange(null, v(10, 'a'));
    assert.deepEqual(result, { next: v(10, 'a'), change: null });
  });

  it('reports nothing when neither figure moved', () => {
    const baseline = v(10, 'a');
    const result = detectRemoteChange(baseline, v(10, 'a'));
    assert.equal(result.change, null);
    assert.equal(result.next, baseline);
  });

  it('reports added rows', () => {
    const result = detectRemoteChange(v(10, 'a'), v(12, 'b'));
    assert.deepEqual(result.change, { delta: 2 });
    assert.deepEqual(result.next, v(12, 'b'));
  });

  it('reports removed rows as a positive count', () => {
    assert.deepEqual(detectRemoteChange(v(10, 'a'), v(9, 'a')).change, { delta: 1 });
  });

  it('reports an edit, which moves only the timestamp, as a zero delta', () => {
    assert.deepEqual(detectRemoteChange(v(10, 'a'), v(10, 'b')).change, { delta: 0 });
  });
});

describe('banner wording', () => {
  it('words edits, one addition and several', () => {
    assert.equal(describeRemoteChange({ delta: 0 }), 'Transactions updated on another device');
    assert.equal(describeRemoteChange({ delta: 1 }), '1 new transaction available');
    assert.equal(describeRemoteChange({ delta: 3 }), '3 new transactions available');
  });
});

describe('local write counter', () => {
  it('increases with each write', () => {
    const before = getLocalWriteCount();
    markLocalWrite();
    assert.equal(getLocalWriteCount(), before + 1);
  });
});
