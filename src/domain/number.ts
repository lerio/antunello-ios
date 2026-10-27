/**
 * @vendored-from antunello-app:utils/number.ts
 * @upstream-sha256 5aacc083a450286284f9c64ae4c26966defad8b7b4e10cc325ffa9b46d4dcd69
 * @vendored-on 2026-10-27
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
 * Number parsing and validation utilities.
 *
 * Provides functions for handling number strings with flexible decimal
 * separator support (both comma and dot), converting them to JavaScript
 * numbers, and validating that they represent positive numeric values.
 *
 * @module utils/number
 */

/**
 * Normalizes decimal separators in number strings by converting commas to dots.
 * This allows proper JavaScript number parsing from inputs that may use
 * either decimal separator convention.
 *
 * @param value - The input string to normalize (e.g. "1,50" or "1.50")
 * @returns The normalized string with commas replaced by dots (e.g. "1.50")
 */
function normalizeDecimalSeparator(value: string): string {
  return value.replace(/,/g, '.');
}

/**
 * Parses a number string with proper decimal separator handling.
 * Supports both comma and dot as decimal separators.
 *
 * @param value - The string to parse (e.g. "123,45" or "123.45")
 * @returns The parsed numeric value
 */
export function parseNumber(value: string): number {
  const normalized = normalizeDecimalSeparator(value);
  return Number(normalized);
}

/**
 * Validates if a string represents a valid positive number.
 * Handles both comma and dot decimal separators. Returns false for
 * empty strings, non-numeric strings, and zero or negative values.
 *
 * @param value - The string to validate
 * @returns True if the string represents a positive number greater than 0
 */
export function isValidPositiveNumber(value: string): boolean {
  if (!value || value.trim() === '') return false;

  const normalized = normalizeDecimalSeparator(value);
  const num = Number(normalized);

  return !Number.isNaN(num) && num > 0;
}
