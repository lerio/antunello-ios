/**
 * @vendored-from antunello-app:utils/currency.ts
 * @upstream-sha256 8806e3ca12f04f2527542cb4fa56da61b390e0d5b1b439075ef2aacaf59603f9
 * @vendored-on 2026-10-20
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
 * Currency formatting utilities.
 *
 * Provides locale-aware currency formatting using `Intl.NumberFormat`.
 * Supports EUR, USD, and JPY with predefined locale configurations,
 * falling back to EUR formatting for unknown currencies.
 *
 * @module utils/currency
 */

type CurrencyConfig = {
  locale: string
  currency: string
}

const CURRENCY_FORMATS: Record<string, CurrencyConfig> = {
  // German rather than Italian CLDR data: both render `1.234,56 €`, but Italian
  // sets minimumGroupingDigits=2 and leaves 5448,96 ungrouped. German groups it.
  EUR: { locale: 'de-DE', currency: 'EUR' },
  USD: { locale: 'en-US', currency: 'USD' },
  JPY: { locale: 'ja-JP', currency: 'JPY' },
}

/**
 * Formats a numeric amount into a locale-aware currency string.
 * Uses currency-specific locales (e.g., EUR uses "." as thousands separator and
 * "," for decimals). JPY is formatted with 0 decimal places;
 * all other currencies use 2 decimal places.
 *
 * @param amount - The numeric amount to format
 * @param currency - Three-letter ISO 4217 currency code (defaults to EUR if unknown)
 * @returns The formatted currency string including the currency symbol
 */
export function formatCurrency(amount: number, currency: string): string {
  const config = CURRENCY_FORMATS[currency] || CURRENCY_FORMATS.EUR

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: currency === 'JPY' ? 0 : 2,
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(amount)
}
