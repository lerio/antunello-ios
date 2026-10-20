/**
 * @vendored-from antunello-app:constants/app-constants.ts
 * @upstream-sha256 bfab7e4e58b1d740703fe3c10e5f113b2409c11f208fc68afaa6669a8ef4d5b7
 * @vendored-on 2026-10-19
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

