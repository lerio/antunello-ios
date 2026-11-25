/**
 * Tests for merging built-in and custom categories.
 *
 * Run: npm test
 */

import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import {
  allCategories,
  allMainCategories,
  customIconName,
  isCategoryOfType,
  setCustomCategories,
  subCategoriesByName,
  subCategoriesFor,
  type CustomCategory,
} from '@/features/categories/registry';

function row(partial: Partial<CustomCategory> & Pick<CustomCategory, 'name'>): CustomCategory {
  return {
    id: partial.name,
    user_id: 'u',
    parent_category: null,
    type: 'expense',
    icon: null,
    ...partial,
  };
}

afterEach(() => setCustomCategories([]));

describe('merging custom categories', () => {
  it('appends custom main categories after the built-in ones, alphabetically', () => {
    setCustomCategories([row({ name: 'Pets' }), row({ name: 'Crypto', type: 'income' })]);
    const names = allCategories().map((c) => c.category);
    assert.deepEqual(names.slice(-2), ['Crypto', 'Pets']);
    assert.ok(allCategories().find((c) => c.category === 'Pets')?.isCustom);
  });

  it('adds a custom subcategory to a built-in parent', () => {
    setCustomCategories([row({ name: 'Vet', parent_category: 'Health' })]);
    assert.ok(subCategoriesFor('Health', 'expense').includes('Vet'));
  });

  it('drops a subcategory whose parent does not exist', () => {
    setCustomCategories([row({ name: 'Orphan', parent_category: 'Nowhere' })]);
    assert.ok(!allCategories().some((c) => c.subcategories.includes('Orphan')));
  });

  it('allows the same name under different types and attaches subs by type', () => {
    setCustomCategories([
      row({ name: 'Gifts', type: 'income' }),
      row({ name: 'Gifts', type: 'expense' }),
      row({ name: 'Birthday', parent_category: 'Gifts', type: 'income' }),
    ]);
    assert.equal(allCategories().filter((c) => c.category === 'Gifts').length, 2);
    assert.deepEqual(subCategoriesFor('Gifts', 'income'), ['Birthday']);
    assert.deepEqual(subCategoriesFor('Gifts', 'expense'), []);
    assert.equal(allMainCategories().filter((n) => n === 'Gifts').length, 1);
    assert.deepEqual(subCategoriesByName('Gifts'), ['Birthday']);
  });

  it('matches a subcategory with no type (pre-migration) by name only', () => {
    setCustomCategories([row({ name: 'Old', parent_category: 'Health', type: null })]);
    assert.ok(subCategoriesFor('Health', 'expense').includes('Old'));
  });
});

describe('category lookups', () => {
  it('knows the type of built-in and custom categories', () => {
    setCustomCategories([row({ name: 'Crypto', type: 'income' })]);
    assert.ok(isCategoryOfType('Dining', 'expense'));
    assert.ok(!isCategoryOfType('Dining', 'income'));
    assert.ok(isCategoryOfType('Crypto', 'income'));
  });

  it('returns the icon of a custom main category only', () => {
    setCustomCategories([
      row({ name: 'Pets', icon: 'PawPrint' }),
      row({ name: 'Vet', parent_category: 'Pets', icon: 'Syringe' }),
    ]);
    assert.equal(customIconName('Pets'), 'PawPrint');
    assert.equal(customIconName('Vet'), undefined);
  });
});
