/**
 * Runtime guards for capabilities the app assumes but cannot verify at build
 * time, because they depend on the JavaScript engine actually running on the
 * device rather than on the bundler or the test environment.
 *
 * These are cheap, run once at startup in development, and exist to turn a
 * silent data-corruption bug into a loud, immediate error.
 */

import { getCurrencyFractionDigits } from '../domain/currency-amount-input';

/** Currency -> expected fraction digits, for the currencies the app supports. */
const EXPECTED_FRACTION_DIGITS: Record<string, number> = {
  EUR: 2,
  USD: 2,
  GBP: 2,
  JPY: 0,
  CHF: 2,
  CAD: 2,
  AUD: 2,
  CNY: 2,
};

/**
 * Asserts that `Intl` behaves as the split engine requires.
 *
 * Why this matters: `split-transactions.ts` asks `getCurrencyFractionDigits`
 * for the decimal precision of a transaction's currency, then rounds each of
 * the twelve monthly slices in minor units. Hermes ships a less complete `Intl`
 * than V8. If it reports 2 digits for JPY, yen are treated as having cents and
 * every JPY split is wrong by a factor of 100 — and the twelve slices will no
 * longer sum to the source amount.
 *
 * That failure is invisible on a correctly-behaving engine, so it would only
 * ever surface as wrong money on the device. Hence this explicit check.
 *
 * @throws {Error} If `Intl` disagrees with the expected table.
 */
export function assertIntlSupport(): void {
  const wrong: string[] = [];

  for (const [currency, expected] of Object.entries(EXPECTED_FRACTION_DIGITS)) {
    let actual: number;
    try {
      actual = getCurrencyFractionDigits(currency);
    } catch (error) {
      throw new Error(
        `Intl is unavailable for currency formatting (${currency}): ${
          error instanceof Error ? error.message : String(error)
        }. Split amounts cannot be computed safely.`,
      );
    }
    if (actual !== expected) {
      wrong.push(`${currency}: expected ${expected}, got ${actual}`);
    }
  }

  if (wrong.length > 0) {
    throw new Error(
      `Intl reports unexpected fraction digits, which would corrupt split ` +
        `rounding:\n  ${wrong.join('\n  ')}\n` +
        `Replace the Intl call in src/domain/currency-amount-input.ts with a ` +
        `static currency table and re-vendor as an 'adapted' divergence.`,
    );
  }
}

/**
 * Runs every runtime guard, logging a single summary line in development.
 *
 * Call once from the root layout, before rendering anything that formats money.
 */
export function runRuntimeChecks(): void {
  assertIntlSupport();
  if (__DEV__) {
    console.log('[runtime-check] Intl currency precision verified');
  }
}
