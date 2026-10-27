/**
 * The filter's criteria and the rules that keep them consistent.
 *
 * The filter is a graph rather than a set of independent controls: picking a
 * type narrows which categories are offered, picking a category narrows which
 * subcategories are offered, and clearing the year clears the month. The web app
 * spreads those rules across four `handleXChange` callbacks in
 * `filter-controls.tsx`, each of which re-derives the ones it depends on. Here
 * they live in one reducer, so a new interaction cannot forget a rule — which is
 * exactly how the web app's rules would drift if it grew a fifth control.
 *
 * Pure and dependency-free apart from the category tables, so the pruning can be
 * tested without rendering anything.
 */

import { CATEGORIES_WITH_TYPES, SUB_CATEGORIES } from '@/domain/types';

/** The three things a transaction can be, from the filter's point of view. */
export type FilterType = 'income' | 'expense' | 'movement';

export type FilterCriteria = {
  /** Matched types; empty means no type constraint. */
  types: FilterType[];
  /** Main category names; empty means no category constraint. */
  mainCategories: string[];
  /** Subcategories as `"Main::Sub"`; empty means no subcategory constraint. */
  subCategories: string[];
  /** Fund ids; matches a transaction's own fund or a transfer's target fund. */
  fundSourceIds: string[];
  /** Inclusive lower bound on the face amount, in the transaction's currency. */
  amountMin: number | null;
  /** Inclusive upper bound on the face amount. */
  amountMax: number | null;
  /** ISO currency codes; empty means every currency. */
  currencies: string[];
  /** Month, 1-12, or null for the whole year. */
  month: number | null;
  /** Year, or null for all time. */
  year: number | null;
};

export const initialFilterCriteria: FilterCriteria = {
  types: [],
  mainCategories: [],
  subCategories: [],
  fundSourceIds: [],
  amountMin: null,
  amountMax: null,
  currencies: [],
  month: null,
  year: null,
};

export type FilterAction =
  | { type: 'toggleType'; value: FilterType }
  | { type: 'toggleMainCategory'; value: string }
  | { type: 'toggleSubCategory'; value: string }
  | { type: 'toggleCurrency'; value: string }
  | { type: 'toggleFund'; value: string }
  | { type: 'setAmountRange'; min: number | null; max: number | null }
  | { type: 'setYear'; year: number | null }
  | { type: 'setMonth'; month: number | null }
  | { type: 'reset' };

/**
 * Adds a value to a selection, or removes it if already present.
 *
 * @param values The current selection.
 * @param value The value to toggle.
 * @returns A new selection.
 */
export function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

/** The main part of a `"Main::Sub"` entry. */
export function parentOfSubCategory(subCategory: string): string {
  return subCategory.split('::')[0] ?? '';
}

/** The display part of a `"Main::Sub"` entry. */
export function labelOfSubCategory(subCategory: string): string {
  return subCategory.split('::')[1] ?? subCategory;
}

/**
 * The categories the user may choose from, given the selected types.
 *
 * With no type selected — or with only "movement" — every category is offered,
 * because nothing has been excluded. Selecting income and/or expense narrows the
 * list to those categories whose own type is among them.
 *
 * @param types The selected types.
 * @returns The chooseable categories, in the domain table's order.
 */
export function selectableCategories(types: readonly FilterType[]) {
  const hasIncomeOrExpense = types.includes('income') || types.includes('expense');

  if (!hasIncomeOrExpense || types.length === 0) return CATEGORIES_WITH_TYPES;

  return CATEGORIES_WITH_TYPES.filter((category) => types.includes(category.type));
}

export type SubCategoryOption = { value: string; label: string; group: string };

/**
 * The subcategories the user may choose from, given the types and categories
 * selected.
 *
 * With no main category selected, every subcategory of every selectable category
 * is offered. Once a main category is selected, only its subcategories are —
 * except that a category invalidated by the type filter contributes nothing.
 *
 * @param criteria The current criteria.
 * @returns The chooseable subcategories, in the domain table's order.
 */
export function selectableSubCategories(criteria: FilterCriteria): SubCategoryOption[] {
  const validCategories = selectableCategories(criteria.types).map(
    (category) => category.category,
  );

  if (criteria.mainCategories.length === 0) {
    return selectableCategories(criteria.types).flatMap((category) =>
      category.subcategories.map((sub) => ({
        value: `${category.category}::${sub}`,
        label: sub,
        group: category.category,
      })),
    );
  }

  return criteria.mainCategories
    .filter((main) => validCategories.includes(main))
    .flatMap((main) =>
      (SUB_CATEGORIES[main] ?? []).map((sub) => ({
        value: `${main}::${sub}`,
        label: sub,
        group: main,
      })),
    );
}

