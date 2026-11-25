/**
 * The categories in play: the built-in ones from the domain table plus the
 * user's own (`custom_categories`).
 *
 * The domain table is vendored from the web app and stays untouched, so custom
 * categories live here. The merged list is held in module state, set by
 * `useCategories` while it renders, so the pure helpers that already existed
 * (the form reducer, the filter and budget rules) can ask "which categories are
 * there?" without every caller having to thread the list through.
 *
 * Two main categories may share a name when their types differ — an income and
 * an expense "Gifts". A subcategory therefore attaches to the parent with its
 * name *and* type.
 */

import { CATEGORIES_WITH_TYPES } from '@/domain/types';

export type CategoryType = 'income' | 'expense';

/** A user-defined category row (`custom_categories`). */
export type CustomCategory = {
  id: string;
  user_id: string;
  name: string;
  /** Null for a main category; otherwise its main category's name. */
  parent_category: string | null;
  /** A main category's own type; a subcategory stores its parent's. */
  type: CategoryType | null;
  /** A Lucide component name, e.g. "Utensils". */
  icon: string | null;
};

/** A main category with its subcategories and type, built-in or custom. */
export type CategoryEntry = {
  category: string;
  subcategories: string[];
  type: CategoryType;
  isCustom: boolean;
};

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * The built-in categories plus the user's own.
 *
 * Custom main categories follow the built-in ones, alphabetically; custom
 * subcategories follow their parent's built-in ones. A subcategory whose parent
 * no longer exists is dropped.
 */
export function mergeCategories(custom: readonly CustomCategory[]): CategoryEntry[] {
  const entries: CategoryEntry[] = CATEGORIES_WITH_TYPES.map((entry) => ({
    category: entry.category,
    subcategories: [...entry.subcategories],
    type: entry.type,
    isCustom: false,
  }));

  const mains = custom
    .filter((row) => row.parent_category === null && row.type !== null)
    .sort((a, b) => byName(a.name, b.name));
  for (const row of mains) {
    entries.push({ category: row.name, subcategories: [], type: row.type!, isCustom: true });
  }

  const subs = custom
    .filter((row) => row.parent_category !== null)
    .sort((a, b) => byName(a.name, b.name));
  for (const row of subs) {
    // A row without a type predates the web app's migration 028; it can only match by name.
    entries
      .find(
        (entry) =>
          entry.category === row.parent_category && (row.type === null || entry.type === row.type),
      )
      ?.subcategories.push(row.name);
  }

  return entries;
}

let customRows: readonly CustomCategory[] = [];
let merged: CategoryEntry[] = mergeCategories([]);

/** Replaces the custom categories; called by `useCategories` as rows load. */
export function setCustomCategories(rows: readonly CustomCategory[]): void {
  customRows = rows;
  merged = mergeCategories(rows);
}

/** Every category, built-in then custom. */
export function allCategories(): CategoryEntry[] {
  return merged;
}

/** Every main category name, once even when it exists under both types. */
export function allMainCategories(): string[] {
  return [...new Set(merged.map((entry) => entry.category))];
}

/** The subcategories of every main category with this name (the union across types). */
export function subCategoriesByName(category: string): string[] {
  return [
    ...new Set(
      merged.filter((entry) => entry.category === category).flatMap((entry) => entry.subcategories),
    ),
  ];
}

/** The subcategories of the main category with this name and type. */
export function subCategoriesFor(category: string, type: CategoryType): string[] {
  return merged.find((entry) => entry.category === category && entry.type === type)?.subcategories ?? [];
}

/** Whether a main category with this name exists with this type. */
export function isCategoryOfType(category: string, type: CategoryType): boolean {
  return merged.some((entry) => entry.category === category && entry.type === type);
}

/** The Lucide component name chosen for a custom main category, if any. */
export function customIconName(category: string): string | undefined {
  return customRows.find((row) => row.parent_category === null && row.name === category)?.icon ?? undefined;
}
