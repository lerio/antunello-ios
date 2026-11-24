/**
 * Tests for the Settings → Categories grouping and counts.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATEGORIES_WITH_TYPES } from '@/domain/types';
import {
  categorySections,
  countCategories,
  subcategoryKey,
} from '@/features/settings/category-sections';

describe('category sections', () => {
  const sections = categorySections();

  it('orders Income, Expense, Movement', () => {
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Income', 'Expense', 'Movement'],
    );
  });

  it('puts Money Transfer under Movement and nowhere else', () => {
    assert.deepEqual(sections[2].categories.map((c) => c.category), ['Money Transfer']);
    assert.ok(!sections[1].categories.some((c) => c.category === 'Money Transfer'));
  });

  it('lists every category exactly once', () => {
    const listed = sections.flatMap((s) => s.categories.map((c) => c.category));
    assert.equal(listed.length, CATEGORIES_WITH_TYPES.length);
    assert.equal(new Set(listed).size, listed.length);
  });
});

describe('counting transactions per category', () => {
  const counts = countCategories([
    { main_category: 'Dining', sub_category: 'Restaurants' },
    { main_category: 'Dining', sub_category: 'Restaurants' },
    { main_category: 'Dining', sub_category: 'Bars and Drinks' },
    { main_category: 'Dining', sub_category: null },
    { main_category: 'Money Transfer', sub_category: 'Money Transfer' },
  ]);

  it('counts main categories, with or without a subcategory', () => {
    assert.equal(counts.byCategory.Dining, 4);
    assert.equal(counts.byCategory['Money Transfer'], 1);
  });

  it('counts subcategories under their own category', () => {
    assert.equal(counts.bySubcategory[subcategoryKey('Dining', 'Restaurants')], 2);
    assert.equal(counts.bySubcategory[subcategoryKey('Dining', 'Bars and Drinks')], 1);
    assert.equal(counts.bySubcategory[subcategoryKey('Money Transfer', 'Money Transfer')], 1);
  });

  it('leaves unused categories absent', () => {
    assert.equal(counts.byCategory.Travel, undefined);
  });
});