/**
 * The filter reducer.
 *
 * Every branch that narrows the type or category selection also drops whatever
 * has become unreachable, so the criteria can never describe a combination the
 * controls would refuse to build.
 *
 * @param state The current criteria.
 * @param action The change to apply.
 * @returns The next criteria.
 */
export function filterReducer(state: FilterCriteria, action: FilterAction): FilterCriteria {
  switch (action.type) {
    case 'toggleType': {
      const types = toggleValue(state.types, action.value);

      // With neither income nor expense selected, nothing is excluded by type,
      // so the category selections stay valid and are kept.
      const hasIncomeOrExpense = types.includes('income') || types.includes('expense');
      if (!hasIncomeOrExpense || types.length === 0) return { ...state, types };

      const allowed = selectableCategories(types).map((category) => category.category);
      const mainCategories = state.mainCategories.filter((main) => allowed.includes(main));

      return {
        ...state,
        types,
        mainCategories,
        // A subcategory is only meaningful alongside its selected parent; with
        // no parent left, the selector disappears and its values must go too.
        subCategories:
          mainCategories.length === 0
            ? []
            : state.subCategories.filter((sub) =>
                mainCategories.includes(parentOfSubCategory(sub)),
              ),
      };
    }

    case 'toggleMainCategory': {
      const mainCategories = toggleValue(state.mainCategories, action.value);

      return {
        ...state,
        mainCategories,
        subCategories:
          mainCategories.length === 0
            ? []
            : state.subCategories.filter((sub) =>
                mainCategories.includes(parentOfSubCategory(sub)),
              ),
      };
    }

    case 'toggleSubCategory':
      return { ...state, subCategories: toggleValue(state.subCategories, action.value) };

    case 'toggleCurrency':
      return {
        ...state,
        currencies: toggleValue(state.currencies, action.value),
        // The amount range only exists for a single currency; a stale bound
        // must not survive a selection that hides it.
        amountMin: null,
        amountMax: null,
      };

    case 'toggleFund':
      return { ...state, fundSourceIds: toggleValue(state.fundSourceIds, action.value) };

    case 'setAmountRange':
      return { ...state, amountMin: action.min, amountMax: action.max };

    case 'setYear':
      // A month without a year is meaningless, and the month control is disabled
      // while the year is unset — so clearing the year clears the month with it.
      return action.year === null
        ? { ...state, year: null, month: null }
        : { ...state, year: action.year };

    case 'setMonth':
      return { ...state, month: action.month };

    case 'reset':
      return initialFilterCriteria;
  }
}

/**
 * Whether anything is actually being filtered.
 *
 * Drives the "adjust filters to see transactions" prompt: with nothing set, the
 * results list would otherwise be every transaction ever recorded, which is not
 * what an untouched filter screen should be showing.
 *
 * @param criteria The current criteria.
 * @returns True if at least one filter is active.
 */
export function hasAnyFilter(criteria: FilterCriteria): boolean {
  return (
    criteria.types.length > 0 ||
    criteria.mainCategories.length > 0 ||
    criteria.subCategories.length > 0 ||
    criteria.fundSourceIds.length > 0 ||
    criteria.currencies.length > 0 ||
    criteria.amountMin !== null ||
    criteria.amountMax !== null ||
    criteria.month !== null ||
    criteria.year !== null
  );
}

/** Whether the period filter is unbounded, which is when dates need a year. */
export function isAllTime(criteria: FilterCriteria): boolean {
  return criteria.month === null && criteria.year === null;
}

/**
 * A stable identity for a set of criteria, for use as a query key.
 *
 * Selections are sorted so that choosing the same categories in a different
 * order reuses the cache entry rather than refetching the same rows under a new
 * key.
 *
 * @param criteria The criteria to key.
 * @returns A string that changes exactly when the criteria do.
 */
export function criteriaHash(criteria: FilterCriteria): string {
  return JSON.stringify([
    [...criteria.types].sort(),
    [...criteria.mainCategories].sort(),
    [...criteria.subCategories].sort(),
    [...criteria.fundSourceIds].sort(),
    criteria.amountMin,
    criteria.amountMax,
    [...criteria.currencies].sort(),
    criteria.month,
    criteria.year,
  ]);
}
