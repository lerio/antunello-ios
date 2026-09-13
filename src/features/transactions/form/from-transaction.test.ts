/**
 * Tests for seeding the edit form from a stored transaction.
 *
 * The fund cases are the regression pin for a silent data-loss bug. The resolver
 * used to return `null` when it could not find a fund's name, which turned "I
 * cannot name this fund" into "there is no fund" — and the form wrote that back
 * on save, detaching the transaction from the fund its balance is summed into.
 * Every trigger below results in a fund id that cannot be named, and every one
 * of them must survive.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UNRESOLVED_FUND_NAME } from '@/features/transactions/form/reducer';
import {
  formStateFromTransaction,
  type TransactionLike,
} from '@/features/transactions/form/from-transaction';

function tx(overrides: Partial<TransactionLike> = {}): TransactionLike {
  return {
    amount: 12.5,
    currency: 'EUR',
    type: 'expense',
    title: 'COFFEE',
    main_category: 'Dining',
    sub_category: 'Restaurants',
    date: '2026-09-13T08:30:00.000Z',
    ...overrides,
  };
}

/** A lookup that knows about one fund. */
const lookupCash = (id: string) => (id === 'fund-cash' ? { id, name: 'Cash' } : undefined);

describe('the ordinary fields', () => {
  it('carries the transaction through', () => {
    const state = formStateFromTransaction(tx(), 'edit');

    assert.equal(state.mode, 'edit');
    assert.equal(state.amount, '12.5');
    assert.equal(state.title, 'COFFEE');
    assert.equal(state.mainCategory, 'Dining');
    assert.equal(state.subCategory, 'Restaurants');
    assert.equal(state.date.toISOString(), '2026-09-13T08:30:00.000Z');
  });

  it('falls back to EUR for a currency the form does not offer', () => {
    assert.equal(formStateFromTransaction(tx({ currency: 'GBP' }), 'edit').currency, 'EUR');
  });

  it('detects a transfer from the flag or the category', () => {
    assert.equal(formStateFromTransaction(tx({ is_money_transfer: true }), 'edit').isMoneyTransferMode, true);
    assert.equal(
      formStateFromTransaction(tx({ main_category: 'Money Transfer' }), 'edit').isMoneyTransferMode,
      true,
    );
    assert.equal(formStateFromTransaction(tx(), 'edit').isMoneyTransferMode, false);
  });
});

describe('a fund whose name can be resolved', () => {
  it('uses the real name', () => {
    const state = formStateFromTransaction(tx({ fund_category_id: 'fund-cash' }), 'edit', lookupCash);

    assert.deepEqual(state.sourceFund, { id: 'fund-cash', name: 'Cash' });
  });

  it('keeps the id when no lookup was supplied at all', () => {
    // The call sites that pass no lookup still must not lose the fund.
    const state = formStateFromTransaction(tx({ fund_category_id: 'fund-cash' }), 'edit');

    assert.equal(state.sourceFund?.id, 'fund-cash');
    assert.equal(state.sourceFund?.name, UNRESOLVED_FUND_NAME);
  });
});

describe('a fund whose name cannot be resolved', () => {
  it('keeps the id when the fund is deactivated and therefore unlisted', () => {
    // `useFunds` filters to active funds, so a deactivated one is absent.
    // This used to be deterministic data loss.
    const state = formStateFromTransaction(tx({ fund_category_id: 'fund-gone' }), 'edit', lookupCash);

    assert.deepEqual(state.sourceFund, { id: 'fund-gone', name: UNRESOLVED_FUND_NAME });
  });

  it('keeps the id when the fund list has not loaded yet', () => {
    // The common case: the transaction comes from the query cache instantly
    // while the funds take a round trip, so the lookup finds nothing.
    const state = formStateFromTransaction(tx({ fund_category_id: 'fund-cash' }), 'edit', () => undefined);

    assert.equal(state.sourceFund?.id, 'fund-cash');
  });

  it('keeps the id when the funds fetch failed outright', () => {
    // An error and an empty list are indistinguishable here, which is exactly
    // why the id must not depend on the list being non-empty.
    const state = formStateFromTransaction(tx({ fund_category_id: 'fund-cash' }), 'edit', () => undefined);

    assert.equal(state.sourceFund?.id, 'fund-cash');
  });

  it('is null only when there is genuinely no fund', () => {
    assert.equal(formStateFromTransaction(tx(), 'edit', lookupCash).sourceFund, null);
    assert.equal(
      formStateFromTransaction(tx({ fund_category_id: null }), 'edit', lookupCash).sourceFund,
      null,
    );
  });

  it('is null for a transfer, so the save fails loudly instead', () => {
    // A transfer is the one case that must not keep an unresolvable id:
    // `normalize` regenerates its title from the funds' names, so a stand-in
    // name would rewrite the title. Null blocks the save via validation
    // instead of corrupting the title — loud, and recoverable.
    const state = formStateFromTransaction(
      tx({ is_money_transfer: true, fund_category_id: 'fund-gone' }),
      'edit',
      lookupCash,
    );

    assert.equal(state.sourceFund, null);
  });

  it('is null for a transfer that resolves, but has no id to resolve', () => {
    const state = formStateFromTransaction(tx({ is_money_transfer: true }), 'edit', lookupCash);

    assert.equal(state.sourceFund, null);
  });
});

describe('the target fund', () => {
  it('resolves normally when the name is known', () => {
    const state = formStateFromTransaction(
      tx({ is_money_transfer: true, target_fund_category_id: 'fund-cash' }),
      'edit',
      lookupCash,
    );

    assert.deepEqual(state.targetFund, { id: 'fund-cash', name: 'Cash' });
  });

  it('is null for a transfer when the name cannot be resolved', () => {
    // The same carve-out as the source fund, and for the same reason: the title
    // is regenerated from *both* funds' names, so a stand-in label on either
    // one rewrites the title.
    const state = formStateFromTransaction(
      tx({ is_money_transfer: true, target_fund_category_id: 'fund-gone' }),
      'edit',
      lookupCash,
    );

    assert.equal(state.targetFund, null);
  });

  it('is dropped for a non-transfer', () => {
    // Only a transfer has a target, so a stray id on an expense is not carried
    // into a form that has no control for it.
    const state = formStateFromTransaction(
      tx({ target_fund_category_id: 'fund-wealth' }),
      'edit',
      lookupCash,
    );

    assert.equal(state.targetFund, null);
  });
});
