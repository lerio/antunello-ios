/**
 * The Settings → Categories grouping and counts.
 *
 * Categories are grouped Income, Expense, Movement, in that order. "Money
 * Transfer" is the one movement: the app stores it as an expense, but it moves
 * money between funds rather than spending it. Counts are per main category and
 * per category/subcategory pair, so same-named subcategories in different
 * categories stay separate. They are also split by transaction type, for two
 * main categories that share a name across types.
 */

import { allCategories, type CategoryEntry } from '@/features/categories/registry';

type Category = CategoryEntry;

export type CategorySection = {
  title: 'Income' | 'Expenses' | 'Movements';
  categories: Category[];
};

const MOVEMENT = 'Money Transfer';

/** The categories under Income, Expense and Movement, in display order. */
export function categorySections(): CategorySection[] {
  const categories = allCategories();
  return [
    { title: 'Income', categories: categories.filter((c) => c.type === 'income') },
    {
      title: 'Expenses',
      categories: categories.filter((c) => c.type === 'expense' && c.category !== MOVEMENT),
    },
    { title: 'Movements', categories: categories.filter((c) => c.category === MOVEMENT) },
  ];
}

/** Key used in {@link CategoryCounts.bySubcategory}. */
export function subcategoryKey(category: string, subcategory: string): string {
  return `${category}|${subcategory}`;
}

export type CategoryCounts = {
  byCategory: Record<string, number>;
  bySubcategory: Record<string, number>;
  /** The same counts split by transaction type, keyed `${type}|${category}`. */
  byCategoryAndType: Record<string, number>;
  /** Keyed `${type}|${category}|${subcategory}`. */
  bySubcategoryAndType: Record<string, number>;
};

/**
 * Counts transactions per category and per subcategory.
 *
 * @param rows One entry per transaction.
 * @returns The counts; a split-across-year transaction is one record, so it
 *   counts once.
 */
export function countCategories(
  rows: readonly { main_category: string; sub_category?: string | null; type?: string }[],
): CategoryCounts {
  const byCategory: Record<string, number> = {};
  const bySubcategory: Record<string, number> = {};
  const byCategoryAndType: Record<string, number> = {};
  const bySubcategoryAndType: Record<string, number> = {};

  for (const row of rows) {
    byCategory[row.main_category] = (byCategory[row.main_category] ?? 0) + 1;
    const typedKey = `${row.type}|${row.main_category}`;
    byCategoryAndType[typedKey] = (byCategoryAndType[typedKey] ?? 0) + 1;
    if (row.sub_category) {
      const key = subcategoryKey(row.main_category, row.sub_category);
      bySubcategory[key] = (bySubcategory[key] ?? 0) + 1;
      const typedSubKey = `${row.type}|${key}`;
      bySubcategoryAndType[typedSubKey] = (bySubcategoryAndType[typedSubKey] ?? 0) + 1;
    }
  }

  return { byCategory, bySubcategory, byCategoryAndType, bySubcategoryAndType };
}

/**
 * The transaction count of a main category.
 *
 * A name that exists under both types is counted per type; otherwise the plain
 * count is kept, which also catches transactions whose type is unusual (transfer
 * legs). Undefined while counts load.
 */
export function categoryTransactionCount(
  counts: CategoryCounts | undefined,
  categories: readonly CategoryEntry[],
  cat: CategoryEntry,
): number | undefined {
  if (!counts) return undefined;
  const ambiguous = categories.filter((other) => other.category === cat.category).length > 1;
  return ambiguous
    ? (counts.byCategoryAndType[`${cat.type}|${cat.category}`] ?? 0)
    : (counts.byCategory[cat.category] ?? 0);
}

/** The transaction count of a subcategory; see {@link categoryTransactionCount}. */
export function subcategoryTransactionCount(
  counts: CategoryCounts | undefined,
  categories: readonly CategoryEntry[],
  cat: CategoryEntry,
  sub: string,
): number | undefined {
  if (!counts) return undefined;
  const ambiguous = categories.filter((other) => other.category === cat.category).length > 1;
  const key = subcategoryKey(cat.category, sub);
  return ambiguous
    ? (counts.bySubcategoryAndType[`${cat.type}|${key}`] ?? 0)
    : (counts.bySubcategory[key] ?? 0);
}

/**
 * Whether a category may be deleted: a subcategory needs no transactions; a main
 * category needs no subcategories and no transactions. False while counts load.
 */
export function canDeleteCategory(
  cat: CategoryEntry,
  sub: string | null,
  count: number | undefined,
): boolean {
  if (count === undefined) return false;
  return sub !== null ? count === 0 : count === 0 && cat.subcategories.length === 0;
}
