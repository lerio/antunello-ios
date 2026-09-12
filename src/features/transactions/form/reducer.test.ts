/**
 * Tests for the transaction form's state machine.
 *
 * The rules under test are the ones the web app maintains through five
 * interdependent `useEffect`s. They are the kind that fail quietly — a category
 * silently left attached to the wrong type, or a yen amount keeping cents —
 * rather than producing an error anyone would notice.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { TitleSuggestion } from '@/domain/types';
import {
  MONEY_TRANSFER_CATEGORY,
  formReducer,
  initialFormState,
  isSubmittable,
  validate,
  type FormAction,
  type FormState,
} from '@/features/transactions/form/reducer';

/** Applies a sequence of actions from a starting state. */
function apply(state: FormState, ...actions: FormAction[]): FormState {
  return actions.reduce(formReducer, state);
}

/** A title suggestion, as the trigger would have recorded it. */
function suggestion(overrides: Partial<TitleSuggestion> = {}): TitleSuggestion {
  return {
    id: 's1',
    user_id: 'u1',
    title: 'Tesco',
    type: 'expense',
    main_category: 'Groceries',
    sub_category: 'Supermarket',
    frequency: 1,
    last_used_at: '2026-09-01T00:00:00.000Z',
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/** A state with a valid expense filled in, for tests about something else. */
function validExpense(): FormState {
  return apply(
    initialFormState(),
    { kind: 'setAmount', value: '12.50' },
    { kind: 'setTitle', value: 'Lunch' },
    { kind: 'setMainCategory', value: 'Dining' },
    { kind: 'setSubCategory', value: 'Restaurants' },
  );
}

describe('money transfer mode', () => {
  it('forces the expense type and the Money Transfer category', () => {
    const state = apply(initialFormState(), { kind: 'setTransferMode', value: true });

    assert.equal(state.type, 'expense');
    assert.equal(state.mainCategory, MONEY_TRANSFER_CATEGORY);
    assert.equal(state.subCategory, MONEY_TRANSFER_CATEGORY);
  });

  it('overrides an income type that was set first', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setType', value: 'income' },
      { kind: 'setTransferMode', value: true },
    );

    assert.equal(state.type, 'expense', 'a transfer is never income');
  });

  it('clears the forced category when leaving transfer mode', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setTransferMode', value: true },
      { kind: 'setTransferMode', value: false },
    );

    assert.equal(state.mainCategory, '');
    assert.equal(state.subCategory, '');
  });

  it('exits transfer mode when an explicit type is chosen', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setTransferMode', value: true },
      { kind: 'setType', value: 'income' },
    );

    assert.equal(state.isMoneyTransferMode, false);
    assert.equal(state.type, 'income');
    assert.equal(state.mainCategory, '', 'the transfer category should not survive');
  });

  it('builds the title from the two fund names', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setTransferMode', value: true },
      { kind: 'setFund', which: 'source', value: { id: 'a', name: 'Current' } },
      { kind: 'setFund', which: 'target', value: { id: 'b', name: 'Savings' } },
    );

    assert.ok(state.title.includes('Current'), `got "${state.title}"`);
    assert.ok(state.title.includes('Savings'), `got "${state.title}"`);
  });

  it('leaves the title alone until both funds are chosen', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setTransferMode', value: true },
      { kind: 'setFund', which: 'source', value: { id: 'a', name: 'Current' } },
    );

    assert.equal(state.title, '');
  });
});

describe('category follows type', () => {
  it('clears an expense category when switching to income', () => {
    const state = apply(initialFormState(), { kind: 'setMainCategory', value: 'Dining' }, {
      kind: 'setType',
      value: 'income',
    });

    assert.equal(state.mainCategory, '');
    assert.equal(state.subCategory, '');
  });

  it('keeps a category that matches the new type', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setType', value: 'income' },
      { kind: 'setMainCategory', value: 'Primary Income' },
      { kind: 'setSubCategory', value: 'Salary' },
    );

    assert.equal(state.mainCategory, 'Primary Income');
    assert.equal(state.subCategory, 'Salary');
  });

  it('refuses an income category on an expense transaction', () => {
    const state = apply(initialFormState(), { kind: 'setMainCategory', value: 'Primary Income' });

    assert.equal(state.mainCategory, '', 'an income category cannot belong to an expense');
  });
});

