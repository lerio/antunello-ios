/**
 * Tests for the pending review mapping.
 *
 * The amount sign is the case worth pinning: banks report an expense as a
 * negative number, and the form works in magnitudes with the direction coming
 * from the type. Passing the raw sign through would fail validation on an amount
 * the user never typed.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { FundCategory } from '@/domain/types';
import { UNRESOLVED_FUND_NAME } from '@/features/transactions/form/reducer';
import { formStateFromPending, hasTrBonuses } from '@/features/pending/from-pending';
import type { PendingTransaction } from '@/features/pending/types';

function pending(overrides: Partial<PendingTransaction['data']> = {}): PendingTransaction {
  return {
    id: 'p1',
    user_id: 'u1',
    status: 'pending',
    external_id: 'ext-1',
    created_at: '2026-09-11T10:00:00.000Z',
    updated_at: '2026-09-11T10:00:00.000Z',
    data: {
      amount: -12.5,
      currency: 'EUR',
      type: 'expense',
      title: 'COFFEE',
      date: '2026-09-11T08:30:00.000Z',
      ...overrides,
    },
  };
}

function fund(overrides: Partial<FundCategory> = {}): FundCategory {
  return {
    id: 'f1',
    user_id: 'u1',
    name: 'Trade Republic',
    description: '',
    currency: 'EUR',
    amount: 0,
    is_active: true,
    order_index: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the review form state', () => {
  it('opens in the accept-pending mode', () => {
    assert.equal(formStateFromPending(pending()).mode, 'accept-pending');
  });

  it('takes the magnitude of a negative expense', () => {
    // The bank's sign says which way the money went; the form's `type` says the
    // same thing, and a negative amount would be rejected as invalid.
    assert.equal(formStateFromPending(pending({ amount: -12.5 })).amount, '12.5');
  });

  it('takes the magnitude of a positive income', () => {
    assert.equal(
      formStateFromPending(pending({ amount: 2480, type: 'income' })).amount,
      '2480',
    );
  });

  it('defaults to an expense when the provider did not say', () => {
    assert.equal(formStateFromPending(pending({ type: undefined })).type, 'expense');
  });

  it('carries the title and date through', () => {
    const state = formStateFromPending(pending());

    assert.equal(state.title, 'COFFEE');
    assert.equal(state.date.toISOString(), '2026-09-11T08:30:00.000Z');
  });

  it('falls back to EUR for a currency the form does not offer', () => {
    // Better a wrong currency the user can see and change than an amount
    // silently interpreted as euros.
    assert.equal(formStateFromPending(pending({ currency: 'GBP' })).currency, 'EUR');
  });

  it('keeps the currencies the form does offer', () => {
    assert.equal(formStateFromPending(pending({ currency: 'USD' })).currency, 'USD');
    assert.equal(formStateFromPending(pending({ currency: 'JPY' })).currency, 'JPY');
  });

  it('leaves the categories empty', () => {
    // They are what the user is being asked for. Pre-filling a guess would
    // invite accepting it.
    const state = formStateFromPending(pending({ main_category: 'Dining' }));

    assert.equal(state.mainCategory, '');
    assert.equal(state.subCategory, '');
  });

  it('resolves the provider fund to a name', () => {
    const state = formStateFromPending(pending({ fund_category_id: 'f1' }), [fund()]);

    assert.deepEqual(state.sourceFund, { id: 'f1', name: 'Trade Republic' });
  });

  it('keeps the id when the fund is not in the list, with a stand-in name', () => {
    // The bank's mapping is the only reason this row is attributed to a fund, so
    // losing it here would discard what the sync recorded — and the review
    // screen has no fund control to put it back. The name is presentation; the
    // id is data.
    const state = formStateFromPending(pending({ fund_category_id: 'gone' }), [fund()]);

    assert.deepEqual(state.sourceFund, { id: 'gone', name: UNRESOLVED_FUND_NAME });
  });

  it('keeps the id even when the fund list is empty', () => {
    // The list is empty on a cold start, and after a failed fetch — which the
    // screen cannot tell apart from "this user has no funds".
    const state = formStateFromPending(pending({ fund_category_id: 'f1' }), []);

    assert.deepEqual(state.sourceFund, { id: 'f1', name: UNRESOLVED_FUND_NAME });
  });

  it('leaves the fund empty when there is none', () => {
    assert.equal(formStateFromPending(pending(), [fund()]).sourceFund, null);
  });
});

describe('detecting Trade Republic bonuses', () => {
  it('is false for a plain card payment', () => {
    assert.equal(hasTrBonuses(pending()), false);
  });

  it('is true for a saveback', () => {
    assert.equal(hasTrBonuses(pending({ saveback_amount: 0.12 })), true);
  });

  it('is true for a round-up', () => {
    assert.equal(hasTrBonuses(pending({ round_up_amount: 1.4 })), true);
  });

  it('is false when the amounts are zero', () => {
    // The sync writes zeroes rather than omitting the fields on most payments,
    // and a zero bonus is not a bonus.
    assert.equal(hasTrBonuses(pending({ saveback_amount: 0, round_up_amount: 0 })), false);
  });
});
