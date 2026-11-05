import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { groupFunds } from '@/features/funds/group-funds';
import type { FundWithBalance } from '@/features/funds/use-fund-balances';

function fund(overrides: Partial<FundWithBalance>): FundWithBalance {
  return {
    id: 'fund',
    user_id: 'user',
    name: 'Fund',
    currency: 'EUR',
    amount: 0,
    is_active: true,
    order_index: 0,
    created_at: '',
    updated_at: '',
    currentAmount: 0,
    currentEurAmount: 0,
    ...overrides,
  };
}

describe('groupFunds', () => {
  it('groups by top-level category, largest group first', () => {
    const { groups, totalEUR } = groupFunds([
      fund({ id: 'a', top_level_category: 'Savings', currentEurAmount: 100 }),
      fund({ id: 'b', top_level_category: 'Investments', currentEurAmount: 500 }),
      fund({ id: 'c', top_level_category: 'Savings', currentEurAmount: 300 }),
    ]);

    assert.deepEqual(groups.map((group) => group.name), ['Investments', 'Savings']);
    assert.deepEqual(groups[1].funds.map((item) => item.id), ['c', 'a']);
    assert.equal(groups[1].totalEUR, 400);
    assert.equal(totalEUR, 900);
  });

  it('leaves inactive funds out of the list and the total', () => {
    const { groups, totalEUR } = groupFunds([
      fund({ id: 'a', currentEurAmount: 100 }),
      fund({ id: 'b', is_active: false, currentEurAmount: 500 }),
    ]);

    assert.deepEqual(groups[0].funds.map((item) => item.id), ['a']);
    assert.equal(totalEUR, 100);
  });

  it('puts funds without a category in their own group', () => {
    const { groups } = groupFunds([fund({ currentEurAmount: 10 })]);

    assert.equal(groups[0].name, 'Uncategorized');
  });
});
