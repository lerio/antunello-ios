/**
 * @vendored-from antunello-app:utils/currency-amount-input.ts
 * @upstream-sha256 3e4fd41566bbe697e132a2c8ee9ce1a960bfec8b7c4c7227a231691ae4c265c9
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
 * Currency amount input utilities for handling user input in currency fields.
 *
 * Provides functions for normalizing, formatting, and determining the number of
 * fraction digits for a given currency, ensuring proper handling of decimal and
 * thousand separators during user input.
 *
 * @module utils/currency-amount-input
 */

/**
 * Returns the number of fraction (decimal) digits for a given currency code.
 * Uses `Intl.NumberFormat` to determine the locale-specific fraction digits
 * for the currency. Falls back to 2 if the currency is unknown or invalid.
 *
 * @param currency - Three-letter ISO 4217 currency code (e.g. "EUR", "USD", "JPY")
 * @returns The maximum number of fraction digits for the currency
 */
export function getCurrencyFractionDigits(currency: string): number {
  try {
    const options = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).resolvedOptions()
    return options.maximumFractionDigits ?? 2
  } catch {
    return 2
  }
}

/**
 * Normalizes a raw user input string by removing invalid characters, converting
 * comma decimal separators to dots, and limiting the number of decimal digits
 * to the currency's maximum fraction digits.
 *
 * @param value - The raw input string to normalize
 * @param currency - Three-letter ISO 4217 currency code for determining decimal precision
 * @returns The normalized amount string suitable for parsing
 */
export function normalizeAmountForCurrencyInput(value: string, currency: string): string {
  const maxFractionDigits = getCurrencyFractionDigits(currency)
  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '')

  const firstDot = normalized.indexOf('.')
  if (firstDot === -1) {
    return normalized
  }

  const integerPart = normalized.slice(0, firstDot)
  const decimalsRaw = normalized.slice(firstDot + 1).replace(/\./g, '')

  if (maxFractionDigits <= 0) {
    return integerPart
  }

  return `${integerPart}.${decimalsRaw.slice(0, maxFractionDigits)}`
}

/**
 * Formats a normalized amount string for display in an input field.
 * Parses the value as a number and formats it with the appropriate number
 * of decimal places for the given currency, without grouping separators.
 *
 * @param value - The normalized amount string to format
 * @param currency - Three-letter ISO 4217 currency code for formatting
 * @returns The formatted amount string, or an empty string if the input is empty
 */
export function formatAmountForCurrencyInput(value: string, currency: string): string {
  const normalized = normalizeAmountForCurrencyInput(value, currency)
  if (!normalized) return ''

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return normalized

  const maxFractionDigits = getCurrencyFractionDigits(currency)
  return parsed.toLocaleString('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFractionDigits,
  })
}
