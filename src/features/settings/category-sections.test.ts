/**
 * Tests for the Settings → Categories grouping and counts.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATEGORIES_WITH_TYPES } from '@/domain/types';
import {
  canDeleteCategory,
  categorySections,
  categoryTransactionCount,
  countCategories,
  subcategoryKey,
  subcategoryTransactionCount,
} from '@/features/settings/category-sections';

describe('category sections', () => {
  const sections = categorySections();

  it('orders Income, Expenses, Movements', () => {
    assert.deepEqual(
      sections.map((s) => s.title),
      ['Income', 'Expenses', 'Movements'],
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

describe('transaction counts and delete rules', () => {
  const entry = (category: string, type: 'income' | 'expense', subcategories: string[] = []) => ({
    category,
    type,
    subcategories,
    isCustom: true,
  });
  const gifts = [entry('Gifts', 'income', ['Birthday']), entry('Gifts', 'expense')];
  const counts = countCategories([
    { main_category: 'Gifts', sub_category: 'Birthday', type: 'income' },
    { main_category: 'Gifts', sub_category: null, type: 'expense' },
    { main_category: 'Gifts', sub_category: null, type: 'expense' },
    { main_category: 'Dining', sub_category: null, type: 'expense' },
  ]);

  it('counts a name shared across types per type', () => {
    assert.equal(categoryTransactionCount(counts, gifts, gifts[0]), 1);
    assert.equal(categoryTransactionCount(counts, gifts, gifts[1]), 2);
    assert.equal(subcategoryTransactionCount(counts, gifts, gifts[0], 'Birthday'), 1);
  });

  it('keeps the plain count for an unshared name', () => {
    const dining = [entry('Dining', 'expense')];
    assert.equal(categoryTransactionCount(counts, dining, dining[0]), 1);
  });

  it('is undefined while counts load', () => {
    assert.equal(categoryTransactionCount(undefined, gifts, gifts[0]), undefined);
  });

  it('allows deleting an empty subcategory, and a main only when it has no subs either', () => {
    assert.equal(canDeleteCategory(gifts[0], 'Birthday', 0), true);
    assert.equal(canDeleteCategory(gifts[0], 'Birthday', 1), false);
    assert.equal(canDeleteCategory(gifts[0], null, 0), false, 'has a subcategory');
    assert.equal(canDeleteCategory(gifts[1], null, 0), true);
    assert.equal(canDeleteCategory(gifts[1], null, undefined), false, 'counts not loaded');
  });
});
