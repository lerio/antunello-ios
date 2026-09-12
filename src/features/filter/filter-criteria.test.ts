/**
 * Tests for the filter's criteria and its consistency rules.
 *
 * The pruning rules are the whole point of this module: the filter offers types,
 * categories and subcategories, and each selection narrows what the others may
 * offer. Every one of these assertions corresponds to a rule the web app
 * implements in a separate handler.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  criteriaHash,
  filterReducer,
  hasAnyFilter,
  initialFilterCriteria,
  isAllTime,
  labelOfSubCategory,
  parentOfSubCategory,
  selectableCategories,
  selectableSubCategories,
  toggleValue,
  type FilterCriteria,
} from '@/features/filter/filter-criteria';

/** Criteria with the given fields overridden, everything else empty. */
function criteria(overrides: Partial<FilterCriteria> = {}): FilterCriteria {
  return { ...initialFilterCriteria, ...overrides };
}

describe('toggleValue', () => {
  it('adds a value that is absent', () => {
    assert.deepEqual(toggleValue(['a'], 'b'), ['a', 'b']);
  });

  it('removes a value that is present', () => {
    assert.deepEqual(toggleValue(['a', 'b'], 'a'), ['b']);
  });

  it('leaves the original untouched', () => {
    const original = ['a'];
    toggleValue(original, 'b');
    assert.deepEqual(original, ['a']);
  });
});

describe('selectableCategories', () => {
  it('offers everything when no type is selected', () => {
    assert.equal(selectableCategories([]).length, 20);
  });

  it('offers everything when only movement is selected', () => {
    // Movement is a flag rather than a category type, so it excludes nothing.
    assert.equal(selectableCategories(['movement']).length, 20);
  });

  it('offers only income categories when income is selected', () => {
    const categories = selectableCategories(['income']);

    assert.ok(categories.length > 0);
    assert.ok(categories.every((category) => category.type === 'income'));
  });

  it('offers income and expense categories together', () => {
    const categories = selectableCategories(['income', 'expense']);

    assert.equal(categories.length, 20);
  });

  it('combines movement with a type without narrowing further', () => {
    assert.deepEqual(
      selectableCategories(['income', 'movement']).map((c) => c.category),
      selectableCategories(['income']).map((c) => c.category),
    );
  });
});

describe('selectableSubCategories', () => {
  it('offers every subcategory of every category when nothing is selected', () => {
    const options = selectableSubCategories(criteria());

    assert.ok(options.some((option) => option.value === 'Dining::Restaurants'));
    assert.ok(options.some((option) => option.value === 'Primary Income::Salary'));
  });

  it('narrows to the selected categories', () => {
    const options = selectableSubCategories(criteria({ mainCategories: ['Dining'] }));

    assert.deepEqual(
      options.map((option) => option.value),
      ['Dining::Bars and Drinks', 'Dining::Food Delivery', 'Dining::Restaurants'],
    );
  });

  it('drops a category the type filter has excluded', () => {
    // Dining is an expense category, so asking for income-only must drop it
    // rather than keep offering its subcategories.
    const options = selectableSubCategories(
      criteria({ types: ['income'], mainCategories: ['Dining'] }),
    );

    assert.deepEqual(options, []);
  });

  it('groups each option under its own category', () => {
    const options = selectableSubCategories(criteria({ mainCategories: ['Dining', 'Groceries'] }));

    assert.ok(options.every((option) => option.group === parentOfSubCategory(option.value)));
  });

  it('falls back to every category when the type is only movement', () => {
    const options = selectableSubCategories(criteria({ types: ['movement'] }));

    assert.ok(options.some((option) => option.value === 'Dining::Restaurants'));
  });
});

describe('pruning subcategories when the type changes', () => {
  it('drops subcategories whose category is no longer income', () => {
    const next = filterReducer(
      criteria({ types: ['income', 'expense'], subCategories: ['Dining::Restaurants'] }),
      { type: 'toggleType', value: 'expense' },
    );

    assert.deepEqual(next.types, ['income']);
    assert.deepEqual(next.subCategories, []);
  });

  it('keeps subcategories that are still reachable', () => {
    const next = filterReducer(
      criteria({ types: ['income', 'expense'], subCategories: ['Dining::Restaurants'] }),
      { type: 'toggleType', value: 'income' },
    );

    assert.deepEqual(next.types, ['expense']);
    assert.deepEqual(next.subCategories, ['Dining::Restaurants']);
  });

  it('drops main categories whose type is no longer selected', () => {
    const next = filterReducer(criteria({ mainCategories: ['Dining', 'Primary Income'] }), {
      type: 'toggleType',
      value: 'income',
    });

    assert.deepEqual(next.mainCategories, ['Primary Income']);
  });

  it('keeps everything when the last type is deselected', () => {
    // With no type constraint nothing is excluded, so nothing may be pruned.
    const next = filterReducer(
      criteria({ types: ['income'], mainCategories: ['Primary Income'] }),
      { type: 'toggleType', value: 'income' },
    );

    assert.deepEqual(next.types, []);
    assert.deepEqual(next.mainCategories, ['Primary Income']);
  });

  it('keeps everything when only movement is selected', () => {
    const next = filterReducer(criteria({ mainCategories: ['Dining'] }), {
      type: 'toggleType',
      value: 'movement',
    });

    assert.deepEqual(next.mainCategories, ['Dining']);
  });

  it('keeps categories reachable by either type when both are selected', () => {
    const next = filterReducer(
      criteria({ types: ['income'], mainCategories: ['Primary Income'] }),
      { type: 'toggleType', value: 'expense' },
    );

    assert.deepEqual(next.mainCategories, ['Primary Income']);
  });
});

