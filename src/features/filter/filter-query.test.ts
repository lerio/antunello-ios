/**
 * Tests for the query a set of filter criteria describes.
 *
 * The date assertions are written against the local-time fields of the resulting
 * bounds rather than literal ISO strings, because the bounds are built in local
 * time on purpose — an assertion on a fixed string would pass only in one
 * timezone, which is the trap this code exists to avoid.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  initialFilterCriteria,
  type FilterCriteria,
} from '@/features/filter/filter-criteria';
import { buildFundCondition, planFilterQuery } from '@/features/filter/filter-query';

function criteria(overrides: Partial<FilterCriteria> = {}): FilterCriteria {
  return { ...initialFilterCriteria, ...overrides };
}

describe('the type filter', () => {
  it('imposes nothing when no type is selected', () => {
    assert.equal(planFilterQuery(criteria()).typeConditions, null);
  });

  it('excludes transfers when expense is selected', () => {
    // A transfer is stored with a type of its own, so without the
    // `is_money_transfer` clause "expense" would include movements of money
    // between the user's own accounts.
    const [condition] = planFilterQuery(criteria({ types: ['expense'] })).typeConditions ?? [];

    assert.equal(
      condition,
      'and(type.eq.expense,or(is_money_transfer.is.null,is_money_transfer.eq.false))',
    );
  });

  it('treats a null is_money_transfer as not a transfer', () => {
    // Older rows predate the column, so it is null rather than false — and those
    // rows must be included, not dropped.
    const [condition] = planFilterQuery(criteria({ types: ['income'] })).typeConditions ?? [];

    assert.ok(condition?.includes('is_money_transfer.is.null'));
  });

  it('matches transfers on the flag alone', () => {
    const conditions = planFilterQuery(criteria({ types: ['movement'] })).typeConditions;

    assert.deepEqual(conditions, ['is_money_transfer.eq.true']);
  });

  it('combines the three types as alternatives', () => {
    const conditions = planFilterQuery(criteria({ types: ['income', 'expense', 'movement'] }))
      .typeConditions;

    assert.equal(conditions?.length, 3);
  });

  it('emits the conditions in a fixed order regardless of selection order', () => {
    const forward = planFilterQuery(criteria({ types: ['income', 'expense', 'movement'] }));
    const backward = planFilterQuery(criteria({ types: ['movement', 'expense', 'income'] }));

    assert.deepEqual(forward.typeConditions, backward.typeConditions);
  });
});

describe('the category filters', () => {
  it('imposes nothing when empty', () => {
    const plan = planFilterQuery(criteria());

    assert.equal(plan.mainCategories, null);
    assert.equal(plan.subCategories, null);
  });

  it('passes main categories through', () => {
    const plan = planFilterQuery(criteria({ mainCategories: ['Dining', 'Groceries'] }));

    assert.deepEqual(plan.mainCategories, ['Dining', 'Groceries']);
  });

  it('strips the parent from a subcategory', () => {
    // Stored as "Main::Sub" so the chip can name both; the database column holds
    // the subcategory alone.
    const plan = planFilterQuery(criteria({ subCategories: ['Dining::Restaurants'] }));

    assert.deepEqual(plan.subCategories, ['Restaurants']);
  });

  it('keeps a subcategory that carries no parent', () => {
    const plan = planFilterQuery(criteria({ subCategories: ['Restaurants'] }));

    assert.deepEqual(plan.subCategories, ['Restaurants']);
  });
});

describe('the fund filter', () => {
  it('imposes nothing when empty', () => {
    assert.equal(planFilterQuery(criteria()).funds, null);
  });

  it('matches a transfer by either end', () => {
    // Filtering by one fund has to include the transfers out of it, which name
    // that fund as the source, and the transfers into it, which name it as the
    // target.
    const condition = buildFundCondition({ ids: ['f1', 'f2'] });

    assert.equal(
      condition,
      'fund_category_id.in.(f1,f2),and(is_money_transfer.eq.true,target_fund_category_id.in.(f1,f2))',
    );
  });

  it('carries the selected ids', () => {
    assert.deepEqual(planFilterQuery(criteria({ fundSourceIds: ['f1'] })).funds, { ids: ['f1'] });
  });
});

describe('the amount filter', () => {
  it('passes bounds through for a single currency, zero included', () => {
    const plan = planFilterQuery(
      criteria({ currencies: ['USD'], amountMin: 0, amountMax: 250 }),
    );

    assert.equal(plan.amountMin, 0);
    assert.equal(plan.amountMax, 250);
  });

  it('leaves an unset bound null rather than defaulting it', () => {
    const plan = planFilterQuery(criteria({ currencies: ['USD'], amountMin: 100 }));

    assert.equal(plan.amountMin, 100);
    assert.equal(plan.amountMax, null);
  });

  it('drops the bounds when no currency is selected', () => {
    const plan = planFilterQuery(criteria({ amountMin: 100, amountMax: 250 }));

    assert.equal(plan.amountMin, null);
    assert.equal(plan.amountMax, null);
  });

  it('drops the bounds when several currencies are selected', () => {
    const plan = planFilterQuery(
      criteria({ currencies: ['EUR', 'USD'], amountMin: 100, amountMax: 250 }),
    );

    assert.equal(plan.amountMin, null);
    assert.equal(plan.amountMax, null);
  });
});

describe('the currency filter', () => {
  it('imposes nothing when empty', () => {
    assert.equal(planFilterQuery(criteria()).currencies, null);
  });

  it('passes currencies through', () => {
    assert.deepEqual(planFilterQuery(criteria({ currencies: ['EUR', 'USD'] })).currencies, [
      'EUR',
      'USD',
    ]);
  });
});

describe('the date bounds', () => {
  it('imposes nothing for all time', () => {
    assert.equal(planFilterQuery(criteria()).dateBounds, null);
  });

  it('covers a whole month in local time, half-open', () => {
    const bounds = planFilterQuery(criteria({ year: 2026, month: 3 })).dateBounds;
    assert.ok(bounds);

    const start = new Date(bounds.start);
    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 2, 'March is month index 2');
    assert.equal(start.getDate(), 1);
    assert.equal(start.getHours(), 0);

    const end = new Date(bounds.end);
    assert.equal(end.getMonth(), 3, 'the end is the start of the next month');
    assert.equal(end.getDate(), 1);
  });

  it('covers a whole year in local time, half-open', () => {
    const bounds = planFilterQuery(criteria({ year: 2026 })).dateBounds;
    assert.ok(bounds);

    const start = new Date(bounds.start);
    assert.equal(start.getFullYear(), 2026);
    assert.equal(start.getMonth(), 0);
    assert.equal(start.getDate(), 1);

    const end = new Date(bounds.end);
    assert.equal(end.getFullYear(), 2027);
    assert.equal(end.getMonth(), 0);
  });

  it('crosses the year boundary correctly for December', () => {
    const bounds = planFilterQuery(criteria({ year: 2026, month: 12 })).dateBounds;
    assert.ok(bounds);

    const end = new Date(bounds.end);
    assert.equal(end.getFullYear(), 2027);
    assert.equal(end.getMonth(), 0);
    assert.equal(end.getDate(), 1);
  });

  it('ignores a month with no year', () => {
    // The month control is disabled while the year is unset, so this state is
    // unreachable through the UI — but the plan must not invent a date bound
    // from a month that has no year to belong to.
    assert.equal(planFilterQuery(criteria({ month: 3 })).dateBounds, null);
  });
});

describe('the search term', () => {
  it('is null when the field is blank', () => {
    assert.equal(planFilterQuery(criteria(), '   ').search, null);
  });

  it('trims the term', () => {
    assert.equal(planFilterQuery(criteria(), '  IOSYS  ').search, 'IOSYS');
  });

  it('combines with the other criteria', () => {
    const plan = planFilterQuery(criteria({ year: 2026, currencies: ['EUR'] }), 'Dining');

    assert.equal(plan.search, 'Dining');
    assert.notEqual(plan.dateBounds, null);
    assert.deepEqual(plan.currencies, ['EUR']);
  });
});