describe('subcategory follows main category', () => {
  it('resets the subcategory when the main category changes', () => {
    const state = apply(
      validExpense(),
      { kind: 'setMainCategory', value: 'Groceries' },
    );

    assert.equal(state.mainCategory, 'Groceries');
    assert.equal(state.subCategory, '', 'the old subcategory must not carry over');
  });
});

describe('title suggestions', () => {
  it('fills type, category and subcategory at once', () => {
    const state = apply(initialFormState(), {
      kind: 'applySuggestion',
      value: suggestion(),
    });

    assert.equal(state.type, 'expense');
    assert.equal(state.mainCategory, 'Groceries');
    assert.equal(state.subCategory, 'Supermarket');
    assert.deepEqual(state.autoFilled, {
      type: true,
      mainCategory: true,
      subCategory: true,
    });
  });

  it('drops the auto-filled marker when that field is edited by hand', () => {
    const suggested = apply(initialFormState(), {
      kind: 'applySuggestion',
      value: suggestion(),
    });

    const edited = apply(suggested, { kind: 'setSubCategory', value: 'Drugstore' });

    assert.equal(edited.subCategory, 'Drugstore');
    assert.equal(edited.autoFilled.subCategory, false);
    assert.equal(edited.autoFilled.mainCategory, true, 'other markers are untouched');
  });
});

describe('amount handling', () => {
  it('strips a decimal point typed into a yen amount', () => {
    const state = apply(initialFormState(), { kind: 'setCurrency', value: 'JPY' }, {
      kind: 'setAmount',
      value: '1500.75',
    });

    assert.equal(state.amount, '1500');
  });

  it('keeps two decimals for euro', () => {
    const state = apply(initialFormState(), { kind: 'setAmount', value: '12.345' });

    assert.equal(state.amount, '12.34');
  });

  it('re-formats an existing amount when the currency changes', () => {
    const state = apply(initialFormState(), { kind: 'setAmount', value: '12.34' }, {
      kind: 'setCurrency',
      value: 'JPY',
    });

    assert.equal(state.amount, '12', 'yen has no minor unit');
  });

  it('converts a comma to a decimal point', () => {
    const state = apply(initialFormState(), { kind: 'setAmount', value: '9,99' });

    assert.equal(state.amount, '9.99');
  });
});

describe('validation', () => {
  it('requires an amount, category and title', () => {
    const errors = validate(initialFormState());

    assert.ok(errors.amount, 'amount should be required');
    assert.ok(errors.mainCategory, 'category should be required');
    assert.ok(errors.title, 'title should be required');
  });

  it('accepts a fully filled expense', () => {
    const state = validExpense();

    assert.equal(isSubmittable(state), true);
    assert.deepEqual(validate(state), {
      amount: '',
      mainCategory: '',
      subCategory: '',
      title: '',
    });
  });

  it('rejects an amount of zero', () => {
    const state = apply(validExpense(), { kind: 'setAmount', value: '0' });

    assert.ok(validate(state).amount, 'zero is not a valid amount');
  });

  it('requires both funds in transfer mode, in the category slots', () => {
    const state = apply(
      initialFormState(),
      { kind: 'setTransferMode', value: true },
      { kind: 'setAmount', value: '100' },
      { kind: 'setFund', which: 'source', value: { id: 'a', name: 'Current' } },
    );

    const errors = validate(state);

    // The target fund error is reported in the subCategory slot, because the
    // two fund pickers occupy the cells the category pickers otherwise would.
    assert.equal(errors.mainCategory, '', 'the source fund is chosen');
    assert.ok(errors.subCategory, 'the missing target fund should be reported');
  });

  it('clears a field error as soon as that field is edited', () => {
    const submitted = apply(initialFormState(), { kind: 'validate' });
    assert.ok(submitted.errors.amount);

    const fixed = apply(submitted, { kind: 'setAmount', value: '5' });

    assert.equal(fixed.errors.amount, '');
  });

  it('remembers that submission was attempted', () => {
    assert.equal(initialFormState().hasAttemptedSubmit, false);
    assert.equal(apply(initialFormState(), { kind: 'validate' }).hasAttemptedSubmit, true);
  });
});
