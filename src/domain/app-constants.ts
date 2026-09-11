/**
 * @vendored-from antunello-app:constants/app-constants.ts
 * @upstream-sha256 1290ecebb90bb17e8efbc3ef0f68de3d38bc8990ee86ba745a8611de1e27259f
 * @vendored-on 2026-09-10
 * @parity exact
 * @divergences none
 *
 * DO NOT EDIT THIS COPY IN ISOLATION.
 *
 * This file is vendored verbatim from the web app. The hash above is of the
 * upstream file after alias rewriting; it must equal the hash of everything
 * below this header. If you change the web implementation, re-run
 * `npm run vendor` and follow PARITY.md.
 */
/**
 * @file Application-wide constants for currency configuration. Defines
 * the set of currencies used for transactions and fund management,
 * their display labels and symbols, and a helper to resolve a symbol
 * from a currency code.
 */

/**
 * Currency options for transaction forms.
 * Each entry includes a code, display label, and currency symbol.
 */
export const CURRENCY_OPTIONS = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "JPY", label: "JPY", symbol: "¥" },
] as const;

/** A single currency option as defined in {@link CURRENCY_OPTIONS}. */
export type CurrencyOption = (typeof CURRENCY_OPTIONS)[number];

/**
 * Full list of supported currencies for fund management.
 */
export const CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "JPY",
  "CHF",
  "CAD",
  "AUD",
  "CNY",
] as const;

/** A supported currency code as defined in {@link CURRENCIES}. */
export type Currency = (typeof CURRENCIES)[number];

/**
 * Helper to get currency symbol from currency code.
 *
 * @param currency - A three-letter currency code (e.g. `"USD"`).
 * @returns The currency symbol string (e.g. `"$"`). Defaults to `"€"`
 *          when the code is not found.
 */
export function getCurrencySymbol(currency: string): string {
  const option = CURRENCY_OPTIONS.find((c) => c.value === currency);
  return option?.symbol || "€";
}
