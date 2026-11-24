/**
 * The Settings → Categories grouping and counts.
 *
 * Categories are grouped Income, Expense, Movement, in that order. "Money
 * Transfer" is the one movement: the app stores it as an expense, but it moves
 * money between funds rather than spending it. Counts are per main category and
 * per category/subcategory pair, so same-named subcategories in different
 * categories stay separate.
 */

import { CATEGORIES_WITH_TYPES } from '@/domain/types';

type Category = (typeof CATEGORIES_WITH_TYPES)[number];

export type CategorySection = {
  title: 'Income' | 'Expense' | 'Movement';
  categories: Category[];
};

const MOVEMENT = 'Money Transfer';

/** The categories under Income, Expense and Movement, in display order. */
export function categorySections(): CategorySection[] {
  return [
    { title: 'Income', categories: CATEGORIES_WITH_TYPES.filter((c) => c.type === 'income') },
    {
      title: 'Expense',
      categories: CATEGORIES_WITH_TYPES.filter((c) => c.type === 'expense' && c.category !== MOVEMENT),
    },
    { title: 'Movement', categories: CATEGORIES_WITH_TYPES.filter((c) => c.category === MOVEMENT) },
  ];
}

/** Key used in {@link CategoryCounts.bySubcategory}. */
export function subcategoryKey(category: string, subcategory: string): string {
  return `${category}|${subcategory}`;
}

export type CategoryCounts = {
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
};

/**
 * Counts transactions per category and per subcategory.
 *
 * @param rows One entry per transaction.
 * @returns The counts; a split-across-year transaction is one record, so it
 *   counts once.
 */
export function countCategories(
  rows: readonly { main_category: string; sub_category?: string | null }[],
): CategoryCounts {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};

  for (const row of rows) {
    byCategory[row.main_category] = (byCategory[row.main_category] ?? 0) + 1;
    if (row.sub_category) {
      const key = subcategoryKey(row.main_category, row.sub_category);
      bySubcategory[key] = (bySubcategory[key] ?? 0) + 1;
    }
  }

  return { byCategory, bySubcategory };
}
