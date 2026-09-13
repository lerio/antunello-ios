/**
 * Tests for the write payload.
 *
 * The fund case is the one that matters: the payload must write the id the form
 * holds, including when the fund's *name* could not be resolved. That is what
 * keeps an edit from detaching a transaction from the fund its balance is summed
 * into. The resolver that makes the id available is tested separately, in
 * `from-transaction.test.ts`.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  UNRESOLVED_FUND_NAME,
  initialFormState,
  type FormState,
} from '@/features/transactions/form/reducer';
import { toInput } from '@/features/transactions/form/to-input';

/** Form state with the given fields overridden. */
function form(overrides: Partial<FormState> = {}): FormState {
  return { ...initialFormState('edit'), amount: '12.50', title: 'Coffee', ...overrides };
}

const CASH = { id: 'fund-cash', name: 'Cash' };
const WEALTH = { id: 'fund-wealth', name: 'Wealth' };

describe('the ordinary fields', () => {
  it('carries the form through', () => {
    const input = toInput(
      form({ mainCategory: 'Dining', subCategory: 'Restaurants', currency: 'USD' }),
    );

    assert.equal(input.amount, 12.5);
    assert.equal(input.title, 'Coffee');
    assert.equal(input.main_category, 'Dining');
    assert.equal(input.sub_category, 'Restaurants');
    assert.equal(input.currency, 'USD');
    assert.equal(input.type, 'expense');
  });

  it('trims the title', () => {
    assert.equal(toInput(form({ title: '  Coffee  ' })).title, 'Coffee');
  });

  it('sends the date as a full ISO timestamp', () => {
    const date = new Date('2026-09-13T08:30:00.000Z');
    assert.equal(toInput(form({ date })).date, date.toISOString());
  });

  it('forces hide-from-totals off for a transfer', () => {
    // A transfer moves money between the user's own funds, so it can never
    // meaningfully be excluded from totals.
    const input = toInput(
      form({ isMoneyTransferMode: true, hideFromTotals: true, sourceFund: CASH, targetFund: WEALTH }),
    );

    assert.equal(input.hide_from_totals, false);
  });
});

describe('the fund the payload carries', () => {
  it('carries the id through', () => {
    assert.equal(toInput(form({ sourceFund: CASH })).fund_category_id, 'fund-cash');
  });

  it('carries the id of a fund whose name could not be resolved', () => {
    // The join between the two halves of the fix: the resolver keeps an
    // unresolvable id, and the payload must then write it rather than a null.
    // If this ever fails, editing a transaction detaches it from its fund.
    const state = form({ sourceFund: { id: 'fund-gone', name: UNRESOLVED_FUND_NAME } });

    assert.equal(toInput(state).fund_category_id, 'fund-gone');
  });

  it('is null when there is no fund', () => {
    assert.equal(toInput(form()).fund_category_id, null);
  });

  it('carries a transfer target only for a transfer', () => {
    assert.equal(
      toInput(form({ isMoneyTransferMode: true, targetFund: WEALTH })).target_fund_category_id,
      'fund-wealth',
    );
    assert.equal(toInput(form({ targetFund: WEALTH })).target_fund_category_id, null);
  });
});
