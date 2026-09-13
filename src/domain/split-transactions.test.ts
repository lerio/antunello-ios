/**
 * Tests for the vendored rolling-12-month split engine.
 *
 * This is the highest-risk logic in the app: it expands a single transaction
 * into twelve monthly instances across a window that can cross a year boundary,
 * and it must round in minor units so the twelve slices sum *exactly* to the
 * source amount. A silent error here corrupts every total in the app.
 *
 * Two kinds of assertion are used deliberately:
 *
 *   properties  hold regardless of implementation — the slices must sum to the
 *               total, JPY must round to whole yen, the remainder must land in
 *               month one. These catch real bugs.
 *   goldens     pin exact outputs so a re-vendor that changes behaviour fails
 *               loudly instead of drifting. These catch upstream changes.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Transaction } from './types';
import { getCurrencyFractionDigits } from './currency-amount-input';
import {
  expandSplitTransactionsForMonth,
  getRoundedSplitAmountForMonth,
  getTransactionDisplayAmount,
} from './split-transactions';

/** Builds a split-source transaction with sensible defaults. */
function makeSplitSource(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 'src-1',
    user_id: 'user-1',
    amount: 1200,
    currency: 'EUR',
    type: 'expense',
    main_category: 'Shopping',
    sub_category: 'Tech and Gadgets',
    title: 'Split purchase',
    date: '2025-11-15T10:00:00.000Z',
    created_at: '2025-11-15T10:00:00.000Z',
    updated_at: '2025-11-15T10:00:00.000Z',
    split_across_year: true,
    ...overrides,
  };
}

/** The twelve (year, month, offset) slots of a rolling window from a source month. */
function windowSlots(sourceYear: number, sourceMonth: number) {
  return Array.from({ length: 12 }, (_, offset) => {
    const monthIndex = sourceMonth + offset;
    return {
      offset,
      year: sourceYear + Math.floor((monthIndex - 1) / 12),
      month: ((monthIndex - 1) % 12) + 1,
    };
  });
}

/** Local-time Y-M-D of an ISO string, so assertions are timezone-independent. */
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

describe('getCurrencyFractionDigits', () => {
  // Hermes ships a less complete Intl than V8. If this returns 2 for JPY, the
  // split engine treats yen as having cents and every JPY split is wrong by
  // 100x. This assertion is the canary for that failure mode.
  it('reports 0 fraction digits for JPY', () => {
    assert.equal(getCurrencyFractionDigits('JPY'), 0);
  });

  it('reports 2 fraction digits for the other supported currencies', () => {
    for (const code of ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'CNY']) {
      assert.equal(getCurrencyFractionDigits(code), 2, `expected 2 for ${code}`);
    }
  });

  it('falls back to 2 for an unknown currency rather than throwing', () => {
    assert.equal(getCurrencyFractionDigits('NOT_A_CURRENCY'), 2);
  });
});

describe('split slices sum exactly to the source amount', () => {
  // The whole point of the minor-unit rounding. If this breaks, money appears
  // or vanishes across the twelve months of the window.
  const cases: Array<[string, number, string]> = [
    ['evenly divisible', 1200, 'EUR'],
    ['repeating remainder', 1000.01, 'EUR'],
    ['awkward thirds', 100, 'EUR'],
    ['small amount', 12.34, 'EUR'],
    ['single cent', 0.01, 'EUR'],
    ['whole yen', 1000, 'JPY'],
    ['odd yen', 999, 'JPY'],
    ['one yen', 1, 'JPY'],
  ];

  for (const [label, total, currency] of cases) {
    it(`${currency} ${total} (${label})`, () => {
      const digits = getCurrencyFractionDigits(currency);
      const totalMinor = Math.round(total * 10 ** digits);

      const slices = windowSlots(2025, 11).map((slot) =>
        getRoundedSplitAmountForMonth(total, slot.month, 11, digits),
      );

      assert.equal(slices.length, 12);
      const summedMinor = Math.round(
        slices.reduce((acc, slice) => acc + slice, 0) * 10 ** digits,
      );
      assert.equal(summedMinor, totalMinor, `${currency} ${total} slices must sum exactly`);
    });
  }

  it('puts the rounding remainder in the first month of the window', () => {
    const digits = 2;
    const first = getRoundedSplitAmountForMonth(1000.01, 11, 11, digits);
    const second = getRoundedSplitAmountForMonth(1000.01, 12, 11, digits);

    // 1000.01 / 12 = 83.334... -> 11 months of 83.33, first month absorbs 83.38
    assert.equal(first, 83.38);
    assert.equal(second, 83.33);
    assert.ok(first > second, 'first month must absorb the remainder');
  });

  it('treats yen as indivisible, with the remainder in the first month', () => {
    const digits = getCurrencyFractionDigits('JPY');
    const first = getRoundedSplitAmountForMonth(1000, 11, 11, digits);
    const second = getRoundedSplitAmountForMonth(1000, 12, 11, digits);

    // 1000 / 12 = 83.33 -> 11 months of 83 yen, first month absorbs 87
    assert.equal(first, 87);
    assert.equal(second, 83);
    assert.ok(Number.isInteger(first) && Number.isInteger(second), 'yen must not have cents');
  });
});