describe('pruning subcategories when a main category changes', () => {
  it('drops subcategories of a deselected category', () => {
    const next = filterReducer(
      criteria({ mainCategories: ['Dining', 'Groceries'], subCategories: ['Groceries::Supermarket'] }),
      { type: 'toggleMainCategory', value: 'Groceries' },
    );

    assert.deepEqual(next.mainCategories, ['Dining']);
    assert.deepEqual(next.subCategories, []);
  });

  it('keeps subcategories of another category', () => {
    const next = filterReducer(
      criteria({
        mainCategories: ['Dining', 'Groceries'],
        subCategories: ['Dining::Restaurants', 'Groceries::Supermarket'],
      }),
      { type: 'toggleMainCategory', value: 'Groceries' },
    );

    assert.deepEqual(next.subCategories, ['Dining::Restaurants']);
  });

  it('keeps every subcategory when the last category is deselected', () => {
    // An empty category selection means "every category", so nothing is
    // unreachable and the subcategory selection survives.
    const next = filterReducer(
      criteria({ mainCategories: ['Dining'], subCategories: ['Groceries::Supermarket'] }),
      { type: 'toggleMainCategory', value: 'Dining' },
    );

    assert.deepEqual(next.subCategories, ['Groceries::Supermarket']);
  });
});

describe('the period controls', () => {
  it('clears the month when the year is cleared', () => {
    const next = filterReducer(criteria({ year: 2026, month: 3 }), {
      type: 'setYear',
      year: null,
    });

    assert.equal(next.year, null);
    assert.equal(next.month, null);
  });

  it('keeps the month when the year changes', () => {
    const next = filterReducer(criteria({ year: 2026, month: 3 }), {
      type: 'setYear',
      year: 2025,
    });

    assert.equal(next.year, 2025);
    assert.equal(next.month, 3);
  });

  it('sets a month without touching the year', () => {
    const next = filterReducer(criteria({ year: 2026 }), { type: 'setMonth', month: 7 });

    assert.equal(next.year, 2026);
    assert.equal(next.month, 7);
  });
});

describe('reset', () => {
  it('returns to the initial criteria', () => {
    const next = filterReducer(
      criteria({ types: ['income'], mainCategories: ['Dining'], year: 2026, month: 2, amountMin: 50 }),
      { type: 'reset' },
    );

    assert.deepEqual(next, initialFilterCriteria);
  });
});

describe('hasAnyFilter', () => {
  it('is false for the initial criteria', () => {
    assert.equal(hasAnyFilter(initialFilterCriteria), false);
  });

  it('is true for each filter in turn', () => {
    const cases: Partial<FilterCriteria>[] = [
      { types: ['income'] },
      { mainCategories: ['Dining'] },
      { subCategories: ['Dining::Restaurants'] },
      { fundSourceIds: ['fund-1'] },
      { currencies: ['USD'] },
      { amountMin: 0 },
      { amountMax: 100 },
      { month: 1 },
      { year: 2026 },
    ];

    for (const override of cases) {
      assert.equal(hasAnyFilter(criteria(override)), true, JSON.stringify(override));
    }
  });

  it('treats an amount bound of zero as a filter', () => {
    // Zero is a real bound — "expenses of nothing" is degenerate, but the lower
    // bound of a range legitimately sits at zero.
    assert.equal(hasAnyFilter(criteria({ amountMin: 0 })), true);
  });
});

describe('isAllTime', () => {
  it('is true with no period selected', () => {
    assert.equal(isAllTime(criteria()), true);
  });

  it('is false with only a year selected', () => {
    assert.equal(isAllTime(criteria({ year: 2026 })), false);
  });

  it('is false with a month selected', () => {
    assert.equal(isAllTime(criteria({ year: 2026, month: 4 })), false);
  });
});

describe('criteriaHash', () => {
  it('is stable across selection order', () => {
    assert.equal(
      criteriaHash(criteria({ mainCategories: ['Dining', 'Groceries'] })),
      criteriaHash(criteria({ mainCategories: ['Groceries', 'Dining'] })),
    );
  });

  it('differs when a filter differs', () => {
    assert.notEqual(
      criteriaHash(criteria({ year: 2026 })),
      criteriaHash(criteria({ year: 2025 })),
    );
  });

  it('distinguishes an unset bound from a zero bound', () => {
    assert.notEqual(
      criteriaHash(criteria({ amountMin: null })),
      criteriaHash(criteria({ amountMin: 0 })),
    );
  });

  it('distinguishes the year-only filter from the same month with no year', () => {
    assert.notEqual(
      criteriaHash(criteria({ year: 2026 })),
      criteriaHash(criteria({ month: 1 })),
    );
  });
});

describe('subcategory labels', () => {
  it('splits an entry into its parts', () => {
    assert.equal(parentOfSubCategory('Dining::Restaurants'), 'Dining');
    assert.equal(labelOfSubCategory('Dining::Restaurants'), 'Restaurants');
  });

  it('treats a bare name as its own label', () => {
    assert.equal(labelOfSubCategory('Restaurants'), 'Restaurants');
  });
});
