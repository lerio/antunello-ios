/**
 * Category to SF Symbol names.
 *
 * Replaces the web app's Lucide icon components.
 *
 * Every name is typed as `SFSymbol`, which is a literal union of real SF Symbol
 * names rather than `string`. That matters more than it sounds: an unrecognised
 * SF Symbol renders as *nothing* rather than erroring, so without the type a
 * typo would silently produce a blank icon. Here it fails the build instead.
 *
 * Note the web app has **two** category icon maps that disagree —
 * `utils/categories.tsx` is the one actually in use, while
 * `types/category-icons.ts` is a stale near-duplicate that its category dropdown
 * still imports, so the dropdown shows different icons from the list. This map
 * follows the live one, settling the inconsistency for this app.
 */

import type { SFSymbol } from 'expo-symbols';

/** Used when a category has no mapping, mirroring the web app's fallback. */
const FALLBACK: SFSymbol = 'wrench.and.screwdriver';

const CATEGORY_SYMBOLS: Record<string, SFSymbol> = {
  'Money Transfer': 'arrow.left.arrow.right',
  'Bank Movements': 'creditcard',
  Dining: 'fork.knife',
  Education: 'graduationcap',
  Entertainment: 'film',
  Fitness: 'figure.run',
  'Gifts and Donations': 'gift',
  'Government Benefits': 'building.columns',
  Groceries: 'cart',
  Health: 'cross.case',
  Housing: 'house',
  Insurance: 'shield',
  'Other Income': 'star',
  'Personal Care': 'scissors',
  'Primary Income': 'briefcase',
  Services: 'wrench.and.screwdriver',
  Shopping: 'bag',
  'Taxes and Fines': 'doc.text',
  Transportation: 'tram',
  Travel: 'airplane',
};

/**
 * The SF Symbol for a category.
 *
 * @param category A main category name.
 * @returns A symbol name, falling back to the Services symbol.
 */
export function symbolForCategory(category: string): SFSymbol {
  return CATEGORY_SYMBOLS[category] ?? FALLBACK;
}

/**
 * The SF Symbol for a money movement.
 *
 * Transfers are a pseudo-category rather than a real one, so they are kept out
 * of the category map — the web app gives them their own icon for the same
 * reason.
 */
export const TRANSFER_SYMBOL: SFSymbol = 'arrow.left.arrow.right';