describe('expandSplitTransactionsForMonth', () => {
  // A generous `now` so no instance is filtered as future.
  const past = new Date('2027-01-01T00:00:00.000Z');

  it('emits the source month as editable, keeping the full amount', () => {
    const source = makeSplitSource({ amount: 1000.01 });
    const [instance] = expandSplitTransactionsForMonth([], [source], 2025, 11, past);

    assert.equal(instance.split_is_read_only, false);
    assert.equal(instance.split_source_transaction_id, null);
    assert.equal(instance.id, 'src-1', 'source month keeps the real row id');

    // The source month's row is still the real row, so `amount` stays the full
    // original. Only the *display* is reduced to this month's slice.
    assert.equal(instance.amount, 1000.01, 'amount is the untouched source amount');
    assert.equal(instance.split_display_amount, 83.38, 'display amount absorbs the remainder');
  });

  it('emits later months as read-only instances with synthetic ids', () => {
    const source = makeSplitSource({ amount: 1000.01 });
    const [instance] = expandSplitTransactionsForMonth([], [source], 2026, 1, past);

    assert.equal(instance.split_is_read_only, true);
    assert.equal(instance.split_source_transaction_id, 'src-1');
    assert.equal(instance.id, 'src-1::split::2026-01');

    // In instance months there is no real row behind the instance, so `amount`
    // itself becomes the slice and matches the display amount.
    assert.equal(instance.amount, 83.33);
    assert.equal(instance.split_display_amount, 83.33);
  });

  it('never requires callers to read `amount` directly', () => {
    // `amount` means different things in the source month (the full original)
    // and in instance months (the slice). `getTransactionDisplayAmount` is the
    // only safe accessor — reading `.amount` double-counts the source month.
    const source = makeSplitSource({ amount: 1000.01 });

    const [sourceMonth] = expandSplitTransactionsForMonth([], [source], 2025, 11, past);
    const [instanceMonth] = expandSplitTransactionsForMonth([], [source], 2026, 1, past);

    assert.notEqual(sourceMonth.amount, instanceMonth.amount);
    assert.equal(getTransactionDisplayAmount(sourceMonth), 83.38);
    assert.equal(getTransactionDisplayAmount(instanceMonth), 83.33);
  });

  it('numbers the remaining count down from 11 to 0 across the window', () => {
    const source = makeSplitSource();
    const slots = windowSlots(2025, 11);

    for (const slot of slots) {
      const [instance] = expandSplitTransactionsForMonth(
        [],
        [source],
        slot.year,
        slot.month,
        past,
      );
      assert.equal(
        instance.split_remaining_count,
        11 - slot.offset,
        `offset ${slot.offset} (${slot.year}-${slot.month})`,
      );
    }
  });

  it('does not emit instances outside the rolling window', () => {
    const source = makeSplitSource(); // window covers Nov 2025 .. Oct 2026

    assert.equal(
      expandSplitTransactionsForMonth([], [source], 2026, 11, past).length,
      0,
      'one month past the window end',
    );
    assert.equal(
      expandSplitTransactionsForMonth([], [source], 2025, 10, past).length,
      0,
      'one month before the window start',
    );
  });

  it('filters out instances that have not happened yet', () => {
    const source = makeSplitSource();
    const now = new Date('2025-12-01T00:00:00.000Z');

    assert.equal(
      expandSplitTransactionsForMonth([], [source], 2025, 11, now).length,
      1,
      'the source month has already occurred',
    );
    assert.equal(
      expandSplitTransactionsForMonth([], [source], 2026, 1, now).length,
      0,
      'January 2026 is still in the future',
    );
  });

  it('clamps the day of month to the length of the target month', () => {
    const source = makeSplitSource({ date: '2026-01-31T10:00:00.000Z' });
    const [february] = expandSplitTransactionsForMonth([], [source], 2026, 2, past);

    // January 31 has no counterpart in February; it must clamp, not roll over
    // into March.
    assert.equal(localDay(february.date), '2026-02-28');
  });

  it('passes non-split transactions through untouched', () => {
    const regular = makeSplitSource({ id: 'regular-1', split_across_year: false });
    const result = expandSplitTransactionsForMonth([regular], [], 2025, 11, past);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'regular-1');
  });

  it('ignores a source with an unparseable date rather than throwing', () => {
    const broken = makeSplitSource({ date: 'not-a-date' });
    assert.doesNotThrow(() =>
      expandSplitTransactionsForMonth([], [broken], 2025, 11, past),
    );
    assert.equal(expandSplitTransactionsForMonth([], [broken], 2025, 11, past).length, 0);
  });
});
